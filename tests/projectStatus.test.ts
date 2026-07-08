import { describe, expect, it } from 'vitest'
import type { ProjectMilestone } from '../src/shared/types'
import { PROJECT_STATUS_META, deriveMilestoneStatus } from '../src/renderer/src/lib/projectStatus'

describe('PROJECT_STATUS_META', () => {
  it('maps project statuses onto semantic UI tones', () => {
    expect(PROJECT_STATUS_META['on-track'].tone).toBe('success')
    expect(PROJECT_STATUS_META['at-risk'].tone).toBe('warning')
    expect(PROJECT_STATUS_META.blocked.tone).toBe('danger')
    expect(PROJECT_STATUS_META.completed.tone).toBe('success')
  })
})

describe('deriveMilestoneStatus', () => {
  it('drops a completed milestone back to in-progress when a subtask is unchecked', () => {
    expect(
      deriveMilestoneStatus(
        createMilestone({
          status: 'completed',
          subtasks: [
            createSubtask({ id: 'subtask-a', completed: true }),
            createSubtask({ id: 'subtask-b', completed: false })
          ]
        })
      )
    ).toBe('in-progress')
  })

  it('preserves a manually completed milestone when it has no subtasks', () => {
    expect(deriveMilestoneStatus(createMilestone({ status: 'completed' }))).toBe('completed')
  })

  it('preserves blocked milestones until every subtask is completed', () => {
    expect(
      deriveMilestoneStatus(
        createMilestone({
          status: 'blocked',
          subtasks: [createSubtask({ completed: false }), createSubtask({ completed: false })]
        })
      )
    ).toBe('blocked')
  })
})

function createMilestone(overrides: Partial<ProjectMilestone> = {}): ProjectMilestone {
  return {
    id: 'milestone-1',
    title: 'Milestone',
    status: 'pending',
    subtasks: [],
    ...overrides
  }
}

function createSubtask(
  overrides: Partial<ProjectMilestone['subtasks'][number]> = {}
): ProjectMilestone['subtasks'][number] {
  return {
    id: 'subtask-1',
    title: 'Subtask',
    completed: false,
    createdAt: '2026-07-07T00:00:00.000Z',
    ...overrides
  }
}
