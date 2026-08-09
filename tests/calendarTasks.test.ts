import { describe, expect, it } from 'vitest'
import {
  buildCalendarEvents,
  buildWeeklyCalendarEntries
} from '../src/renderer/src/lib/calendarTasks'

const task = {
  id: 'task-1',
  title: 'Plan release',
  date: '2026-04-02',
  completed: false,
  status: 'pending' as const,
  createdAt: '2026-04-01T00:00:00.000Z',
  priority: 'medium' as const,
  reminders: []
}

describe('calendar task projections', () => {
  it('builds an all-day event for a scheduled task', () => {
    expect(buildCalendarEvents([task])).toMatchObject([
      {
        id: task.id,
        title: task.title,
        start: task.date,
        extendedProps: { source: 'task', taskId: task.id, status: task.status }
      }
    ])
  })

  it('includes backlog status in calendar event data', () => {
    const backlogTask = { ...task, status: 'backlog' as const }

    expect(buildCalendarEvents([backlogTask])[0]?.extendedProps.status).toBe('backlog')
  })

  it('builds weekly all-day entries for tasks without a time', () => {
    expect(buildWeeklyCalendarEntries([task], '2026-03-30')).toMatchObject({
      timedTasks: [],
      allDayItems: [
        {
          id: task.id,
          source: 'task',
          startDate: task.date,
          endDate: task.date,
          task
        }
      ]
    })
  })
})
