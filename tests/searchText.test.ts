import { describe, expect, it } from 'vitest'
import {
  createSearchTextIndex,
  findSearchMatchRanges,
  normalizeSearchText,
  searchTextIncludes,
  tokenizeSearchQuery
} from '../src/shared/searchText'

describe('shared search text normalization', () => {
  it('normalizes case and diacritics without changing the stored text', () => {
    expect(normalizeSearchText('Café Résumé')).toBe('cafe resume')
    expect(searchTextIncludes('Café Résumé', 'resume')).toBe(true)
  })

  it('tokenizes normalized terms while preserving multi-term AND semantics', () => {
    expect(tokenizeSearchQuery('  Café / roadmap  ')).toEqual(['cafe', 'roadmap'])
  })

  it('maps normalized match ranges back to the original text', () => {
    const index = createSearchTextIndex('Café roadmap')

    expect(findSearchMatchRanges(index, ['cafe'])).toEqual([{ start: 0, end: 4 }])
    expect('Café roadmap'.slice(0, 4)).toBe('Café')
  })

  it('keeps command-palette fuzzy highlighting compatible with normalized text', () => {
    const index = createSearchTextIndex('Go Projects')

    expect(findSearchMatchRanges(index, ['gpr'], { fuzzy: true })).toEqual([
      { start: 0, end: 1 },
      { start: 3, end: 5 }
    ])
  })
})
