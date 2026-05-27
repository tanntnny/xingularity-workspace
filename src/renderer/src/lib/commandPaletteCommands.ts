export interface CommandPaletteCommandSearchItem {
  value: string
  label: string
  keywords?: readonly string[]
}

export function filterCommandPaletteCommands<T extends CommandPaletteCommandSearchItem>(
  commands: readonly T[],
  query: string
): T[] {
  const trimmedQuery = query.trim()
  if (!trimmedQuery) {
    return [...commands]
  }

  const terms = tokenizeCommandQuery(trimmedQuery)
  if (terms.length === 0) {
    return [...commands]
  }

  return commands
    .map((command) => {
      const score = scoreCommandDocument(terms, [
        { text: command.label, weight: 8 },
        { text: command.value.replace(/^>/, '').trim(), weight: 6 },
        { text: command.keywords?.join(' ') ?? '', weight: 5 }
      ])

      return score > 0 ? { command, score } : null
    })
    .filter((result): result is { command: T; score: number } => result !== null)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }

      return left.command.label.localeCompare(right.command.label)
    })
    .map((result) => result.command)
}

function tokenizeCommandQuery(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[\s/_.-]+/)
    .map((term) => term.trim())
    .filter(Boolean)
}

function scoreCommandDocument(
  terms: string[],
  fields: Array<{
    text: string
    weight: number
  }>
): number {
  let totalScore = 0

  for (const term of terms) {
    let bestTermScore = 0

    for (const field of fields) {
      const fieldScore = scoreCommandField(term, field.text) * field.weight
      if (fieldScore > bestTermScore) {
        bestTermScore = fieldScore
      }
    }

    if (bestTermScore === 0) {
      return 0
    }

    totalScore += bestTermScore
  }

  return totalScore
}

function scoreCommandField(term: string, rawFieldText: string): number {
  const fieldText = rawFieldText.toLowerCase().trim()
  if (!term || !fieldText) {
    return 0
  }

  if (fieldText === term) {
    return 140
  }

  if (fieldText.startsWith(term)) {
    return 110
  }

  const words = fieldText.split(/[\s/_.-]+/).filter(Boolean)
  if (words.some((word) => word === term)) {
    return 95
  }

  if (words.some((word) => word.startsWith(term))) {
    return 78
  }

  const includesIndex = fieldText.indexOf(term)
  if (includesIndex >= 0) {
    return Math.max(52 - includesIndex, 28)
  }

  return scoreCommandSubsequenceMatch(term, fieldText)
}

function scoreCommandSubsequenceMatch(term: string, fieldText: string): number {
  let searchIndex = 0
  let firstMatchIndex = -1
  let lastMatchIndex = -1

  for (const char of term) {
    const nextIndex = fieldText.indexOf(char, searchIndex)
    if (nextIndex === -1) {
      return 0
    }

    if (firstMatchIndex === -1) {
      firstMatchIndex = nextIndex
    }

    lastMatchIndex = nextIndex
    searchIndex = nextIndex + 1
  }

  const span = lastMatchIndex - firstMatchIndex + 1
  const compactnessPenalty = Math.max(span - term.length, 0)
  return Math.max(36 - compactnessPenalty - firstMatchIndex, 12)
}
