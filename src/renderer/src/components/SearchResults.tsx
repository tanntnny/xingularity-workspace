import { ReactElement } from 'react'
import { SearchResult } from '../../../shared/types'
import { Button } from './ui/button'

interface SearchResultsProps {
  results: SearchResult[]
  onOpen: (relPath: string) => void
}

export function SearchResults({ results, onOpen }: SearchResultsProps): ReactElement {
  if (results.length === 0) {
    return <div className="p-5 text-sm text-muted-foreground">No search results</div>
  }

  return (
    <div className="flex h-full flex-col gap-2 overflow-auto p-3.5">
      {results.map((result) => (
        <Button
          key={`${result.id}-${result.relPath}`}
          variant="outline"
          className="h-auto w-full justify-start p-2.5 text-left whitespace-normal"
          onClick={() => onOpen(result.relPath)}
        >
          <div className="mb-0.5 text-base font-semibold">{result.title}</div>
          <div className="text-xs text-muted-foreground">{result.relPath}</div>
          <div className="text-xs text-muted-foreground">{result.snippet}</div>
          <div className="text-xs text-muted-foreground">
            {result.tags.map((tag) => `#${tag}`).join(' ')}
          </div>
        </Button>
      ))}
    </div>
  )
}
