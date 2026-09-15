import { describe, expect, it, vi } from 'vitest'
import { createDefaultStickyNoteBoard } from '../src/shared/stickyNotes'
import {
  createStickyNoteSaveCoordinator,
  type StickyNoteSaveRequest
} from '../src/renderer/src/lib/stickyNoteSaveCoordinator'

function request(version: number): StickyNoteSaveRequest {
  return {
    board: createDefaultStickyNoteBoard(),
    version
  }
}

function deferred<T>(): {
  promise: Promise<T>
  resolve: (value: T) => void
} {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve
  })
  return { promise, resolve }
}

describe('sticky note save coordinator', () => {
  it('keeps the first active save and only the newest pending snapshot', async () => {
    const firstSave = deferred<void>()
    const save = vi
      .fn<(next: StickyNoteSaveRequest) => Promise<void>>()
      .mockImplementationOnce(() => firstSave.promise)
      .mockResolvedValue(undefined)
    const coordinator = createStickyNoteSaveCoordinator({ save })

    coordinator.enqueue(request(1))
    coordinator.enqueue(request(2))
    coordinator.enqueue(request(3))

    await Promise.resolve()
    expect(save).toHaveBeenCalledTimes(1)
    expect(save.mock.calls[0]?.[0].version).toBe(1)

    firstSave.resolve()
    await coordinator.flush()

    expect(save).toHaveBeenCalledTimes(2)
    expect(save.mock.calls[1]?.[0].version).toBe(3)
  })

  it('flushes a pending snapshot immediately and waits for it to finish', async () => {
    const save = vi
      .fn<(next: StickyNoteSaveRequest) => Promise<void>>()
      .mockResolvedValue(undefined)
    const coordinator = createStickyNoteSaveCoordinator({ save })

    coordinator.enqueue(request(7))
    await coordinator.flush()

    expect(save).toHaveBeenCalledTimes(1)
    expect(save.mock.calls[0]?.[0].version).toBe(7)
  })

  it('reports failures and remains usable for newer snapshots', async () => {
    const error = new Error('write failed')
    const onError = vi.fn()
    const save = vi
      .fn<(next: StickyNoteSaveRequest) => Promise<void>>()
      .mockRejectedValueOnce(error)
      .mockResolvedValue(undefined)
    const coordinator = createStickyNoteSaveCoordinator({ save, onError })

    coordinator.enqueue(request(1))
    coordinator.enqueue(request(2))
    await coordinator.flush()

    expect(onError).toHaveBeenCalledWith(error)
    expect(save).toHaveBeenCalledTimes(2)
    expect(save.mock.calls[1]?.[0].version).toBe(2)
  })
})
