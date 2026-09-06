import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { TaskFiltersPopover } from '../src/renderer/src/components/TaskFiltersPopover'
import { TaskGroupByPopover } from '../src/renderer/src/components/TaskGroupByPopover'
import { TaskTable } from '../src/renderer/src/components/TaskTable'
import { TaskSearchInput, TasksPage } from '../src/renderer/src/pages/TasksPage'
import { getTaskPageRows, type TaskFilterOptions } from '../src/renderer/src/lib/taskRows'
import type { TaskWorkspaceViewState } from '../src/renderer/src/lib/workspaceViewState'
import type { CalendarTask, Project } from '../src/shared/types'

const project: Project = {
  id: 'project-1',
  name: 'Atlas',
  summary: '',
  state: 'active',
  updatedAt: '2026-08-01T00:00:00.000Z',
  icon: { variant: 'filled', color: '#2563eb' },
  milestones: [
    {
      id: 'milestone-1',
      title: 'Launch',
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z'
    }
  ]
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

const taskRows = getTaskPageRows(
  [
    task('task-1', {
      title: 'Launch brief',
      projectId: project.id,
      milestoneId: 'milestone-1',
      taskType: 'review',
      priority: 'high',
      date: '2026-08-05',
      endDate: '2026-08-10',
      tags: ['release']
    }),
    task('task-2', { title: 'Inbox follow-up', tags: ['inbox'] })
  ],
  [project]
)

describe('TasksPage', () => {
  it('renders a controlled workspace view without replacing the task table', () => {
    const viewState: TaskWorkspaceViewState = {
      filters: { searchQuery: 'Launch', statuses: ['pending'] },
      groupBy: 'priority',
      sortState: { columnId: 'priority', direction: 'desc' }
    }
    const markup = renderToStaticMarkup(
      createElement(TasksPage, {
        projects: [project],
        tasks: [taskRows[0]!.task, taskRows[1]!.task],
        onOpenTask: () => undefined,
        viewState,
        onViewStateChange: () => undefined
      })
    )

    expect(markup).toContain('data-testid="tasks-page"')
    expect(markup).toContain('data-testid="tasks-table"')
    expect(markup).toContain('data-testid="table-row-list-group:priority:high"')
    expect(markup).toContain('>Launch brief</span>')
    expect(markup).not.toContain('>Inbox follow-up</span>')
  })

  it('renders the global task table with planning context', () => {
    const markup = renderToStaticMarkup(
      createElement(TasksPage, {
        projects: [project],
        tasks: [taskRows[0]!.task],
        onOpenTask: () => undefined
      })
    )

    expect(markup).toContain('data-testid="tasks-page"')
    expect(markup).toContain('data-testid="tasks-table"')
    expect(markup).toContain('>Name</span>')
    expect(markup).toContain('>Status</span>')
    expect(markup).toContain('>Type</span>')
    expect(markup).toContain('>Priority</span>')
    expect(markup).toContain('>Project</span>')
    expect(markup).toContain('>Milestone</span>')
    expect(markup).toContain('>Start date</span>')
    expect(markup).toContain('>End date</span>')
    expect(markup).toContain('>Tags</span>')
    expect(markup).toContain('>Launch brief</span>')
    expect(markup).toContain('Atlas')
    expect(markup).toContain('Launch')
    expect(markup).toContain('Aug 5, 2026')
    expect(markup).toContain('Aug 10, 2026')
    expect(markup).toContain('data-testid="task-row:task-1"')
  })

  it('renders grouping, filtering, and search controls for the top bar', () => {
    const options: TaskFilterOptions = {
      statuses: [{ value: 'pending', label: 'Pending' }],
      types: [{ value: 'assignment', label: 'Assignment' }],
      priorities: [{ value: 'medium', label: 'Medium' }],
      projects: [{ value: project.id, label: project.name }],
      milestones: [{ value: 'milestone-1', label: 'Atlas · Launch' }],
      schedules: [{ value: 'scheduled', label: 'Scheduled' }],
      tags: [{ value: 'release', label: 'release' }]
    }

    const groupMarkup = renderToStaticMarkup(
      createElement(TaskGroupByPopover, { value: 'none', onChange: () => undefined })
    )
    const filterMarkup = renderToStaticMarkup(
      createElement(TaskFiltersPopover, { options, value: {}, onChange: () => undefined })
    )
    const searchMarkup = renderToStaticMarkup(
      createElement(TaskSearchInput, { value: '', onChange: () => undefined })
    )

    expect(groupMarkup).toContain('data-testid="task-group-by-trigger"')
    expect(groupMarkup).toContain('aria-label="Group tasks"')
    expect(groupMarkup).toContain('>Group by</span>')
    expect(filterMarkup).toContain('data-testid="task-filters-trigger"')
    expect(filterMarkup).toContain('aria-label="Filter tasks"')
    expect(filterMarkup).toContain('>Filter</span>')
    expect(searchMarkup).toContain('data-testid="task-search-input"')
    expect(searchMarkup).toContain('placeholder="Search tasks"')
  })

  it('renders grouped task sections and an actionable empty state', () => {
    const groupedMarkup = renderToStaticMarkup(
      createElement(TaskTable, {
        rows: taskRows,
        groupBy: 'project',
        sortState: { columnId: 'name', direction: 'asc' },
        onSortChange: () => undefined,
        onOpenTask: () => undefined
      })
    )
    const emptyMarkup = renderToStaticMarkup(
      createElement(TasksPage, {
        projects: [],
        tasks: [],
        onOpenTask: () => undefined
      })
    )

    expect(groupedMarkup).toContain('data-testid="table-row-list-group:project:project-1"')
    expect(groupedMarkup).toContain('data-testid="table-row-list-group:__unassigned_project__"')
    expect(groupedMarkup).toContain('>1</span>')
    expect(groupedMarkup).toContain('Atlas')
    expect(groupedMarkup).toContain('Unassigned')
    expect(emptyMarkup).toContain('No tasks found')
    expect(emptyMarkup).toContain('Use New task in the top bar')
    expect(emptyMarkup).not.toContain('data-testid="tasks-table"')
  })

  it('renders a duplicate button for each task when duplication is available', () => {
    const markup = renderToStaticMarkup(
      createElement(TasksPage, {
        projects: [project],
        tasks: [taskRows[0]!.task],
        onOpenTask: () => undefined,
        onDuplicateTask: () => undefined
      })
    )

    expect(markup).toContain('data-testid="duplicate-task-button:task-1"')
    expect(markup).toContain('aria-label="Duplicate task: Launch brief"')
  })
})
