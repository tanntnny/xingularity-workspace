import { describe, expect, it } from 'vitest'
import { normalizeTaskTags } from '../src/shared/taskTags'

describe('task tag normalization', () => {
  it('normalizes, deduplicates, and preserves supported task tags', () => {
    expect(
      normalizeTaskTags([
        ' #Design Notes ',
        'design-notes',
        'project:alpha',
        'release_1',
        'not/valid'
      ])
    ).toEqual(['design-notes', 'project:alpha', 'release_1'])
  })

  it('returns an empty list for malformed values and caps the tag count', () => {
    const manyTags = Array.from({ length: 55 }, (_, index) => `tag-${index}`)

    expect(normalizeTaskTags(null)).toEqual([])
    expect(normalizeTaskTags(['', 42, null, 'bad/tag'])).toEqual([])
    expect(normalizeTaskTags(manyTags)).toHaveLength(50)
  })
})
