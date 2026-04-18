import katex from 'katex'

export interface LatexTextMatch {
  from: number
  to: number
  value: string
  valid: boolean
  displayMode: boolean
  delimiter: '$' | '$$'
}

interface LatexDelimiterMatch {
  sourceFrom: number
  dollarFrom: number
  sourceTo: number
  delimiter: '$' | '$$'
}

function readLatexDelimiter(value: string, dollarIndex: number): LatexDelimiterMatch {
  const sourceFrom = value[dollarIndex - 1] === '\\' ? dollarIndex - 1 : dollarIndex
  const isDoubleDelimiter =
    value[dollarIndex + 1] === '$' ||
    (value[dollarIndex + 1] === '\\' && value[dollarIndex + 2] === '$')

  return {
    sourceFrom,
    dollarFrom: dollarIndex,
    sourceTo: dollarIndex + (isDoubleDelimiter ? (value[dollarIndex + 1] === '\\' ? 3 : 2) : 1),
    delimiter: isDoubleDelimiter ? '$$' : '$'
  }
}

function findClosingLatexDelimiter(
  value: string,
  startIndex: number,
  delimiter: '$' | '$$'
): LatexDelimiterMatch | null {
  for (let cursor = startIndex; cursor < value.length; cursor += 1) {
    if (value[cursor] !== '$') {
      continue
    }

    const candidate = readLatexDelimiter(value, cursor)
    if (candidate.delimiter === delimiter) {
      return candidate
    }
  }

  return null
}

export function isValidLatex(value: string, displayMode: boolean): boolean {
  if (!value.trim()) {
    return false
  }

  try {
    katex.renderToString(value, {
      displayMode,
      throwOnError: true
    })
    return true
  } catch {
    return false
  }
}

export function findLatexTextMatches(value: string): LatexTextMatch[] {
  const matches: LatexTextMatch[] = []
  let index = 0

  while (index < value.length) {
    const openingIndex = value.indexOf('$', index)
    if (openingIndex < 0) {
      break
    }

    const opening = readLatexDelimiter(value, openingIndex)
    const closing = findClosingLatexDelimiter(value, opening.sourceTo, opening.delimiter)

    if (!closing) {
      const source = value.slice(opening.sourceTo)
      const isDisplayMode = opening.delimiter === '$$'
      const isValidSource = source.trim() && (isDisplayMode || !source.includes('\n'))

      if (isValidSource) {
        matches.push({
          from: opening.sourceFrom,
          to: value.length,
          value: source,
          valid: false,
          displayMode: isDisplayMode,
          delimiter: opening.delimiter
        })
      }
      break
    }

    const to = closing.sourceTo
    const latexValue = value.slice(opening.sourceTo, closing.dollarFrom)
    const displayMode = opening.delimiter === '$$'
    const isCandidate = latexValue.trim() && (displayMode || !latexValue.includes('\n'))

    if (isCandidate) {
      matches.push({
        from: opening.sourceFrom,
        to,
        value: latexValue,
        valid: isValidLatex(latexValue, displayMode),
        displayMode,
        delimiter: opening.delimiter
      })
    }

    index = closing.sourceTo
  }

  return matches
}

export function normalizeLatexEscapes(markdown: string): string {
  return markdown
    .replace(/\\\$\\\$([\s\S]+?)\\\$\\\$/g, (_match, value: string) => `$$${value}$$`)
    .replace(/\\\$([^$\n]+?)\\\$/g, (_match, value: string) => `$${value}$`)
    .replace(/\\\$\\\$([\s\S]*)$/gm, (_match, value: string) => `$$${value}`)
    .replace(/\\\$([^$\n]*)$/gm, (_match, value: string) => `$${value}`)
}
