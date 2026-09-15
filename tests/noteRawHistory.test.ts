import { describe, expect, it } from 'vitest'

import {
  getNoteRawHistoryEntryBytes,
  NOTE_RAW_HISTORY_MAX_BYTES,
  NOTE_RAW_HISTORY_LIMIT,
  trimNoteRawHistory
} from '../src/renderer/src/lib/noteRawHistory'

describe('raw note undo history', () => {
  it('keeps the most recent entries within the entry limit', () => {
    const history = Array.from({ length: NOTE_RAW_HISTORY_LIMIT + 2 }, (_, index) => `${index}`)
    const historyBytes = history.reduce(
      (total, value) => total + getNoteRawHistoryEntryBytes(value),
      0
    )

    const nextBytes = trimNoteRawHistory(history, historyBytes)

    expect(history).toHaveLength(NOTE_RAW_HISTORY_LIMIT)
    expect(history[0]).toBe('2')
    expect(nextBytes).toBe(
      history.reduce((total, value) => total + getNoteRawHistoryEntryBytes(value), 0)
    )
  })

  it('evicts the oldest snapshots when the byte budget is exceeded', () => {
    const entry = 'x'.repeat(1024 * 1024)
    const history = [entry, entry, entry, entry, entry]
    const historyBytes = history.length * getNoteRawHistoryEntryBytes(entry)

    const nextBytes = trimNoteRawHistory(history, historyBytes)

    expect(nextBytes).toBeLessThanOrEqual(NOTE_RAW_HISTORY_MAX_BYTES)
    expect(history).toHaveLength(4)
  })
})
