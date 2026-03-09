import { ReactElement } from 'react'
import { SearchResult } from '../../../shared/types'

interface SearchResultsProps {
  results: SearchResult[]
  onOpen: (relPath: string) => void
}

export function SearchResults({ results, onOpen }: SearchResultsProps): ReactElement {
  if (results.length === 0) {
    return <div className="p-5 text-sm text-[var(--muted)]">No search results</div>
  }

  return (
    <div className="flex h-full flex-col gap-2 overflow-auto p-3.5">
      {results.map((result) => (
        <button
          key={`${result.id}-${result.relPath}`}
          className="w-full rounded-lg border border-[var(--line)] bg-[var(--panel-2)] p-2.5 text-left hover:border-[var(--accent)]"
          onClick={() => onOpen(result.relPath)}
        >
          <div className="mb-0.5 text-base font-semibold">{result.title}</div>
          <div className="text-xs text-[var(--muted)]">{result.relPath}</div>
          <div className="text-xs text-[var(--muted)]">{result.snippet}</div>
          <div className="text-xs text-[var(--muted)]">
            {result.tags.map((tag) => `#${tag}`).join(' ')}
          </div>
        </button>
      ))}
    </div>
  )
}
