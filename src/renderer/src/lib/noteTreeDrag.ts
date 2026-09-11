import type { NoteTreeNode } from '../../../shared/types'
import { normalizeNoteTreeSelection, type NoteTreeSelection } from './noteTreeSelection'

export const NOTE_TREE_DRAG_DATA_TYPE = 'application/x-xingularity-note-tree'
export type NoteTreeDragSource = 'tree' | 'card'

let activeNoteTreeDragEntries: NoteTreeSelection | null = null
let activeNoteTreeDragSource: NoteTreeDragSource | null = null

export function setActiveNoteTreeDrag(
  entries: NoteTreeSelection,
  source: NoteTreeDragSource = 'tree'
): void {
  activeNoteTreeDragEntries = normalizeNoteTreeSelection(entries)
  activeNoteTreeDragSource = source
}

export function clearActiveNoteTreeDrag(): void {
  activeNoteTreeDragEntries = null
  activeNoteTreeDragSource = null
}

export function getActiveNoteTreeDragSource(): NoteTreeDragSource | null {
  return activeNoteTreeDragSource
}

export function writeNoteTreeDragData(
  dataTransfer: DataTransfer,
  entries: NoteTreeSelection
): void {
  const serializedEntries = JSON.stringify(normalizeNoteTreeSelection(entries))
  dataTransfer.effectAllowed = 'move'
  dataTransfer.setData(NOTE_TREE_DRAG_DATA_TYPE, serializedEntries)
  dataTransfer.setData('text/plain', serializedEntries)
}

export function readNoteTreeDragEntries(dataTransfer: DataTransfer): NoteTreeSelection | null {
  let raw = ''
  try {
    raw = dataTransfer.getData(NOTE_TREE_DRAG_DATA_TYPE)
  } catch {
    raw = ''
  }

  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown
      if (Array.isArray(parsed)) {
        const entries = parsed.filter(isNoteTreeSelectionEntry)
        if (entries.length > 0) {
          return normalizeNoteTreeSelection(entries)
        }
      }
    } catch {
      raw = ''
    }
  }

  return activeNoteTreeDragEntries ? [...activeNoteTreeDragEntries] : null
}

function isNoteTreeSelectionEntry(value: unknown): value is NoteTreeSelection[number] {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as { kind?: unknown; relPath?: unknown }
  return (
    (candidate.kind === 'note' || candidate.kind === 'excalidraw' || candidate.kind === 'folder') &&
    typeof candidate.relPath === 'string'
  )
}

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
