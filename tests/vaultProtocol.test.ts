import { describe, expect, it } from 'vitest'
import type {
  NoteDocumentReadResult,
  VaultChangeEvent,
  VaultConflict,
  VaultDomainDefinition,
  VaultFileRevision,
  VaultQuarantineRecord,
  VaultReconcileResult,
  VaultStatus,
  WriteNoteDocumentRequest,
  WriteNoteResult
} from '../src/shared/vaultProtocol'

const revision: VaultFileRevision = {
  contentHash: 'sha256:base',
  size: 24,
  mtimeMs: 1_756_000_000_000,
  sequence: 7,
  revision: 'rev-7'
}

const domain: VaultDomainDefinition = {
  id: 'notes',
  canonicalRoots: ['notebooks'],
  derivedPaths: ['index.sqlite', 'filemap.json'],
  parser: 'stored-note-markdown',
  schemaVersion: 1,
  identity: 'content-id',
  editPolicy: 'markdown-merge',
  transactionUnit: 'file',
  portable: true,
  onMalformed: 'quarantine'
}

const change: VaultChangeEvent = {
  vaultId: 'vault-1',
  sequence: 8,
  transactionId: 'tx-8',
  domain: 'notes',
  kind: 'change',
  path: 'notebooks/readme.md',
  source: 'external',
  contentHash: 'sha256:external',
  baseHash: revision.contentHash,
  revision: 'rev-8',
  observedAt: '2026-08-29T00:00:00.000Z'
}

const conflict: VaultConflict = {
  id: 'conflict-1',
  vaultId: 'vault-1',
  domain: 'notes',
  path: 'notebooks/readme.md',
  kind: 'compare-and-swap',
  detectedAt: '2026-08-29T00:00:01.000Z',
  base: revision,
  local: { ...revision, contentHash: 'sha256:local', revision: 'rev-local' },
  external: { ...revision, contentHash: 'sha256:external', revision: 'rev-external' },
  localContentPath: '.xingularity/conflicts/conflict-1.local',
  externalContentPath: '.xingularity/conflicts/conflict-1.external'
}

const quarantine: VaultQuarantineRecord = {
  id: 'quarantine-1',
  vaultId: 'vault-1',
  domain: 'tasks',
  path: 'tasks/task-1.json',
  quarantinePath: '.xingularity/quarantine/quarantine-1.json',
  contentHash: 'sha256:invalid',
  quarantinedAt: '2026-08-29T00:00:02.000Z',
  reason: 'Invalid JSON',
  parser: 'json'
}

const status: VaultStatus = {
  vaultId: 'vault-1',
  vaultPath: '/vault',
  state: 'watching',
  lastScanAt: '2026-08-29T00:00:03.000Z',
  lastCommittedSequence: change.sequence,
  externalChangeCount: 1,
  conflictCount: 1,
  quarantineCount: 1,
  staleDomains: []
}

describe('vault protocol contracts', () => {
  it('accepts the documented catalog, revision, read, and write shapes', () => {
    const read: NoteDocumentReadResult = {
      document: { version: 1, tags: ['docs'], markdown: '# Read me' },
      revision
    }
    const request: WriteNoteDocumentRequest = {
      path: 'notebooks/readme.md',
      document: read.document,
      baseHash: read.revision.contentHash,
      clientMutationId: 'client-1'
    }
    const result: WriteNoteResult = {
      ok: true,
      path: request.path,
      revision: { ...revision, sequence: 8 },
      transactionId: 'tx-8'
    }

    expect(domain).toMatchObject({ id: 'notes', editPolicy: 'markdown-merge' })
    expect(read.document.markdown).toBe('# Read me')
    expect(result).toMatchObject({ ok: true, path: request.path })
  })

  it('keeps changes, conflicts, quarantine, and reconciliation JSON-serializable', () => {
    const result: VaultReconcileResult = {
      vaultId: 'vault-1',
      startedAt: '2026-08-29T00:00:00.000Z',
      completedAt: '2026-08-29T00:00:03.000Z',
      sequence: change.sequence,
      status,
      scannedFiles: 12,
      changes: [change],
      conflicts: [conflict],
      quarantine: [quarantine],
      errors: [
        {
          code: 'validation-failed',
          message: 'Task schema is invalid',
          path: quarantine.path,
          domain: quarantine.domain,
          details: ['id is required']
        }
      ]
    }

    const serialized = JSON.stringify(result)
    expect(serialized).toContain('compare-and-swap')
    expect(JSON.parse(serialized)).toEqual(result)
  })

  it('represents compare-and-swap and path failures as serializable result payloads', () => {
    const failures: WriteNoteResult[] = [
      {
        ok: false,
        path: 'notebooks/readme.md',
        error: {
          code: 'compare-and-swap-conflict',
          message: 'The note changed on disk',
          path: 'notebooks/readme.md',
          expectedBaseHash: 'sha256:base',
          actualRevision: { ...revision, contentHash: 'sha256:external' }
        }
      },
      {
        ok: false,
        path: '../outside.md',
        error: {
          code: 'path-traversal',
          message: 'Path must remain inside the vault',
          path: '../outside.md'
        }
      }
    ]

    expect(JSON.parse(JSON.stringify(failures))).toEqual(failures)
  })
})
