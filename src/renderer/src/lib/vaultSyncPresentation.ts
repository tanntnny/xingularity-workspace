import type { UiTone } from './uiTone'

export type VaultSyncPageStatus = 'loading' | 'ready' | 'error'

export type VaultWatcherStatus = 'watching' | 'paused' | 'offline' | 'error'

export type VaultReconcileStatus = 'idle' | 'running' | 'complete' | 'failed'

export type VaultSyncChangeKind = 'add' | 'change' | 'delete' | 'rename'

export type VaultSyncChangeSource = 'external' | 'app' | 'sync' | 'reconcile'

export type VaultSyncConflictKind =
  | 'content'
  | 'structured'
  | 'binary'
  | 'delete-update'
  | 'add-add'

export type VaultSyncRepairKind = 'quarantine' | 'needs-repair' | 'rename' | 'projection'

export interface VaultSyncChange {
  id: string
  path: string
  domain: string
  kind: VaultSyncChangeKind
  observedAt: string
  source?: VaultSyncChangeSource
  previousPath?: string
  transactionId?: string
}

export interface VaultSyncConflict {
  id: string
  path: string
  domain: string
  kind: VaultSyncConflictKind
  summary: string
  createdAt: string
}

export interface VaultSyncRepair {
  id: string
  path: string
  domain: string
  kind: VaultSyncRepairKind
  summary: string
  createdAt: string
}

export interface VaultSyncPortableScope {
  includedCategories: readonly string[]
  excludedCategories: readonly string[]
}

export interface VaultSyncSnapshot {
  vaultPath: string
  vaultId?: string | null
  watcher: {
    status: VaultWatcherStatus
    watchedRoots?: number | null
    lastEventAt?: string | null
    message?: string | null
  }
  reconcile: {
    status: VaultReconcileStatus
    message?: string | null
  }
  lastScanAt?: string | null
  lastCommittedSequence?: number | null
  externalChanges: readonly VaultSyncChange[]
  conflicts: readonly VaultSyncConflict[]
  repairs: readonly VaultSyncRepair[]
  portableScope?: VaultSyncPortableScope | null
}

export interface VaultSyncStatusPresentation {
  label: string
  description: string
  tone: UiTone
}

export interface VaultSyncPresentation {
  health: VaultSyncStatusPresentation
  watcher: VaultSyncStatusPresentation
  reconcile: VaultSyncStatusPresentation
  lastScanLabel: string
  sequenceLabel: string
  externalChangeCount: number
  conflictCount: number
  repairCount: number
  attentionCount: number
}

const CHANGE_KIND_LABELS: Record<VaultSyncChangeKind, string> = {
  add: 'Added',
  change: 'Changed',
  delete: 'Deleted',
  rename: 'Renamed'
}

const CONFLICT_KIND_LABELS: Record<VaultSyncConflictKind, string> = {
  content: 'Content conflict',
  structured: 'Structured conflict',
  binary: 'Binary conflict',
  'delete-update': 'Delete/update conflict',
  'add-add': 'Add/add conflict'
}

const REPAIR_KIND_LABELS: Record<VaultSyncRepairKind, string> = {
  quarantine: 'Quarantined',
  'needs-repair': 'Needs repair',
  rename: 'Rename review',
  projection: 'Projection repair'
}

function titleCaseIdentifier(value: string): string {
  return value
    .trim()
    .split(/[-_/]+/u)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function formatVaultSyncDomain(domain: string): string {
  const label = titleCaseIdentifier(domain)
  return label || 'Unknown domain'
}

export function formatVaultSyncChangeKind(kind: VaultSyncChangeKind): string {
  return CHANGE_KIND_LABELS[kind]
}

export function formatVaultSyncConflictKind(kind: VaultSyncConflictKind): string {
  return CONFLICT_KIND_LABELS[kind]
}

export function formatVaultSyncRepairKind(kind: VaultSyncRepairKind): string {
  return REPAIR_KIND_LABELS[kind]
}

export function formatVaultSyncChangeSource(source: VaultSyncChangeSource = 'external'): string {
  const labels: Record<VaultSyncChangeSource, string> = {
    external: 'External edit',
    app: 'App write',
    sync: 'Sync import',
    reconcile: 'Reconciliation'
  }

  return labels[source]
}

export function formatVaultSyncTimestamp(timestamp?: string | null): string {
  if (!timestamp) {
    return 'Not yet'
  }

  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) {
    return 'Unavailable'
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date)
}

export function formatVaultSyncSequence(sequence?: number | null): string {
  return sequence == null ? 'Not recorded' : `#${sequence.toLocaleString()}`
}

export function formatVaultSyncCount(
  count: number,
  singular: string,
  plural = `${singular}s`
): string {
  return `${count.toLocaleString()} ${count === 1 ? singular : plural}`
}

export function getVaultWatcherPresentation(
  status: VaultWatcherStatus,
  watchedRoots?: number | null
): VaultSyncStatusPresentation {
  const rootDescription =
    watchedRoots == null
      ? 'Canonical vault paths are monitored.'
      : `${formatVaultSyncCount(watchedRoots, 'canonical root')} are monitored.`

  const presentations: Record<VaultWatcherStatus, VaultSyncStatusPresentation> = {
    watching: {
      label: 'Watching',
      description: rootDescription,
      tone: 'success'
    },
    paused: {
      label: 'Paused',
      description: 'File events are paused until watching resumes.',
      tone: 'warning'
    },
    offline: {
      label: 'Offline',
      description: 'The vault is not currently being observed.',
      tone: 'warning'
    },
    error: {
      label: 'Watcher error',
      description: 'File events need attention before live updates are reliable.',
      tone: 'danger'
    }
  }

  return presentations[status]
}

export function getVaultReconcilePresentation(
  status: VaultReconcileStatus
): VaultSyncStatusPresentation {
  const presentations: Record<VaultReconcileStatus, VaultSyncStatusPresentation> = {
    idle: {
      label: 'Idle',
      description: 'No reconciliation is running.',
      tone: 'neutral'
    },
    running: {
      label: 'Reconciling',
      description: 'Comparing canonical files with the last known state.',
      tone: 'info'
    },
    complete: {
      label: 'Up to date',
      description: 'The last reconciliation completed successfully.',
      tone: 'success'
    },
    failed: {
      label: 'Needs attention',
      description: 'The last reconciliation did not complete successfully.',
      tone: 'danger'
    }
  }

  return presentations[status]
}

export function getVaultSyncHealthPresentation(
  snapshot: Pick<VaultSyncSnapshot, 'watcher' | 'reconcile' | 'conflicts' | 'repairs'>
): VaultSyncStatusPresentation {
  if (snapshot.watcher.status === 'error' || snapshot.reconcile.status === 'failed') {
    return {
      label: 'Needs attention',
      description: 'Vault health is degraded and needs a review.',
      tone: 'danger'
    }
  }

  if (snapshot.watcher.status === 'offline' || snapshot.watcher.status === 'paused') {
    return {
      label: 'Watching paused',
      description: 'Live external edits may not be visible until watching resumes.',
      tone: 'warning'
    }
  }

  if (snapshot.conflicts.length > 0 || snapshot.repairs.length > 0) {
    return {
      label: 'Review required',
      description: 'Some changes need a deliberate conflict or repair decision.',
      tone: 'warning'
    }
  }

  if (snapshot.reconcile.status === 'running') {
    return {
      label: 'Reconciling',
      description: 'The vault is checking canonical files for changes.',
      tone: 'info'
    }
  }

  return {
    label: 'Healthy',
    description: 'Canonical files and local projections are in sync.',
    tone: 'success'
  }
}

export function getVaultSyncPresentation(snapshot: VaultSyncSnapshot): VaultSyncPresentation {
  const conflictCount = snapshot.conflicts.length
  const repairCount = snapshot.repairs.length

  return {
    health: getVaultSyncHealthPresentation(snapshot),
    watcher: getVaultWatcherPresentation(snapshot.watcher.status, snapshot.watcher.watchedRoots),
    reconcile: getVaultReconcilePresentation(snapshot.reconcile.status),
    lastScanLabel: formatVaultSyncTimestamp(snapshot.lastScanAt),
    sequenceLabel: formatVaultSyncSequence(snapshot.lastCommittedSequence),
    externalChangeCount: snapshot.externalChanges.length,
    conflictCount,
    repairCount,
    attentionCount: conflictCount + repairCount
  }
}

export function getVaultSyncChangeTone(kind: VaultSyncChangeKind): UiTone {
  if (kind === 'delete') {
    return 'attention'
  }

  if (kind === 'rename') {
    return 'info'
  }

  return 'neutral'
}

export function getVaultSyncRepairTone(kind: VaultSyncRepairKind): UiTone {
  return kind === 'quarantine' || kind === 'needs-repair' ? 'danger' : 'warning'
}
