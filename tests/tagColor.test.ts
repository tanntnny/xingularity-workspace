import { describe, expect, it } from 'vitest'
import {
  getTagColorIndex,
  getTagColorVariant,
  TAG_COLOR_COUNT,
  TAG_COLOR_VARIANTS
} from '../src/renderer/src/utils/tagColor'

describe('tag color helpers', () => {
  it('keeps equivalent tag names on the same color', () => {
    expect(getTagColorIndex('Alpha')).toBe(getTagColorIndex(' alpha '))
    expect(getTagColorVariant('#Project:Roadmap')).toBe(getTagColorVariant('project:roadmap'))
  })

  it('returns one of the configured color buckets', () => {
    const tags = ['alpha', 'beta', 'project:roadmap', 'release-1', 'work']

    for (const tag of tags) {
      expect(getTagColorIndex(tag)).toBeGreaterThanOrEqual(0)
      expect(getTagColorIndex(tag)).toBeLessThan(TAG_COLOR_COUNT)
      expect(TAG_COLOR_VARIANTS).toContain(getTagColorVariant(tag))
    }
  })

  it('defines six distinct tag variants', () => {
    expect(TAG_COLOR_VARIANTS).toHaveLength(TAG_COLOR_COUNT)
    expect(new Set(TAG_COLOR_VARIANTS).size).toBe(TAG_COLOR_COUNT)
  })
})
