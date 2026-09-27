const FENCE_PATTERN = /^ {0,3}(`{3,}|~{3,})(.*)$/
const LEADING_WHITESPACE_PATTERN = /^[ \t]*/
const LIST_MARKER_PATTERN = /^(?:[-+*]|\d+[.)])(?=[ \t]|$)/

export interface MarkdownIndentationMigrationResult {
  content: string
  changes: readonly MarkdownIndentationChange[]
  changedLineCount: number
  convertedUnitCount: number
  skippedCodeBlockLineCount: number
  skippedAmbiguousLineCount: number
}

export interface MarkdownIndentationChange {
  from: number
  to: number
  insert: string
}

interface SourceLine {
  from: number
  text: string
  newline: string
}

interface FenceState {
  character: '`' | '~'
  length: number
}

function splitSource(source: string): SourceLine[] {
  const parts = source.split(/(\r\n|\n|\r)/)
  const lines: SourceLine[] = []
  let from = 0

  for (let index = 0; index < parts.length; index += 2) {
    const text = parts[index] ?? ''
    const newline = parts[index + 1] ?? ''
    lines.push({
      from,
      text,
      newline
    })
    from += text.length + newline.length
  }

  return lines
}

function getFence(text: string): { character: '`' | '~'; length: number; info: string } | null {
  const match = FENCE_PATTERN.exec(text)
  if (!match) return null

  return {
    character: match[1][0] as '`' | '~',
    length: match[1].length,
    info: match[2].trim()
  }
}

function isClosingFence(fence: FenceState, candidate: ReturnType<typeof getFence>): boolean {
  return Boolean(
    candidate &&
    candidate.character === fence.character &&
    candidate.length >= fence.length &&
    candidate.info.length === 0
  )
}

function getLeadingWhitespace(text: string): string {
  return LEADING_WHITESPACE_PATTERN.exec(text)?.[0] ?? ''
}

function hasMarkdownStructure(text: string): boolean {
  const content = text.slice(getLeadingWhitespace(text).length)
  return content.startsWith('>') || LIST_MARKER_PATTERN.test(content)
}

function isBlank(text: string): boolean {
  return text.trim().length === 0
}

function isIndentedCodeLine(text: string, previousStructuralLine: boolean): boolean {
  const leading = getLeadingWhitespace(text)
  if (leading.length < 4) return false

  if (!previousStructuralLine) return true

  if (hasMarkdownStructure(text)) return false

  // A four-space continuation after a list or quote is the Markdown shape of
  // an indented code block. The structural marker check above keeps nested
  // list items with four spaces eligible for conversion.
  return true
}

function convertLeadingSpaces(leading: string): {
  converted: string
  convertedUnitCount: number
  ambiguous: boolean
} {
  if (!leading || leading.includes('\t')) {
    return {
      converted: leading,
      convertedUnitCount: 0,
      ambiguous: leading.includes(' ') && leading.includes('\t')
    }
  }

  const unitCount = Math.floor(leading.length / 2)
  if (unitCount === 0) {
    return { converted: leading, convertedUnitCount: 0, ambiguous: false }
  }

  return {
    converted: '\t'.repeat(unitCount) + ' '.repeat(leading.length % 2),
    convertedUnitCount: unitCount,
    ambiguous: false
  }
}

/**
 * Converts the app's legacy two-space structural indentation into literal
 * tabs without rewriting code-sensitive or ambiguous Markdown whitespace.
 */
export function migrateMarkdownIndentationToTabs(
  source: string
): MarkdownIndentationMigrationResult {
  const lines = splitSource(source)
  const output: SourceLine[] = []
  let fence: FenceState | null = null
  let previousStructuralLine = false
  const changes: MarkdownIndentationChange[] = []
  let changedLineCount = 0
  let convertedUnitCount = 0
  let skippedCodeBlockLineCount = 0
  let skippedAmbiguousLineCount = 0

  for (const line of lines) {
    const candidateFence = getFence(line.text)

    if (fence) {
      output.push(line)
      skippedCodeBlockLineCount += 1
      if (isClosingFence(fence, candidateFence)) fence = null
      previousStructuralLine = false
      continue
    }

    if (candidateFence) {
      output.push(line)
      skippedCodeBlockLineCount += 1
      fence = { character: candidateFence.character, length: candidateFence.length }
      previousStructuralLine = false
      continue
    }

    if (isBlank(line.text)) {
      output.push(line)
      previousStructuralLine = false
      continue
    }

    const structural = hasMarkdownStructure(line.text)
    if (isIndentedCodeLine(line.text, previousStructuralLine)) {
      output.push(line)
      skippedCodeBlockLineCount += 1
      previousStructuralLine = false
      continue
    }

    const leading = getLeadingWhitespace(line.text)
    const continuation = !structural && previousStructuralLine && leading.length > 0
    const eligible = structural || continuation

    if (!eligible) {
      output.push(line)
      previousStructuralLine = false
      continue
    }

    const converted = convertLeadingSpaces(leading)
    if (converted.ambiguous) {
      output.push(line)
      skippedAmbiguousLineCount += 1
      previousStructuralLine = structural || continuation
      continue
    }

    const nextText = `${converted.converted}${line.text.slice(leading.length)}`
    if (nextText !== line.text) {
      changedLineCount += 1
      convertedUnitCount += converted.convertedUnitCount
      changes.push({
        from: line.from,
        to: line.from + leading.length,
        insert: converted.converted
      })
    }
    output.push({ ...line, text: nextText })
    previousStructuralLine = structural || continuation
  }

  return {
    content: output.map((line) => `${line.text}${line.newline}`).join(''),
    changes,
    changedLineCount,
    convertedUnitCount,
    skippedCodeBlockLineCount,
    skippedAmbiguousLineCount
  }
}
