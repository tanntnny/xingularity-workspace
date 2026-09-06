import { createHash, randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createFileAtomically, writeFileAtomically } from './atomicFile'

export const VAULT_MANIFEST_FORMAT = 'xingularity-vault' as const
export const VAULT_MANIFEST_VERSION = 1 as const
export const VAULT_MANIFEST_RELATIVE_PATH = '.xingularity/manifest.json' as const
export const DEFAULT_VAULT_SCHEMA_VERSION = 1
export const DEFAULT_VAULT_PROTOCOL_VERSION = 1

const DEFAULT_CAPABILITIES = ['attachments', 'markdown', 'structured-records'] as const
const DEFAULT_MIGRATION: VaultMigrationMarker = {
  legacyLayoutActive: true,
  rollbackAvailable: false
}

const MANIFEST_KEYS = new Set([
  'format',
  'manifestVersion',
  'vaultId',
  'schemaVersion',
  'protocolVersion',
  'createdAt',
  'capabilities',
  'migration'
])

const MIGRATION_KEYS = new Set(['legacyLayoutActive', 'rollbackAvailable'])

const FORBIDDEN_CAPABILITY_VALUES = new Set(['api-key', 'private-key'])

const FORBIDDEN_CAPABILITY_TOKENS = new Set([
  'backup',
  'cache',
  'conflict',
  'credential',
  'credentials',
  'device',
  'filemap',
  'index',
  'indexes',
  'locator',
  'locators',
  'quarantine',
  'secret',
  'secrets',
  'sqlite',
  'temp',
  'temporary',
  'token',
  'tokens'
])

const VAULT_ID_PATTERN = /^[a-z0-9](?:[a-z0-9_-]{0,62}[a-z0-9])?$/
const CAPABILITY_PATTERN = /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/

export interface VaultMigrationMarker {
  legacyLayoutActive: boolean
  rollbackAvailable: boolean
}

export interface VaultManifest {
  format: typeof VAULT_MANIFEST_FORMAT
  manifestVersion: typeof VAULT_MANIFEST_VERSION
  /** Generated once and persisted; it intentionally contains no filesystem path. */
  vaultId: string
  schemaVersion: number
  protocolVersion: number
  createdAt: string
  capabilities: string[]
  migration: VaultMigrationMarker
}

export interface CreateVaultManifestOptions {
  vaultId?: string
  schemaVersion?: number
  protocolVersion?: number
  createdAt?: string | Date
  capabilities?: readonly string[]
  migration?: VaultMigrationMarker
}

export interface VaultManifestValidationResult {
  valid: boolean
  errors: string[]
  manifest?: VaultManifest
}

export function getVaultManifestPath(rootPath: string): string {
  return path.join(path.resolve(rootPath), VAULT_MANIFEST_RELATIVE_PATH)
}

/** Read the persisted identity marker, returning null for a pre-manifest vault. */
export async function readVaultManifest(rootPath: string): Promise<VaultManifest | null> {
  const manifestPath = getVaultManifestPath(rootPath)
  let stats: import('node:fs').Stats
  try {
    stats = await fs.lstat(manifestPath)
  } catch (error) {
    if (isMissingPathError(error)) {
      return null
    }
    throw error
  }

  if (stats.isSymbolicLink() || !stats.isFile()) {
    throw new Error('Vault manifest must be a regular file')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(await fs.readFile(manifestPath, 'utf8'))
  } catch (error) {
    throw new Error(
      `Vault manifest is not valid JSON: ${error instanceof Error ? error.message : String(error)}`
    )
  }
  return normalizeVaultManifest(parsed)
}

/** Atomically persist a validated identity marker under the vault system directory. */
export async function writeVaultManifest(
  rootPath: string,
  input: unknown,
  options: { createOnly?: boolean } = {}
): Promise<VaultManifest> {
  const manifest = normalizeVaultManifest(input)
  const resolvedRoot = path.resolve(rootPath)
  const systemPath = path.join(resolvedRoot, path.dirname(VAULT_MANIFEST_RELATIVE_PATH))
  await ensureManifestDirectory(systemPath)

  const manifestPath = getVaultManifestPath(resolvedRoot)
  await assertManifestTarget(manifestPath)
  const serialized = `${JSON.stringify(manifest, null, 2)}\n`
  if (options.createOnly) {
    try {
      await createFileAtomically(manifestPath, serialized)
    } catch (error) {
      if (!isFileExistsError(error)) {
        throw error
      }
      const existing = await readVaultManifest(resolvedRoot)
      if (!existing) {
        throw new Error('Vault manifest creation raced with an unavailable file')
      }
      return existing
    }
  } else {
    await writeFileAtomically(manifestPath, serialized)
  }
  return manifest
}

/** Load an existing identity or create one exactly once for a new vault. */
export async function ensureVaultManifest(
  rootPath: string,
  options: CreateVaultManifestOptions = {}
): Promise<VaultManifest> {
  const existing = await readVaultManifest(rootPath)
  if (existing) {
    return existing
  }
  return writeVaultManifest(rootPath, createVaultManifest(options), { createOnly: true })
}

/**
 * Generate an opaque identity for a vault.
 *
 * This function deliberately accepts no root path. The caller must persist the
 * result in the manifest so moving or copying the vault does not change its ID.
 */
export function generateVaultId(): string {
  return randomUUID()
}

export const createVaultId = generateVaultId
export const generateStableVaultId = generateVaultId

export function createVaultManifest(options: CreateVaultManifestOptions = {}): VaultManifest {
  const createdAt =
    options.createdAt instanceof Date
      ? Number.isFinite(options.createdAt.getTime())
        ? options.createdAt.toISOString()
        : undefined
      : options.createdAt

  return normalizeVaultManifest({
    format: VAULT_MANIFEST_FORMAT,
    manifestVersion: VAULT_MANIFEST_VERSION,
    vaultId: options.vaultId ?? generateVaultId(),
    schemaVersion: options.schemaVersion ?? DEFAULT_VAULT_SCHEMA_VERSION,
    protocolVersion: options.protocolVersion ?? DEFAULT_VAULT_PROTOCOL_VERSION,
    createdAt: createdAt ?? new Date().toISOString(),
    capabilities: options.capabilities ?? DEFAULT_CAPABILITIES,
    migration: options.migration ?? DEFAULT_MIGRATION
  })
}

export function normalizeVaultManifest(input: unknown): VaultManifest {
  if (!isRecord(input)) {
    throw new Error('Vault manifest must be an object')
  }

  const unknownKey = Object.keys(input).find((key) => !MANIFEST_KEYS.has(key))
  if (unknownKey) {
    throw new Error(`Vault manifest contains an unknown field: ${unknownKey}`)
  }

  for (const key of [
    'format',
    'manifestVersion',
    'vaultId',
    'schemaVersion',
    'protocolVersion',
    'createdAt',
    'capabilities'
  ]) {
    if (!hasOwn(input, key)) {
      throw new Error(`Vault manifest is missing required field: ${key}`)
    }
  }

  if (input.format !== VAULT_MANIFEST_FORMAT) {
    throw new Error('Vault manifest has an unsupported format')
  }
  if (input.manifestVersion !== VAULT_MANIFEST_VERSION) {
    throw new Error(`Unsupported vault manifest version: ${String(input.manifestVersion)}`)
  }

  return {
    format: VAULT_MANIFEST_FORMAT,
    manifestVersion: VAULT_MANIFEST_VERSION,
    vaultId: normalizeVaultId(input.vaultId),
    schemaVersion: normalizePositiveInteger(input.schemaVersion, 'schemaVersion'),
    protocolVersion: normalizePositiveInteger(input.protocolVersion, 'protocolVersion'),
    createdAt: normalizeTimestamp(input.createdAt),
    capabilities: normalizeCapabilities(input.capabilities),
    migration: normalizeMigration(input.migration)
  }
}

export function validateVaultManifest(input: unknown): VaultManifestValidationResult {
  try {
    return {
      valid: true,
      errors: [],
      manifest: normalizeVaultManifest(input)
    }
  } catch (error) {
    return {
      valid: false,
      errors: [error instanceof Error ? error.message : 'Invalid vault manifest']
    }
  }
}

export function parseVaultManifest(input: unknown): VaultManifest {
  const result = validateVaultManifest(input)
  if (!result.valid || !result.manifest) {
    throw new Error(`Invalid vault manifest: ${result.errors.join('; ')}`)
  }
  return result.manifest
}

export const assertValidVaultManifest = parseVaultManifest

export function isValidVaultManifest(input: unknown): input is VaultManifest {
  return validateVaultManifest(input).valid
}

/** Serialize the normalized manifest as canonical JSON for storage or hashing. */
export function serializeVaultManifest(input: unknown): string {
  return JSON.stringify(normalizeVaultManifest(input))
}

/** Return the SHA-256 checksum of the canonical manifest serialization. */
export function checksumVaultManifest(input: unknown): string {
  return createHash('sha256').update(serializeVaultManifest(input), 'utf8').digest('hex')
}

export const hashVaultManifest = checksumVaultManifest

export function normalizeVaultId(value: unknown): string {
  if (typeof value !== 'string') {
    throw new Error('Vault manifest vaultId must be a safe portable identifier')
  }
  const normalized = value.trim().toLowerCase()
  if (!VAULT_ID_PATTERN.test(normalized)) {
    throw new Error('Vault manifest vaultId must be a safe portable identifier')
  }
  return normalized
}

function normalizePositiveInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    throw new Error(`Vault manifest ${field} must be a positive safe integer`)
  }
  return value as number
}

function normalizeTimestamp(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error('Vault manifest createdAt must be a valid timestamp')
  }
  const timestamp = new Date(value)
  if (!Number.isFinite(timestamp.getTime())) {
    throw new Error('Vault manifest createdAt must be a valid timestamp')
  }
  return timestamp.toISOString()
}

function normalizeCapabilities(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 32) {
    throw new Error('Vault manifest capabilities must contain 1 to 32 entries')
  }

  const capabilities = value.map((entry, index) => {
    if (typeof entry !== 'string') {
      throw new Error(`Vault manifest capability ${index} must be a safe identifier`)
    }
    const normalized = entry.trim().toLowerCase()
    if (
      normalized.length > 64 ||
      !CAPABILITY_PATTERN.test(normalized) ||
      FORBIDDEN_CAPABILITY_VALUES.has(normalized) ||
      normalized.split(/[._-]+/).some((token) => FORBIDDEN_CAPABILITY_TOKENS.has(token))
    ) {
      throw new Error(`Vault manifest capability ${index} is not allowed`)
    }
    return normalized
  })

  if (new Set(capabilities).size !== capabilities.length) {
    throw new Error('Vault manifest capabilities must not contain duplicates')
  }
  return capabilities.sort((left, right) => left.localeCompare(right))
}

function normalizeMigration(value: unknown): VaultMigrationMarker {
  if (value === undefined) {
    return { ...DEFAULT_MIGRATION }
  }
  if (!isRecord(value)) {
    throw new Error('Vault manifest migration must be an object')
  }

  const unknownKey = Object.keys(value).find((key) => !MIGRATION_KEYS.has(key))
  if (unknownKey) {
    throw new Error(`Vault manifest migration contains an unknown field: ${unknownKey}`)
  }
  if (
    typeof value.legacyLayoutActive !== 'boolean' ||
    typeof value.rollbackAvailable !== 'boolean'
  ) {
    throw new Error('Vault manifest migration must declare layout and rollback booleans')
  }

  return {
    legacyLayoutActive: value.legacyLayoutActive,
    rollbackAvailable: value.rollbackAvailable
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key)
}

async function ensureManifestDirectory(systemPath: string): Promise<void> {
  try {
    const stats = await fs.lstat(systemPath)
    if (stats.isSymbolicLink() || !stats.isDirectory()) {
      throw new Error('Vault manifest directory must be a regular directory')
    }
  } catch (error) {
    if (!isMissingPathError(error)) {
      throw error
    }
    await fs.mkdir(systemPath, { recursive: true })
  }
}

async function assertManifestTarget(manifestPath: string): Promise<void> {
  try {
    const stats = await fs.lstat(manifestPath)
    if (stats.isSymbolicLink() || !stats.isFile()) {
      throw new Error('Vault manifest must be a regular file')
    }
  } catch (error) {
    if (!isMissingPathError(error)) {
      throw error
    }
  }
}

function isMissingPathError(error: unknown): boolean {
  return Boolean(
    error && typeof error === 'object' && (error as NodeJS.ErrnoException).code === 'ENOENT'
  )
}

function isFileExistsError(error: unknown): boolean {
  return Boolean(
    error && typeof error === 'object' && (error as NodeJS.ErrnoException).code === 'EEXIST'
  )
}
