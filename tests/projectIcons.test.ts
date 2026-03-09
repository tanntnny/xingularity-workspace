import { describe, expect, it } from 'vitest'
import { createRandomProjectIcon } from '../src/shared/projectIcons'

describe('project icon helpers', () => {
  it('creates deterministic icon for same seed', () => {
    const first = createRandomProjectIcon('project-seed')
    const second = createRandomProjectIcon('project-seed')
    expect(first).toEqual(second)
  })

  it('creates different icons for different seeds', () => {
    const first = createRandomProjectIcon('project-a')
    const second = createRandomProjectIcon('project-b')
    expect(first).not.toEqual(second)
  })
})
