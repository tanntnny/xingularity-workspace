import type { PartialBlock } from '@blocknote/core'

export type NoteEditorBlock = PartialBlock

export interface NoteEditorSessionSnapshot {
  blocks: NoteEditorBlock[]
  body: string
  content: string
}

export interface NoteEditorSnapshot {
  blocks: NoteEditorBlock[]
  body: string
}

export function cloneNoteEditorBlocks(blocks: NoteEditorBlock[]): NoteEditorBlock[] {
  if (typeof structuredClone === 'function') {
    return structuredClone(blocks)
  }

  return JSON.parse(JSON.stringify(blocks)) as NoteEditorBlock[]
}
