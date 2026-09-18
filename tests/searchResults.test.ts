import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { SearchResults } from '../src/renderer/src/components/SearchResults'
import type { SearchResult } from '../src/shared/types'

const RESULT: SearchResult = {
  id: 'note:cafe',
  relPath: 'Projects/Café Roadmap.md',
  title: 'Café Roadmap',
  tags: ['planning'],
  updated: '2026-09-19T00:00:00.000Z',
  snippet: 'Review the café launch plan',
  entityType: 'note',
  target: {
    kind: 'note',
    id: 'note:cafe',
    relPath: 'Projects/Café Roadmap.md'
  }
}

describe('search results', () => {
  it('renders normalized search matches as safe semantic highlights', () => {
    const markup = renderToStaticMarkup(
      createElement(SearchResults, {
        results: [RESULT],
        query: 'cafe',
        onOpen: () => undefined
      })
    )

    expect(markup.match(/data-testid="search-match"/g)?.length).toBeGreaterThanOrEqual(3)
    expect(markup).toContain('<mark')
    expect(markup).toContain('Café')
    expect(markup).toContain('bg-yellow-700')
  })
})
