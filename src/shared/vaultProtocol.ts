import type { StoredNoteDocument } from './types'

export type VaultDomain =
  | 'notes'
  | 'drawings'
  | 'attachments'
  | 'fleeting'
  | 'projects'
  | 'tasks'
  | 'calendar'
  | 'planning'
  | 'weekly-plan'
  | 'subscriptions'
  | 'schedules'
  | 'agent'
  | 'resources'
  | 'settings'
  | 'vault'

export type VaultDomainId = VaultDomain

export type VaultIdentityStrategy = 'path' | 'record-id' | 'content-id'

export type VaultEditPolicy = 'markdown-merge' | 'structured-validate' | 'binary-copy' | 'app-only'

export type VaultTransactionUnit = 'file' | 'record' | 'domain' | 'vault'

export type VaultMalformedFilePolicy = 'quarantine' | 'reject' | 'ignore'

export interface VaultDomainDefinition {
  id: VaultDomain
  canonicalRoots: string[]
  derivedPaths: string[]
  parser: string
  schemaVersion: number
  identity: VaultIdentityStrategy
  editPolicy: VaultEditPolicy
  transactionUnit: VaultTransactionUnit
  portable: boolean
  onMalformed: VaultMalformedFilePolicy
}

export interface VaultFileRevision {
  contentHash: string
  size: number
  mtimeMs: number
  sequence?: number
  revision?: string
}

export interface NoteDocumentReadResult {
  document: StoredNoteDocument
  revision: VaultFileRevision
}

export interface WriteNoteDocumentRequest {
  path: string
  document: StoredNoteDocument
  baseDocument?: StoredNoteDocument
  baseHash: string | null
  clientMutationId: string
}

export type VaultCompareAndSwapErrorCode = 'compare-and-swap-conflict'

export interface VaultCompareAndSwapConflictError {
  code: VaultCompareAndSwapErrorCode
  message: string
  path: string
  expectedBaseHash: string | null
  actualRevision: VaultFileRevision | null
}

export type VaultCompareAndSwapConflictPayload = VaultCompareAndSwapConflictError
export type VaultCompareAndSwapErrorPayload = VaultCompareAndSwapConflictError

export type VaultPathErrorCode =
  | 'invalid-path'
  | 'path-outside-vault'
  | 'path-traversal'
  | 'symlink-escape'
  | 'unsupported-path'

export interface VaultPathErrorPayload {
  code: VaultPathErrorCode
  message: string
  path: string
}

export type VaultValidationErrorCode = 'validation-failed' | 'malformed-file' | 'unsupported-schema'

export interface VaultValidationErrorPayload {
  code: VaultValidationErrorCode
  message: string
  path: string
  domain?: VaultDomain
  parser?: string
  schemaVersion?: number
  details?: string[]
}

export type VaultProtocolErrorPayload =
  | VaultCompareAndSwapConflictError
  | VaultPathErrorPayload
  | VaultValidationErrorPayload

export type VaultErrorPayload = VaultProtocolErrorPayload

export interface WriteNoteSuccess {
  ok: true
  path: string
  revision: VaultFileRevision
  transactionId: string
}

export interface WriteNoteFailure {
  ok: false
  path: string
  conflictId?: string
  error: VaultProtocolErrorPayload
}

export type WriteNoteResult = WriteNoteSuccess | WriteNoteFailure

export type VaultChangeKind = 'add' | 'change' | 'delete' | 'rename' | 'repair'
export type VaultEventKind = VaultChangeKind

export type VaultChangeSource = 'app' | 'external' | 'sync' | 'reconcile'
export type VaultEventSource = VaultChangeSource

export interface VaultChangeEvent {
  vaultId: string
  sequence: number
  transactionId: string
  domain: VaultDomain
  kind: VaultChangeKind
  path: string
  previousPath?: string
  source: VaultChangeSource
  contentHash?: string
  baseHash?: string
  revision?: string
  observedAt: string
}

export type VaultConflictKind =
  | 'content'
  | 'compare-and-swap'
  | 'delete-update'
  | 'add-add'
  | 'binary'
  | 'validation'

export type VaultConflictStatus = 'unresolved' | 'resolved'

export type VaultConflictResolution =
  | 'keep-local'
  | 'keep-external'
  | 'merge'
  | 'keep-both'
  | 'discard-local'
  | 'discard-external'

export interface VaultConflictDetails {
  conflict: VaultConflict
  baseContent: string | null
  localContent: string | null
  externalContent: string | null
}

export interface VaultConflictResolutionRequest {
  conflictId: string
  resolution: VaultConflictResolution
}

export interface VaultConflictResolutionResult {
  conflictId: string
  path: string
  resolution: VaultConflictResolution
  recoveryRetained: boolean
  revision: VaultFileRevision | null
}

export interface VaultConflict {
  id: string
  vaultId: string
  domain: VaultDomain
  path: string
  kind: VaultConflictKind
  detectedAt: string
  base: VaultFileRevision | null
  local: VaultFileRevision | null
  external: VaultFileRevision | null
  localContentPath?: string
  externalContentPath?: string
  status?: VaultConflictStatus
  resolution?: VaultConflictResolution
  resolvedAt?: string
}

export interface VaultQuarantineRecord {
  id: string
  vaultId: string
  domain: VaultDomain
  path: string
  quarantinePath: string
  contentHash: string
  quarantinedAt: string
  reason: string
  parser?: string
  validationError?: VaultValidationErrorPayload
  restoreInstructions?: string
  restoredAt?: string
}

export type VaultStatusState =
  | 'watching'
  | 'reconciling'
  | 'external-change'
  | 'conflict'
  | 'needs-repair'
  | 'offline'

export type VaultStatusKind = VaultStatusState

export interface VaultStatus {
  vaultId: string
  vaultPath: string
  state: VaultStatusState
  watchedRoots?: number
  lastScanAt: string | null
  lastCommittedSequence: number
  externalChangeCount: number
  conflictCount: number
  quarantineCount: number
  staleDomains: VaultDomain[]
  lastError?: string
}

export interface VaultReconcileResult {
  vaultId: string
  startedAt: string
  completedAt: string
  sequence: number
  status: VaultStatus
  scannedFiles: number
  changes: VaultChangeEvent[]
  conflicts: VaultConflict[]
  quarantine: VaultQuarantineRecord[]
  errors: Array<VaultPathErrorPayload | VaultValidationErrorPayload>
}

export interface VaultSyncSnapshot {
  status: VaultStatus
  events: VaultChangeEvent[]
  conflicts: VaultConflict[]
  quarantine: VaultQuarantineRecord[]
}
