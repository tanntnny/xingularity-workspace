import { ReactElement } from 'react'
import { SearchResult } from '../../../shared/types'
import { SearchResults } from '../components/SearchResults'
import type { WorkspaceOpenOptions } from '../lib/workspaceOpen'

interface SearchPageProps {
  results: SearchResult[]
  query: string
  onOpen: (result: SearchResult, options?: WorkspaceOpenOptions) => void
}

export function SearchPage({ results, query, onOpen }: SearchPageProps): ReactElement {
  return <SearchResults results={results} query={query} onOpen={onOpen} />
}
