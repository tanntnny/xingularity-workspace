import { extractNoteTitle, noteBlocksToPreviewText, parseStoredNoteDocument } from '../../shared/noteDocument'
import { NoteMetadata } from '../../shared/types'

export interface ParsedNote {
  metadata: NoteMetadata
  bodyText: string
}

export function parseNoteContent(content: string, relPath: string): ParsedNote {
  const document = parseStoredNoteDocument(content)

  return {
    metadata: {
      title: extractNoteTitle(document.blocks, relPath),
      tags: document.tags
    },
    bodyText: noteBlocksToPreviewText(document.blocks)
  }
}
