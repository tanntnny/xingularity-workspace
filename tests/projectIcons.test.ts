import { describe, expect, it } from 'vitest'
import {
  coerceFilledTablerProjectIcon,
  createRandomProjectIcon,
  normalizeProjectIcon,
  PROJECT_ICON_COLORS
} from '../src/shared/projectIcons'

describe('project icon helpers', () => {
  it('creates deterministic icon for same seed', () => {
    const first = createRandomProjectIcon('project-seed')
    const second = createRandomProjectIcon('project-seed')
    expect(first).toEqual(second)
    expect(first.set).toBe('tabler')
    expect(first.variant).toBe('filled')
    expect(PROJECT_ICON_COLORS).toContain(first.color)
  })

  it('creates different icons for different seeds', () => {
    const first = createRandomProjectIcon('project-a')
    const second = createRandomProjectIcon('project-b')
    expect(first).not.toEqual(second)
  })

  it('normalizes legacy shape icons into the current model', () => {
    expect(
      normalizeProjectIcon(
        {
          shape: 'diamond',
          variant: 'outlined',
          color: '#38bdf8'
        },
        'alpha'
      )
    ).toEqual({
      set: 'tabler',
      glyph: 'folder-kanban',
      shape: undefined,
      variant: 'filled',
      color: '#38bdf8'
    })
  })

  it('coerces legacy project icons into filled Tabler icons for the picker', () => {
    expect(
      coerceFilledTablerProjectIcon(
        {
          shape: 'diamond',
          variant: 'outlined',
          color: '#38bdf8'
        },
        'alpha'
      )
    ).toEqual({
      set: 'tabler',
      glyph: 'folder-kanban',
      shape: undefined,
      variant: 'filled',
      color: '#38bdf8'
    })
  })

  it('normalizes legacy Lucide glyphs into canonical Tabler records', () => {
    expect(
      normalizeProjectIcon(
        {
          set: 'lucide',
          glyph: 'sparkles',
          variant: 'outlined',
          color: '#60a5fa'
        },
        'beta'
      )
    ).toEqual({
      set: 'tabler',
      glyph: 'sparkles',
      shape: undefined,
      variant: 'filled',
      color: '#60a5fa'
    })
  })

  it('preserves arbitrary filled Tabler glyph slugs', () => {
    expect(
      normalizeProjectIcon(
        {
          set: 'tabler',
          glyph: '3d-cube-sphere',
          variant: 'filled',
          color: '#38bdf8'
        },
        'gamma'
      )
    ).toEqual({
      set: 'tabler',
      glyph: '3d-cube-sphere',
      shape: undefined,
      variant: 'filled',
      color: '#38bdf8'
    })
  })

  it('preserves outlined Tabler icon variants', () => {
    expect(
      normalizeProjectIcon(
        {
          set: 'tabler',
          glyph: 'access-point',
          variant: 'outlined',
          color: '#38bdf8'
        },
        'outlined-project'
      )
    ).toEqual({
      set: 'tabler',
      glyph: 'access-point',
      shape: undefined,
      variant: 'outlined',
      color: '#38bdf8'
    })
  })

  it('remaps low-contrast project colors deterministically', () => {
    const first = normalizeProjectIcon(
      { glyph: 'rocket', variant: 'filled', color: '#334155' },
      'legacy-project'
    )
    const second = normalizeProjectIcon(
      { glyph: 'rocket', variant: 'filled', color: '#334155' },
      'legacy-project'
    )

    expect(first.color).not.toBe('#334155')
    expect(PROJECT_ICON_COLORS).toContain(first.color)
    expect(second.color).toBe(first.color)
  })
})
