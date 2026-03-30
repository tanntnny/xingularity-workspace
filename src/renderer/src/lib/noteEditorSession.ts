import type { PartialBlock } from '@blocknote/core'

export type NoteEditorBlock = PartialBlock

export interface NoteEditorSessionSnapshot {
  blocks: NoteEditorBlock[]
  content: string
  tags: string[]
}

export interface NoteEditorSnapshot {
  blocks: NoteEditorBlock[]
  content: string
}

export function cloneNoteEditorBlocks(blocks: NoteEditorBlock[]): NoteEditorBlock[] {
  if (typeof structuredClone === 'function') {
    return structuredClone(blocks)
  }

  return JSON.parse(JSON.stringify(blocks)) as NoteEditorBlock[]
}
