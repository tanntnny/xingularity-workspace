import { describe, expect, it } from 'vitest'

import {
  PROJECT_ICON_CATALOG,
  PROJECT_ICON_PICKER_RESULT_LIMIT,
  getProjectIconCatalogEntry,
  searchProjectIcons
} from '../src/renderer/src/lib/projectIconCatalog'
import { PROJECT_ICON_SYMBOLS } from '../src/shared/projectIcons'

describe('project icon catalog', () => {
  it('loads the full outline and filled catalog as SVG nodes', () => {
    expect(PROJECT_ICON_CATALOG.length).toBeGreaterThan(6000)

    const outlinedRocket = getProjectIconCatalogEntry('rocket', 'outlined')
    const filledRocket = getProjectIconCatalogEntry('rocket', 'filled')

    expect(outlinedRocket.iconNode.length).toBeGreaterThan(0)
    expect(filledRocket.iconNode.length).toBeGreaterThan(0)
    expect(outlinedRocket.variant).toBe('outlined')
    expect(filledRocket.variant).toBe('filled')
    expect(outlinedRocket.iconNode).not.toBe(filledRocket.iconNode)
  })

  it('keeps every canonical project icon available in both variants', () => {
    for (const glyph of PROJECT_ICON_SYMBOLS) {
      expect(getProjectIconCatalogEntry(glyph, 'outlined').glyph).toBe(glyph)
      expect(getProjectIconCatalogEntry(glyph, 'outlined').variant).toBe('outlined')
      expect(getProjectIconCatalogEntry(glyph, 'filled').glyph).toBe(glyph)
      expect(getProjectIconCatalogEntry(glyph, 'filled').variant).toBe('filled')
    }
  })
})

describe('project icon search', () => {
  it('keeps the blank picker bounded and includes the current icon', () => {
    const result = searchProjectIcons('', { glyph: 'rocket', variant: 'outlined' })

    expect(result.entries.length).toBeLessThanOrEqual(PROJECT_ICON_PICKER_RESULT_LIMIT)
    expect(result.isTruncated).toBe(false)
    expect(
      result.entries.some((entry) => entry.glyph === 'rocket' && entry.variant === 'outlined')
    ).toBe(true)
  })

  it('ranks exact icon names before broader matches', () => {
    const result = searchProjectIcons('rocket')

    expect(result.entries.slice(0, 2).map((entry) => entry.glyph)).toEqual(['rocket', 'rocket'])
    expect(result.entries.some((entry) => entry.variant === 'filled')).toBe(true)
    expect(result.entries.some((entry) => entry.variant === 'outlined')).toBe(true)
    expect(result.entries.some((entry) => entry.glyph === 'briefcase')).toBe(false)
  })

  it('caps broad searches and reports that more results are available', () => {
    const result = searchProjectIcons('a')

    expect(result.totalMatches).toBeGreaterThan(PROJECT_ICON_PICKER_RESULT_LIMIT)
    expect(result.entries).toHaveLength(PROJECT_ICON_PICKER_RESULT_LIMIT)
    expect(result.isTruncated).toBe(true)
  })

  it('returns an accessible empty state for an unknown name', () => {
    const result = searchProjectIcons('not-a-real-project-icon')

    expect(result.entries).toHaveLength(0)
    expect(result.totalMatches).toBe(0)
    expect(result.isTruncated).toBe(false)
  })
})
