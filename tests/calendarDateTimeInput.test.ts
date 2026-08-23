import { describe, expect, it } from 'vitest'
import {
  formatCalendarDateValue,
  formatCalendarTimeValue,
  getCalendarTimeOptions,
  parseCalendarDateInput,
  parseCalendarTimeInput
} from '../src/renderer/src/lib/calendarDateTimeInput'

const referenceDate = new Date(2026, 7, 21, 9, 30)

describe('parseCalendarDateInput', () => {
  it.each([
    ['today', '2026-08-21'],
    ['tomorrow', '2026-08-22'],
    ['tommorow', '2026-08-22'],
    ['yesterday', '2026-08-20'],
    ['14 Feb', '2026-02-14'],
    ['February 14, 2026', '2026-02-14'],
    ['2026/01/31', '2026-01-31'],
    ['2026-01-31', '2026-01-31']
  ])('parses %s', (input, value) => {
    expect(parseCalendarDateInput(input, referenceDate)).toEqual({ status: 'valid', value })
  })

  it('rejects invalid dates without falling back to the reference date', () => {
    expect(parseCalendarDateInput('31 February 2026', referenceDate)).toEqual({
      status: 'invalid',
      message: expect.any(String)
    })
  })

  it('returns an empty result for blank input', () => {
    expect(parseCalendarDateInput('   ', referenceDate)).toEqual({ status: 'empty' })
  })
})

describe('parseCalendarTimeInput', () => {
  it.each([
    ['11am', '11:00'],
    ['11:30 pm', '23:30'],
    ['12am', '00:00'],
    ['12pm', '12:00'],
    ['17', '17:00'],
    ['1700', '17:00'],
    ['0110', '01:10'],
    ['6:20', '06:20'],
    ['23:45', '23:45']
  ])('parses %s', (input, value) => {
    expect(parseCalendarTimeInput(input)).toEqual({ status: 'valid', value })
  })

  it('rejects invalid times and supports clearing with blank input', () => {
    expect(parseCalendarTimeInput('25:00')).toEqual({
      status: 'invalid',
      message: expect.any(String)
    })
    expect(parseCalendarTimeInput('')).toEqual({ status: 'empty' })
  })
})

describe('calendar date/time display helpers', () => {
  it('formats canonical values for compact triggers', () => {
    expect(formatCalendarDateValue('2026-01-31')).toBe('Jan 31, 2026')
    expect(formatCalendarTimeValue('06:20')).toBe('6:20 AM')
    expect(formatCalendarTimeValue('01:10')).toBe('1:10 AM')
  })

  it('builds a full-day 5-minute time grid', () => {
    const options = getCalendarTimeOptions()
    expect(options).toHaveLength(288)
    expect(options[0]).toBe('00:00')
    expect(options[1]).toBe('00:05')
    expect(options).toContain('06:20')
    expect(options.at(-1)).toBe('23:55')
  })
})
