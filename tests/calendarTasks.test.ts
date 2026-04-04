import { describe, expect, it } from 'vitest'
import { CalendarTask, Project } from '../src/shared/types'
import {
  buildCalendarEvents,
  buildMilestoneCalendarEvents,
  normalizeCalendarTasks
} from '../src/renderer/src/lib/calendarTasks'

function makeTask(overrides: Partial<CalendarTask> = {}): CalendarTask {
  return {
    id: 'task-1',
    title: 'Task',
    completed: false,
    createdAt: '2026-03-17T00:00:00.000Z',
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
    updatedAt: '2026-03-17T00:00:00.000Z',
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

describe('normalizeCalendarTasks', () => {
  it('collapses duplicate ids and keeps the latest task data', () => {
    const tasks = normalizeCalendarTasks([
      makeTask({ id: 'task-a', title: 'Old title', date: '2026-03-17' }),
      makeTask({ id: 'task-b', title: 'Other task', date: '2026-03-18' }),
      makeTask({ id: 'task-a', title: 'New title', date: '2026-03-19' })
    ])

    expect(tasks).toHaveLength(2)
    expect(tasks.map((task) => task.id)).toEqual(['task-a', 'task-b'])
    expect(tasks[0]).toMatchObject({
      id: 'task-a',
      title: 'New title',
      date: '2026-03-19'
    })
  })

  it('preserves first-seen ordering while removing duplicates', () => {
    const tasks = normalizeCalendarTasks([
      makeTask({ id: 'task-a', title: 'A-1' }),
      makeTask({ id: 'task-b', title: 'B-1' }),
      makeTask({ id: 'task-a', title: 'A-2' }),
      makeTask({ id: 'task-c', title: 'C-1' }),
      makeTask({ id: 'task-b', title: 'B-2' })
    ])

    expect(tasks.map((task) => `${task.id}:${task.title}`)).toEqual([
      'task-a:A-2',
      'task-b:B-2',
      'task-c:C-1'
    ])
  })
})

describe('buildCalendarEvents', () => {
  it('returns one scheduled event per unique task id', () => {
    const events = buildCalendarEvents([
      makeTask({ id: 'task-a', title: 'Draft', date: '2026-03-17' }),
      makeTask({ id: 'task-a', title: 'Final', date: '2026-03-18' }),
      makeTask({ id: 'task-b', title: 'Multi-day', date: '2026-03-20', endDate: '2026-03-22' }),
      makeTask({ id: 'task-c', title: 'Unscheduled' })
    ])

    expect(events).toEqual([
      {
        id: 'task-a',
        title: 'Final',
        start: '2026-03-18',
        end: undefined,
        allDay: true,
        extendedProps: {
          source: 'task',
          taskId: 'task-a'
        }
      },
      {
        id: 'task-b',
        title: 'Multi-day',
        start: '2026-03-20',
        end: '2026-03-23',
        allDay: true,
        extendedProps: {
          source: 'task',
          taskId: 'task-b'
        }
      }
    ])
  })
})

describe('buildMilestoneCalendarEvents', () => {
  it('builds read-only calendar events from milestone due dates', () => {
    const events = buildMilestoneCalendarEvents([
      makeProject({
        id: 'project-alpha',
        milestones: [
          {
            id: 'milestone-a',
            title: 'Alpha launch',
            dueDate: '2026-04-02',
            description: '',
            collapsed: false,
            priority: 'medium',
            status: 'pending',
            subtasks: []
          }
        ]
      })
    ])

    expect(events).toEqual([
      {
        id: 'calendar-milestone:project-alpha:milestone-a',
        title: 'Alpha launch',
        start: '2026-04-02',
        allDay: true,
        editable: true,
        startEditable: true,
        durationEditable: false,
        extendedProps: {
          source: 'milestone',
          projectId: 'project-alpha',
          projectName: 'Project',
          milestoneId: 'milestone-a'
          ,
          completed: false
        }
      }
    ])
  })

  it('uses a namespaced id distinct from normal task ids', () => {
    const taskEvents = buildCalendarEvents([
      makeTask({
        id: 'task-a',
        title: 'Normal task',
        date: '2026-04-02'
      })
    ])
    const milestoneEvents = buildMilestoneCalendarEvents([
      makeProject({
        id: 'project-alpha',
        milestones: [
          {
            id: 'milestone-a',
            title: 'Alpha launch',
            dueDate: '2026-04-02',
            description: '',
            collapsed: false,
            priority: 'medium',
            status: 'pending',
            subtasks: []
          }
        ]
      })
    ])

    expect(taskEvents[0].id).not.toEqual(milestoneEvents[0].id)
  })

  it('skips milestones without a due date', () => {
    const events = buildMilestoneCalendarEvents([
      makeProject({
        id: 'project-alpha',
        milestones: [
          {
            id: 'milestone-a',
            title: 'Alpha launch',
            description: '',
            collapsed: false,
            priority: 'medium',
            status: 'pending',
            subtasks: []
          }
        ]
      })
    ])

    expect(events).toEqual([])
  })
})
