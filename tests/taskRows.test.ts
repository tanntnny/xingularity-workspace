import { describe, expect, it } from 'vitest'
import type { CalendarTask, Project, ProjectMilestone } from '../src/shared/types'
import {
  filterTaskRows,
  getTaskFilterOptions,
  getTaskGroup,
  getTaskPageRows,
  hasTaskFilters,
  UNASSIGNED_TASK_MILESTONE_FILTER,
  UNASSIGNED_TASK_PROJECT_FILTER
} from '../src/renderer/src/lib/taskRows'

const milestone: ProjectMilestone = {
  id: 'milestone-1',
  title: 'Launch',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z'
}

const project: Project = {
  id: 'project-1',
  name: 'Atlas',
  summary: '',
  state: 'active',
  updatedAt: '2026-08-01T00:00:00.000Z',
  icon: { variant: 'filled', color: '#2563eb' },
  milestones: [milestone]
}

function task(id: string, overrides: Partial<CalendarTask> = {}): CalendarTask {
  return {
    id,
    title: id,
    tags: [],
    completed: false,
    status: 'pending',
    createdAt: '2026-08-01T00:00:00.000Z',
    priority: 'medium',
    reminders: [],
    ...overrides
  }
}

function createRows(): ReturnType<typeof getTaskPageRows> {
  return getTaskPageRows(
    [
      task('task-1', {
        title: 'Draft launch brief',
        projectId: project.id,
        milestoneId: milestone.id,
        status: 'in-progress',
        taskType: 'review',
        priority: 'high',
        date: '2026-08-05',
        endDate: '2026-08-10',
        tags: ['launch', 'brief']
      }),
      task('task-2', {
        title: 'Triage inbox',
        status: 'backlog',
        taskType: 'assignment',
        priority: 'low',
        tags: ['inbox']
      }),
      task('task-3', {
        title: 'Archive notes',
        status: 'completed',
        completed: true,
        endDate: '2026-08-01'
      })
    ],
    [project]
  )
}

describe('task page row projection', () => {
  it('resolves project context, fallback values, and duplicate task records', () => {
    const rows = getTaskPageRows(
      [
        task('task-1', { title: 'Old title' }),
        task('task-1', { title: 'Latest title', tags: ['work', 'work'] }),
        task('task-2', { title: 'Unassigned task' })
      ],
      [project]
    )

    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      task: { title: 'Latest title' },
      projectLabel: 'Unassigned',
      milestoneLabel: 'Unassigned',
      status: 'pending',
      taskType: 'assignment',
      priority: 'medium',
      tags: ['work']
    })
    expect(rows[1]?.task.title).toBe('Unassigned task')

    const contextualRows = createRows()
    expect(contextualRows[0]).toMatchObject({
      projectLabel: 'Atlas',
      milestoneLabel: 'Launch',
      status: 'in-progress',
      taskType: 'review',
      priority: 'high'
    })
  })
})

describe('task page filters and grouping', () => {
  it('combines text, facets, tags, and schedule states', () => {
    const rows = createRows()

    expect(filterTaskRows(rows, { searchQuery: 'launch brief' }).map((row) => row.task.id)).toEqual(
      ['task-1']
    )
    expect(filterTaskRows(rows, { projectIds: [project.id] }).map((row) => row.task.id)).toEqual([
      'task-1'
    ])
    expect(
      filterTaskRows(rows, { projectIds: [UNASSIGNED_TASK_PROJECT_FILTER] }).map(
        (row) => row.task.id
      )
    ).toEqual(['task-2', 'task-3'])
    expect(
      filterTaskRows(rows, { milestoneIds: [milestone.id], taskTypes: ['review'] }).map(
        (row) => row.task.id
      )
    ).toEqual(['task-1'])
    expect(filterTaskRows(rows, { tags: ['inbox'] }).map((row) => row.task.id)).toEqual(['task-2'])
    expect(
      filterTaskRows(rows, { scheduleStates: ['scheduled'] }).map((row) => row.task.id)
    ).toEqual(['task-1', 'task-3'])
    expect(
      filterTaskRows(rows, { scheduleStates: ['unscheduled'] }).map((row) => row.task.id)
    ).toEqual(['task-2'])
    expect(
      filterTaskRows(rows, { scheduleStates: ['overdue'] }, '2026-08-12').map((row) => row.task.id)
    ).toEqual(['task-1'])
  })

  it('exposes data-backed filter options and stable grouping metadata', () => {
    const rows = createRows()
    const options = getTaskFilterOptions(rows, [project], '2026-08-12')

    expect(options.projects).toEqual([
      { value: project.id, label: 'Atlas' },
      { value: UNASSIGNED_TASK_PROJECT_FILTER, label: 'Unassigned' }
    ])
    expect(options.milestones).toEqual([
      { value: milestone.id, label: 'Atlas · Launch' },
      { value: UNASSIGNED_TASK_MILESTONE_FILTER, label: 'Unassigned' }
    ])
    expect(options.schedules.map((option) => option.value)).toEqual([
      'scheduled',
      'unscheduled',
      'overdue'
    ])
    expect(options.tags.map((option) => option.label)).toEqual(['brief', 'inbox', 'launch'])

    expect(getTaskGroup(rows[0]!, 'project')).toMatchObject({
      id: 'project:project-1',
      label: 'Atlas'
    })
    expect(getTaskGroup(rows[1]!, 'project')).toMatchObject({
      id: UNASSIGNED_TASK_PROJECT_FILTER,
      label: 'Unassigned'
    })
    expect(getTaskGroup(rows[0]!, 'status')).toMatchObject({
      id: 'status:in-progress',
      label: 'In progress',
      sortValue: 2
    })
    expect(getTaskGroup(rows[0]!, 'priority')).toMatchObject({
      id: 'priority:high',
      label: 'High',
      sortValue: 0
    })
    expect(hasTaskFilters({ searchQuery: 'brief' })).toBe(false)
    expect(hasTaskFilters({ priorities: ['high'] })).toBe(true)
  })
})
