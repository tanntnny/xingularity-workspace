import type { NoteTreeNode } from '../../../shared/types'

export interface NoteTreeDropTargetParent {
  id: string
  isRoot: boolean
  data?: Pick<NoteTreeNode, 'kind'>
}

export interface NoteTreeDropVisualState {
  hoveredFolderId: string | null
  isRootDropTarget: boolean
}

export function getNoteTreeDropVisualState(args: {
  parentNode: NoteTreeDropTargetParent | null
  index: number | null
}): NoteTreeDropVisualState {
  const { parentNode, index } = args

  if (!parentNode) {
    return {
      hoveredFolderId: null,
      isRootDropTarget: false
    }
  }

  if (parentNode.isRoot) {
    return {
      hoveredFolderId: null,
      isRootDropTarget: true
    }
  }

  if (parentNode.data?.kind === 'folder' && index === null) {
    return {
      hoveredFolderId: parentNode.id,
      isRootDropTarget: false
    }
  }

  return {
    hoveredFolderId: null,
    isRootDropTarget: false
  }
}
