import { describe, expect, it } from 'vitest'
import { getNoteTreeDropVisualState } from '../src/renderer/src/lib/noteTreeDrag'

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
