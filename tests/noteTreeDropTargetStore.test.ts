import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  clearNoteTreeDropTarget,
  isNoteTreeDropTarget,
  setNoteTreeDropTarget,
  subscribeNoteTreeDropTarget
} from '../src/renderer/src/lib/noteTreeDropTargetStore'

describe('note tree drop target store', () => {
  beforeEach(() => {
    clearNoteTreeDropTarget()
  })

  it('notifies only the previous and next folder once per target transition', () => {
    const previousListener = vi.fn()
    const nextListener = vi.fn()
    const unrelatedListener = vi.fn()

    subscribeNoteTreeDropTarget('folder:previous', previousListener)
    subscribeNoteTreeDropTarget('folder:next', nextListener)
    subscribeNoteTreeDropTarget('folder:unrelated', unrelatedListener)

    setNoteTreeDropTarget('folder:previous')
    setNoteTreeDropTarget('folder:previous')

    expect(previousListener).toHaveBeenCalledTimes(1)
    expect(nextListener).not.toHaveBeenCalled()
    expect(unrelatedListener).not.toHaveBeenCalled()
    expect(isNoteTreeDropTarget('folder:previous')).toBe(true)

    setNoteTreeDropTarget('folder:next')

    expect(previousListener).toHaveBeenCalledTimes(2)
    expect(nextListener).toHaveBeenCalledTimes(1)
    expect(unrelatedListener).not.toHaveBeenCalled()
    expect(isNoteTreeDropTarget('folder:previous')).toBe(false)
    expect(isNoteTreeDropTarget('folder:next')).toBe(true)
  })

  it('clears the active target and removes unsubscribed listeners', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeNoteTreeDropTarget('folder:archive', listener)

    setNoteTreeDropTarget('folder:archive')
    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()
    clearNoteTreeDropTarget()

    expect(listener).toHaveBeenCalledTimes(1)
    expect(isNoteTreeDropTarget('folder:archive')).toBe(false)
  })
})
