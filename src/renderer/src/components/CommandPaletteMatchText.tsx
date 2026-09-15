import type { ReactNode } from 'react'

import {
  mergeCommandPaletteMatchRanges,
  type CommandPaletteMatchRange
} from '../lib/commandPaletteSearch'

interface CommandPaletteMatchTextProps {
  text: string
  ranges?: readonly CommandPaletteMatchRange[]
}

export function CommandPaletteMatchText({ text, ranges }: CommandPaletteMatchTextProps): ReactNode {
  if (!ranges?.length) {
    return text
  }

  const boundedRanges = mergeCommandPaletteMatchRanges(
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
        key={`command-palette-match-${index}`}
        data-testid="command-palette-match"
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
