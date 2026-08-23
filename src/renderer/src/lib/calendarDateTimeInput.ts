export type CalendarInputParseResult =
  | { status: 'empty' }
  | { status: 'valid'; value: string }
  | { status: 'invalid'; message: string }

export const CALENDAR_TIME_GRID_STEP_MINUTES = 5

const DATE_INPUT_ERROR = 'Enter a date like tomorrow, 14 Feb, or 2026/01/31.'
const TIME_INPUT_ERROR = 'Enter a time like 17, 1700, 0110, 11am, or 23:30.'

const MONTH_NAMES = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december'
] as const

const MONTH_ALIASES = new Map<string, number>(
  MONTH_NAMES.flatMap((month, index) => [
    [month, index + 1],
    [month.slice(0, 3), index + 1]
  ])
)

export function parseCalendarDateInput(
  input: string,
  referenceDate: Date = new Date()
): CalendarInputParseResult {
  const normalized = normalizeInput(input)
  if (!normalized) {
    return { status: 'empty' }
  }

  const relativeOffset = getRelativeDateOffset(normalized)
  if (relativeOffset !== undefined) {
    const date = new Date(referenceDate)
    date.setHours(12, 0, 0, 0)
    date.setDate(date.getDate() + relativeOffset)
    return { status: 'valid', value: toIsoDate(date) }
  }

  const numericMatch = normalized.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/)
  if (numericMatch) {
    return buildDateResult(
      Number(numericMatch[1]),
      Number(numericMatch[2]),
      Number(numericMatch[3])
    )
  }

  const dayMonthMatch = normalized.match(/^(\d{1,2})\s+([a-z]+)(?:\s+(\d{4}))?$/i)
  if (dayMonthMatch) {
    const month = MONTH_ALIASES.get(dayMonthMatch[2].toLowerCase())
    if (month) {
      return buildDateResult(
        Number(dayMonthMatch[3] ?? referenceDate.getFullYear()),
        month,
        Number(dayMonthMatch[1])
      )
    }
  }

  const monthDayMatch = normalized.match(/^([a-z]+)\s+(\d{1,2})(?:\s+(\d{4}))?$/i)
  if (monthDayMatch) {
    const month = MONTH_ALIASES.get(monthDayMatch[1].toLowerCase())
    if (month) {
      return buildDateResult(
        Number(monthDayMatch[3] ?? referenceDate.getFullYear()),
        month,
        Number(monthDayMatch[2])
      )
    }
  }

  return { status: 'invalid', message: DATE_INPUT_ERROR }
}

export function parseCalendarTimeInput(input: string): CalendarInputParseResult {
  const normalized = normalizeInput(input).toLowerCase().replace(/\s+/g, '')
  if (!normalized) {
    return { status: 'empty' }
  }

  const meridiemMatch = normalized.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)$/)
  if (meridiemMatch) {
    const hour = Number(meridiemMatch[1])
    const minute = Number(meridiemMatch[2] ?? 0)
    if (hour < 1 || hour > 12) {
      return { status: 'invalid', message: TIME_INPUT_ERROR }
    }

    const normalizedHour = meridiemMatch[3] === 'pm' ? (hour % 12) + 12 : hour % 12
    return buildTimeResult(normalizedHour, minute)
  }

  const twentyFourHourMatch = normalized.match(/^(\d{1,2}):(\d{2})$/)
  if (twentyFourHourMatch) {
    const hour = Number(twentyFourHourMatch[1])
    const minute = Number(twentyFourHourMatch[2])
    return buildTimeResult(hour, minute)
  }

  const compactTimeMatch = normalized.match(/^(\d{1,4})$/)
  if (compactTimeMatch) {
    const digits = compactTimeMatch[1]
    const hour = digits.length <= 2 ? Number(digits) : Number(digits.slice(0, -2))
    const minute = digits.length <= 2 ? 0 : Number(digits.slice(-2))

    return buildTimeResult(hour, minute)
  }

  return { status: 'invalid', message: TIME_INPUT_ERROR }
}

export function formatCalendarDateValue(value: string | undefined): string {
  if (!value) {
    return ''
  }

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) {
    return value
  }

  const date = createDate(Number(match[1]), Number(match[2]), Number(match[3]))
  if (!date) {
    return value
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(date)
}

export function formatCalendarTimeValue(value: string | undefined): string {
  if (!value) {
    return ''
  }

  const match = value.match(/^(\d{2}):(\d{2})$/)
  if (!match) {
    return value
  }

  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour > 23 || minute > 59) {
    return value
  }

  const displayHour = hour % 12 || 12
  const meridiem = hour >= 12 ? 'PM' : 'AM'
  return `${displayHour}:${String(minute).padStart(2, '0')} ${meridiem}`
}

export function getCalendarTimeOptions(): string[] {
  const optionCount = (24 * 60) / CALENDAR_TIME_GRID_STEP_MINUTES
  return Array.from({ length: optionCount }, (_, index) => {
    const minutes = index * CALENDAR_TIME_GRID_STEP_MINUTES
    return toTimeString(Math.floor(minutes / 60), minutes % 60)
  })
}

function normalizeInput(input: string): string {
  return input.trim().replace(/\s+/g, ' ').replace(/,/g, '')
}

function getRelativeDateOffset(value: string): number | undefined {
  return {
    today: 0,
    tomorrow: 1,
    tommorow: 1,
    yesterday: -1
  }[value]
}

function buildDateResult(year: number, month: number, day: number): CalendarInputParseResult {
  const date = createDate(year, month, day)
  return date
    ? { status: 'valid', value: toIsoDate(date) }
    : { status: 'invalid', message: DATE_INPUT_ERROR }
}

function createDate(year: number, month: number, day: number): Date | undefined {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return undefined
  }

  const date = new Date(0)
  date.setHours(12, 0, 0, 0)
  date.setFullYear(year, month - 1, day)

  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return undefined
  }

  return date
}

function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`
}

function toTimeString(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function buildTimeResult(hour: number, minute: number): CalendarInputParseResult {
  if (hour > 23 || minute > 59) {
    return { status: 'invalid', message: TIME_INPUT_ERROR }
  }

  return { status: 'valid', value: toTimeString(hour, minute) }
}
