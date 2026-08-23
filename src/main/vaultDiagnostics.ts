import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { Dirent } from 'node:fs'
import { assertSafeRelativePath, normalizeRelativePath } from '../shared/pathSafety'
import type { VaultDiagnosticIssue, VaultDiagnosticsReport } from '../shared/types'

/**
 * These are the portable-transfer defaults.  They intentionally describe
 * rebuildable or device-scoped data, rather than every path that may exist in
 * a vault.  User content, structured records, and attachments remain in the
 * transfer set.
 */
export const DEFAULT_PORTABLE_EXCLUDES = Object.freeze([
  'index.sqlite',
  'filemap.json',
  'settings.json',
  'manifest.json',
  'credentials.json',
  '.env',
  '.env.*',
  '.sync',
  'resources/locators.json',
  '.tmp-*'
])

export interface VaultScannedFile {
  path: string
  absolutePath: string
  size: number
  checksum: string
}

export interface VaultFileScanOptions {
  /** Additional exact paths or simple glob rules to exclude. */
  exclude?: readonly string[]
  /** Explicit relative paths to exclude, useful for a backup staging path. */
  excludedPaths?: readonly string[]
  /** Indexes are rebuildable and excluded by default. */
  includeIndexes?: boolean
  /** Credentials are device-scoped and excluded by default. */
  includeCredentials?: boolean
  /** Transient synchronization/staging files stay excluded by default. */
  includeTransient?: boolean
  /** Fail a portable scan instead of silently omitting symbolic links. */
  rejectSymlinks?: boolean
}

interface VaultTreeFile {
  relPath: string
  absolutePath: string
  size: number
}

interface VaultTreeResult {
  files: VaultTreeFile[]
  symlinks: string[]
  errors: Array<{ path: string; message: string }>
}

const LEGACY_PATHS = [
  'notes',
  '.appmeta',
  'projects.json',
  'project-icons.json',
  'projects/index.json',
  'calendar/tasks.json',
  'tasks.json',
  'weekly-plan.json',
  'subscriptions.json',
  'schedule-jobs.json',
  'schedule-runs.json',
  'agent-chats.json',
  'agent-runs.json',
  'excalidraw-sessions.json'
] as const

const LEGACY_SYSTEM_FILES = [
  '.appmeta/vault.json',
  '.appmeta/filemap.json',
  '.appmeta/index.sqlite'
] as const

const SENSITIVE_BASENAMES = new Set([
  'credentials.json',
  'credential.json',
  'secrets.json',
  'secret.json',
  'tokens.json',
  'token.json',
  'settings.json',
  'manifest.json',
  '.env',
  '.env.local',
  '.env.production',
  '.env.development'
])

const SENSITIVE_EXTENSIONS = new Set(['.key', '.pem', '.p12', '.pfx'])

/** Return true for device/account credentials that must never be portable. */
export function isSensitiveVaultPath(relPathInput: string): boolean {
  const relPath = normalizeRelativePath(relPathInput).toLowerCase()
  if (relPath === 'resources/locators.json') {
    return true
  }
  const segments = relPath.split('/')
  const basename = segments[segments.length - 1] ?? ''

  if (segments.some((segment) => segment === 'credentials' || segment === 'secrets')) {
    return true
  }
  if (SENSITIVE_BASENAMES.has(basename)) {
    return true
  }
  if (basename.startsWith('.env.')) {
    return true
  }
  return [...SENSITIVE_EXTENSIONS].some((extension) => basename.endsWith(extension))
}

/** Return true for indexes and file maps that can be rebuilt from vault data. */
export function isVaultIndexPath(relPathInput: string): boolean {
  const relPath = normalizeRelativePath(relPathInput).toLowerCase()
  const basename = path.posix.basename(relPath)
  return (
    basename === 'index.sqlite' ||
    basename.startsWith('index.sqlite-') ||
    basename === 'filemap.json' ||
    basename === 'index.db' ||
    basename === 'index.sqlite-shm' ||
    basename === 'index.sqlite-wal'
  )
}

/** Return true for staging/synchronization artifacts rather than user data. */
export function isTransientVaultPath(relPathInput: string): boolean {
  const relPath = normalizeRelativePath(relPathInput)
  const segments = relPath.split('/')
  const basename = segments[segments.length - 1] ?? ''
  return (
    segments.includes('.sync') ||
    segments.includes('.vault-transfer') ||
    basename.endsWith('.tmp') ||
    basename.includes('.tmp-') ||
    basename.startsWith('.tmp-')
  )
}

export function isPortableVaultPath(relPathInput: string): boolean {
  if (
    typeof relPathInput !== 'string' ||
    relPathInput.includes('\\') ||
    relPathInput.startsWith('/') ||
    /^[a-zA-Z]:[\\/]/.test(relPathInput)
  ) {
    return false
  }
  try {
    if (assertSafeRelativePath(relPathInput) !== relPathInput) {
      return false
    }
  } catch {
    return false
  }
  return (
    !isSensitiveVaultPath(relPathInput) &&
    !isVaultIndexPath(relPathInput) &&
    !isTransientVaultPath(relPathInput)
  )
}

/** Alias used by sync callers that need the same safety boundary as exports. */
export const isSyncableVaultPath = isPortableVaultPath

export function getPortableExclusionReason(
  relPathInput: string,
  options: VaultFileScanOptions = {}
): string | null {
  const relPath = normalizeRelativePath(relPathInput)
  const normalizedExcludedPaths = new Set(
    (options.excludedPaths ?? []).map((value) => normalizeRelativePath(value))
  )

  if (normalizedExcludedPaths.has(relPath)) {
    return 'explicitly excluded'
  }
  if (!options.includeCredentials && isSensitiveVaultPath(relPath)) {
    return 'credential or secret material'
  }
  if (!options.includeIndexes && isVaultIndexPath(relPath)) {
    return 'rebuildable index metadata'
  }
  if (!options.includeTransient && isTransientVaultPath(relPath)) {
    return 'temporary or synchronization artifact'
  }

  const matchedRule = (options.exclude ?? DEFAULT_PORTABLE_EXCLUDES).find((rule) => {
    if (options.includeCredentials && isSensitiveVaultPath(relPath) && isCredentialRule(rule)) {
      return false
    }
    if (options.includeIndexes && isVaultIndexPath(relPath) && isIndexRule(rule)) {
      return false
    }
    if (options.includeTransient && isTransientVaultPath(relPath) && isTransientRule(rule)) {
      return false
    }
    return matchesPathRule(relPath, rule)
  })
  return matchedRule ? `excluded by ${ruleLabel(matchedRule)}` : null
}

/**
 * Scan a vault without following symbolic links.  The returned paths are
 * normalized POSIX relative paths and sorted, making manifests portable and
 * deterministic across operating systems.
 */
export async function scanVaultFiles(
  rootPath: string,
  options: VaultFileScanOptions = {}
): Promise<VaultScannedFile[]> {
  const root = await assertDirectory(rootPath)
  const tree = await walkVaultTree(root)
  if (options.rejectSymlinks && tree.symlinks.length > 0) {
    throw new Error(`Vault scan rejected symbolic links: ${tree.symlinks.sort().join(', ')}`)
  }
  if (tree.errors.length > 0) {
    const firstError = tree.errors[0]
    throw new Error(`Unable to scan vault file ${firstError.path}: ${firstError.message}`)
  }

  const files: VaultScannedFile[] = []
  for (const entry of tree.files) {
    if (getPortableExclusionReason(entry.relPath, options)) {
      continue
    }
    files.push({
      path: entry.relPath,
      absolutePath: entry.absolutePath,
      size: entry.size,
      checksum: await checksumFile(entry.absolutePath)
    })
  }

  return files.sort((left, right) => left.path.localeCompare(right.path))
}

export async function checksumFile(filePath: string): Promise<string> {
  const content = await fs.readFile(filePath)
  return createHash('sha256').update(content).digest('hex')
}

export function checksumManifestFiles(
  files: ReadonlyArray<Pick<VaultScannedFile, 'path' | 'size' | 'checksum'>>
): string {
  const canonical = files
    .map(({ path: relPath, size, checksum }) => ({
      path: normalizeRelativePath(relPath),
      size,
      checksum
    }))
    .sort((left, right) => left.path.localeCompare(right.path))
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex')
}

export async function readVaultSchemaVersion(rootPath: string): Promise<number> {
  const root = path.resolve(rootPath)
  const migrations = await readJsonObject(path.join(root, 'migrations.json'))
  if (typeof migrations?.version === 'number' && Number.isInteger(migrations.version)) {
    return migrations.version
  }

  const vault = await readJsonObject(path.join(root, 'vault.json'))
  if (typeof vault?.version === 'number' && Number.isInteger(vault.version)) {
    return vault.version
  }
  return 1
}

/** Build the safe, user-visible integrity report described by VAULT-001. */
export async function collectVaultDiagnostics(rootPath: string): Promise<VaultDiagnosticsReport> {
  const root = await assertDirectory(rootPath)
  const tree = await walkVaultTree(root)
  const issues: VaultDiagnosticIssue[] = []
  const legacyPaths = await findExistingRelativePaths(root, LEGACY_PATHS)
  const legacySystemFiles = await findExistingRelativePaths(root, LEGACY_SYSTEM_FILES)

  const schemaVersionResult = await readSchemaVersionWithIssue(root)
  if (schemaVersionResult.issue) {
    issues.push(schemaVersionResult.issue)
  }

  for (const symlink of tree.symlinks.sort()) {
    issues.push({
      severity: 'warning',
      code: 'symlink-skipped',
      path: symlink,
      message: 'Symbolic link was skipped to prevent a vault boundary escape.',
      recoverable: true
    })
  }
  for (const error of tree.errors.sort((left, right) => left.path.localeCompare(right.path))) {
    issues.push({
      severity: 'error',
      code: 'unreadable-file',
      path: error.path,
      message: error.message,
      recoverable: true
    })
  }

  const checksums: Record<string, string> = {}
  const recordCounts: Record<string, number> = {
    files: 0,
    notes: 0,
    attachments: 0,
    resources: 0,
    structured: 0,
    other: 0
  }
  const orphanedPaths = new Set<string>()

  for (const entry of tree.files.sort((left, right) => left.relPath.localeCompare(right.relPath))) {
    const exclusionReason = getPortableExclusionReason(entry.relPath)
    if (!exclusionReason) {
      recordCounts.files += 1
      incrementDomainCount(recordCounts, entry.relPath)
      try {
        checksums[entry.relPath] = await checksumFile(entry.absolutePath)
      } catch (error) {
        issues.push({
          severity: 'error',
          code: 'checksum-failed',
          path: entry.relPath,
          message: describeError(error),
          recoverable: true
        })
      }
    }

    if (isLegacyRelativePath(entry.relPath)) {
      issues.push({
        severity: 'warning',
        code: 'legacy-path',
        path: entry.relPath,
        message: 'This path is from a legacy vault layout and should be migrated.',
        recoverable: true
      })
    }

    if (isTransientVaultPath(entry.relPath)) {
      orphanedPaths.add(entry.relPath)
      issues.push({
        severity: 'warning',
        code: 'stale-artifact',
        path: entry.relPath,
        message: 'A temporary or synchronization artifact was found in the vault.',
        recoverable: true
      })
    }

    if (entry.relPath.endsWith('.bak')) {
      const primaryPath = entry.relPath.slice(0, -'.bak'.length)
      if (!tree.files.some((candidate) => candidate.relPath === primaryPath)) {
        orphanedPaths.add(entry.relPath)
        issues.push({
          severity: 'warning',
          code: 'orphaned-backup',
          path: entry.relPath,
          message: 'A backup file has no corresponding primary file.',
          recoverable: true
        })
      }
    }

    if (isMalformedJsonCandidate(entry.relPath) && !isSensitiveVaultPath(entry.relPath)) {
      try {
        const raw = await fs.readFile(entry.absolutePath, 'utf-8')
        JSON.parse(raw)
      } catch (error) {
        issues.push({
          severity: 'error',
          code: 'malformed-structured-file',
          path: entry.relPath,
          message: `Structured file is not valid JSON: ${describeError(error)}`,
          recoverable: true
        })
      }
    }
  }

  if (legacyPaths.length > 0 || legacySystemFiles.length > 0) {
    issues.push({
      severity: 'warning',
      code: 'legacy-layout',
      message: 'Legacy vault paths are present and need migration review.',
      recoverable: true
    })
  }

  for (const duplicate of await findDuplicateSources(root)) {
    issues.push({
      severity: 'warning',
      code: 'duplicate-source',
      path: duplicate,
      message: 'Canonical and legacy storage locations both exist.',
      recoverable: true
    })
  }

  if (tree.files.some((entry) => isVaultIndexPath(entry.relPath))) {
    issues.push({
      severity: 'info',
      code: 'rebuildable-index',
      message: 'Index metadata is present but excluded from portable checksums.',
      recoverable: true
    })
  }

  return {
    generatedAt: new Date().toISOString(),
    schemaVersion: schemaVersionResult.version,
    vaultRoot: root,
    recordCounts,
    checksums: sortRecordMap(checksums),
    legacyPaths: [...legacyPaths, ...legacySystemFiles].sort(),
    orphanedPaths: [...orphanedPaths].sort(),
    issues: issues.sort(compareIssues)
  }
}

export const diagnoseVault = collectVaultDiagnostics
export const createVaultDiagnosticsReport = collectVaultDiagnostics
export const buildVaultDiagnosticsReport = collectVaultDiagnostics
export const createVaultDiagnostics = collectVaultDiagnostics
export const generateVaultDiagnostics = collectVaultDiagnostics
export const runVaultDiagnostics = collectVaultDiagnostics

async function walkVaultTree(root: string): Promise<VaultTreeResult> {
  const files: VaultTreeFile[] = []
  const symlinks: string[] = []
  const errors: Array<{ path: string; message: string }> = []

  async function visit(directory: string, relativeDirectory: string): Promise<void> {
    let entries: Dirent[]
    try {
      entries = await fs.readdir(directory, { withFileTypes: true })
    } catch (error) {
      errors.push({
        path: relativeDirectory || '.',
        message: describeError(error)
      })
      return
    }

    entries.sort((left, right) => left.name.localeCompare(right.name))
    for (const entry of entries) {
      const relPath = normalizeRelativePath(
        relativeDirectory ? path.posix.join(relativeDirectory, entry.name) : entry.name
      )
      const absolutePath = path.join(root, ...relPath.split('/'))

      if (entry.isSymbolicLink()) {
        symlinks.push(relPath)
        continue
      }
      if (entry.isDirectory()) {
        await visit(absolutePath, relPath)
        continue
      }
      if (!entry.isFile()) {
        continue
      }

      try {
        const stats = await fs.stat(absolutePath)
        files.push({ relPath, absolutePath, size: stats.size })
      } catch (error) {
        errors.push({ path: relPath, message: describeError(error) })
      }
    }
  }

  await visit(root, '')
  return { files, symlinks, errors }
}

async function assertDirectory(rootPath: string): Promise<string> {
  const root = path.resolve(rootPath)
  const stats = await fs.lstat(root)
  if (!stats.isDirectory()) {
    throw new Error(`Vault root is not a directory: ${root}`)
  }
  return root
}

function matchesPathRule(relPath: string, ruleInput: string): boolean {
  const rule = normalizeRelativePath(ruleInput).replace(/^\.\//, '')
  if (!rule || rule === '.') {
    return false
  }
  if (rule === relPath || rule === path.posix.basename(relPath)) {
    return true
  }
  if (rule.startsWith('**/')) {
    const suffix = rule.slice(3)
    return (
      matchesSimpleGlob(relPath, suffix) || matchesSimpleGlob(path.posix.basename(relPath), suffix)
    )
  }
  if (rule.endsWith('/**')) {
    const prefix = rule.slice(0, -3).replace(/\/$/, '')
    return relPath === prefix || relPath.startsWith(`${prefix}/`)
  }
  return matchesSimpleGlob(relPath, rule)
}

function matchesSimpleGlob(value: string, pattern: string): boolean {
  const expression = pattern
    .split('*')
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*')
  return new RegExp(`^${expression}$`).test(value)
}

function ruleLabel(rule: string): string {
  return rule.replace(/\*\*/g, 'any').replace(/\*/g, 'any')
}

function isLegacyRelativePath(relPath: string): boolean {
  return LEGACY_PATHS.some(
    (candidate) => relPath === candidate || relPath.startsWith(`${candidate}/`)
  )
}

function isMalformedJsonCandidate(relPath: string): boolean {
  return relPath.endsWith('.json') || relPath.endsWith('.excalidraw')
}

function incrementDomainCount(recordCounts: Record<string, number>, relPath: string): void {
  const firstSegment = relPath.split('/')[0]
  let domain = 'other'
  if (firstSegment === 'notebooks' || firstSegment === 'notes' || firstSegment === 'fleeting') {
    domain = 'notes'
  } else if (firstSegment === 'attachments') {
    domain = 'attachments'
  } else if (firstSegment === 'resources') {
    domain = 'resources'
  } else if (
    [
      'tasks',
      'calendar',
      'projects',
      'weekly-plan',
      'subscriptions',
      'schedules',
      'agent'
    ].includes(firstSegment) ||
    relPath.endsWith('.json')
  ) {
    domain = 'structured'
  }
  recordCounts[domain] = (recordCounts[domain] ?? 0) + 1
}

async function findExistingRelativePaths(
  root: string,
  candidates: readonly string[]
): Promise<string[]> {
  const existing: string[] = []
  for (const candidate of candidates) {
    try {
      await fs.lstat(path.join(root, ...candidate.split('/')))
      existing.push(candidate)
    } catch (error) {
      if (!isMissingPathError(error)) {
        existing.push(candidate)
      }
    }
  }
  return existing
}

async function findDuplicateSources(root: string): Promise<string[]> {
  const pairs: Array<[string, string, string]> = [
    ['notes', 'notebooks', 'notes/notebooks'],
    ['tasks.json', 'tasks', 'tasks.json/tasks'],
    ['calendar/tasks.json', 'tasks', 'calendar/tasks.json/tasks'],
    ['weekly-plan.json', 'weekly-plan', 'weekly-plan.json/weekly-plan'],
    ['subscriptions.json', 'subscriptions', 'subscriptions.json/subscriptions'],
    ['projects.json', 'projects', 'projects.json/projects']
  ]
  const duplicates: string[] = []
  for (const [legacy, canonical, label] of pairs) {
    if (
      (await pathExists(path.join(root, ...legacy.split('/')))) &&
      (await pathExists(path.join(root, ...canonical.split('/'))))
    ) {
      duplicates.push(label)
    }
  }
  return duplicates
}

async function readSchemaVersionWithIssue(
  root: string
): Promise<{ version: number; issue?: VaultDiagnosticIssue }> {
  const migrationsPath = path.join(root, 'migrations.json')
  const migrations = await readJsonObject(migrationsPath)
  if (migrations === null && (await pathExists(migrationsPath))) {
    return {
      version: 1,
      issue: {
        severity: 'error',
        code: 'malformed-migrations',
        path: 'migrations.json',
        message: 'Migration metadata is not valid JSON.',
        recoverable: true
      }
    }
  }
  if (typeof migrations?.version === 'number' && Number.isInteger(migrations.version)) {
    return { version: migrations.version }
  }

  const vaultPath = path.join(root, 'vault.json')
  const vault = await readJsonObject(vaultPath)
  if (vault === null && (await pathExists(vaultPath))) {
    return {
      version: 1,
      issue: {
        severity: 'error',
        code: 'malformed-vault-config',
        path: 'vault.json',
        message: 'Vault configuration is not valid JSON.',
        recoverable: true
      }
    }
  }
  if (typeof vault?.version === 'number' && Number.isInteger(vault.version)) {
    return { version: vault.version }
  }
  return { version: 1 }
}

async function readJsonObject(
  filePath: string
): Promise<Record<string, unknown> | null | undefined> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8')
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null
    }
    return parsed as Record<string, unknown>
  } catch (error) {
    if (isMissingPathError(error)) {
      return undefined
    }
    return null
  }
}

function sortRecordMap(input: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(input).sort(([left], [right]) => left.localeCompare(right))
  )
}

function compareIssues(left: VaultDiagnosticIssue, right: VaultDiagnosticIssue): number {
  return `${left.path ?? ''}:${left.code}`.localeCompare(`${right.path ?? ''}:${right.code}`)
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function isMissingPathError(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === 'ENOENT'
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.lstat(targetPath)
    return true
  } catch (error) {
    if (isMissingPathError(error)) {
      return false
    }
    throw error
  }
}

function isCredentialRule(ruleInput: string): boolean {
  const rule = ruleInput.toLowerCase()
  return (
    rule.includes('credential') ||
    rule.includes('secret') ||
    rule.includes('token') ||
    rule.includes('.env')
  )
}

function isIndexRule(ruleInput: string): boolean {
  const rule = ruleInput.toLowerCase()
  return rule.includes('index') || rule.includes('filemap')
}

function isTransientRule(ruleInput: string): boolean {
  const rule = ruleInput.toLowerCase()
  return rule.includes('.sync') || rule.includes('.tmp') || rule.includes('transfer')
}
