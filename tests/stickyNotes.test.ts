import { describe, expect, it } from 'vitest'
import {
  DEFAULT_STICKY_NOTE_BOARD,
  STICKY_NOTE_FONT_SIZE,
  STICKY_NOTE_FONT_WEIGHT,
  normalizeStickyNoteBoard
} from '../src/shared/stickyNotes'

describe('sticky notes', () => {
  it('normalizes persisted board data without mutating the source', () => {
    const input = {
      viewport: { x: Number.NaN, y: 42, zoom: 99 },
      notes: [
        {
          id: 'keep-me',
          text: 'A'.repeat(25_000),
          color: 'pink',
          position: { x: 12, y: -8 },
          size: { width: 80, height: 12 },
          zIndex: 3
        },
        { id: 'discard-me', color: 'not-a-color' },
        {
          id: 'second',
          text: 'Second note',
          color: 'blue',
          position: { x: 0, y: 0 },
          size: { width: 300, height: 220 },
          zIndex: 8
        }
      ]
    }

    const normalized = normalizeStickyNoteBoard(input)

    expect(normalized).toEqual({
      viewport: { x: 0, y: 42, zoom: 4 },
      notes: [
        {
          id: 'keep-me',
          text: 'A'.repeat(20_000),
          color: 'pink',
          position: { x: 12, y: -8 },
          size: { width: 180, height: 160 },
          zIndex: 3
        },
        {
          id: 'second',
          text: 'Second note',
          color: 'blue',
          position: { x: 0, y: 0 },
          size: { width: 300, height: 220 },
          zIndex: 8
        }
      ]
    })
    expect(input).toEqual({
      viewport: { x: Number.NaN, y: 42, zoom: 99 },
      notes: [
        {
          id: 'keep-me',
          text: 'A'.repeat(25_000),
          color: 'pink',
          position: { x: 12, y: -8 },
          size: { width: 80, height: 12 },
          zIndex: 3
        },
        { id: 'discard-me', color: 'not-a-color' },
        {
          id: 'second',
          text: 'Second note',
          color: 'blue',
          position: { x: 0, y: 0 },
          size: { width: 300, height: 220 },
          zIndex: 8
        }
      ]
    })
  })

  it('returns a stable default board for missing or malformed values', () => {
    expect(normalizeStickyNoteBoard(null)).toEqual(DEFAULT_STICKY_NOTE_BOARD)
    expect(normalizeStickyNoteBoard({ notes: 'nope' })).toEqual(DEFAULT_STICKY_NOTE_BOARD)
  })

  it('keeps note text at a fixed readable size regardless of note dimensions', () => {
    expect(STICKY_NOTE_FONT_SIZE).toBe(24)
    expect(STICKY_NOTE_FONT_WEIGHT).toBe(500)
  })
})
