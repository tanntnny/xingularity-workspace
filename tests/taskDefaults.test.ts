import { describe, expect, it } from 'vitest'
import { resolveTaskPriority } from '../src/shared/taskDefaults'

describe('task defaults', () => {
  it('uses medium when no priority is supplied', () => {
    expect(resolveTaskPriority(undefined)).toBe('medium')
  })

  it('preserves an explicitly supplied priority', () => {
    expect(resolveTaskPriority('low')).toBe('low')
    expect(resolveTaskPriority('high')).toBe('high')
  })
})
