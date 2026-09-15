export interface NoteRawTextRange {
  from: number
  to: number
}

export interface NoteRawLineBounds {
  start: number
  end: number
}

export type NoteRawEnterBehavior = 'newline' | 'continue-list' | 'exit-list'

export interface NoteRawEnterResult {
  text: string
  selection: number
  behavior: NoteRawEnterBehavior
}

export function clampNoteRawPosition(text: string, position: number): number {
  return Math.max(0, Math.min(Math.floor(position), text.length))
}

export function getNoteRawLineBounds(text: string, position: number): NoteRawLineBounds {
  const boundedPosition = clampNoteRawPosition(text, position)
  const start = text.lastIndexOf('\n', Math.max(0, boundedPosition - 1)) + 1
  const nextLineBreak = text.indexOf('\n', boundedPosition)

  return {
    start,
    end: nextLineBreak < 0 ? text.length : nextLineBreak
  }
}

export function getNoteRawLineEndPosition(text: string, position: number): number {
  const { start, end } = getNoteRawLineBounds(text, position)
  return end > start ? end - 1 : start
}

export function getNoteRawFirstNonWhitespacePosition(text: string, position: number): number {
  const { start, end } = getNoteRawLineBounds(text, position)
  const firstContent = text.slice(start, end).search(/\S/)
  return firstContent < 0 ? start : start + firstContent
}

export function getNoteRawAdjacentLinePosition(
  text: string,
  position: number,
  direction: 'up' | 'down',
  preferredColumn?: number
): number {
  const currentLine = getNoteRawLineBounds(text, position)
  const currentColumn = Math.max(0, position - currentLine.start)
  const column = preferredColumn ?? currentColumn

  if (direction === 'up' && currentLine.start === 0) {
    return clampNoteRawPosition(text, position)
  }

  if (direction === 'down' && currentLine.end >= text.length) {
    return clampNoteRawPosition(text, position)
  }

  const targetPosition = direction === 'up' ? currentLine.start - 1 : currentLine.end + 1
  const targetLine = getNoteRawLineBounds(text, targetPosition)
  const targetLength = targetLine.end - targetLine.start

  return targetLength > 0 ? targetLine.start + Math.min(column, targetLength - 1) : targetLine.start
}

interface NoteRawListLine {
  indent: string
  marker: string
  body: string
  taskMarker: string | null
}

interface NoteRawFenceMarker {
  character: '`' | '~'
  length: number
}

function parseNoteRawListLine(line: string): NoteRawListLine | null {
  const match = /^([ \t]*)([-+*]|\d+[.)])(?:([ \t]+)(.*))?$/.exec(line)
  if (!match) {
    return null
  }

  const marker = match[2] ?? ''
  const spacing = match[3]
  if (spacing === undefined && line.trim() !== marker) {
    return null
  }

  const body = match[4] ?? ''
  const taskMatch = /^\[([ xX])\](?:[ \t]+|$)/.exec(body)

  return {
    indent: match[1] ?? '',
    marker,
    body,
    taskMarker: taskMatch?.[0] ?? null
  }
}

function parseNoteRawFenceMarker(line: string): NoteRawFenceMarker | null {
  const match = /^\s*(`{3,}|~{3,})(?:.*)$/.exec(line)
  if (!match) {
    return null
  }

  const marker = match[1] ?? ''
  return {
    character: marker[0] as '`' | '~',
    length: marker.length
  }
}

function isNoteRawPositionInsideFence(text: string, position: number): boolean {
  const boundedPosition = clampNoteRawPosition(text, position)
  let fence: NoteRawFenceMarker | null = null
  let lineStart = 0

  while (lineStart <= text.length) {
    const lineBreak = text.indexOf('\n', lineStart)
    const lineEnd = lineBreak < 0 ? text.length : lineBreak
    if (boundedPosition <= lineEnd) {
      return fence !== null
    }

    const marker = parseNoteRawFenceMarker(text.slice(lineStart, lineEnd))
    if (marker) {
      if (!fence) {
        fence = marker
      } else if (marker.character === fence.character && marker.length >= fence.length) {
        fence = null
      }
    }

    if (lineBreak < 0) {
      break
    }

    lineStart = lineBreak + 1
  }

  return fence !== null
}

function getNoteRawListContinuationPrefix(listLine: NoteRawListLine): string {
  const orderedMarker = /^(\d+)([.)])$/.exec(listLine.marker)
  const marker = orderedMarker
    ? `${Number.parseInt(orderedMarker[1] ?? '1', 10) + 1}${orderedMarker[2] ?? '.'}`
    : listLine.marker
  const taskMarker = listLine.taskMarker ? '[ ] ' : ''
  return `${listLine.indent}${marker} ${taskMarker}`
}

function isNoteRawListLineEmpty(listLine: NoteRawListLine): boolean {
  const body = listLine.taskMarker ? listLine.body.slice(listLine.taskMarker.length) : listLine.body
  return body.trim().length === 0
}

export function applyNoteRawEnter(
  text: string,
  from: number,
  to = from,
  options: { continueList?: boolean } = {}
): NoteRawEnterResult {
  const boundedFrom = clampNoteRawPosition(text, from)
  const boundedTo = clampNoteRawPosition(text, Math.max(boundedFrom, to))
  const line = getNoteRawLineBounds(text, boundedFrom)
  const continueList = options.continueList ?? true
  const isInsideFence = isNoteRawPositionInsideFence(text, boundedFrom)
  const lineBeforeCursor = text.slice(line.start, boundedFrom)
  const lineAfterSelection = boundedTo <= line.end ? text.slice(boundedTo, line.end) : ''
  const listLine =
    continueList && !isInsideFence
      ? parseNoteRawListLine(lineBeforeCursor + lineAfterSelection)
      : null

  if (listLine && isNoteRawListLineEmpty(listLine)) {
    const nextText = text.slice(0, line.start) + listLine.indent + text.slice(line.end)
    return {
      text: nextText,
      selection: line.start + listLine.indent.length,
      behavior: 'exit-list'
    }
  }

  const replacement = listLine ? `\n${getNoteRawListContinuationPrefix(listLine)}` : '\n'
  return {
    text: text.slice(0, boundedFrom) + replacement + text.slice(boundedTo),
    selection: boundedFrom + replacement.length,
    behavior: listLine ? 'continue-list' : 'newline'
  }
}

function isNoteRawWordCharacter(character: string | undefined): boolean {
  return Boolean(character && /[A-Za-z0-9_]/.test(character))
}

export function getNoteRawWordStartAfter(text: string, position: number): number {
  let cursor = clampNoteRawPosition(text, position)

  if (isNoteRawWordCharacter(text[cursor])) {
    while (cursor < text.length && isNoteRawWordCharacter(text[cursor])) {
      cursor += 1
    }
  }

  while (cursor < text.length && !isNoteRawWordCharacter(text[cursor])) {
    cursor += 1
  }

  return clampNoteRawPosition(text, cursor)
}

export function getNoteRawWordStartBefore(text: string, position: number): number {
  let cursor = clampNoteRawPosition(text, position) - 1

  while (cursor >= 0 && !isNoteRawWordCharacter(text[cursor])) {
    cursor -= 1
  }

  while (cursor >= 0 && isNoteRawWordCharacter(text[cursor])) {
    cursor -= 1
  }

  return Math.max(0, cursor + 1)
}

export function getNoteRawWordEndAfter(text: string, position: number): number {
  let cursor = clampNoteRawPosition(text, position)

  while (cursor < text.length && !isNoteRawWordCharacter(text[cursor])) {
    cursor += 1
  }

  while (cursor < text.length && isNoteRawWordCharacter(text[cursor])) {
    cursor += 1
  }

  return Math.max(0, cursor - 1)
}

export function getNoteRawVisualLineRange(
  text: string,
  anchor: number,
  head: number
): NoteRawTextRange {
  const firstLine = getNoteRawLineBounds(text, Math.min(anchor, head))
  const lastLine = getNoteRawLineBounds(text, Math.max(anchor, head))
  let to = lastLine.end

  if (to < text.length && text[to] === '\n') {
    to += 1
  }

  return {
    from: firstLine.start,
    to: Math.max(firstLine.start, to)
  }
}

export function getNoteRawLinewiseRange(text: string, position: number): NoteRawTextRange {
  const { start, end } = getNoteRawLineBounds(text, position)

  if (end < text.length) {
    return { from: start, to: end + 1 }
  }

  if (start > 0) {
    return { from: start - 1, to: end }
  }

  return { from: start, to: end }
}

export function getNoteRawLinewiseText(text: string, position: number): string {
  const { start, end } = getNoteRawLineBounds(text, position)
  return text.slice(start, end) + (end < text.length ? '\n' : '')
}

export function findNoteRawHeadingPositions(markdown: string): number[] {
  const positions: number[] = []
  let offset = 0
  let inCodeFence = false

  markdown.split('\n').forEach((line) => {
    if (/^\s*```/.test(line)) {
      inCodeFence = !inCodeFence
    } else if (!inCodeFence && /^(#{1,6})\s+.*\S\s*$/.test(line)) {
      positions.push(offset)
    }

    offset += line.length + 1
  })

  return positions
}
