import { describe, expect, it } from 'vitest'
import { CalendarTask } from '../src/shared/types'
import { buildCalendarEvents, normalizeCalendarTasks } from '../src/renderer/src/lib/calendarTasks'

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
          taskId: 'task-b'
        }
      }
    ])
  })
})
