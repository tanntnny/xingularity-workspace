import { StoredNoteDocument } from './types'
import { listTagsFromMarkdown, normalizeTag } from './noteTags'
import { splitNoteContent } from './noteContent'

export const NOTE_FILE_EXTENSION = '.xnote'
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
    new Set(tags.map((tag) => normalizeTag(String(tag))).filter((tag): tag is string => Boolean(tag)))
  )
}

function normalizeBlocks(blocks: unknown): unknown[] {
  return Array.isArray(blocks) && blocks.length > 0 ? blocks : [{ type: 'paragraph' }]
}

export function isNotePath(relPath: string): boolean {
  return relPath.toLowerCase().endsWith(NOTE_FILE_EXTENSION)
}

export function stripNoteExtension(relPath: string): string {
  return relPath.replace(new RegExp(`${NOTE_FILE_EXTENSION.replace('.', '\\.')}$`, 'i'), '')
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
  return {
    version: NOTE_FILE_VERSION,
    tags: normalizeTags(tags),
    blocks: [{ type: 'paragraph' }]
  }
}

export function normalizeStoredNoteDocument(document: StoredNoteDocument): StoredNoteDocument {
  return {
    version: NOTE_FILE_VERSION,
    tags: normalizeTags(document.tags),
    blocks: normalizeBlocks(document.blocks)
  }
}

export function parseStoredNoteDocument(raw: string): StoredNoteDocument {
  const parsed = JSON.parse(raw) as unknown
  if (!isRecord(parsed)) {
    throw new Error('Invalid note document')
  }

  return normalizeStoredNoteDocument({
    version: NOTE_FILE_VERSION,
    tags: parsed.tags,
    blocks: parsed.blocks
  } as StoredNoteDocument)
}

export function serializeStoredNoteDocument(document: StoredNoteDocument): string {
  return JSON.stringify(normalizeStoredNoteDocument(document), null, 2)
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
      typeof block.props === 'object' && block.props ? String((block.props as JsonRecord).url ?? '') : ''
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

export function noteBlocksToText(blocks: unknown[]): string {
  return normalizeBlocks(blocks)
    .flatMap((block) => blockToLines(block))
    .join('\n')
}

export function noteBlocksToPreviewText(blocks: unknown[]): string {
  return noteBlocksToText(blocks).replace(/\s+/g, ' ').trim()
}

function createBlockFromLine(line: string): JsonRecord {
  if (/^#{1,6}\s+/.test(line)) {
    const [, hashes = '', text = ''] = line.match(/^(#{1,6})\s+(.*)$/) ?? []
    return {
      type: 'heading',
      props: { level: hashes.length },
      content: text
    }
  }

  if (/^- \[(x| )\]\s+/i.test(line)) {
    const [, checked = '', text = ''] = line.match(/^- \[(x| )\]\s+(.*)$/i) ?? []
    return {
      type: 'checkListItem',
      props: { checked: checked.toLowerCase() === 'x' },
      content: text
    }
  }

  if (/^[-*]\s+/.test(line)) {
    return {
      type: 'bulletListItem',
      content: line.replace(/^[-*]\s+/, '')
    }
  }

  if (/^\d+\.\s+/.test(line)) {
    return {
      type: 'numberedListItem',
      content: line.replace(/^\d+\.\s+/, '')
    }
  }

  if (/^>\s+/.test(line)) {
    return {
      type: 'quote',
      content: line.replace(/^>\s+/, '')
    }
  }

  const imageMatch = line.match(/^!\[[^\]]*\]\(([^)]+)\)$/)
  if (imageMatch) {
    return {
      type: 'image',
      props: {
        url: imageMatch[1],
        caption: '',
        previewWidth: 512
      }
    }
  }

  return {
    type: 'paragraph',
    content: line
  }
}

export function noteTextToBlocks(text: string): unknown[] {
  const normalized = text.replace(/\r\n/g, '\n')
  const lines = normalized.length > 0 ? normalized.split('\n') : ['']
  return lines.map((line) => createBlockFromLine(line))
}

export function appendTextToNoteBlocks(blocks: unknown[], text: string): unknown[] {
  const appendedText = text.trim()
  if (!appendedText) {
    return normalizeBlocks(blocks)
  }

  const nextBlocks = normalizeBlocks(blocks)
  const needsSpacer =
    nextBlocks.length > 0 &&
    blockToLines(nextBlocks[nextBlocks.length - 1]).join('').trim().length > 0

  return [
    ...nextBlocks,
    ...(needsSpacer ? [{ type: 'paragraph', content: '' }] : []),
    ...noteTextToBlocks(appendedText)
  ]
}

export function createStoredNoteDocumentFromText(text: string, tags: string[] = []): StoredNoteDocument {
  return {
    version: NOTE_FILE_VERSION,
    tags: normalizeTags(tags),
    blocks: noteTextToBlocks(text)
  }
}

export function createStoredNoteDocumentFromMarkdown(markdown: string): StoredNoteDocument {
  const parts = splitNoteContent(markdown)
  const tags = listTagsFromMarkdown(markdown)
  return createStoredNoteDocumentFromText(parts.body, tags)
}

export function extractNoteTitle(blocks: unknown[], relPath: string): string {
  for (const block of normalizeBlocks(blocks)) {
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
