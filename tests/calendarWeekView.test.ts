import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CalendarWeekView } from '../src/renderer/src/components/CalendarWeekView'
import { CalendarTask, Project } from '../src/shared/types'
import { buildMilestoneCalendarEvents } from '../src/renderer/src/lib/calendarTasks'

function makeTask(overrides: Partial<CalendarTask> = {}): CalendarTask {
  return {
    id: 'task-1',
    title: 'Task',
    completed: false,
    createdAt: '2026-07-06T00:00:00.000Z',
    priority: 'medium',
    reminders: [],
    ...overrides
  }
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'project-1',
    name: 'Project',
    summary: '',
    status: 'on-track',
    updatedAt: '2026-07-06T00:00:00.000Z',
    progress: 0,
    milestones: [],
    icon: {
      shape: 'circle',
      variant: 'filled',
      color: '#000000'
    },
    ...overrides
  }
}

describe('CalendarWeekView', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T10:15:00'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders a single shared now line across the weekly timed grid', () => {
    const markup = renderToStaticMarkup(
      createElement(CalendarWeekView, {
        selectedDate: '2026-07-06',
        tasks: [],
        onSelectDate: () => undefined
      })
    )

    expect(markup.match(/data-testid="calendar-week-current-time-line"/g)?.length ?? 0).toBe(1)
    expect(markup.match(/data-testid="calendar-week-current-time-label"/g)?.length ?? 0).toBe(1)
  })

  it('renders a multi-day all-day task as one spanning block', () => {
    const markup = renderToStaticMarkup(
      createElement(CalendarWeekView, {
        selectedDate: '2026-07-06',
        tasks: [
          makeTask({
            id: 'task-trip',
            title: 'Trip',
            date: '2026-07-06',
            endDate: '2026-07-07'
          })
        ],
        onSelectDate: () => undefined
      })
    )

    expect(markup.match(/data-testid="calendar-week-all-day-task:task-trip"/g)?.length ?? 0).toBe(1)
    expect(markup).toContain('data-span-days="2"')
    expect(markup).toContain('data-start-date="2026-07-06"')
    expect(markup).toContain('data-end-date="2026-07-07"')
    expect(markup).toContain('margin-left:10px')
    expect(markup).toContain('margin-right:10px')
  })

  it('renders milestone project metadata in the weekly all-day lane', () => {
    const milestoneEvents = buildMilestoneCalendarEvents([
      makeProject({
        id: 'project-alpha',
        name: 'Alpha Project',
        milestones: [
          {
            id: 'milestone-launch',
            title: 'Launch',
            dueDate: '2026-07-08',
            description: 'Ship the release candidate',
            collapsed: false,
            priority: 'high',
            status: 'in-progress',
            subtasks: [
              {
                id: 'subtask-1',
                title: 'QA sign-off',
                description: '',
                completed: true,
                priority: 'high',
                createdAt: '2026-07-06T00:00:00.000Z'
              },
              {
                id: 'subtask-2',
                title: 'Release notes',
                description: '',
                completed: false,
                priority: 'medium',
                createdAt: '2026-07-06T00:00:00.000Z'
              }
            ]
          }
        ]
      })
    ])

    const markup = renderToStaticMarkup(
      createElement(CalendarWeekView, {
        selectedDate: '2026-07-06',
        tasks: [],
        milestoneEvents,
        onSelectDate: () => undefined
      })
    )

    expect(milestoneEvents[0]?.extendedProps.milestoneProgressPercent).toBe(50)
    expect(milestoneEvents[0]?.extendedProps.milestoneCompletedSubtaskCount).toBe(1)
    expect(milestoneEvents[0]?.extendedProps.milestoneSubtaskCount).toBe(2)
    expect(markup).toContain('data-testid="calendar-week-milestone:project-alpha:milestone-launch"')
    expect(markup).toContain('data-testid="calendar-milestone-card"')
    expect(markup).toContain('Launch')
    expect(markup).toContain('Alpha Project')
    expect(markup).toContain('data-testid="calendar-milestone-project"')
    expect(markup).toContain('50% complete')
  })
})
