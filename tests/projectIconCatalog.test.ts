import { describe, expect, it } from 'vitest'
import {
  getProjectIconCatalogEntry,
  PROJECT_ICON_CATALOG
} from '../src/renderer/src/lib/projectIconCatalog'

describe('project icon catalog', () => {
  it('exposes the full installed filled Tabler catalog', () => {
    expect(PROJECT_ICON_CATALOG.length).toBeGreaterThan(1000)
    expect(getProjectIconCatalogEntry('rocket').label).toBe('Rocket')
    expect(getProjectIconCatalogEntry('rocket').Icon).toBeDefined()
  })

  it('creates searchable readable labels for compound glyph names', () => {
    expect(getProjectIconCatalogEntry('arrow-down-circle').label).toBe('Arrow Down Circle')
  })
})
