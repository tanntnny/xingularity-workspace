import type { ReactNode } from 'react'

import { mergeSearchMatchRanges, type SearchMatchRange } from '../../../shared/searchText'

interface SearchMatchTextProps {
  text: string
  ranges?: readonly SearchMatchRange[]
  testId?: string
}

export function SearchMatchText({
  text,
  ranges,
  testId = 'search-match'
}: SearchMatchTextProps): ReactNode {
  if (!ranges?.length) {
    return text
  }

  const boundedRanges = mergeSearchMatchRanges(
    ranges
      .map(({ start, end }) => ({
        start: Math.max(0, Math.min(start, text.length)),
        end: Math.max(0, Math.min(end, text.length))
      }))
      .filter(({ start, end }) => end > start)
  )

  if (boundedRanges.length === 0) {
    return text
  }

  const segments: ReactNode[] = []
  let cursor = 0

  boundedRanges.forEach((range, index) => {
    if (range.start > cursor) {
      segments.push(text.slice(cursor, range.start))
    }

    segments.push(
      <mark
        key={`search-match-${index}`}
        data-testid={testId}
        className="rounded-none bg-yellow-700 font-medium text-white"
      >
        {text.slice(range.start, range.end)}
      </mark>
    )
    cursor = range.end
  })

  if (cursor < text.length) {
    segments.push(text.slice(cursor))
  }

  return segments
}
