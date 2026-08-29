import { describe, expect, it } from 'vitest'
import {
  getProjectIconCatalogEntry,
  PROJECT_ICON_CATALOG
} from '../src/renderer/src/lib/projectIconCatalog'

describe('project icon catalog', () => {
  it('exposes the full installed filled and outlined Tabler catalog', () => {
    expect(PROJECT_ICON_CATALOG.length).toBeGreaterThan(6000)

    const filledRocket = getProjectIconCatalogEntry('rocket', 'filled')
    const outlinedRocket = getProjectIconCatalogEntry('rocket', 'outlined')

    expect(filledRocket).toMatchObject({ label: 'Rocket', variant: 'filled' })
    expect(outlinedRocket).toMatchObject({ label: 'Rocket', variant: 'outlined' })
    expect(filledRocket.Icon).not.toBe(outlinedRocket.Icon)
  })

  it('includes outline-only Tabler icons', () => {
    expect(getProjectIconCatalogEntry('access-point', 'outlined')).toMatchObject({
      label: 'Access Point',
      variant: 'outlined'
    })
  })

  it('creates searchable readable labels for compound glyph names', () => {
    expect(getProjectIconCatalogEntry('arrow-down-circle').label).toBe('Arrow Down Circle')
  })
})
