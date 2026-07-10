import { describe, expect, it } from 'vitest'
import type { Project } from '../src/shared/types'
import {
  buildProjectTaskRows,
  compareProjectTaskRows,
  filterProjectsForWorkspace
} from '../src/renderer/src/lib/projectTaskRows'
import type { ProjectTaskRow } from '../src/renderer/src/lib/projectTaskRows'

const alphaProject: Project = {
  id: 'project-alpha',
  name: 'Alpha',
  summary: 'Alpha summary',
  status: 'on-track',
  updatedAt: '2026-07-05T10:00:00.000Z',
  progress: 50,
  icon: {
    set: 'shape',
    glyph: 'circle',
    shape: 'circle',
    variant: 'filled',
    color: '#2563eb'
  },
  milestones: [
    {
      id: 'milestone-alpha',
      title: 'Launch',
      description: '',
      dueDate: '2026-07-10',
      priority: 'high',
      status: 'pending',
      subtasks: [
        {
          id: 'subtask-alpha',
          title: 'Write copy',
          description: '',
          completed: false,
          priority: 'medium',
          createdAt: '2026-07-01T10:00:00.000Z',
          dueDate: '2026-07-09'
        }
      ]
    }
  ]
}

const betaProject: Project = {
  ...alphaProject,
  id: 'project-beta',
  name: 'Beta',
  status: 'completed',
  updatedAt: '2026-07-01T10:00:00.000Z',
  milestones: []
}

describe('project task row helpers', () => {
  it('builds milestone and subtask rows without applying table sort order', () => {
    const rows = buildProjectTaskRows([alphaProject])

    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      kind: 'milestone',
      projectName: 'Alpha',
      title: 'Launch',
      dueDate: '2026-07-10',
      milestoneDueDate: '2026-07-10',
      milestonePriority: 'high',
      milestoneCompletedSubtaskCount: 0,
      milestoneSubtaskCount: 1,
      milestoneProgressPercent: 0
    })
    expect(rows[1]).toMatchObject({
      kind: 'subtask',
      projectName: 'Alpha',
      title: 'Write copy',
      dueDate: '2026-07-09',
      milestoneDueDate: '2026-07-10',
      milestonePriority: 'high',
      milestoneCompletedSubtaskCount: 0,
      milestoneSubtaskCount: 1,
      milestoneProgressPercent: 0
    })
  })

  it('filters workspace projects by favorites and completion state', () => {
    expect(
      filterProjectsForWorkspace([alphaProject, betaProject], ['project-beta'], 'favorites')
    ).toEqual([betaProject])
    expect(filterProjectsForWorkspace([alphaProject, betaProject], [], 'active')).toEqual([
      alphaProject
    ])
    expect(filterProjectsForWorkspace([alphaProject, betaProject], [], 'completed')).toEqual([
      betaProject
    ])
  })

  it('sorts rows by due date with empty dates last in ascending order', () => {
    const rows = [
      createTaskRow({ id: 'task-late', dueDate: '2026-07-10' }),
      createTaskRow({ id: 'task-early', dueDate: '2026-07-09' }),
      createTaskRow({ id: 'task-none', dueDate: undefined })
    ]

    expect(
      [...rows]
        .sort((left, right) => compareProjectTaskRows(left, right, 'dueDate', 'asc'))
        .map((row) => row.id)
    ).toEqual(['task-early', 'task-late', 'task-none'])

    expect(
      [...rows]
        .sort((left, right) => compareProjectTaskRows(left, right, 'dueDate', 'desc'))
        .map((row) => row.id)
    ).toEqual(['task-none', 'task-late', 'task-early'])
  })

  it('sorts rows by completion status', () => {
    const rows = [
      createTaskRow({ id: 'task-complete', completed: true }),
      createTaskRow({ id: 'task-pending', completed: false })
    ]

    expect(
      [...rows]
        .sort((left, right) => compareProjectTaskRows(left, right, 'status', 'asc'))
        .map((row) => row.id)
    ).toEqual(['task-pending', 'task-complete'])

    expect(
      [...rows]
        .sort((left, right) => compareProjectTaskRows(left, right, 'status', 'desc'))
        .map((row) => row.id)
    ).toEqual(['task-complete', 'task-pending'])
  })

  it('sorts rows by priority with high first and no-priority last', () => {
    const rows = [
      createTaskRow({ id: 'task-none', priority: undefined }),
      createTaskRow({ id: 'task-low', priority: 'low' }),
      createTaskRow({ id: 'task-high', priority: 'high' }),
      createTaskRow({ id: 'task-medium', priority: 'medium' })
    ]

    expect(
      [...rows]
        .sort((left, right) => compareProjectTaskRows(left, right, 'priority', 'asc'))
        .map((row) => row.id)
    ).toEqual(['task-high', 'task-medium', 'task-low', 'task-none'])

    expect(
      [...rows]
        .sort((left, right) => compareProjectTaskRows(left, right, 'priority', 'desc'))
        .map((row) => row.id)
    ).toEqual(['task-none', 'task-low', 'task-medium', 'task-high'])
  })

  it('sorts rows alphabetically by project and milestone', () => {
    const rows = [
      createTaskRow({ id: 'task-beta', projectName: 'Beta', milestoneTitle: 'Review' }),
      createTaskRow({ id: 'task-alpha-b', projectName: 'Alpha', milestoneTitle: 'Zeta' }),
      createTaskRow({ id: 'task-alpha-a', projectName: 'Alpha', milestoneTitle: 'Launch' })
    ]

    expect(
      [...rows]
        .sort((left, right) => compareProjectTaskRows(left, right, 'project', 'asc'))
        .map((row) => row.id)
    ).toEqual(['task-alpha-a', 'task-alpha-b', 'task-beta'])

    expect(
      [...rows]
        .sort((left, right) => compareProjectTaskRows(left, right, 'milestone', 'asc'))
        .map((row) => row.id)
    ).toEqual(['task-alpha-a', 'task-beta', 'task-alpha-b'])
  })
})

function createTaskRow(
  overrides: Partial<ProjectTaskRow> & Pick<ProjectTaskRow, 'id'>
): ProjectTaskRow {
  const { id, ...rest } = overrides

  return {
    id,
    kind: 'milestone',
    title: 'Task',
    completed: false,
    priority: undefined,
    dueDate: '2026-07-10',
    projectId: 'project-alpha',
    projectName: 'Alpha',
    projectIcon: alphaProject.icon,
    projectStatus: 'on-track',
    milestoneId: 'milestone-alpha',
    milestoneTitle: 'Launch',
    milestoneDueDate: '2026-07-10',
    milestonePriority: 'high',
    milestoneStatus: 'pending',
    milestoneCompletedSubtaskCount: 0,
    milestoneSubtaskCount: 0,
    milestoneProgressPercent: 0,
    ...rest
  }
}
