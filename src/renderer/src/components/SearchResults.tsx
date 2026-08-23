import { ReactElement } from 'react'
import { SearchResult } from '../../../shared/types'
import { Search } from './ui/icons'
import { Button } from './ui/button'
import { EmptyState } from './ui/empty-state'

interface SearchResultsProps {
  results: SearchResult[]
  onOpen: (result: SearchResult) => void
}

export function SearchResults({ results, onOpen }: SearchResultsProps): ReactElement {
  if (results.length === 0) {
    return (
      <EmptyState
        className="h-full"
        icon={Search}
        title="No search results"
        description="Try a different search term."
      />
    )
  }

  return (
    <div className="flex min-h-full w-full flex-col gap-2 p-2">
      {results.map((result) => (
        <Button
          key={`${result.id}-${result.relPath}`}
          variant="outline"
          className="h-auto w-full justify-start p-2.5 text-left whitespace-normal"
          onClick={() => onOpen(result)}
        >
          <span className="mb-0.5 block text-base font-semibold">{result.title}</span>
          <span className="block text-xs text-muted-foreground">
            {result.provider ?? result.entityType} · {result.state ?? 'available'}
          </span>
          <span className="block text-xs text-muted-foreground">{result.relPath}</span>
          <span className="block text-xs text-muted-foreground">{result.snippet}</span>
          <span className="block text-xs text-muted-foreground">
            {result.tags.map((tag) => `#${tag}`).join(' ')}
          </span>
        </Button>
      ))}
    </div>
  )
}
