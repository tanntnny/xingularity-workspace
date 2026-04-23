import { describe, expect, it } from 'vitest'
import {
  getPrimaryNoteTreeSelectionEntry,
  normalizeNoteTreeSelection
} from '../src/renderer/src/lib/noteTreeSelection'

describe('noteTreeSelection', () => {
  it('drops duplicate entries and descendants of selected folders', () => {
    expect(
      normalizeNoteTreeSelection([
        { kind: 'folder', relPath: 'projects' },
        { kind: 'note', relPath: 'projects/alpha.md' },
        { kind: 'folder', relPath: 'projects/nested' },
        { kind: 'folder', relPath: 'projects' },
        { kind: 'note', relPath: 'loose.md' }
      ])
    ).toEqual([
      { kind: 'folder', relPath: 'projects' },
      { kind: 'note', relPath: 'loose.md' }
    ])
  })

  it('returns the last selected entry as the primary selection', () => {
    expect(
      getPrimaryNoteTreeSelectionEntry([
        { kind: 'note', relPath: 'alpha.md' },
        { kind: 'folder', relPath: 'projects' }
      ])
    ).toEqual({ kind: 'folder', relPath: 'projects' })
  })
})
