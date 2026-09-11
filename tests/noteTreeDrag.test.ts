import { describe, expect, it } from 'vitest'
import {
  clearActiveNoteTreeDrag,
  getNoteTreeDropVisualState,
  readNoteTreeDragEntries,
  setActiveNoteTreeDrag
} from '../src/renderer/src/lib/noteTreeDrag'

function protectedDataTransfer(): DataTransfer {
  return {
    getData: () => ''
  } as unknown as DataTransfer
}

describe('getNoteTreeDropVisualState', () => {
  it('marks root drops as a root target glow', () => {
    expect(
      getNoteTreeDropVisualState({
        parentNode: {
          id: '__REACT_ARBORIST_INTERNAL_ROOT__',
          isRoot: true
        },
        index: 0
      })
    ).toEqual({
      hoveredFolderId: null,
      isRootDropTarget: true
    })
  })

  it('marks folder highlight drops when hovering directly over a folder', () => {
    expect(
      getNoteTreeDropVisualState({
        parentNode: {
          id: 'folder:Projects',
          isRoot: false,
          data: { kind: 'folder' }
        },
        index: null
      })
    ).toEqual({
      hoveredFolderId: 'folder:Projects',
      isRootDropTarget: false
    })
  })

  it('does not mark insertion positions as hovered folder targets', () => {
    expect(
      getNoteTreeDropVisualState({
        parentNode: {
          id: 'folder:Projects',
          isRoot: false,
          data: { kind: 'folder' }
        },
        index: 2
      })
    ).toEqual({
      hoveredFolderId: null,
      isRootDropTarget: false
    })
  })

  it('ignores note rows as drop highlight targets', () => {
    expect(
      getNoteTreeDropVisualState({
        parentNode: {
          id: 'note:Projects/todo.md',
          isRoot: false,
          data: { kind: 'note' }
        },
        index: null
      })
    ).toEqual({
      hoveredFolderId: null,
      isRootDropTarget: false
    })
  })
})

describe('note tree drag session', () => {
  it('keeps drag entries available while the browser protects dragover data', () => {
    setActiveNoteTreeDrag([{ kind: 'folder', relPath: 'Projects' }])

    try {
      expect(readNoteTreeDragEntries(protectedDataTransfer())).toEqual([
        { kind: 'folder', relPath: 'Projects' }
      ])
    } finally {
      clearActiveNoteTreeDrag()
    }
  })

  it('falls back to the active drag session when reading drag data throws', () => {
    setActiveNoteTreeDrag([{ kind: 'note', relPath: 'Projects/todo.md' }])

    try {
      const dataTransfer = {
        getData: () => {
          throw new Error('protected drag data')
        }
      } as unknown as DataTransfer

      expect(readNoteTreeDragEntries(dataTransfer)).toEqual([
        { kind: 'note', relPath: 'Projects/todo.md' }
      ])
    } finally {
      clearActiveNoteTreeDrag()
    }
  })
})
