export type DateOnly = string

export interface DateOnlyRange {
  kind: 'date-only'
  start: DateOnly
  end: DateOnly
}

export interface TimedRange {
  kind: 'timed'
  start: string
  end: string
  timezone: string
}

export type CalendarTimeRange = DateOnlyRange | TimedRange

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const LOCAL_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

export function isDateOnly(value: unknown): value is DateOnly {
  if (typeof value !== 'string' || !DATE_ONLY_PATTERN.test(value)) {
    return false
  }

  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  )
}

export function isLocalTime(value: unknown): value is string {
  return typeof value === 'string' && LOCAL_TIME_PATTERN.test(value)
}

export function isIanaTimezone(value: unknown): value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return false
  }

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format()
    return true
  } catch {
    return false
  }
}

export function assertCalendarTimeRange(range: CalendarTimeRange): CalendarTimeRange {
  if (range.kind === 'date-only') {
    if (!isDateOnly(range.start) || !isDateOnly(range.end) || range.end < range.start) {
      throw new Error('All-day calendar ranges must use valid date-only values in order')
    }
    return range
  }

  if (!isValidInstant(range.start) || !isValidInstant(range.end) || range.end <= range.start) {
    throw new Error('Timed calendar ranges must use ordered ISO instants')
  }
  if (!isIanaTimezone(range.timezone)) {
    throw new Error(`Invalid IANA timezone: ${range.timezone}`)
  }
  return range
}

export function isValidInstant(value: unknown): value is string {
  if (typeof value !== 'string' || !value.includes('T')) {
    return false
  }
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) && /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)
}

export function normalizeDateOnlyRange(start: string, end?: string): DateOnlyRange {
  if (!isDateOnly(start)) {
    throw new Error(`Invalid date-only start: ${start}`)
  }
  const normalizedEnd = end ?? start
  assertCalendarTimeRange({ kind: 'date-only', start, end: normalizedEnd })
  return { kind: 'date-only', start, end: normalizedEnd }
}

export function normalizeRecurrenceRule(rule: string): string {
  const normalized = rule
    .split(';')
    .map((part) => part.trim().toUpperCase())
    .filter(Boolean)
    .join(';')
  if (!normalized.startsWith('FREQ=')) {
    throw new Error('Recurrence rules must start with FREQ=')
  }
  const frequency = normalized.slice(5).split(';')[0]
  if (!['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(frequency)) {
    throw new Error(`Unsupported recurrence frequency: ${frequency}`)
  }
  return normalized
}

export function describeCalendarRange(range: CalendarTimeRange): string {
  if (range.kind === 'date-only') {
    return range.start === range.end ? range.start : `${range.start} → ${range.end}`
  }

  return `${new Date(range.start).toLocaleString()} → ${new Date(range.end).toLocaleString()} (${range.timezone})`
}
