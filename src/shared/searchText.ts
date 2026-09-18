export interface SearchMatchRange {
  start: number
  end: number
}

export interface SearchTextIndex {
  text: string
  normalized: string
  searchable: string
  words: readonly SearchMatchRange[]
  sourceRanges: readonly SearchMatchRange[]
}

const SEARCH_DIACRITICS = /\p{M}/gu
const SEARCH_WORD = /[^\s/_.-]+/g

export function normalizeSearchText(value: string): string {
  return value.normalize('NFKD').replace(SEARCH_DIACRITICS, '').toLowerCase()
}

export function normalizeSearchQueryText(value: string): string {
  return normalizeSearchText(value).trim()
}

export function searchTextIncludes(text: string, query: string): boolean {
  const normalizedQuery = normalizeSearchQueryText(query)
  return Boolean(normalizedQuery) && normalizeSearchText(text).includes(normalizedQuery)
}

export function tokenizeSearchQuery(query: string): string[] {
  return normalizeSearchQueryText(query)
    .split(/[^\p{L}\p{N}]+/u)
    .map((term) => term.trim())
    .filter(Boolean)
}

export function createSearchTextIndex(text: string): SearchTextIndex {
  const normalizedParts: string[] = []
  const sourceRanges: SearchMatchRange[] = []
  let sourceOffset = 0

  for (const sourceCharacter of text) {
    const sourceStart = sourceOffset
    sourceOffset += sourceCharacter.length
    const normalizedCharacter = normalizeSearchText(sourceCharacter)

    for (const normalizedUnit of normalizedCharacter) {
      normalizedParts.push(normalizedUnit)
      for (let offset = 0; offset < normalizedUnit.length; offset += 1) {
        sourceRanges.push({ start: sourceStart, end: sourceOffset })
      }
    }
  }

  const normalized = normalizedParts.join('')
  const words: SearchMatchRange[] = []
  for (const match of normalized.matchAll(SEARCH_WORD)) {
    if (match.index === undefined) {
      continue
    }
    words.push({ start: match.index, end: match.index + match[0].length })
  }

  return {
    text,
    normalized,
    searchable: normalized.trim(),
    words,
    sourceRanges
  }
}

export function mergeSearchMatchRanges(
  ranges: readonly SearchMatchRange[]
): SearchMatchRange[] {
  return ranges
    .filter(({ start, end }) => end > start)
    .sort((left, right) => left.start - right.start || left.end - right.end)
    .reduce<SearchMatchRange[]>((merged, range) => {
      const previous = merged[merged.length - 1]
      if (!previous || range.start > previous.end) {
        merged.push({ ...range })
      } else {
        previous.end = Math.max(previous.end, range.end)
      }
      return merged
    }, [])
}

export function findSearchMatchRanges(
  index: SearchTextIndex,
  terms: readonly string[],
  options: { fuzzy?: boolean } = {}
): SearchMatchRange[] {
  const ranges = terms.flatMap((term) => {
    const contiguousRanges = findContiguousRanges(index.normalized, term)
    const normalizedRanges =
      contiguousRanges.length > 0 || !options.fuzzy
        ? contiguousRanges
        : findFuzzyRanges(index.normalized, term)

    return normalizedRanges.flatMap((range) => {
      const firstSourceRange = index.sourceRanges[range.start]
      const lastSourceRange = index.sourceRanges[range.end - 1]
      return firstSourceRange && lastSourceRange
        ? [{ start: firstSourceRange.start, end: lastSourceRange.end }]
        : []
    })
  })

  return mergeSearchMatchRanges(ranges)
}

function findContiguousRanges(text: string, term: string): SearchMatchRange[] {
  if (!term) {
    return []
  }

  const ranges: SearchMatchRange[] = []
  let searchIndex = 0
  while (searchIndex < text.length) {
    const matchIndex = text.indexOf(term, searchIndex)
    if (matchIndex < 0) {
      break
    }
    ranges.push({ start: matchIndex, end: matchIndex + term.length })
    searchIndex = matchIndex + term.length
  }
  return ranges
}

function findFuzzyRanges(text: string, term: string): SearchMatchRange[] {
  const ranges: SearchMatchRange[] = []
  let searchIndex = 0

  for (const character of term) {
    const matchIndex = text.indexOf(character, searchIndex)
    if (matchIndex < 0) {
      return []
    }
    ranges.push({ start: matchIndex, end: matchIndex + character.length })
    searchIndex = matchIndex + character.length
  }

  return ranges
}
