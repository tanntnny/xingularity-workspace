import { describe, expect, it } from 'vitest'
import { CalendarTask } from '../src/shared/types'
import {
  buildWeeklyAllDayDropIndicator,
  buildWeeklyAllDayDropSchedule,
  buildWeeklyTimedDropRange,
  buildWeeklyTimedDropSchedule
} from '../src/renderer/src/lib/calendarWeekDrag'

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

describe('buildWeeklyTimedDropSchedule', () => {
  it('preserves timed duration and pointer offset when dropping into the weekly grid', () => {
    expect(
      buildWeeklyTimedDropSchedule(
        makeTask({
          time: '09:00',
          endTime: '09:40'
        }),
        '2026-04-15',
        605,
        17
      )
    ).toEqual({
      date: '2026-04-15',
      endDate: undefined,
      time: '09:50',
      endTime: '10:30'
    })
  })

  it('creates a timed schedule for unscheduled drags without inventing an end time', () => {
    expect(buildWeeklyTimedDropSchedule(undefined, '2026-04-15', 83, 0)).toEqual({
      date: '2026-04-15',
      endDate: undefined,
      time: '01:20',
      endTime: undefined
    })
  })
})

describe('buildWeeklyTimedDropRange', () => {
  it('clamps unscheduled drags into the final valid 10-minute slot', () => {
    expect(buildWeeklyTimedDropRange(undefined, 1435, 0)).toEqual({
      startMinutes: 1420,
      endMinutes: 1430
    })
  })
})

describe('buildWeeklyAllDayDropSchedule', () => {
  it('preserves multi-day span when dropping into the all-day lane', () => {
    expect(
      buildWeeklyAllDayDropSchedule(
        makeTask({
          date: '2026-04-14',
          endDate: '2026-04-16'
        }),
        '2026-04-20'
      )
    ).toEqual({
      date: '2026-04-20',
      endDate: '2026-04-22',
      time: undefined,
      endTime: undefined
    })
  })
})

describe('buildWeeklyAllDayDropIndicator', () => {
  it('covers every target day cell for a multi-day all-day drop', () => {
    expect(
      buildWeeklyAllDayDropIndicator(
        makeTask({
          date: '2026-07-06',
          endDate: '2026-07-07'
        }),
        '2026-07-09',
        '2026-07-05'
      )
    ).toEqual({
      startDate: '2026-07-09',
      endDate: '2026-07-10',
      columnStart: 4,
      columnSpan: 2
    })
  })

  it('clips the preview span to the visible week', () => {
    expect(
      buildWeeklyAllDayDropIndicator(
        makeTask({
          date: '2026-07-06',
          endDate: '2026-07-08'
        }),
        '2026-07-11',
        '2026-07-05'
      )
    ).toEqual({
      startDate: '2026-07-11',
      endDate: '2026-07-11',
      columnStart: 6,
      columnSpan: 1
    })
  })
})
