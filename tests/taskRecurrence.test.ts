import { describe, expect, it } from 'vitest'
import {
  getTaskRecurrenceOccurrences,
  initializeTaskRecurrence,
  reconcileTaskRecurrences
} from '../src/shared/taskRecurrence'
import type { CalendarTask } from '../src/shared/types'

const anchorTask: CalendarTask = {
  id: 'task-anchor',
  title: 'Review release notes',
  tags: [],
  date: '2026-09-01',
  completed: false,
  status: 'pending',
  createdAt: '2026-08-31T00:00:00.000Z',
  priority: 'medium',
  reminders: []
}

function reconcile(
  previous: CalendarTask[],
  requested: CalendarTask[],
  now: string
): CalendarTask[] {
  let nextId = 1
  return reconcileTaskRecurrences(previous, requested, {
    now: new Date(now),
    createTaskId: () => `task-generated-${nextId++}`
  })
}

describe('task recurrence', () => {
  it('normalizes an RRULE and returns the next rolling occurrences', () => {
    const task = initializeTaskRecurrence(anchorTask, {
      rrule: 'rrule:freq=weekly;byday=mo',
      horizon: 3,
      timezone: 'UTC'
    })

    expect(
      getTaskRecurrenceOccurrences(task, task.recurrence!, new Date('2026-09-01T12:00:00Z'))
    ).toEqual([
      {
        date: '2026-09-07',
        endDate: undefined,
        time: undefined,
        endTime: undefined,
        key: '2026-09-07T00:00'
      },
      {
        date: '2026-09-14',
        endDate: undefined,
        time: undefined,
        endTime: undefined,
        key: '2026-09-14T00:00'
      },
      {
        date: '2026-09-21',
        endDate: undefined,
        time: undefined,
        endTime: undefined,
        key: '2026-09-21T00:00'
      }
    ])
  })

  it('materializes the configured rolling horizon', () => {
    const task = initializeTaskRecurrence(anchorTask, {
      rrule: 'FREQ=WEEKLY;BYDAY=MO',
      horizon: 3,
      timezone: 'UTC'
    })
    const tasks = reconcile([anchorTask], [task], '2026-09-01T12:00:00Z')

    expect(tasks).toHaveLength(4)
    expect(tasks.slice(1).map((item) => item.date)).toEqual([
      '2026-09-07',
      '2026-09-14',
      '2026-09-21'
    ])
    expect(tasks.slice(1).every((item) => item.recurrence?.generated)).toBe(true)
  })

  it('records a deleted occurrence as an exclusion and fills the next slot', () => {
    const task = initializeTaskRecurrence(anchorTask, {
      rrule: 'FREQ=WEEKLY;BYDAY=MO',
      horizon: 3,
      timezone: 'UTC'
    })
    const materialized = reconcile([anchorTask], [task], '2026-09-01T12:00:00Z')
    const deleted = materialized[1]!
    const next = reconcile(
      materialized,
      materialized.filter((candidate) => candidate.id !== deleted.id),
      '2026-09-01T12:00:00Z'
    )

    expect(next.map((item) => item.date)).toEqual([
      '2026-09-01',
      '2026-09-14',
      '2026-09-21',
      '2026-09-28'
    ])
    expect(next[0]?.recurrence?.excludedOccurrenceKeys).toContain('2026-09-07T00:00')
  })

  it('preserves a manually edited generated task as an override', () => {
    const task = initializeTaskRecurrence(anchorTask, {
      rrule: 'FREQ=DAILY',
      horizon: 2,
      timezone: 'UTC'
    })
    const materialized = reconcile([anchorTask], [task], '2026-09-01T12:00:00Z')
    const edited = { ...materialized[1]!, title: 'Review notes manually' }
    const next = reconcile(
      materialized,
      materialized.map((candidate) => (candidate.id === edited.id ? edited : candidate)),
      '2026-09-01T12:00:00Z'
    )

    expect(next.find((candidate) => candidate.id === edited.id)).toMatchObject({
      title: 'Review notes manually',
      recurrence: { generated: true, overridden: true }
    })
  })

  it('propagates anchor edits to future unmodified occurrences', () => {
    const task = initializeTaskRecurrence(anchorTask, {
      rrule: 'FREQ=DAILY',
      horizon: 2,
      timezone: 'UTC'
    })
    const materialized = reconcile([anchorTask], [task], '2026-09-01T12:00:00Z')
    const editedAnchor = { ...materialized[0]!, title: 'Review the final release notes' }
    const next = reconcile(
      materialized,
      materialized.map((candidate) =>
        candidate.id === editedAnchor.id ? editedAnchor : candidate
      ),
      '2026-09-01T12:00:00Z'
    )

    expect(next.slice(1).every((candidate) => candidate.title === editedAnchor.title)).toBe(true)
  })

  it('replenishes the horizon when a future occurrence is completed early', () => {
    const task = initializeTaskRecurrence(anchorTask, {
      rrule: 'FREQ=DAILY',
      horizon: 2,
      timezone: 'UTC'
    })
    const materialized = reconcile([anchorTask], [task], '2026-09-01T12:00:00Z')
    const completedEarly = {
      ...materialized[1]!,
      completed: true,
      status: 'completed' as const
    }
    const next = reconcile(
      materialized,
      materialized.map((candidate) =>
        candidate.id === completedEarly.id ? completedEarly : candidate
      ),
      '2026-09-01T12:00:00Z'
    )

    expect(next.map((candidate) => candidate.date)).toEqual([
      '2026-09-01',
      '2026-09-02',
      '2026-09-03',
      '2026-09-04'
    ])
  })

  it('detaches generated tasks when the series is disabled', () => {
    const task = initializeTaskRecurrence(anchorTask, {
      rrule: 'FREQ=DAILY',
      horizon: 2,
      timezone: 'UTC'
    })
    const materialized = reconcile([anchorTask], [task], '2026-09-01T12:00:00Z')
    const disabledAnchor = { ...materialized[0]!, recurrence: undefined }
    const next = reconcile(
      materialized,
      [disabledAnchor, ...materialized.slice(1)],
      '2026-09-01T12:00:00Z'
    )

    expect(next.every((candidate) => candidate.recurrence === undefined)).toBe(true)
    expect(next).toHaveLength(3)
  })
})
