import { describe, expect, it } from 'vitest'
import type { CalendarTask, ProjectMilestone } from '../src/shared/types'
import {
  getProjectDirectTasks,
  getMostUrgentProjectTask,
  getProjectMilestoneProgress,
  getProjectMilestoneTasks,
  getProjectMilestoneStatus,
  getCurrentProjectMilestone,
  moveProjectMilestone
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

function createMilestone(id: string, title = id): ProjectMilestone {
  return {
    id,
    title,
    createdAt: '2026-08-13T00:00:00.000Z',
    updatedAt: '2026-08-13T00:00:00.000Z'
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

  it('selects the highest-priority unfinished task across the project', () => {
    const tasks = [
      createTask({
        id: 'medium-due-sooner',
        projectId: 'project-1',
        priority: 'medium',
        date: '2026-08-25'
      }),
      createTask({
        id: 'high-undated',
        projectId: 'project-1',
        priority: 'high',
        milestoneId: 'milestone-1'
      }),
      createTask({
        id: 'other-project',
        projectId: 'project-2',
        priority: 'high'
      }),
      createTask({
        id: 'completed-high',
        projectId: 'project-1',
        priority: 'high',
        status: 'completed',
        completed: true
      })
    ]

    expect(getMostUrgentProjectTask(tasks, 'project-1')?.id).toBe('high-undated')
  })

  it('uses due date and creation time to break priority ties', () => {
    const tasks = [
      createTask({
        id: 'later-created',
        projectId: 'project-1',
        priority: 'high',
        date: '2026-08-24',
        createdAt: '2026-08-14T00:00:00.000Z'
      }),
      createTask({
        id: 'earlier-due',
        projectId: 'project-1',
        priority: 'high',
        date: '2026-08-23',
        createdAt: '2026-08-15T00:00:00.000Z'
      }),
      createTask({
        id: 'earlier-created',
        projectId: 'project-1',
        priority: 'high',
        date: '2026-08-23',
        createdAt: '2026-08-13T00:00:00.000Z'
      })
    ]

    expect(getMostUrgentProjectTask(tasks, 'project-1')?.id).toBe('earlier-created')
  })

  it('returns no urgent task when every project task is done', () => {
    const tasks = [
      createTask({
        projectId: 'project-1',
        status: 'completed',
        completed: true
      }),
      createTask({
        id: 'canceled',
        projectId: 'project-1',
        status: 'canceled',
        completed: false
      })
    ]

    expect(getMostUrgentProjectTask(tasks, 'project-1')).toBeNull()
  })

  it('derives milestone completeness from all child task statuses', () => {
    const tasks = [
      createTask({ id: 'pending', status: 'pending' }),
      createTask({ id: 'canceled', status: 'canceled', completed: false }),
      createTask({ id: 'completed', status: 'completed', completed: true })
    ]

    expect(getProjectMilestoneProgress(tasks)).toEqual({
      completed: 2,
      total: 3,
      isComplete: false
    })
    expect(
      getProjectMilestoneProgress(
        tasks.map((task) => ({ ...task, status: 'completed', completed: true }))
      )
    ).toEqual({
      completed: 3,
      total: 3,
      isComplete: true
    })
    expect(getProjectMilestoneProgress([])).toEqual({
      completed: 0,
      total: 0,
      isComplete: false
    })
  })

  it('moves one milestone to a target index without changing its identity', () => {
    const milestones = [createMilestone('one'), createMilestone('two'), createMilestone('three')]

    expect(moveProjectMilestone(milestones, 'three', 0).map((item) => item.id)).toEqual([
      'three',
      'one',
      'two'
    ])
    expect(moveProjectMilestone(milestones, 'missing', 0)).toEqual(milestones)
  })

  it('selects the first incomplete milestone in the persisted order', () => {
    const milestones = [
      createMilestone('complete', 'Complete milestone'),
      createMilestone('current', 'Current milestone'),
      createMilestone('later', 'Later milestone')
    ]
    const tasks = [
      createTask({
        id: 'complete-task',
        projectId: 'project-1',
        milestoneId: 'complete',
        status: 'completed',
        completed: true
      }),
      createTask({ id: 'current-task', projectId: 'project-1', milestoneId: 'current' })
    ]

    expect(getCurrentProjectMilestone(milestones, tasks, 'project-1')?.id).toBe('current')
    expect(getCurrentProjectMilestone([createMilestone('empty')], [], 'project-1')?.id).toBe(
      'empty'
    )
    expect(
      getCurrentProjectMilestone(
        milestones.slice(0, 2),
        tasks.map((task) => ({ ...task, status: 'completed', completed: true })),
        'project-1'
      )
    ).toBeNull()
  })

  it('classifies the first incomplete milestone as current and later incomplete milestones as unreached', () => {
    const milestones = [
      createMilestone('complete'),
      createMilestone('current'),
      createMilestone('unreached')
    ]
    const tasks = [
      createTask({
        id: 'complete-task',
        projectId: 'project-1',
        milestoneId: 'complete',
        status: 'completed',
        completed: true
      }),
      createTask({ id: 'current-task', projectId: 'project-1', milestoneId: 'current' })
    ]

    expect(getProjectMilestoneStatus(milestones[0], milestones, tasks, 'project-1')).toBe(
      'complete'
    )
    expect(getProjectMilestoneStatus(milestones[1], milestones, tasks, 'project-1')).toBe('current')
    expect(getProjectMilestoneStatus(milestones[2], milestones, tasks, 'project-1')).toBe(
      'unreached'
    )
  })
})
