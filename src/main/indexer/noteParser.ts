import matter from 'gray-matter'
import path from 'node:path'
import { NoteMetadata } from '../../shared/types'

const INLINE_TAG_REGEX = /(^|\s)#([a-zA-Z0-9_-]{1,64})\b/g

export interface ParsedNote {
  metadata: NoteMetadata
  bodyMarkdown: string
  bodyText: string
}

function parseFrontmatterTags(rawTags: unknown): string[] {
  if (Array.isArray(rawTags)) {
    return rawTags
      .map((item) => String(item).trim().replace(/^#/, '').toLowerCase())
      .filter(Boolean)
  }

  if (typeof rawTags === 'string') {
    return rawTags
      .split(',')
      .map((item) => item.trim().replace(/^#/, '').toLowerCase())
      .filter(Boolean)
  }

  return []
}

function parseInlineTags(markdown: string): string[] {
  const tags = new Set<string>()
  let match: RegExpExecArray | null
  while ((match = INLINE_TAG_REGEX.exec(markdown))) {
    tags.add(match[2].toLowerCase())
  }
  return Array.from(tags)
}

function toPlainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^\)]*\)/g, ' ')
    .replace(/\[[^\]]*\]\([^\)]*\)/g, ' ')
    .replace(/[#>*_~\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function parseNoteContent(content: string, relPath: string): ParsedNote {
  const parsed = matter(content)
  const frontmatter = parsed.data as Record<string, unknown>
  const inlineTags = parseInlineTags(parsed.content)
  const tags = new Set<string>([...parseFrontmatterTags(frontmatter.tags), ...inlineTags])

  const basename = path.basename(relPath, '.md')
  const firstHeading = parsed.content
    .split('\n')
    .find((line) => line.trim().startsWith('# '))
    ?.trim()
    .replace(/^#\s+/, '')

  const title =
    typeof frontmatter.title === 'string' && frontmatter.title.trim().length > 0
      ? frontmatter.title.trim()
      : firstHeading ?? basename

  return {
    metadata: {
      title,
      tags: Array.from(tags),
      created: typeof frontmatter.created === 'string' ? frontmatter.created : undefined,
      updated: typeof frontmatter.updated === 'string' ? frontmatter.updated : undefined
    },
    bodyMarkdown: parsed.content,
    bodyText: toPlainText(parsed.content)
  }
}
