import { describe, expect, it } from 'vitest'
import { CalendarTask } from '../src/shared/types'
import {
  buildWeeklyAllDayDropIndicator,
  buildWeeklyAllDayDropSchedule,
  buildWeeklyTimedCreateSchedule,
  buildWeeklyTimedDropPreview,
  buildWeeklyTimedDropRange,
  buildWeeklyTimedDropSchedule
} from '../src/renderer/src/lib/calendarWeekDrag'

function makeTask(overrides: Partial<CalendarTask> = {}): CalendarTask {
  return {
    id: 'task-1',
    title: 'Task',
    tags: [],
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
          date: '2026-04-14',
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
      endTime: '10:30',
      weeklyHeightMode: 'duration'
    })
  })

  it('creates an end-date-only schedule for unscheduled drags', () => {
    expect(buildWeeklyTimedDropSchedule(undefined, '2026-04-15', 83, 0)).toEqual({
      date: undefined,
      endDate: '2026-04-15',
      time: undefined,
      endTime: undefined
    })
  })

  it('marks tasks without start or end times for content-fit weekly rendering', () => {
    expect(buildWeeklyTimedDropSchedule(makeTask(), '2026-04-15', 605, 0)).toEqual({
      date: undefined,
      endDate: '2026-04-15',
      time: undefined,
      endTime: undefined
    })
  })
})

describe('buildWeeklyTimedDropPreview', () => {
  it('uses the timed task duration and preserves the grab offset', () => {
    expect(
      buildWeeklyTimedDropPreview(
        makeTask({ date: '2026-04-15', time: '09:00', endTime: '09:40' }),
        605,
        17
      )
    ).toEqual({
      startMinutes: 590,
      endMinutes: 630,
      heightMode: 'duration'
    })
  })

  it('converts an all-day task into a compact one-hour timed preview', () => {
    expect(buildWeeklyTimedDropPreview(makeTask({ date: '2026-04-15' }), 60, 0)).toEqual({
      startMinutes: 60,
      endMinutes: 120,
      heightMode: 'content'
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

describe('buildWeeklyTimedCreateSchedule', () => {
  it('creates a one-hour schedule snapped to the clicked weekly-grid time', () => {
    expect(buildWeeklyTimedCreateSchedule('2026-04-15', 605)).toEqual({
      date: '2026-04-15',
      endDate: '2026-04-15',
      time: '10:10',
      endTime: '11:10'
    })
  })

  it('clamps a one-hour schedule into the final valid same-day interval', () => {
    expect(buildWeeklyTimedCreateSchedule('2026-04-15', 1435)).toEqual({
      date: '2026-04-15',
      endDate: '2026-04-15',
      time: '22:50',
      endTime: '23:50'
    })
  })
})

describe('buildWeeklyAllDayDropSchedule', () => {
  it('converts an unscheduled task into an end-date-only task', () => {
    expect(buildWeeklyAllDayDropSchedule(makeTask(), '2026-04-20')).toEqual({
      date: undefined,
      endDate: '2026-04-20',
      time: undefined,
      endTime: undefined
    })
  })

  it('moves a deadline-only task by changing its end date only', () => {
    expect(
      buildWeeklyAllDayDropSchedule(
        makeTask({
          endDate: '2026-04-16'
        }),
        '2026-04-20'
      )
    ).toEqual({
      date: undefined,
      endDate: '2026-04-20',
      time: undefined,
      endTime: undefined
    })
  })

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
