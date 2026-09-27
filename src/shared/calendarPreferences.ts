export const CALENDAR_WEEKLY_HOUR_HEIGHT_DEFAULT_PX = 160
export const CALENDAR_WEEKLY_HOUR_HEIGHT_MIN_PX = 80
export const CALENDAR_WEEKLY_HOUR_HEIGHT_MAX_PX = 320
export const CALENDAR_WEEKLY_HOUR_HEIGHT_STEP_PX = 20

export function isValidCalendarWeeklyHourHeight(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= CALENDAR_WEEKLY_HOUR_HEIGHT_MIN_PX &&
    value <= CALENDAR_WEEKLY_HOUR_HEIGHT_MAX_PX &&
    (value - CALENDAR_WEEKLY_HOUR_HEIGHT_MIN_PX) % CALENDAR_WEEKLY_HOUR_HEIGHT_STEP_PX === 0
  )
}

export function normalizeCalendarWeeklyHourHeight(value: unknown): number {
  return isValidCalendarWeeklyHourHeight(value) ? value : CALENDAR_WEEKLY_HOUR_HEIGHT_DEFAULT_PX
}

export function clampCalendarWeeklyHourHeight(value: number): number {
  return Math.min(
    CALENDAR_WEEKLY_HOUR_HEIGHT_MAX_PX,
    Math.max(CALENDAR_WEEKLY_HOUR_HEIGHT_MIN_PX, value)
  )
}
