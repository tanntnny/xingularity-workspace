import { ReactElement } from 'react'
import { SearchResult } from '../../../shared/types'
import { SearchResults } from '../components/SearchResults'

interface SearchPageProps {
  results: SearchResult[]
  onOpen: (relPath: string) => void
}

export function SearchPage({ results, onOpen }: SearchPageProps): ReactElement {
  return <SearchResults results={results} onOpen={onOpen} />
}
