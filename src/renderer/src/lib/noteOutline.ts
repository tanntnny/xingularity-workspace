export interface NoteOutlineItem {
  id: string
  label: string
  level: number
}

const HEADING_REGEX = /^(#{1,6})[ \t]+(.+?)\s*$/

function stripMarkdownFormatting(input: string): string {
  return input
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .trim()
}

export function extractNoteOutline(markdown: string): NoteOutlineItem[] {
  return markdown
    .split(/\r?\n/)
    .map((line, index) => {
      const match = HEADING_REGEX.exec(line)
      if (!match) {
        return null
      }

      const label = stripMarkdownFormatting(match[2])
      if (!label) {
        return null
      }

      return {
        id: String(index + 1),
        label,
        level: match[1].length
      } satisfies NoteOutlineItem
    })
    .filter((item): item is NoteOutlineItem => item !== null)
}
