export interface NoteContentParts {
  frontmatter: string | null
  body: string
  lineEnding: '\n' | '\r\n'
}

const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/

export function splitNoteContent(markdown: string): NoteContentParts {
  const lineEnding = markdown.includes('\r\n') ? '\r\n' : '\n'
  const match = FRONTMATTER_REGEX.exec(markdown)
  if (!match) {
    return {
      frontmatter: null,
      body: markdown,
      lineEnding
    }
  }

  const rawBody = markdown.slice(match[0].length)
  const body = rawBody.startsWith('\r\n')
    ? rawBody.slice(2)
    : rawBody.startsWith('\n')
      ? rawBody.slice(1)
      : rawBody

  return {
    frontmatter: match[1],
    body,
    lineEnding
  }
}

export function replaceNoteBody(markdown: string, nextBody: string): string {
  const parts = splitNoteContent(markdown)
  if (!parts.frontmatter) {
    return nextBody
  }

  return ['---', parts.frontmatter, '---', '', nextBody].join(parts.lineEnding)
}
