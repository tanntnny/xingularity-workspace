import { Fragment, ReactElement } from 'react'
import { SearchResult } from '../../../shared/types'
import {
  createSearchTextIndex,
  findSearchMatchRanges,
  tokenizeSearchQuery
} from '../../../shared/searchText'
import { Search } from './ui/icons'
import { Button } from './ui/button'
import { EmptyState } from './ui/empty-state'
import { WorkspaceTextFade } from './ui/workspace-text-fade'
import { getWorkspaceOpenOptions, type WorkspaceOpenOptions } from '../lib/workspaceOpen'
import { SearchMatchText } from './SearchMatchText'

interface SearchResultsProps {
  results: SearchResult[]
  query: string
  onOpen: (result: SearchResult, options?: WorkspaceOpenOptions) => void
}

export function SearchResults({ results, query, onOpen }: SearchResultsProps): ReactElement {
  const terms = tokenizeSearchQuery(query.replace(/^@/, ''))
  const highlight = (text: string): ReactElement => (
    <SearchMatchText
      text={text}
      ranges={findSearchMatchRanges(createSearchTextIndex(text), terms)}
    />
  )

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
            {highlight(result.title)}
          </WorkspaceTextFade>
          <WorkspaceTextFade className="max-w-full text-xs text-muted-foreground">
            {highlight(`${result.provider ?? result.entityType} · ${result.state ?? 'available'}`)}
          </WorkspaceTextFade>
          <WorkspaceTextFade className="max-w-full text-xs text-muted-foreground">
            {highlight(result.relPath)}
          </WorkspaceTextFade>
          <WorkspaceTextFade lines={2} className="max-w-full text-xs text-muted-foreground">
            {highlight(result.snippet)}
          </WorkspaceTextFade>
          <WorkspaceTextFade className="max-w-full text-xs text-muted-foreground">
            {result.tags.map((tag, index) => (
              <Fragment key={`${tag}-${index}`}>
                {index > 0 ? ' ' : null}
                {highlight(`#${tag}`)}
              </Fragment>
            ))}
          </WorkspaceTextFade>
        </Button>
      ))}
    </div>
  )
}
