import { describe, expect, it } from 'vitest'

import { formatCalendarTaskScheduleLabel } from '../src/renderer/src/lib/calendarTaskScheduleLabel'

describe('formatCalendarTaskScheduleLabel', () => {
  it('formats a complete start and end date-time range', () => {
    expect(
      formatCalendarTaskScheduleLabel({
        date: '2026-08-05',
        time: '09:00',
        endDate: '2026-08-05',
        endTime: '10:00'
      })
    ).toBe('Aug 5 09:00 → Aug 5 10:00')
  })

  it('keeps a start-only schedule compact', () => {
    expect(formatCalendarTaskScheduleLabel({ date: '2026-08-05', time: '09:00' })).toBe(
      'Aug 5 09:00'
    )
  })

  it('labels tasks without a schedule as unscheduled', () => {
    expect(formatCalendarTaskScheduleLabel({})).toBe('Unscheduled')
  })

  it('labels an end-date-only task as a deadline', () => {
    expect(
      formatCalendarTaskScheduleLabel({
        date: undefined,
        endDate: '2026-08-20',
        time: undefined,
        endTime: undefined
      })
    ).toBe('Due Aug 20')
  })
})
