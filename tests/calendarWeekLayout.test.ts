import { describe, expect, it } from 'vitest'
import {
  buildMovedTimedRange,
  buildResizedTimedRange,
  formatWeeklyTimeLabel,
  layoutWeeklyTimedTasks,
  normalizeTimedRange,
  snapMinutes,
  WEEKLY_DAY_HEIGHT_PX,
  WEEKLY_HOUR_HEIGHT_PX
} from '../src/renderer/src/lib/calendarWeekLayout'

describe('formatWeeklyTimeLabel', () => {
  it('uses 24-hour labels for the weekly gutter', () => {
    expect(formatWeeklyTimeLabel(0)).toBe('00:00')
    expect(formatWeeklyTimeLabel(1)).toBe('01:00')
    expect(formatWeeklyTimeLabel(13)).toBe('13:00')
    expect(formatWeeklyTimeLabel(23)).toBe('23:00')
  })
})

describe('snapMinutes', () => {
  it('snaps to the nearest 10-minute boundary', () => {
    expect(snapMinutes(83)).toBe(80)
    expect(snapMinutes(86)).toBe(90)
  })
})

describe('normalizeTimedRange', () => {
  it('enforces a minimum 10-minute duration and clamps to the same day', () => {
    expect(normalizeTimedRange(1439, 1439)).toEqual({
      startMinutes: 1420,
      endMinutes: 1430
    })
  })
})

describe('buildMovedTimedRange', () => {
  it('preserves task duration while snapping drag moves to 10 minutes', () => {
    expect(
      buildMovedTimedRange({
        pointerMinutes: 605,
        pointerOffsetMinutes: 17,
        durationMinutes: 40
      })
    ).toEqual({
      startMinutes: 590,
      endMinutes: 630
    })
  })
})

describe('buildResizedTimedRange', () => {
  it('snaps top-handle resize to 10 minutes', () => {
    expect(buildResizedTimedRange('resize-start', 548, 540, 600)).toEqual({
      startMinutes: 550,
      endMinutes: 600
    })
  })

  it('snaps bottom-handle resize to 10 minutes', () => {
    expect(buildResizedTimedRange('resize-end', 607, 540, 600)).toEqual({
      startMinutes: 540,
      endMinutes: 610
    })
  })

  it('clamps resize to the same day at 23:50', () => {
    expect(buildResizedTimedRange('resize-end', 1440, 1410, 1430)).toEqual({
      startMinutes: 1410,
      endMinutes: 1430
    })
  })
})

describe('layoutWeeklyTimedTasks', () => {
  it('packs overlapping tasks into deterministic side-by-side lanes', () => {
    const layouts = layoutWeeklyTimedTasks([
      { taskId: 'a', date: '2026-04-14', startMinutes: 540, endMinutes: 600 },
      { taskId: 'b', date: '2026-04-14', startMinutes: 570, endMinutes: 630 },
      { taskId: 'c', date: '2026-04-14', startMinutes: 615, endMinutes: 660 }
    ])

    expect(layouts.map((layout) => `${layout.taskId}:${layout.lane}/${layout.laneCount}`)).toEqual([
      'a:0/2',
      'b:1/2',
      'c:0/2'
    ])
    expect(layouts[0]?.topPx).toBe(WEEKLY_HOUR_HEIGHT_PX * 9)
    expect(layouts[2]?.heightPx).toBeGreaterThan(0)
  })

  it('keeps layout within the configured day height', () => {
    const [layout] = layoutWeeklyTimedTasks([
      { taskId: 'late', date: '2026-04-14', startMinutes: 1420, endMinutes: 1430 }
    ])

    expect(layout.topPx + layout.heightPx).toBeLessThanOrEqual(WEEKLY_DAY_HEIGHT_PX)
  })
})
