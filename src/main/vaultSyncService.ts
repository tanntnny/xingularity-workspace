import path from 'node:path'
import { buildPortableManifest, type VaultTransferOptions } from './vaultTransferService'
import { isPortableVaultPath } from './vaultDiagnostics'
import type { VaultTransferManifest } from '../shared/types'

export interface VaultSyncFile {
  path: string
  checksum: string
}

export interface VaultSyncSnapshot {
  files: VaultSyncFile[]
  vaultId?: string
  schemaVersion?: number
  generatedAt?: string
}

export interface VaultSyncConflict {
  path: string
  baseChecksum: string | null
  localChecksum: string | null
  remoteChecksum: string | null
  reason: 'concurrent-edit' | 'add-add' | 'delete-update' | 'no-base'
}

export interface VaultSyncComparison {
  conflicts: VaultSyncConflict[]
  unchanged: string[]
  localChanges: string[]
  remoteChanges: string[]
  additions: string[]
  deletions: string[]
}

export type SyncSnapshotInput =
  | VaultSyncSnapshot
  | VaultTransferManifest
  | ReadonlyArray<VaultSyncFile>
  | Readonly<Record<string, string>>

export interface DetectSyncConflictsInput {
  base?: SyncSnapshotInput | null
  local: SyncSnapshotInput
  remote: SyncSnapshotInput
}

/** Create a sync snapshot using exactly the portable transfer boundary. */
export async function createVaultSyncSnapshot(
  rootPath: string,
  options: VaultTransferOptions = {}
): Promise<VaultSyncSnapshot> {
  const manifest = await buildPortableManifest(rootPath, options)
  return snapshotFromManifest(manifest)
}

export const createSyncSnapshot = createVaultSyncSnapshot

export function snapshotFromManifest(manifest: VaultTransferManifest): VaultSyncSnapshot {
  return {
    ...(manifest.vaultId ? { vaultId: manifest.vaultId } : {}),
    files: manifest.files
      .filter((file) => isPortableVaultPath(file.path))
      .map(({ path: relPath, checksum }) => ({ path: relPath, checksum }))
      .sort((left, right) => left.path.localeCompare(right.path)),
    schemaVersion: manifest.schemaVersion,
    generatedAt: manifest.createdAt
  }
}

/**
 * Compare three snapshots.  A path is a conflict only when both devices
 * changed it from the same base to different values.  Without a base, every
 * disagreement is conservatively treated as a conflict.  All outputs are
 * sorted by normalized path, so input order cannot change the result.
 */
export function compareVaultSync(
  base: SyncSnapshotInput | null | undefined,
  local: SyncSnapshotInput,
  remote: SyncSnapshotInput
): VaultSyncComparison
export function compareVaultSync(input: DetectSyncConflictsInput): VaultSyncComparison
export function compareVaultSync(
  baseOrInput: SyncSnapshotInput | null | undefined | DetectSyncConflictsInput,
  localInput?: SyncSnapshotInput,
  remoteInput?: SyncSnapshotInput
): VaultSyncComparison {
  const { base, local, remote } = isComparisonInput(baseOrInput)
    ? baseOrInput
    : { base: baseOrInput, local: localInput, remote: remoteInput }
  if (local === undefined || remote === undefined) {
    throw new Error('Sync comparison requires local and remote snapshots')
  }

  const baseMap = toSnapshotMap(base)
  const localMap = toSnapshotMap(local)
  const remoteMap = toSnapshotMap(remote)
  const hasBase = base !== null && base !== undefined
  const paths = [...new Set([...baseMap.keys(), ...localMap.keys(), ...remoteMap.keys()])].sort()

  const result: VaultSyncComparison = {
    conflicts: [],
    unchanged: [],
    localChanges: [],
    remoteChanges: [],
    additions: [],
    deletions: []
  }

  for (const relPath of paths) {
    const baseChecksum = baseMap.get(relPath) ?? null
    const localChecksum = localMap.get(relPath) ?? null
    const remoteChecksum = remoteMap.get(relPath) ?? null

    if (localChecksum === remoteChecksum) {
      result.unchanged.push(relPath)
      continue
    }

    if (!hasBase) {
      result.conflicts.push({
        path: relPath,
        baseChecksum: null,
        localChecksum,
        remoteChecksum,
        reason: 'no-base'
      })
      continue
    }

    const localChanged = localChecksum !== baseChecksum
    const remoteChanged = remoteChecksum !== baseChecksum

    if (localChanged && !remoteChanged) {
      result.localChanges.push(relPath)
    } else if (!localChanged && remoteChanged) {
      result.remoteChanges.push(relPath)
    } else {
      result.conflicts.push({
        path: relPath,
        baseChecksum,
        localChecksum,
        remoteChecksum,
        reason: classifyConflict(baseChecksum, localChecksum, remoteChecksum)
      })
    }

    if (baseChecksum === null && (localChecksum !== null || remoteChecksum !== null)) {
      result.additions.push(relPath)
    }
    if (baseChecksum !== null && (localChecksum === null || remoteChecksum === null)) {
      result.deletions.push(relPath)
    }
  }

  result.conflicts.sort((left, right) => left.path.localeCompare(right.path))
  result.unchanged.sort()
  result.localChanges.sort()
  result.remoteChanges.sort()
  result.additions.sort()
  result.deletions.sort()
  return result
}

export function detectSyncConflicts(
  base: SyncSnapshotInput | null | undefined,
  local: SyncSnapshotInput,
  remote: SyncSnapshotInput
): VaultSyncConflict[]
export function detectSyncConflicts(input: DetectSyncConflictsInput): VaultSyncConflict[]
export function detectSyncConflicts(
  baseOrInput: SyncSnapshotInput | null | undefined | DetectSyncConflictsInput,
  localInput?: SyncSnapshotInput,
  remoteInput?: SyncSnapshotInput
): VaultSyncConflict[] {
  return isComparisonInput(baseOrInput)
    ? compareVaultSync(baseOrInput).conflicts
    : compareVaultSync(
        baseOrInput,
        localInput as SyncSnapshotInput,
        remoteInput as SyncSnapshotInput
      ).conflicts
}

export const findSyncConflicts = detectSyncConflicts
export const detectVaultSyncConflicts = detectSyncConflicts
export const detectConflicts = detectSyncConflicts

export function syncSnapshotFromChecksums(
  checksums: Readonly<Record<string, string>>
): VaultSyncSnapshot {
  return {
    files: Object.entries(checksums)
      .filter(([relPath]) => isPortableVaultPath(relPath))
      .map(([relPath, checksum]) => ({ path: normalizeSyncPath(relPath), checksum }))
      .sort((left, right) => left.path.localeCompare(right.path))
  }
}

function toSnapshotMap(snapshot: SyncSnapshotInput | null | undefined): Map<string, string> {
  const map = new Map<string, string>()
  if (snapshot === null || snapshot === undefined) {
    return map
  }

  const entries: Array<[string, string]> = Array.isArray(snapshot)
    ? snapshot.map((entry) => [entry.path, entry.checksum] as [string, string])
    : isSnapshotWithFiles(snapshot)
      ? snapshot.files.map((entry) => [entry.path, entry.checksum] as [string, string])
      : Object.entries(snapshot)

  for (const [pathInput, checksum] of entries) {
    const relPath = normalizeSyncPath(pathInput)
    if (!isPortableVaultPath(relPath)) {
      continue
    }
    if (typeof checksum !== 'string' || checksum.length === 0) {
      throw new Error(`Sync checksum must be a non-empty string: ${relPath}`)
    }
    if (map.has(relPath)) {
      throw new Error(`Sync snapshot contains duplicate path: ${relPath}`)
    }
    map.set(relPath, checksum)
  }
  return map
}

function normalizeSyncPath(value: string): string {
  if (
    typeof value !== 'string' ||
    !value ||
    value.includes('\\') ||
    value.startsWith('/') ||
    /^[a-zA-Z]:/.test(value)
  ) {
    throw new Error(`Sync path must be a portable relative path: ${String(value)}`)
  }
  const normalized = path.posix.normalize(value)
  if (normalized === '.' || normalized.startsWith('../') || normalized.includes('/../')) {
    throw new Error(`Sync path escapes the vault: ${value}`)
  }
  return normalized
}

function classifyConflict(
  baseChecksum: string | null,
  localChecksum: string | null,
  remoteChecksum: string | null
): VaultSyncConflict['reason'] {
  if (baseChecksum === null && localChecksum !== null && remoteChecksum !== null) {
    return 'add-add'
  }
  if (baseChecksum !== null && (localChecksum === null || remoteChecksum === null)) {
    return 'delete-update'
  }
  return 'concurrent-edit'
}

function isComparisonInput(value: unknown): value is DetectSyncConflictsInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }
  return 'local' in value && 'remote' in value
}

function isSnapshotWithFiles(value: unknown): value is VaultSyncSnapshot | VaultTransferManifest {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !('files' in value)) {
    return false
  }
  return Array.isArray((value as { files?: unknown }).files)
}
