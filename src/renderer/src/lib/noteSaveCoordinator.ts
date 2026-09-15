import type { StoredNoteDocument } from '../../../shared/types'
import type { WriteNoteResult } from '../../../shared/vaultProtocol'

export interface NoteSaveRequest {
  relPath: string
  content: string
  document: StoredNoteDocument
  baseHash?: string | null
  clientMutationId?: string
  workspaceTabId?: string
}

export class NoteSaveConflictError extends Error {
  readonly result: Extract<WriteNoteResult, { ok: false }>

  constructor(result: Extract<WriteNoteResult, { ok: false }>) {
    super(result.error.message)
    this.name = 'NoteSaveConflictError'
    this.result = result
  }
}

interface CreateNoteSaveCoordinatorOptions {
  onPersisted?: (request: NoteSaveRequest) => Promise<void> | void
  writeNote: (request: NoteSaveRequest) => Promise<void | WriteNoteResult>
}

export interface NoteSaveCoordinator {
  enqueue: (request: NoteSaveRequest) => Promise<void>
  setBaseRevision: (relPath: string, revision: string | null, workspaceTabId?: string) => void
}

export function createNoteSaveCoordinator(
  options: CreateNoteSaveCoordinatorOptions
): NoteSaveCoordinator {
  let queue = Promise.resolve()
  let latestVersion = 0
  const latestRevisions = new Map<string, { revision: string | null; workspaceTabId?: string }>()

  return {
    enqueue(request) {
      const requestVersion = ++latestVersion
      const run = async (): Promise<void> => {
        const executionRequest =
          latestRevisions.has(request.relPath) &&
          request.baseHash !== undefined &&
          latestRevisions.get(request.relPath)?.workspaceTabId === request.workspaceTabId
            ? {
                ...request,
                baseHash: latestRevisions.get(request.relPath)?.revision ?? null
              }
            : request
        const result = await options.writeNote(executionRequest)
        if (result && !result.ok) {
          throw new NoteSaveConflictError(result)
        }
        if (result?.ok) {
          latestRevisions.set(request.relPath, {
            revision: result.revision.contentHash,
            workspaceTabId: request.workspaceTabId
          })
        }

        if (requestVersion === latestVersion) {
          await options.onPersisted?.(request)
        }
      }

      const next = queue.catch(() => undefined).then(run)
      queue = next
      return next
    },
    setBaseRevision(relPath, revision, workspaceTabId) {
      latestRevisions.set(relPath, { revision, workspaceTabId })
    }
  }
}
