import { ReactElement } from 'react'
import { SearchResult } from '../../../shared/types'
import { Search } from './ui/icons'
import { Button } from './ui/button'
import { EmptyState } from './ui/empty-state'
import { WorkspaceTextFade } from './ui/workspace-text-fade'
import { getWorkspaceOpenOptions, type WorkspaceOpenOptions } from '../lib/workspaceOpen'

interface SearchResultsProps {
  results: SearchResult[]
  onOpen: (result: SearchResult, options?: WorkspaceOpenOptions) => void
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
          className="h-auto w-full min-w-0 flex-col items-start justify-start gap-0 p-2.5 text-left whitespace-normal"
          onClick={(event) => {
            const options = getWorkspaceOpenOptions(event)
            if (options.openInNewTab) {
              event.preventDefault()
              event.stopPropagation()
              onOpen(result, options)
              return
            }

            onOpen(result)
          }}
          onAuxClick={(event) => {
            if (event.button !== 1) {
              return
            }

            event.preventDefault()
            event.stopPropagation()
            onOpen(result, { openInNewTab: true })
          }}
        >
          <WorkspaceTextFade className="mb-0.5 max-w-full text-base font-semibold">
            {result.title}
          </WorkspaceTextFade>
          <WorkspaceTextFade className="max-w-full text-xs text-muted-foreground">
            {result.provider ?? result.entityType} · {result.state ?? 'available'}
          </WorkspaceTextFade>
          <WorkspaceTextFade className="max-w-full text-xs text-muted-foreground">
            {result.relPath}
          </WorkspaceTextFade>
          <WorkspaceTextFade lines={2} className="max-w-full text-xs text-muted-foreground">
            {result.snippet}
          </WorkspaceTextFade>
          <WorkspaceTextFade className="max-w-full text-xs text-muted-foreground">
            {result.tags.map((tag) => `#${tag}`).join(' ')}
          </WorkspaceTextFade>
        </Button>
      ))}
    </div>
  )
}
