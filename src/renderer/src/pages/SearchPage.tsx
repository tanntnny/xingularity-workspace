import { ReactElement } from 'react'
import { SearchResult } from '../../../shared/types'
import { SearchResults } from '../components/SearchResults'
import type { WorkspaceOpenOptions } from '../lib/workspaceOpen'

interface SearchPageProps {
  results: SearchResult[]
  onOpen: (result: SearchResult, options?: WorkspaceOpenOptions) => void
}

export function SearchPage({ results, onOpen }: SearchPageProps): ReactElement {
  return <SearchResults results={results} onOpen={onOpen} />
}
