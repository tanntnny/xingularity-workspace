import { extractNoteTitleFromMarkdown } from '../../shared/noteDocument'
import { listTagsFromMarkdown, listPreviewTagsFromMarkdown } from '../../shared/noteTags'
import { splitNoteContent } from '../../shared/noteContent'
import { NoteMetadata } from '../../shared/types'

export interface ParsedNote {
  metadata: NoteMetadata
  bodyText: string
}

export function parseNoteContent(content: string, relPath: string): ParsedNote {
  const { body } = splitNoteContent(content)

  return {
    metadata: {
      title: extractNoteTitleFromMarkdown(content, relPath),
      tags: listTagsFromMarkdown(content)
    },
    bodyText: body.replace(/\s+/g, ' ').trim() || listPreviewTagsFromMarkdown(content).join(' ')
  }
}
