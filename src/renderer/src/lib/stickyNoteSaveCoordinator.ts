import type { StickyNoteBoardState } from '../../../shared/types'

export interface StickyNoteSaveRequest {
  board: StickyNoteBoardState
  version: number
}

interface CreateStickyNoteSaveCoordinatorOptions {
  save: (request: StickyNoteSaveRequest) => Promise<void>
  onError?: (error: unknown) => void
}

export interface StickyNoteSaveCoordinator {
  enqueue: (request: StickyNoteSaveRequest) => void
  flush: () => Promise<void>
}

/**
 * Keeps one sticky-note settings write in flight and replaces stale pending
 * snapshots with the newest board state.
 */
export function createStickyNoteSaveCoordinator(
  options: CreateStickyNoteSaveCoordinatorOptions
): StickyNoteSaveCoordinator {
  let pendingRequest: StickyNoteSaveRequest | null = null
  let runningSave: Promise<void> | null = null

  const startNextSave = (): void => {
    if (runningSave || !pendingRequest) {
      return
    }

    const request = pendingRequest
    pendingRequest = null

    const save = Promise.resolve()
      .then(() => options.save(request))
      .catch((error: unknown) => {
        try {
          options.onError?.(error)
        } catch {
          // Error reporting must not strand the coordinator.
        }
      })

    runningSave = save.then(() => {
      runningSave = null
      startNextSave()
    })
  }

  return {
    enqueue(request) {
      pendingRequest = request
      startNextSave()
    },
    async flush() {
      while (runningSave || pendingRequest) {
        if (!runningSave) {
          startNextSave()
        }

        await runningSave
      }
    }
  }
}
