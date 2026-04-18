import { StoredNoteDocument } from './types'
import { listTagsFromMarkdown, normalizeTag, upsertTagsInMarkdown } from './noteTags'
import { splitNoteContent } from './noteContent'

export const NOTE_FILE_EXTENSION = '.md'
export const LEGACY_NOTE_FILE_EXTENSION = '.xnote'
const NOTE_FILE_VERSION = 1

type JsonRecord = Record<string, unknown>

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null
}

function normalizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) {
    return []
  }

  return Array.from(
    new Set(
      tags.map((tag) => normalizeTag(String(tag))).filter((tag): tag is string => Boolean(tag))
    )
  )
}

function extractInlineText(content: unknown): string {
  if (typeof content === 'string') {
    return content
  }

  if (Array.isArray(content)) {
    return content.map((item) => extractInlineText(item)).join('')
  }

  if (!isRecord(content)) {
    return ''
  }

  if (typeof content.text === 'string') {
    return content.text
  }

  if ('content' in content) {
    return extractInlineText(content.content)
  }

  return ''
}

function blockPrefix(block: JsonRecord): string {
  switch (block.type) {
    case 'heading': {
      const level =
        typeof block.props === 'object' &&
        block.props &&
        typeof (block.props as JsonRecord).level === 'number'
          ? Math.max(1, Math.min(6, (block.props as JsonRecord).level as number))
          : 1
      return `${'#'.repeat(level)} `
    }
    case 'bulletListItem':
      return '- '
    case 'numberedListItem':
      return '1. '
    case 'checkListItem': {
      const checked =
        typeof block.props === 'object' &&
        block.props &&
        Boolean((block.props as JsonRecord).checked)
      return checked ? '- [x] ' : '- [ ] '
    }
    case 'quote':
      return '> '
    default:
      return ''
  }
}

function blockToLines(block: unknown, depth = 0): string[] {
  if (!isRecord(block)) {
    return []
  }

  if (block.type === 'image') {
    const url =
      typeof block.props === 'object' && block.props
        ? String((block.props as JsonRecord).url ?? '')
        : ''
    return [url ? `![image](${url})` : '']
  }

  const text = extractInlineText(block.content)
  const prefix = blockPrefix(block)
  const indent = depth > 0 ? `${'  '.repeat(depth)}` : ''
  const line = `${indent}${prefix}${text}`.trimEnd()
  const lines = [line]

  if (Array.isArray(block.children)) {
    for (const child of block.children) {
      lines.push(...blockToLines(child, depth + 1))
    }
  }

  return lines
}

function looksLikeBlockNoteBlocks(value: unknown): value is unknown[] {
  if (!Array.isArray(value) || value.length === 0) {
    return false
  }

  return value.every((block) => {
    if (!isRecord(block) || typeof block.type !== 'string') {
      return false
    }

    return 'content' in block || 'children' in block || 'props' in block
  })
}

export function noteBlocksToText(blocks: unknown[]): string {
  return (Array.isArray(blocks) ? blocks : [{ type: 'paragraph' }])
    .flatMap((block) => blockToLines(block))
    .join('\n')
}

export function noteBlocksToPreviewText(blocks: unknown[]): string {
  return noteBlocksToText(blocks).replace(/\s+/g, ' ').trim()
}

export function isNotePath(relPath: string): boolean {
  return relPath.toLowerCase().endsWith(NOTE_FILE_EXTENSION)
}

export function isLegacyNotePath(relPath: string): boolean {
  return relPath.toLowerCase().endsWith(LEGACY_NOTE_FILE_EXTENSION)
}

export function stripNoteExtension(relPath: string): string {
  return relPath.replace(/\.(md|xnote)$/i, '')
}

export function withNoteExtension(relPath: string): string {
  return isNotePath(relPath) ? relPath : `${stripNoteExtension(relPath)}${NOTE_FILE_EXTENSION}`
}

export function getNoteDisplayName(relPath: string): string {
  const normalized = stripNoteExtension(relPath).replace(/\/+$/, '')
  const segments = normalized.split('/')
  return segments[segments.length - 1] || normalized
}

export function createEmptyNoteDocument(tags: string[] = []): StoredNoteDocument {
  return createStoredNoteDocumentFromMarkdown(upsertTagsInMarkdown('', tags))
}

export function normalizeStoredNoteDocument(document: StoredNoteDocument): StoredNoteDocument {
  const markdown = typeof document.markdown === 'string' ? document.markdown : ''
  const frontmatterTags = listTagsFromMarkdown(markdown)
  const tags =
    normalizeTags(document.tags).length > 0 ? normalizeTags(document.tags) : frontmatterTags

  return {
    version: NOTE_FILE_VERSION,
    tags,
    markdown
  }
}

export function parseStoredNoteDocument(raw: string): StoredNoteDocument {
  return createStoredNoteDocumentFromMarkdown(raw)
}

export function serializeStoredNoteDocument(document: StoredNoteDocument): string {
  const normalized = normalizeStoredNoteDocument(document)
  return upsertTagsInMarkdown(normalized.markdown, normalized.tags)
}

export function createStoredNoteDocumentFromText(
  text: string,
  tags: string[] = []
): StoredNoteDocument {
  return createStoredNoteDocumentFromMarkdown(upsertTagsInMarkdown(text, tags))
}

export function createStoredNoteDocumentFromMarkdown(markdown: string): StoredNoteDocument {
  return {
    version: NOTE_FILE_VERSION,
    tags: normalizeTags(listTagsFromMarkdown(markdown)),
    markdown
  }
}

export function parseLegacyStoredNoteDocument(raw: string): StoredNoteDocument {
  const parsed = JSON.parse(raw) as unknown
  if (!isRecord(parsed)) {
    throw new Error('Invalid legacy note document')
  }

  const tags = normalizeTags(parsed.tags)
  const blocks = Array.isArray(parsed.blocks) && parsed.blocks.length > 0 ? parsed.blocks : []
  return createStoredNoteDocumentFromText(noteBlocksToText(blocks), tags)
}

export function parseBlockNoteJsonMarkdown(raw: string): StoredNoteDocument | null {
  const trimmed = raw.trim()
  if (!trimmed || (!trimmed.startsWith('{') && !trimmed.startsWith('['))) {
    return null
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed) as unknown
  } catch {
    return null
  }

  if (looksLikeBlockNoteBlocks(parsed)) {
    return createStoredNoteDocumentFromText(noteBlocksToText(parsed))
  }

  if (!isRecord(parsed)) {
    return null
  }

  const blocks = parsed.blocks
  if (!looksLikeBlockNoteBlocks(blocks)) {
    return null
  }

  return createStoredNoteDocumentFromText(noteBlocksToText(blocks), normalizeTags(parsed.tags))
}

export function appendTextToNoteMarkdown(markdown: string, text: string): string {
  const appendedText = text.trim()
  if (!appendedText) {
    return markdown
  }

  const { frontmatter, body, lineEnding } = splitNoteContent(markdown)
  const separator = body.trim().length > 0 ? `${lineEnding}${lineEnding}` : ''
  const nextBody = `${body}${separator}${appendedText}`

  if (!frontmatter) {
    return nextBody
  }

  return ['---', frontmatter, '---', '', nextBody].join(lineEnding)
}

export function extractNoteTitleFromMarkdown(markdown: string, relPath: string): string {
  const { body } = splitNoteContent(markdown)
  const heading = body
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.match(/^#{1,6}\s+(.+)$/)?.[1]?.trim() ?? '')
    .find((line) => line.length > 0)

  return heading ?? getNoteDisplayName(relPath)
}

export function extractNoteTitle(blocksOrMarkdown: unknown[] | string, relPath: string): string {
  if (typeof blocksOrMarkdown === 'string') {
    return extractNoteTitleFromMarkdown(blocksOrMarkdown, relPath)
  }

  for (const block of Array.isArray(blocksOrMarkdown) ? blocksOrMarkdown : []) {
    if (!isRecord(block) || block.type !== 'heading') {
      continue
    }

    const text = extractInlineText(block.content).trim()
    if (text.length > 0) {
      return text
    }
  }

  return getNoteDisplayName(relPath)
}
