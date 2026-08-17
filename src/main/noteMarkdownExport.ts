import { extractNoteTitleFromMarkdown } from '../shared/noteDocument'
import { splitNoteContent } from '../shared/noteContent'

export interface FolderMarkdownNote {
  relPath: string
  markdown: string
}

export function buildFolderMarkdown(folderName: string, notes: FolderMarkdownNote[]): string {
  const sections = notes.map(({ relPath, markdown }) => {
    const title = extractNoteTitleFromMarkdown(markdown, relPath)
    const body = splitNoteContent(markdown).body.trim()

    return [
      `## ${title}`,
      '',
      `Source: \`${escapeInlineCode(relPath)}\``,
      ...(body ? ['', body] : [])
    ].join('\n')
  })

  return [`# ${folderName}`, '', sections.join('\n\n---\n\n'), ''].join('\n')
}

function escapeInlineCode(value: string): string {
  return value.replaceAll('`', '\\`')
}
