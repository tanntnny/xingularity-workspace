import { describe, expect, it } from 'vitest'
import {
  coerceFilledLucideProjectIcon,
  createRandomProjectIcon,
  normalizeProjectIcon
} from '../src/shared/projectIcons'

describe('project icon helpers', () => {
  it('creates deterministic icon for same seed', () => {
    const first = createRandomProjectIcon('project-seed')
    const second = createRandomProjectIcon('project-seed')
    expect(first).toEqual(second)
    expect(first.set).toBe('lucide')
    expect(first.variant).toBe('filled')
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
          color: '#be123c'
        },
        'alpha'
      )
    ).toEqual({
      set: 'shape',
      glyph: 'diamond',
      shape: 'diamond',
      variant: 'outlined',
      color: '#be123c'
    })
  })

  it('coerces legacy project icons into filled lucide icons for the picker', () => {
    expect(
      coerceFilledLucideProjectIcon(
        {
          shape: 'diamond',
          variant: 'outlined',
          color: '#be123c'
        },
        'alpha'
      )
    ).toEqual({
      set: 'lucide',
      glyph: 'folder-kanban',
      shape: undefined,
      variant: 'filled',
      color: '#be123c'
    })
  })
})
