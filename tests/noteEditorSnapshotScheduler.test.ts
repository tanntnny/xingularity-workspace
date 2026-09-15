import { afterEach, describe, expect, it, vi } from 'vitest'

import { createNoteEditorSnapshotScheduler } from '../src/renderer/src/lib/noteEditorSnapshotScheduler'

describe('note editor snapshot scheduler', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('publishes only the latest content after the trailing delay', () => {
    vi.useFakeTimers()
    const published: string[] = []
    const scheduler = createNoteEditorSnapshotScheduler({
      debounceMs: 250,
      maxWaitMs: 1000,
      onFlush: (content) => published.push(content)
    })

    scheduler.schedule('first')
    scheduler.schedule('latest')
    vi.advanceTimersByTime(249)
    expect(published).toEqual([])

    vi.advanceTimersByTime(1)
    expect(published).toEqual(['latest'])
  })

  it('publishes during continuous typing at the maximum wait', () => {
    vi.useFakeTimers()
    const published: string[] = []
    const scheduler = createNoteEditorSnapshotScheduler({
      debounceMs: 600,
      maxWaitMs: 1000,
      onFlush: (content) => published.push(content)
    })

    scheduler.schedule('at-start')
    vi.advanceTimersByTime(500)
    scheduler.schedule('at-halfway')
    vi.advanceTimersByTime(499)
    expect(published).toEqual([])

    vi.advanceTimersByTime(1)
    expect(published).toEqual(['at-halfway'])
  })

  it('flushes immediately and does not publish the same change twice', () => {
    vi.useFakeTimers()
    const published: string[] = []
    const scheduler = createNoteEditorSnapshotScheduler({
      debounceMs: 250,
      maxWaitMs: 1000,
      onFlush: (content) => published.push(content)
    })

    scheduler.schedule('pending')
    expect(scheduler.flush()).toBe('pending')
    expect(scheduler.flush()).toBeNull()
    vi.runAllTimers()

    expect(published).toEqual(['pending'])
  })

  it('cancels pending content and ignores future schedules after disposal', () => {
    vi.useFakeTimers()
    const published: string[] = []
    const scheduler = createNoteEditorSnapshotScheduler({
      debounceMs: 120,
      maxWaitMs: 1000,
      onFlush: (content) => published.push(content)
    })

    scheduler.schedule('cancelled')
    scheduler.cancel()
    scheduler.schedule('disposed')
    scheduler.dispose()
    vi.runAllTimers()

    expect(published).toEqual([])
  })
})
