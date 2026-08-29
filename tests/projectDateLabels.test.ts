import { describe, expect, it } from 'vitest'
import {
  formatProjectDate,
  formatProjectUpdatedDate
} from '../src/renderer/src/lib/projectDateLabels'

function createLocalDate(daysFromNow: number, now: Date): Date {
  const date = new Date(now)
  date.setDate(date.getDate() + daysFromNow)
  return date
}

describe('project date labels', () => {
  const now = new Date(2026, 7, 24, 12, 0, 0)

  it.each([
    [0, 'Today'],
    [-1, 'Yesterday'],
    [-2, '2 days ago'],
    [-7, '7 days ago']
  ])('labels a project updated %s calendar days from now as %s', (offset, expected) => {
    const value = createLocalDate(offset, now).toISOString()

    expect(formatProjectUpdatedDate(value, now).label).toBe(expected)
  })

  it('falls back to the short date for older and future timestamps', () => {
    const olderValue = createLocalDate(-8, now).toISOString()
    const futureValue = createLocalDate(2, now).toISOString()

    expect(formatProjectUpdatedDate(olderValue, now).label).toBe(formatProjectDate(olderValue))
    expect(formatProjectUpdatedDate(futureValue, now).label).toBe(formatProjectDate(futureValue))
  })

  it('preserves an exact localized timestamp for accessible context', () => {
    const value = createLocalDate(-1, now).toISOString()
    const result = formatProjectUpdatedDate(value, now)

    expect(result.label).toBe('Yesterday')
    expect(result.exactLabel).toBe(
      new Date(value).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short'
      })
    )
  })

  it('returns Unknown for invalid timestamps', () => {
    expect(formatProjectUpdatedDate('not-a-date', now)).toEqual({
      label: 'Unknown',
      exactLabel: 'Unknown'
    })
  })
})
