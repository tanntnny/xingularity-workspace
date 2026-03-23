import { describe, expect, it } from 'vitest'
import { shiftIsoMonthClamped } from '../src/renderer/src/lib/calendarDate'

describe('shiftIsoMonthClamped', () => {
  it('clamps the day when moving into a shorter month', () => {
    expect(shiftIsoMonthClamped('2026-01-31', 1)).toBe('2026-02-28')
    expect(shiftIsoMonthClamped('2026-03-31', -1)).toBe('2026-02-28')
  })

  it('handles leap years correctly', () => {
    expect(shiftIsoMonthClamped('2024-01-31', 1)).toBe('2024-02-29')
    expect(shiftIsoMonthClamped('2024-03-31', -1)).toBe('2024-02-29')
  })

  it('crosses year boundaries in both directions', () => {
    expect(shiftIsoMonthClamped('2026-12-15', 1)).toBe('2027-01-15')
    expect(shiftIsoMonthClamped('2026-01-15', -1)).toBe('2025-12-15')
  })

  it('supports offsets larger than one month', () => {
    expect(shiftIsoMonthClamped('2026-10-31', 5)).toBe('2027-03-31')
    expect(shiftIsoMonthClamped('2026-05-31', -3)).toBe('2026-02-28')
  })
})
