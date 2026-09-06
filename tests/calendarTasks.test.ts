import { describe, expect, it } from 'vitest'
import {
  buildCalendarEvents,
  buildWeeklyCalendarEntries,
  filterCalendarTasks,
  filterCalendarTasksByTags,
  getCalendarTaskTagOptions,
  getWeeklyAllDaySurfaceHeightPx,
  isCalendarTaskOnDate,
  layoutWeeklyAllDayItems
} from '../src/renderer/src/lib/calendarTasks'

const task = {
  id: 'task-1',
  title: 'Plan release',
  tags: [],
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

  it('places a deadline-only task on its end date without creating a span', () => {
    const deadlineTask = {
      ...task,
      id: 'deadline-only',
      date: undefined,
      endDate: '2026-04-08'
    }

    expect(buildCalendarEvents([deadlineTask])).toMatchObject([
      {
        id: deadlineTask.id,
        start: deadlineTask.endDate,
        end: undefined,
        durationEditable: true,
        extendedProps: {
          deadlineOnly: true
        }
      }
    ])

    expect(buildWeeklyCalendarEntries([deadlineTask], '2026-04-06')).toMatchObject({
      timedTasks: [],
      allDayItems: [
        {
          id: deadlineTask.id,
          startDate: deadlineTask.endDate,
          endDate: deadlineTask.endDate,
          deadlineOnly: true
        }
      ]
    })
  })

  it('matches deadline-only tasks to their end date in day views', () => {
    const deadlineTask = {
      ...task,
      date: undefined,
      endDate: '2026-04-08'
    }

    expect(isCalendarTaskOnDate(deadlineTask, '2026-04-08')).toBe(true)
    expect(isCalendarTaskOnDate(deadlineTask, '2026-04-07')).toBe(false)
    expect(isCalendarTaskOnDate(deadlineTask, '2026-04-09')).toBe(false)
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

  it('keeps all-day tasks on different days independent of each other height-wise', () => {
    const layouts = layoutWeeklyAllDayItems(
      [
        {
          id: 'short-task',
          source: 'task',
          startDate: '2026-04-06',
          endDate: '2026-04-06',
          title: 'Short task'
        },
        {
          id: 'tall-task',
          source: 'task',
          startDate: '2026-04-07',
          endDate: '2026-04-07',
          title: 'Tall task'
        }
      ],
      '2026-04-06',
      { 'short-task': 60, 'tall-task': 132 }
    )

    expect(layouts).toMatchObject([
      { id: 'short-task', topPx: 0, heightPx: 60, columnStart: 0, columnSpan: 1 },
      { id: 'tall-task', topPx: 0, heightPx: 132, columnStart: 1, columnSpan: 1 }
    ])
  })

  it('stacks overlapping all-day tasks while allowing unrelated days to reuse the space', () => {
    const layouts = layoutWeeklyAllDayItems(
      [
        {
          id: 'multi-day-task',
          source: 'task',
          startDate: '2026-04-06',
          endDate: '2026-04-07',
          title: 'Multi-day task'
        },
        {
          id: 'same-day-task',
          source: 'task',
          startDate: '2026-04-06',
          endDate: '2026-04-06',
          title: 'Same-day task'
        },
        {
          id: 'unrelated-task',
          source: 'task',
          startDate: '2026-04-08',
          endDate: '2026-04-08',
          title: 'Unrelated task'
        }
      ],
      '2026-04-06',
      { 'multi-day-task': 112, 'same-day-task': 60, 'unrelated-task': 80 }
    )

    expect(layouts).toMatchObject([
      { id: 'multi-day-task', topPx: 0, heightPx: 112, columnStart: 0, columnSpan: 2 },
      { id: 'same-day-task', topPx: 120, heightPx: 60, columnStart: 0, columnSpan: 1 },
      { id: 'unrelated-task', topPx: 0, heightPx: 80, columnStart: 2, columnSpan: 1 }
    ])
    expect(getWeeklyAllDaySurfaceHeightPx(layouts, 92, 8)).toBe(196)
  })

  it('filters project and non-project tasks without changing all-task views', () => {
    const projectTask = { ...task, id: 'task-2', projectId: 'project-1' }

    expect(filterCalendarTasks([task, projectTask], 'all')).toEqual([task, projectTask])
    expect(filterCalendarTasks([task, projectTask], 'projectTasks')).toEqual([projectTask])
    expect(filterCalendarTasks([task, projectTask], 'nonProjectTasks')).toEqual([task])
  })

  it('filters tasks by any selected tag and normalizes tag values', () => {
    const releaseTask = { ...task, id: 'release-task', tags: ['Release', 'project:alpha'] }
    const planningTask = { ...task, id: 'planning-task', tags: ['planning'] }
    const untaggedTask = { ...task, id: 'untagged-task', tags: [] }

    expect(
      filterCalendarTasksByTags([releaseTask, planningTask, untaggedTask], ['release'])
    ).toEqual([releaseTask])
    expect(
      filterCalendarTasksByTags(
        [releaseTask, planningTask, untaggedTask],
        ['project:alpha', 'planning']
      )
    ).toEqual([releaseTask, planningTask])
  })

  it('returns stable tag options with task counts', () => {
    const releaseTask = { ...task, id: 'release-task', tags: ['release', 'project:alpha'] }
    const planningTask = { ...task, id: 'planning-task', tags: ['planning', 'release'] }

    expect(getCalendarTaskTagOptions([planningTask, releaseTask])).toEqual([
      { value: 'planning', count: 1 },
      { value: 'project:alpha', count: 1 },
      { value: 'release', count: 2 }
    ])
  })
})
