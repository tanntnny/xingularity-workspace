import { describe, expect, it } from 'vitest'
import type { CalendarTask } from '../src/shared/types'
import {
  getProjectDirectTasks,
  getProjectMilestoneProgress,
  getProjectMilestoneTasks
} from '../src/renderer/src/lib/projectMilestones'

function createTask(overrides: Partial<CalendarTask> = {}): CalendarTask {
  return {
    id: 'task-1',
    title: 'Task',
    tags: [],
    completed: false,
    status: 'pending',
    createdAt: '2026-08-13T00:00:00.000Z',
    priority: 'low',
    taskType: 'assignment',
    reminders: [],
    ...overrides
  }
}

describe('project milestones', () => {
  it('separates direct project tasks from milestone tasks', () => {
    const tasks = [
      createTask({ id: 'direct', projectId: 'project-1' }),
      createTask({ id: 'child', projectId: 'project-1', milestoneId: 'milestone-1' }),
      createTask({ id: 'other-project', projectId: 'project-2', milestoneId: 'milestone-1' })
    ]

    expect(getProjectDirectTasks(tasks, 'project-1').map((task) => task.id)).toEqual(['direct'])
    expect(
      getProjectMilestoneTasks(tasks, 'project-1', 'milestone-1').map((task) => task.id)
    ).toEqual(['child'])
  })

  it('derives milestone completeness from all child task statuses', () => {
    const tasks = [
      createTask({ id: 'pending', status: 'pending' }),
      createTask({ id: 'completed', status: 'completed', completed: true })
    ]

    expect(getProjectMilestoneProgress(tasks)).toEqual({
      completed: 1,
      total: 2,
      isComplete: false
    })
    expect(
      getProjectMilestoneProgress(
        tasks.map((task) => ({ ...task, status: 'completed', completed: true }))
      )
    ).toEqual({
      completed: 2,
      total: 2,
      isComplete: true
    })
    expect(getProjectMilestoneProgress([])).toEqual({
      completed: 0,
      total: 0,
      isComplete: false
    })
  })
})
