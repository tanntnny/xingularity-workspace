import { describe, expect, it } from 'vitest'
import type { TaskStatus } from '../src/shared/types'
import { getTaskStatus, TASK_STATUS_META } from '../src/renderer/src/lib/taskStatus'

describe('task status metadata', () => {
  it('defines visual metadata for every task status', () => {
    const statuses: TaskStatus[] = ['pending', 'backlog', 'in-progress', 'blocked', 'completed']

    expect(Object.keys(TASK_STATUS_META)).toEqual(statuses)
    expect(TASK_STATUS_META.backlog.label).toBe('Backlog')
    expect(TASK_STATUS_META.backlog.tone).toBe('warning')
  })

  it('preserves legacy completed fallback behavior', () => {
    expect(getTaskStatus(undefined, false)).toBe('pending')
    expect(getTaskStatus(undefined, true)).toBe('completed')
    expect(getTaskStatus('backlog', true)).toBe('backlog')
  })
})
