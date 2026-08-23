import { describe, expect, it } from 'vitest'
import {
  applyProjectMilestoneOrder,
  calculateProjectHealth,
  getBlockedByDependencies,
  validateTaskDependencies,
  validateTaskRelationships
} from '../src/shared/projectPlanning'
import type { CalendarTask, Project } from '../src/shared/types'

const project: Project = {
  id: 'project-1',
  name: 'Roadmap',
  summary: '',
  state: 'active',
  updatedAt: '2026-08-01T00:00:00.000Z',
  icon: { variant: 'filled', color: '#000000' }
}

function task(id: string, overrides: Partial<CalendarTask> = {}): CalendarTask {
  return {
    id,
    title: id,
    projectId: project.id,
    tags: [],
    completed: false,
    status: 'pending',
    createdAt: '2026-08-01T00:00:00.000Z',
    priority: 'medium',
    reminders: [],
    ...overrides
  }
}

describe('project planning dependencies', () => {
  it('reports cycles and missing dependencies', () => {
    const errors = validateTaskDependencies([
      task('a', { dependencyIds: ['b'] }),
      task('b', { dependencyIds: ['a', 'missing'] })
    ])
    expect(errors).toEqual(
      expect.arrayContaining(['Dependency cycle includes a', 'b depends on missing task missing'])
    )
  })

  it('identifies unfinished blockers and project health', () => {
    const blocker = task('blocker', { date: '2026-08-01', completed: false })
    const blocked = task('blocked', { dependencyIds: ['blocker'], endDate: '2026-07-01' })
    expect(getBlockedByDependencies(blocked, [blocker, blocked])).toEqual([blocker])
    expect(calculateProjectHealth(project, [blocker, blocked], '2026-08-17')).toMatchObject({
      totalTasks: 2,
      blockedTasks: 1,
      overdueTasks: 2,
      completionRatio: 0
    })
  })

  it('treats canceled tasks as done for dependencies and project health', () => {
    const canceled = task('canceled', {
      status: 'canceled',
      completed: false,
      date: '2026-08-01'
    })
    const followUp = task('follow-up', {
      dependencyIds: ['canceled'],
      endDate: '2026-08-20'
    })

    expect(getBlockedByDependencies(followUp, [canceled, followUp])).toEqual([])
    expect(calculateProjectHealth(project, [canceled, followUp], '2026-08-17')).toMatchObject({
      totalTasks: 2,
      completedTasks: 1,
      blockedTasks: 0,
      overdueTasks: 0,
      completionRatio: 0.5
    })

    expect(
      calculateProjectHealth(project, [task('blocked', { status: 'blocked' })], '2026-08-17')
    ).toMatchObject({ blockedTasks: 1, completedTasks: 0 })
  })

  it('validates parent task references and parent cycles', () => {
    const errors = validateTaskRelationships([
      task('child', { parentTaskId: 'missing' }),
      task('a', { parentTaskId: 'b' }),
      task('b', { parentTaskId: 'a' })
    ])

    expect(errors).toEqual(
      expect.arrayContaining([
        'child has missing parent task missing',
        'Parent task cycle includes a'
      ])
    )
  })
})

describe('project milestone ordering', () => {
  it('applies a complete milestone order and rejects partial orders', () => {
    const projectWithMilestones: Project = {
      ...project,
      milestones: [
        {
          id: 'milestone-1',
          title: 'First',
          createdAt: '2026-08-01T00:00:00.000Z',
          updatedAt: '2026-08-01T00:00:00.000Z'
        },
        {
          id: 'milestone-2',
          title: 'Second',
          createdAt: '2026-08-01T00:00:00.000Z',
          updatedAt: '2026-08-01T00:00:00.000Z'
        }
      ]
    }

    expect(
      applyProjectMilestoneOrder(projectWithMilestones, [
        'milestone-2',
        'milestone-1'
      ]).milestones?.map((milestone) => milestone.id)
    ).toEqual(['milestone-2', 'milestone-1'])
    expect(() => applyProjectMilestoneOrder(projectWithMilestones, ['milestone-2'])).toThrow(
      'Milestone order must include every milestone exactly once'
    )
  })
})
