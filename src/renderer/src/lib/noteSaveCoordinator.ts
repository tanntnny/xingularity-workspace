import type { StoredNoteDocument } from '../../../shared/types'

export interface NoteSaveRequest {
  relPath: string
  content: string
  document: StoredNoteDocument
}

interface CreateNoteSaveCoordinatorOptions {
  onPersisted?: (request: NoteSaveRequest) => Promise<void> | void
  writeNote: (request: NoteSaveRequest) => Promise<void>
}

export interface NoteSaveCoordinator {
  enqueue: (request: NoteSaveRequest) => Promise<void>
}

export function createNoteSaveCoordinator(
  options: CreateNoteSaveCoordinatorOptions
): NoteSaveCoordinator {
  let queue = Promise.resolve()
  let latestVersion = 0

  return {
    enqueue(request) {
      const requestVersion = ++latestVersion
      const run = async (): Promise<void> => {
        await options.writeNote(request)

        if (requestVersion === latestVersion) {
          await options.onPersisted?.(request)
        }
      }

      const next = queue.catch(() => undefined).then(run)
      queue = next
      return next
    }
  }
}
