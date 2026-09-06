import { createHash, randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { writeFileAtomically } from './atomicFile'
import {
  checksumFile,
  DEFAULT_PORTABLE_EXCLUDES,
  getPortableExclusionReason,
  isSensitiveVaultPath,
  isVaultIndexPath,
  readVaultSchemaVersion,
  scanVaultFiles,
  type VaultFileScanOptions
} from './vaultDiagnostics'
import { assertSafeRelativePath, joinSafe, normalizeRelativePath } from '../shared/pathSafety'
import type { VaultBackupResult, VaultTransferManifest } from '../shared/types'
import { isPortableScopePath } from './vaultPortablePolicy'
import { ensureVaultManifest, normalizeVaultId, readVaultManifest } from './vaultManifest'

export const PORTABLE_MANIFEST_FILE_NAME = 'manifest.json'
export const PORTABLE_MANIFEST_VERSION = 1

export interface VaultTransferOptions extends VaultFileScanOptions {
  schemaVersion?: number
}

export interface VaultRestorePreviewEntry {
  path: string
  size: number
  checksum: string
  currentChecksum?: string
  action: 'create' | 'replace' | 'unchanged' | 'conflict' | 'unsafe' | 'missing'
}

export interface VaultRestorePreview {
  sourcePath: string
  destinationPath: string
  manifest: VaultTransferManifest
  manifestChecksum: string
  entries: VaultRestorePreviewEntry[]
  conflicts: string[]
  missingFiles: string[]
  unsafePaths: string[]
  canRestore: boolean
}

export interface VaultRestoreResult {
  path: string
  fileCount: number
  checksum: string
  restoredAt: string
}

export interface ManifestValidationResult {
  valid: boolean
  errors: string[]
  manifest?: VaultTransferManifest
}

/** Build a sorted manifest that never includes credentials or rebuildable indexes. */
export async function buildPortableManifest(
  rootPath: string,
  options: VaultTransferOptions = {}
): Promise<VaultTransferManifest> {
  const root = path.resolve(rootPath)
  const scannedFiles = await scanVaultFiles(root, {
    ...options,
    exclude: [...DEFAULT_PORTABLE_EXCLUDES, ...(options.exclude ?? [])],
    // Portable transfer is a hard privacy boundary.  The flags are accepted
    // by the shared scanner for diagnostics, but are not honored here.
    includeCredentials: false,
    includeIndexes: false,
    rejectSymlinks: true
  })
  const files = scannedFiles.filter((file) => isPortableScopePath(file.path))
  const vaultManifest = await readVaultManifest(root)
  const excludes = normalizeExclusionRules([
    ...DEFAULT_PORTABLE_EXCLUDES,
    ...(options.exclude ?? [])
  ])

  const manifest: VaultTransferManifest = {
    version: PORTABLE_MANIFEST_VERSION,
    createdAt: new Date().toISOString(),
    schemaVersion: options.schemaVersion ?? (await readVaultSchemaVersion(root)),
    ...(vaultManifest ? { vaultId: vaultManifest.vaultId } : {}),
    files: files.map(({ path: relPath, size, checksum }) => ({ path: relPath, size, checksum })),
    excludes
  }
  return normalizePortableManifest(manifest)
}

export const createPortableManifest = buildPortableManifest
export const createVaultTransferManifest = buildPortableManifest
export const buildVaultTransferManifest = buildPortableManifest

export function validatePortableManifest(input: unknown): ManifestValidationResult {
  try {
    return { valid: true, errors: [], manifest: normalizePortableManifest(input) }
  } catch (error) {
    return { valid: false, errors: [describeError(error)] }
  }
}

export function normalizePortableManifest(input: unknown): VaultTransferManifest {
  if (!isRecord(input)) {
    throw new Error('Portable manifest must be an object')
  }
  const allowedKeys = new Set([
    'version',
    'createdAt',
    'schemaVersion',
    'vaultId',
    'files',
    'excludes'
  ])
  const unknownKey = Object.keys(input).find((key) => !allowedKeys.has(key))
  if (unknownKey) {
    throw new Error(`Portable manifest contains an unknown field: ${unknownKey}`)
  }
  if (input.version !== PORTABLE_MANIFEST_VERSION) {
    throw new Error(`Unsupported portable manifest version: ${String(input.version)}`)
  }
  if (typeof input.createdAt !== 'string' || !Number.isFinite(Date.parse(input.createdAt))) {
    throw new Error('Portable manifest createdAt must be a valid ISO timestamp')
  }
  if (
    typeof input.schemaVersion !== 'number' ||
    !Number.isInteger(input.schemaVersion) ||
    input.schemaVersion < 1
  ) {
    throw new Error('Portable manifest schemaVersion must be a positive integer')
  }
  const vaultId = input.vaultId === undefined ? undefined : normalizeVaultId(input.vaultId)
  if (!Array.isArray(input.files)) {
    throw new Error('Portable manifest files must be an array')
  }
  if (!Array.isArray(input.excludes) || input.excludes.some((value) => typeof value !== 'string')) {
    throw new Error('Portable manifest excludes must be an array of strings')
  }

  const seen = new Set<string>()
  const files = input.files.map((value, index) => {
    if (!isRecord(value)) {
      throw new Error(`Portable manifest file ${index} must be an object`)
    }
    const relPath = normalizeManifestPath(value.path, `files[${index}].path`)
    if (seen.has(relPath)) {
      throw new Error(`Portable manifest contains duplicate path: ${relPath}`)
    }
    seen.add(relPath)
    if (isSensitiveVaultPath(relPath)) {
      throw new Error(`Portable manifest contains credential material: ${relPath}`)
    }
    if (isVaultIndexPath(relPath)) {
      throw new Error(`Portable manifest contains rebuildable index metadata: ${relPath}`)
    }
    if (getPortableExclusionReason(relPath)) {
      throw new Error(`Portable manifest contains excluded path: ${relPath}`)
    }
    if (typeof value.size !== 'number' || !Number.isSafeInteger(value.size) || value.size < 0) {
      throw new Error(`Portable manifest file ${relPath} has an invalid size`)
    }
    if (typeof value.checksum !== 'string' || !/^[a-f0-9]{64}$/i.test(value.checksum)) {
      throw new Error(`Portable manifest file ${relPath} has an invalid SHA-256 checksum`)
    }
    return {
      path: relPath,
      size: value.size,
      checksum: value.checksum.toLowerCase()
    }
  })

  return {
    version: PORTABLE_MANIFEST_VERSION,
    createdAt: input.createdAt,
    schemaVersion: input.schemaVersion,
    ...(vaultId ? { vaultId } : {}),
    files: files.sort((left, right) => left.path.localeCompare(right.path)),
    excludes: normalizeExclusionRules(input.excludes)
  }
}

export function checksumPortableManifest(manifest: VaultTransferManifest): string {
  const normalized = normalizePortableManifest(manifest)
  const canonical = {
    version: normalized.version,
    schemaVersion: normalized.schemaVersion,
    ...(normalized.vaultId ? { vaultId: normalized.vaultId } : {}),
    excludes: normalized.excludes,
    files: normalized.files
  }
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex')
}

export const checksumTransferManifest = checksumPortableManifest
export const checksumVaultManifest = checksumPortableManifest

export async function writePortableManifest(
  manifest: VaultTransferManifest,
  destinationPath: string
): Promise<string> {
  const normalized = normalizePortableManifest(manifest)
  const target = path.resolve(destinationPath)
  await fs.mkdir(path.dirname(target), { recursive: true })
  await writeFileAtomically(target, `${JSON.stringify(normalized, null, 2)}\n`)
  return target
}

export async function readPortableManifest(sourcePath: string): Promise<VaultTransferManifest> {
  const source = path.resolve(sourcePath)
  const stats = await fs.lstat(source)
  const manifestPath = stats.isDirectory() ? path.join(source, PORTABLE_MANIFEST_FILE_NAME) : source
  const manifestStats = await fs.lstat(manifestPath)
  if (!manifestStats.isFile() || manifestStats.isSymbolicLink()) {
    throw new Error('Portable manifest must be a regular file')
  }
  const raw = await fs.readFile(manifestPath, 'utf-8')
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    throw new Error(`Portable manifest is not valid JSON: ${describeError(error)}`)
  }
  return normalizePortableManifest(parsed)
}

/** Create a verified directory backup; no existing destination is overwritten. */
export async function createVaultBackup(
  rootPath: string,
  destinationPath?: string,
  options: VaultTransferOptions = {}
): Promise<VaultBackupResult> {
  const sourceRoot = path.resolve(rootPath)
  const destination = path.resolve(
    destinationPath ??
      path.join(sourceRoot, `.vault-backup-${Date.now()}-${randomUUID().slice(0, 8)}`)
  )
  if (sourceRoot === destination) {
    throw new Error('Backup destination must differ from the vault root')
  }

  const manifest = await buildPortableManifest(sourceRoot, options)
  const stagingPath = `${destination}.tmp-${process.pid}-${randomUUID()}`
  await fs.mkdir(path.dirname(destination), { recursive: true })
  await assertDestinationDoesNotExist(destination)
  await fs.mkdir(stagingPath, { recursive: true })

  try {
    await copyManifestFiles(sourceRoot, stagingPath, manifest, false)
    await writePortableManifest(manifest, path.join(stagingPath, PORTABLE_MANIFEST_FILE_NAME))
    await verifyManifestFiles(stagingPath, manifest)
    await fs.rename(stagingPath, destination)
  } catch (error) {
    await fs.rm(stagingPath, { recursive: true, force: true }).catch(() => undefined)
    throw error
  }

  return {
    path: destination,
    createdAt: manifest.createdAt,
    fileCount: manifest.files.length,
    checksum: checksumPortableManifest(manifest)
  }
}

export const backupVault = createVaultBackup
export const createBackup = createVaultBackup
export const exportVault = createVaultBackup
export const exportPortableVault = createVaultBackup

/** Preview a restore without creating directories or changing destination files. */
export async function previewVaultRestore(
  sourcePath: string,
  destinationPath: string
): Promise<VaultRestorePreview> {
  const source = await assertDirectory(sourcePath)
  const destination = path.resolve(destinationPath)
  if (isSameOrWithin(source, destination)) {
    throw new Error('Restore destination must be outside the backup source')
  }
  await assertPreviewDestination(destination)

  const manifest = await readPortableManifest(source)
  const entries: VaultRestorePreviewEntry[] = []
  const conflicts: string[] = []
  const missingFiles: string[] = []
  const unsafePaths: string[] = []

  for (const file of manifest.files) {
    let sourceStatus: 'available' | 'missing' | 'unsafe' = 'available'
    try {
      await assertSafeRegularFile(source, file.path)
      const actualChecksum = await checksumFile(joinSafe(source, file.path))
      if (actualChecksum !== file.checksum) {
        sourceStatus = 'unsafe'
      }
    } catch (error) {
      sourceStatus = isMissingPathError(error) ? 'missing' : 'unsafe'
    }

    if (sourceStatus === 'missing') {
      missingFiles.push(file.path)
      entries.push({ ...file, action: 'missing' })
      continue
    }
    if (sourceStatus === 'unsafe') {
      unsafePaths.push(file.path)
      entries.push({ ...file, action: 'unsafe' })
      continue
    }

    const destinationEntry = await inspectDestinationFile(destination, file.path)
    if (destinationEntry.kind === 'missing') {
      entries.push({ ...file, action: 'create' })
    } else if (destinationEntry.kind === 'unsafe') {
      unsafePaths.push(file.path)
      entries.push({ ...file, action: 'unsafe' })
    } else if (destinationEntry.checksum === file.checksum) {
      entries.push({ ...file, currentChecksum: destinationEntry.checksum, action: 'unchanged' })
    } else {
      conflicts.push(file.path)
      entries.push({ ...file, currentChecksum: destinationEntry.checksum, action: 'conflict' })
    }
  }

  return {
    sourcePath: source,
    destinationPath: destination,
    manifest,
    manifestChecksum: checksumPortableManifest(manifest),
    entries,
    conflicts: conflicts.sort(),
    missingFiles: missingFiles.sort(),
    unsafePaths: unsafePaths.sort(),
    canRestore: conflicts.length === 0 && missingFiles.length === 0 && unsafePaths.length === 0
  }
}

export const restorePreview = previewVaultRestore
export const previewRestore = previewVaultRestore
export const previewRestoreVault = previewVaultRestore

/** Restore a verified backup after its preview has found no unsafe inputs. */
export async function restoreVault(
  sourcePath: string,
  destinationPath: string,
  options: { overwrite?: boolean } = {}
): Promise<VaultRestoreResult> {
  const preview = await previewVaultRestore(sourcePath, destinationPath)
  if (preview.missingFiles.length > 0 || preview.unsafePaths.length > 0) {
    throw new Error('Restore cannot continue because the backup contains missing or unsafe files')
  }
  if (preview.conflicts.length > 0 && !options.overwrite) {
    throw new Error(
      `Restore conflicts require explicit overwrite approval: ${preview.conflicts.join(', ')}`
    )
  }

  const destinationExists = await transferPathExists(preview.destinationPath)
  if (!destinationExists) {
    const stagingPath = `${preview.destinationPath}.tmp-${process.pid}-${randomUUID()}`
    try {
      await ensureDestinationDirectory(stagingPath)
      await copyManifestFiles(preview.sourcePath, stagingPath, preview.manifest, false)
      await verifyManifestFiles(stagingPath, preview.manifest)
      await ensureVaultManifest(stagingPath, {
        ...(preview.manifest.vaultId ? { vaultId: preview.manifest.vaultId } : {}),
        schemaVersion: preview.manifest.schemaVersion
      })
      await fs.rename(stagingPath, preview.destinationPath)
    } catch (error) {
      await fs.rm(stagingPath, { recursive: true, force: true }).catch(() => undefined)
      throw error
    }
  } else {
    await ensureDestinationDirectory(preview.destinationPath)
    await copyManifestFiles(
      preview.sourcePath,
      preview.destinationPath,
      preview.manifest,
      Boolean(options.overwrite)
    )
    await verifyManifestFiles(preview.destinationPath, preview.manifest)
    await ensureVaultManifest(preview.destinationPath, {
      ...(preview.manifest.vaultId ? { vaultId: preview.manifest.vaultId } : {}),
      schemaVersion: preview.manifest.schemaVersion
    })
  }

  return {
    path: preview.destinationPath,
    fileCount: preview.manifest.files.length,
    checksum: preview.manifestChecksum,
    restoredAt: new Date().toISOString()
  }
}

export const restoreFromBackup = restoreVault

async function copyManifestFiles(
  sourceRoot: string,
  destinationRoot: string,
  manifest: VaultTransferManifest,
  overwrite: boolean
): Promise<void> {
  for (const file of manifest.files) {
    await assertSafeRegularFile(sourceRoot, file.path)
    const sourcePath = joinSafe(sourceRoot, file.path)
    const destinationPath = joinSafe(destinationRoot, file.path)
    await assertNoSymlinkAncestors(sourceRoot, file.path)
    await assertNoSymlinkAncestors(destinationRoot, file.path)
    await fs.mkdir(path.dirname(destinationPath), { recursive: true })

    const existing = await inspectDestinationFile(destinationRoot, file.path)
    if (existing.kind === 'unsafe') {
      throw new Error(`Restore destination contains an unsafe path: ${file.path}`)
    }
    if (existing.kind === 'file' && !overwrite) {
      if (existing.checksum === file.checksum) {
        continue
      }
      throw new Error(`Restore destination already contains a different file: ${file.path}`)
    }

    const temporaryPath = `${destinationPath}.tmp-${process.pid}-${randomUUID()}`
    try {
      await fs.copyFile(sourcePath, temporaryPath)
      await fs.rename(temporaryPath, destinationPath)
    } finally {
      await fs.rm(temporaryPath, { force: true }).catch(() => undefined)
    }
  }
}

async function verifyManifestFiles(root: string, manifest: VaultTransferManifest): Promise<void> {
  for (const file of manifest.files) {
    await assertSafeRegularFile(root, file.path)
    const target = joinSafe(root, file.path)
    const stats = await fs.stat(target)
    const checksum = await checksumFile(target)
    if (stats.size !== file.size || checksum !== file.checksum) {
      throw new Error(`Checksum verification failed for ${file.path}`)
    }
  }
}

async function assertSafeRegularFile(root: string, relPath: string): Promise<void> {
  await assertNoSymlinkAncestors(root, relPath)
  const target = joinSafe(root, relPath)
  const stats = await fs.lstat(target)
  if (!stats.isFile() || stats.isSymbolicLink()) {
    throw new Error(`Portable transfer path is not a regular file: ${relPath}`)
  }
}

async function assertNoSymlinkAncestors(root: string, relPath: string): Promise<void> {
  const safeRelPath = normalizeManifestPath(relPath, 'path')
  let current = path.resolve(root)
  const parentSegments = path.posix.dirname(safeRelPath).split('/').filter(Boolean)
  for (const segment of parentSegments) {
    current = path.join(current, segment)
    try {
      const stats = await fs.lstat(current)
      if (stats.isSymbolicLink()) {
        throw new Error(`Symbolic link is not allowed in transfer path: ${safeRelPath}`)
      }
    } catch (error) {
      if (isMissingPathError(error)) {
        return
      }
      throw error
    }
  }
}

async function inspectDestinationFile(
  destinationRoot: string,
  relPath: string
): Promise<{ kind: 'missing' | 'file' | 'unsafe'; checksum?: string }> {
  const target = joinSafe(destinationRoot, relPath)
  try {
    const stats = await fs.lstat(target)
    if (stats.isSymbolicLink() || !stats.isFile()) {
      return { kind: 'unsafe' }
    }
    return { kind: 'file', checksum: await checksumFile(target) }
  } catch (error) {
    if (isMissingPathError(error)) {
      return { kind: 'missing' }
    }
    throw error
  }
}

async function ensureDestinationDirectory(destination: string): Promise<void> {
  try {
    const stats = await fs.lstat(destination)
    if (stats.isSymbolicLink() || !stats.isDirectory()) {
      throw new Error('Restore destination must be a real directory')
    }
  } catch (error) {
    if (!isMissingPathError(error)) {
      throw error
    }
    await fs.mkdir(destination, { recursive: true })
  }
}

async function assertPreviewDestination(destination: string): Promise<void> {
  try {
    const stats = await fs.lstat(destination)
    if (stats.isSymbolicLink() || !stats.isDirectory()) {
      throw new Error('Restore preview destination must be a real directory or not exist yet')
    }
  } catch (error) {
    if (!isMissingPathError(error)) {
      throw error
    }
  }
}

async function assertDirectory(rootPath: string): Promise<string> {
  const root = path.resolve(rootPath)
  const stats = await fs.lstat(root)
  if (!stats.isDirectory() || stats.isSymbolicLink()) {
    throw new Error(`Transfer source must be a real directory: ${root}`)
  }
  return root
}

async function assertDestinationDoesNotExist(destination: string): Promise<void> {
  try {
    await fs.lstat(destination)
    throw new Error(`Backup destination already exists: ${destination}`)
  } catch (error) {
    if (!isMissingPathError(error)) {
      throw error
    }
  }
}

async function transferPathExists(targetPath: string): Promise<boolean> {
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

function normalizeManifestPath(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value) {
    throw new Error(`${label} must be a non-empty relative path`)
  }
  if (value.includes('\\') || value.startsWith('/') || /^[a-zA-Z]:/.test(value)) {
    throw new Error(`${label} must be a portable relative path`)
  }
  const normalized = assertSafeRelativePath(value)
  if (normalized !== value) {
    throw new Error(`${label} must not contain dot segments or duplicate separators`)
  }
  return normalized
}

function normalizeExclusionRules(rules: readonly string[]): string[] {
  const normalized = new Set<string>()
  for (const rule of rules) {
    if (typeof rule !== 'string' || !rule.trim()) {
      throw new Error('Portable manifest exclusion rules must be non-empty strings')
    }
    if (rule.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(rule)) {
      throw new Error('Portable manifest exclusion rules cannot be absolute paths')
    }
    const normalizedRule = normalizeRelativePath(rule)
    if (normalizedRule === '..' || normalizedRule.startsWith('../')) {
      throw new Error('Portable manifest exclusion rules cannot escape the vault')
    }
    normalized.add(normalizedRule)
  }
  return [...normalized].sort()
}

function isSameOrWithin(base: string, target: string): boolean {
  const relative = path.relative(path.resolve(base), path.resolve(target))
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isMissingPathError(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === 'ENOENT'
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
