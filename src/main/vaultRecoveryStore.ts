import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { writeFileAtomically } from './atomicFile'
import { hashVaultBytes } from './vaultRevision'
import { assertSafeRelativePath, ensureWithinBase, joinSafe } from '../shared/pathSafety'

const RECOVERY_FORMAT_VERSION = 1 as const
const CONFLICTS_DIRECTORY = 'conflicts'
const QUARANTINE_DIRECTORY = 'quarantine'
const JSON_FILE_SUFFIX = '.json'
const RECOVERY_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/
const CONFLICT_PAYLOAD_ROLES = new Set(['base', 'local', 'external', 'disk', 'remote'])

export interface VaultRecoveryPayloadReference {
  /** Path relative to the recovery root, never an absolute filesystem path. */
  path: string
  contentHash?: string
  size?: number
  mediaType?: string
}

export type VaultRecoveryPayloadInput = VaultRecoveryPayloadReference | string

export interface VaultConflictPayloads {
  base?: VaultRecoveryPayloadInput | null
  local?: VaultRecoveryPayloadInput | null
  external?: VaultRecoveryPayloadInput | null
  disk?: VaultRecoveryPayloadInput | null
  remote?: VaultRecoveryPayloadInput | null
}

export interface VaultConflictRecord {
  id: string
  /** Canonical vault-relative path involved in the conflict. */
  path: string
  detectedAt: string
  payloads: VaultConflictPayloads
  reason?: string
  metadata?: Record<string, unknown>
}

export type VaultConflictRecordInput = Omit<VaultConflictRecord, 'id'> & {
  id?: string
}

export interface VaultQuarantineRecord {
  id: string
  /** Canonical vault-relative path whose bytes were quarantined. */
  path: string
  quarantinedAt: string
  reason: string
  payload: VaultRecoveryPayloadInput
  metadata?: Record<string, unknown>
}

export type VaultQuarantineRecordInput = Omit<VaultQuarantineRecord, 'id'> & {
  id?: string
}

type RecoveryRecordKind = 'conflict' | 'quarantine'

interface NormalizedVaultConflictRecord extends Omit<VaultConflictRecord, 'payloads'> {
  payloads: NormalizedVaultConflictPayloads
}

interface NormalizedVaultQuarantineRecord extends Omit<VaultQuarantineRecord, 'payload'> {
  payload: VaultRecoveryPayloadReference
}

interface NormalizedVaultConflictPayloads {
  base?: VaultRecoveryPayloadReference | null
  local?: VaultRecoveryPayloadReference | null
  external?: VaultRecoveryPayloadReference | null
  disk?: VaultRecoveryPayloadReference | null
  remote?: VaultRecoveryPayloadReference | null
}

interface StoredRecoveryRecord {
  formatVersion: typeof RECOVERY_FORMAT_VERSION
  record: VaultConflictRecord | VaultQuarantineRecord
}

/**
 * Durable metadata and payload bytes for unresolved conflicts and quarantined
 * recovery work.
 */
export class VaultRecoveryStore {
  private readonly recoveryRoot: string
  private mutationQueue: Promise<void> = Promise.resolve()

  constructor(recoveryRoot: string) {
    if (typeof recoveryRoot !== 'string' || recoveryRoot.trim() === '') {
      throw new Error('A recovery root is required')
    }
    if (recoveryRoot.includes('\0')) {
      throw new Error('Recovery root contains an invalid null character')
    }

    this.recoveryRoot = path.resolve(recoveryRoot)
  }

  async listConflicts(): Promise<VaultConflictRecord[]> {
    await this.mutationQueue
    const records = await this.listRecords<VaultConflictRecord>(CONFLICTS_DIRECTORY, 'conflict')
    return records.map((record) => cloneJson(record))
  }

  async writePayload(
    input: VaultRecoveryPayloadInput,
    content: string | Uint8Array
  ): Promise<VaultRecoveryPayloadReference> {
    return this.enqueueMutation(async () => {
      const reference = normalizePayloadReference(input, this.recoveryRoot, 'Recovery payload')
      const bytes =
        typeof content === 'string' ? Buffer.from(content, 'utf8') : Buffer.from(content)
      const contentHash = hashVaultBytes(bytes)
      if (reference.contentHash && reference.contentHash !== contentHash) {
        throw new Error('Recovery payload content hash does not match the supplied bytes')
      }
      if (reference.size !== undefined && reference.size !== bytes.byteLength) {
        throw new Error('Recovery payload size does not match the supplied bytes')
      }

      const targetPath = joinSafe(this.recoveryRoot, reference.path)
      await ensureRecoveryDirectory(path.dirname(targetPath), this.recoveryRoot)
      await assertWritableRecoveryPayload(targetPath)
      await writeFileAtomically(targetPath, bytes)

      return {
        path: reference.path,
        contentHash,
        size: bytes.byteLength,
        ...(reference.mediaType ? { mediaType: reference.mediaType } : {})
      }
    })
  }

  async upsertConflict(input: VaultConflictRecordInput): Promise<VaultConflictRecord> {
    return this.enqueueMutation(async () => {
      const record = normalizeConflictRecord(input, this.recoveryRoot)
      const recordPath = await this.getRecordPath('conflict', record.id, true)
      await this.writeRecord(recordPath, record)
      return cloneJson(record)
    })
  }

  async resolveConflict(conflictId: string): Promise<boolean> {
    return this.removeRecord('conflict', conflictId)
  }

  async removeConflict(conflictId: string): Promise<boolean> {
    return this.resolveConflict(conflictId)
  }

  async listQuarantine(): Promise<VaultQuarantineRecord[]> {
    await this.mutationQueue
    const records = await this.listRecords<VaultQuarantineRecord>(
      QUARANTINE_DIRECTORY,
      'quarantine'
    )
    return records.map((record) => cloneJson(record))
  }

  async upsertQuarantine(input: VaultQuarantineRecordInput): Promise<VaultQuarantineRecord> {
    return this.enqueueMutation(async () => {
      const record = normalizeQuarantineRecord(input, this.recoveryRoot)
      const recordPath = await this.getRecordPath('quarantine', record.id, true)
      await this.writeRecord(recordPath, record)
      return cloneJson(record)
    })
  }

  async resolveQuarantine(quarantineId: string): Promise<boolean> {
    return this.removeRecord('quarantine', quarantineId)
  }

  async removeQuarantine(quarantineId: string): Promise<boolean> {
    return this.resolveQuarantine(quarantineId)
  }

  private async removeRecord(kind: RecoveryRecordKind, idInput: string): Promise<boolean> {
    return this.enqueueMutation(async () => {
      const id = assertRecoveryId(idInput)
      const recordPath = await this.getRecordPath(kind, id, false)

      try {
        await fs.unlink(recordPath)
        return true
      } catch (error) {
        if (isMissingPathError(error)) {
          return false
        }
        throw error
      }
    })
  }

  private async listRecords<T extends VaultConflictRecord | VaultQuarantineRecord>(
    directoryName: string,
    kind: RecoveryRecordKind
  ): Promise<T[]> {
    const directoryPath = await this.getDirectoryPath(directoryName, false)
    let entries: Array<import('node:fs').Dirent>
    try {
      entries = await fs.readdir(directoryPath, { withFileTypes: true })
    } catch (error) {
      if (isMissingPathError(error)) {
        return []
      }
      throw error
    }

    const recordEntries = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(JSON_FILE_SUFFIX))
      .sort((left, right) => left.name.localeCompare(right.name))

    const records = await Promise.all(
      recordEntries.map(async (entry) => {
        const id = assertRecoveryId(entry.name.slice(0, -JSON_FILE_SUFFIX.length))
        const recordPath = joinSafe(directoryPath, entry.name)
        const stored = await this.readRecord(recordPath, kind)
        if (stored.record.id !== id) {
          throw new Error(`Recovery ${kind} record id does not match its file name: ${entry.name}`)
        }
        return stored.record as T
      })
    )

    return records
  }

  private async readRecord(
    recordPath: string,
    kind: RecoveryRecordKind
  ): Promise<StoredRecoveryRecord> {
    let raw: string
    try {
      raw = await fs.readFile(recordPath, 'utf-8')
    } catch (error) {
      if (isMissingPathError(error)) {
        throw new Error(`Recovery ${kind} record disappeared while it was being read`)
      }
      throw error
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(raw) as unknown
    } catch (error) {
      throw new Error(`Invalid recovery ${kind} record JSON at ${recordPath}`, { cause: error })
    }

    if (!isRecord(parsed) || parsed.formatVersion !== RECOVERY_FORMAT_VERSION) {
      throw new Error(`Unsupported recovery ${kind} record format at ${recordPath}`)
    }

    if (kind === 'conflict') {
      return {
        formatVersion: RECOVERY_FORMAT_VERSION,
        record: normalizeConflictRecord(parsed.record, this.recoveryRoot, true)
      }
    }

    return {
      formatVersion: RECOVERY_FORMAT_VERSION,
      record: normalizeQuarantineRecord(parsed.record, this.recoveryRoot, true)
    }
  }

  private async writeRecord(
    recordPath: string,
    record: VaultConflictRecord | VaultQuarantineRecord
  ): Promise<void> {
    const stored: StoredRecoveryRecord = {
      formatVersion: RECOVERY_FORMAT_VERSION,
      record
    }
    let serialized: string
    try {
      serialized = JSON.stringify(stored, null, 2)
    } catch (error) {
      throw new Error('Recovery record contains values that cannot be serialized as JSON', {
        cause: error
      })
    }
    await writeFileAtomically(recordPath, `${serialized}\n`)
  }

  private async getRecordPath(
    kind: RecoveryRecordKind,
    id: string,
    createDirectory: boolean
  ): Promise<string> {
    const directoryName = kind === 'conflict' ? CONFLICTS_DIRECTORY : QUARANTINE_DIRECTORY
    const directoryPath = await this.getDirectoryPath(directoryName, createDirectory)
    return joinSafe(directoryPath, `${id}${JSON_FILE_SUFFIX}`)
  }

  private async getDirectoryPath(directoryName: string, createDirectory: boolean): Promise<string> {
    await assertNonSymlinkDirectory(this.recoveryRoot, true)
    if (createDirectory) {
      await fs.mkdir(this.recoveryRoot, { recursive: true })
      await assertNonSymlinkDirectory(this.recoveryRoot, false)
    }

    const directoryPath = joinSafe(this.recoveryRoot, directoryName)
    if (createDirectory) {
      await fs.mkdir(directoryPath, { recursive: true })
    }
    await assertNonSymlinkDirectory(directoryPath, !createDirectory)
    return directoryPath
  }

  private enqueueMutation<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.mutationQueue.then(operation)
    this.mutationQueue = next.then(
      () => undefined,
      () => undefined
    )
    return next
  }
}

function normalizeConflictRecord(
  input: unknown,
  recoveryRoot: string,
  requireId = false
): NormalizedVaultConflictRecord {
  if (!isRecord(input)) {
    throw new Error('A conflict record must be an object')
  }

  const id = normalizeRecordId(input.id, requireId)
  const pathValue = normalizeRelativePathValue(input.path, 'Conflict path')
  const detectedAt = normalizeRequiredString(input.detectedAt, 'Conflict detectedAt')
  const payloads = normalizeConflictPayloads(input.payloads, recoveryRoot)

  return {
    id: id ?? randomUUID(),
    path: pathValue,
    detectedAt,
    payloads,
    ...(input.reason !== undefined
      ? { reason: normalizeRequiredString(input.reason, 'Conflict reason') }
      : {}),
    ...(input.metadata !== undefined
      ? { metadata: normalizeMetadata(input.metadata, 'Conflict metadata') }
      : {})
  }
}

function normalizeQuarantineRecord(
  input: unknown,
  recoveryRoot: string,
  requireId = false
): NormalizedVaultQuarantineRecord {
  if (!isRecord(input)) {
    throw new Error('A quarantine record must be an object')
  }

  const id = normalizeRecordId(input.id, requireId)
  const pathValue = normalizeRelativePathValue(input.path, 'Quarantine path')
  const quarantinedAt = normalizeRequiredString(input.quarantinedAt, 'Quarantine quarantinedAt')
  const reason = normalizeRequiredString(input.reason, 'Quarantine reason')
  const payload = normalizePayloadReference(input.payload, recoveryRoot, 'Quarantine payload')

  return {
    id: id ?? randomUUID(),
    path: pathValue,
    quarantinedAt,
    reason,
    payload,
    ...(input.metadata !== undefined
      ? { metadata: normalizeMetadata(input.metadata, 'Quarantine metadata') }
      : {})
  }
}

function normalizeConflictPayloads(
  input: unknown,
  recoveryRoot: string
): NormalizedVaultConflictPayloads {
  if (!isRecord(input)) {
    throw new Error('Conflict payloads must be an object')
  }

  const payloads: NormalizedVaultConflictPayloads = {}
  let referenceCount = 0

  for (const [role, value] of Object.entries(input)) {
    if (!CONFLICT_PAYLOAD_ROLES.has(role)) {
      throw new Error(`Unsupported conflict payload role: ${role}`)
    }
    if (value === null) {
      payloads[role as keyof NormalizedVaultConflictPayloads] = null
      continue
    }

    payloads[role as keyof NormalizedVaultConflictPayloads] = normalizePayloadReference(
      value,
      recoveryRoot,
      `Conflict ${role} payload`
    )
    referenceCount += 1
  }

  if (referenceCount === 0) {
    throw new Error('Conflict payloads must contain at least one payload reference')
  }

  return payloads
}

function normalizePayloadReference(
  input: unknown,
  recoveryRoot: string,
  label: string
): VaultRecoveryPayloadReference {
  const source = typeof input === 'string' ? { path: input } : input
  if (!isRecord(source)) {
    throw new Error(`${label} must be a path or payload reference`)
  }

  const payloadPath = normalizeRecoveryRelativePath(source.path, recoveryRoot, `${label} path`)
  const contentHash =
    source.contentHash === undefined
      ? undefined
      : normalizeRequiredString(source.contentHash, `${label} contentHash`)
  const size = source.size === undefined ? undefined : normalizeSize(source.size, `${label} size`)
  const mediaType =
    source.mediaType === undefined
      ? undefined
      : normalizeRequiredString(source.mediaType, `${label} mediaType`)

  return {
    path: payloadPath,
    ...(contentHash ? { contentHash } : {}),
    ...(size !== undefined ? { size } : {}),
    ...(mediaType ? { mediaType } : {})
  }
}

function normalizeRecordId(value: unknown, required: boolean): string | undefined {
  if (value === undefined && !required) {
    return undefined
  }
  if (typeof value !== 'string' || !RECOVERY_ID_PATTERN.test(value)) {
    throw new Error(
      'Recovery record ids must contain only letters, numbers, dots, underscores, or hyphens'
    )
  }
  return value
}

function assertRecoveryId(value: unknown): string {
  const id = normalizeRecordId(value, true)
  if (!id) {
    throw new Error('A recovery record id is required')
  }
  return id
}

function normalizeRelativePathValue(value: unknown, label: string): string {
  if (typeof value !== 'string') {
    throw new Error(`${label} must be a safe relative path`)
  }
  return assertSafePath(value, label)
}

function normalizeRecoveryRelativePath(
  value: unknown,
  recoveryRoot: string,
  label: string
): string {
  const normalized = normalizeRelativePathValue(value, label)
  const targetPath = joinSafe(recoveryRoot, normalized)
  ensureWithinBase(recoveryRoot, targetPath)
  return normalized
}

function assertSafePath(value: string, label: string): string {
  if (value.includes('\0') || /^[a-zA-Z]:/.test(value)) {
    throw new Error(`${label} must be a safe relative path`)
  }
  try {
    return assertSafeRelativePath(value)
  } catch (error) {
    throw new Error(`${label} must be a safe relative path`, { cause: error })
  }
}

function normalizeRequiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} must be a non-empty string`)
  }
  return value
}

function normalizeSize(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer`)
  }
  return value
}

function normalizeMetadata(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${label} must be an object`)
  }
  return cloneJson(value)
}

function cloneJson<T>(value: T): T {
  let serialized: string
  try {
    serialized = JSON.stringify(value)
  } catch (error) {
    throw new Error('Recovery metadata must be JSON serializable', { cause: error })
  }
  if (serialized === undefined) {
    throw new Error('Recovery metadata must be JSON serializable')
  }
  return JSON.parse(serialized) as T
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isMissingPathError(error: unknown): boolean {
  return Boolean(
    error && typeof error === 'object' && (error as NodeJS.ErrnoException).code === 'ENOENT'
  )
}

async function assertNonSymlinkDirectory(
  directoryPath: string,
  allowMissing: boolean
): Promise<void> {
  try {
    const stats = await fs.lstat(directoryPath)
    if (stats.isSymbolicLink()) {
      throw new Error(`Recovery directory must not be a symbolic link: ${directoryPath}`)
    }
    if (!stats.isDirectory()) {
      throw new Error(`Recovery path is not a directory: ${directoryPath}`)
    }
  } catch (error) {
    if (isMissingPathError(error) && allowMissing) {
      return
    }
    throw error
  }
}

async function ensureRecoveryDirectory(directoryPath: string, recoveryRoot: string): Promise<void> {
  const resolvedRoot = path.resolve(recoveryRoot)
  const resolvedDirectory = path.resolve(directoryPath)
  ensureWithinBase(resolvedRoot, resolvedDirectory)

  try {
    await assertNonSymlinkDirectory(resolvedRoot, false)
  } catch (error) {
    if (!isMissingPathError(error)) {
      throw error
    }
    await fs.mkdir(resolvedRoot, { recursive: true })
    await assertNonSymlinkDirectory(resolvedRoot, false)
  }
  const relative = path.relative(resolvedRoot, resolvedDirectory)
  if (!relative || relative === '.') {
    return
  }

  let current = resolvedRoot
  for (const segment of relative.split(path.sep)) {
    current = path.join(current, segment)
    try {
      await assertNonSymlinkDirectory(current, false)
    } catch (error) {
      if (!isMissingPathError(error)) {
        throw error
      }
      await fs.mkdir(current)
      await assertNonSymlinkDirectory(current, false)
    }
  }
}

async function assertWritableRecoveryPayload(filePath: string): Promise<void> {
  try {
    const stats = await fs.lstat(filePath)
    if (stats.isSymbolicLink()) {
      throw new Error(`Recovery payload must not be a symbolic link: ${filePath}`)
    }
    if (stats.isDirectory()) {
      throw new Error(`Recovery payload path is a directory: ${filePath}`)
    }
  } catch (error) {
    if (isMissingPathError(error)) {
      return
    }
    throw error
  }
}
