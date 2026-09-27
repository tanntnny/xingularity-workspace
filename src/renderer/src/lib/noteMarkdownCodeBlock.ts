import type { Text } from '@codemirror/state'

export interface MarkdownCodeBlock {
  from: number
  to: number
  source: string
  openingLine: string
  closingLine: string | null
  marker: string
  language: string
  body: string
  bodyFrom: number
  bodyTo: number
}

export interface MarkdownCodeFenceCompletion {
  from: number
  to: number
  insert: string
  cursor: number
}

interface MarkdownLine {
  from: number
  to: number
  text: string
}

interface FenceMatch {
  marker: string
  info: string
}

function getLines(source: string): MarkdownLine[] {
  const lines: MarkdownLine[] = []
  let from = 0

  for (const text of source.split('\n')) {
    lines.push({ from, to: from + text.length, text })
    from += text.length + 1
  }

  return lines
}

function matchFence(text: string): FenceMatch | null {
  const match = /^\s*(`{3,}|~{3,})(.*)$/.exec(text)
  if (!match) return null
  return { marker: match[1], info: match[2].trim() }
}

function getLanguage(info: string): string {
  return info.split(/\s+/)[0] ?? ''
}

function isClosingFence(opening: FenceMatch, candidate: FenceMatch): boolean {
  return (
    candidate.marker[0] === opening.marker[0] &&
    candidate.marker.length >= opening.marker.length &&
    candidate.info.length === 0
  )
}

function createCodeBlock(
  source: string,
  opening: MarkdownLine,
  openingFence: FenceMatch,
  bodyLines: readonly MarkdownLine[],
  closing: MarkdownLine | null
): MarkdownCodeBlock {
  const bodyFrom = Math.min(source.length, opening.to + 1)
  const bodyTo = closing
    ? Math.max(bodyFrom, closing.from > bodyFrom ? closing.from - 1 : closing.from)
    : source.length

  return {
    from: opening.from,
    to: closing?.to ?? source.length,
    source: source.slice(opening.from, closing?.to ?? source.length),
    openingLine: opening.text,
    closingLine: closing?.text ?? null,
    marker: openingFence.marker,
    language: getLanguage(openingFence.info),
    body: bodyLines.map((line) => line.text).join('\n'),
    bodyFrom,
    bodyTo
  }
}

/**
 * Finds fenced code blocks using permissive Markdown fence recognition. A
 * matching fence line closes the current block, while an unfinished opening
 * fence owns the remainder of the document.
 */
export function findMarkdownCodeBlocks(document: string | Text): MarkdownCodeBlock[] {
  const source = typeof document === 'string' ? document : document.toString()
  const lines = getLines(source)
  const blocks: MarkdownCodeBlock[] = []
  let opening: MarkdownLine | null = null
  let openingFence: FenceMatch | null = null
  let bodyLines: MarkdownLine[] = []

  for (const line of lines) {
    const fence = matchFence(line.text)
    if (fence && openingFence && !isClosingFence(openingFence, fence)) {
      bodyLines.push(line)
      continue
    }

    if (fence) {
      if (!opening || !openingFence) {
        opening = line
        openingFence = fence
        bodyLines = []
      } else {
        blocks.push(createCodeBlock(source, opening, openingFence, bodyLines, line))
        opening = null
        openingFence = null
        bodyLines = []
      }
      continue
    }

    if (opening) bodyLines.push(line)
  }

  if (opening && openingFence) {
    blocks.push(createCodeBlock(source, opening, openingFence, bodyLines, null))
  }

  return blocks
}

export function serializeMarkdownCodeBlock(block: MarkdownCodeBlock, body: string): string {
  if (!block.closingLine) return `${block.openingLine}\n${body}`
  return `${block.openingLine}\n${body}\n${block.closingLine}`
}

export function isMarkdownCodeBlockEmpty(block: MarkdownCodeBlock): boolean {
  return block.body.trim().length === 0
}

export function findMarkdownCodeBlockAt(
  blocks: readonly MarkdownCodeBlock[],
  position: number
): MarkdownCodeBlock | null {
  return blocks.find((block) => position >= block.from && position <= block.to) ?? null
}

export function expandMarkdownCodeBlockDeletion(
  blocks: readonly MarkdownCodeBlock[],
  from: number,
  to: number
): { from: number; to: number } {
  let expandedFrom = from
  let expandedTo = to

  for (const block of blocks) {
    const intersects = from < block.to && to > block.from
    if (!intersects) continue
    expandedFrom = Math.min(expandedFrom, block.from)
    expandedTo = Math.max(expandedTo, block.to)
  }

  return { from: expandedFrom, to: expandedTo }
}

function hasOpenMarkdownCodeFenceBefore(source: string, position: number): boolean {
  let opening: FenceMatch | null = null

  for (const line of getLines(source.slice(0, position))) {
    const fence = matchFence(line.text)
    if (!fence) continue

    if (!opening) {
      opening = fence
    } else if (isClosingFence(opening, fence)) {
      opening = null
    }
  }

  return opening !== null
}

export function getMarkdownCodeFenceCompletion(
  document: string | Text,
  position: number
): MarkdownCodeFenceCompletion | null {
  const source = typeof document === 'string' ? document : document.toString()
  const lines = getLines(source)
  const line = lines.find((candidate) => position >= candidate.from && position <= candidate.to)
  if (!line || position !== line.to) return null

  const match = /^(\s{0,3})(```)([^`\n]*)$/.exec(line.text)
  if (!match) return null
  if (hasOpenMarkdownCodeFenceBefore(source, line.from)) return null

  const indent = match[1]
  const closing = `${indent}\`\`\``
  const insert = `\n\n${closing}`
  return {
    from: position,
    to: position,
    insert,
    cursor: position + 1
  }
}

export function getMarkdownCodeFencePairCompletion(
  document: string | Text,
  position: number
): MarkdownCodeFenceCompletion | null {
  const source = typeof document === 'string' ? document : document.toString()
  const lines = getLines(source)
  const line = lines.find((candidate) => position >= candidate.from && position <= candidate.to)
  if (!line || position !== line.to) return null
  if (!/^\s{0,3}```$/.test(line.text)) return null

  return getMarkdownCodeFenceCompletion(source, position)
}
