import { CalendarTask } from '../../../shared/types'
import {
  buildMovedTimedRange,
  minutesToTime,
  normalizeTimedRange,
  parseTimeToMinutes,
  snapMinutes
} from './calendarWeekLayout'

export function buildWeeklyTimedDropSchedule(
  task: Pick<CalendarTask, 'time' | 'endTime'> | undefined,
  date: string,
  pointerMinutes: number,
  pointerOffsetMinutes: number
): {
  date: string
  endDate: undefined
  time: string
  endTime: string | undefined
} {
  const nextRange = buildWeeklyTimedDropRange(task, pointerMinutes, pointerOffsetMinutes)

  if (!task) {
    return {
      date,
      endDate: undefined,
      time: minutesToTime(nextRange.startMinutes),
      endTime: undefined
    }
  }

  return {
    date,
    endDate: undefined,
    time: minutesToTime(nextRange.startMinutes),
    endTime: minutesToTime(nextRange.endMinutes)
  }
}

export function buildWeeklyTimedCreateSchedule(
  date: string,
  pointerMinutes: number
): {
  date: string
  endDate: undefined
  time: string
  endTime: string
} {
  const range = buildMovedTimedRange({
    pointerMinutes,
    pointerOffsetMinutes: 0,
    durationMinutes: 60
  })

  return {
    date,
    endDate: undefined,
    time: minutesToTime(range.startMinutes),
    endTime: minutesToTime(range.endMinutes)
  }
}

export function buildWeeklyTimedDropRange(
  task: Pick<CalendarTask, 'time' | 'endTime'> | undefined,
  pointerMinutes: number,
  pointerOffsetMinutes: number
): {
  startMinutes: number
  endMinutes: number
} {
  if (!task) {
    return normalizeTimedRange(snapMinutes(pointerMinutes), snapMinutes(pointerMinutes) + 10)
  }

  const normalizedRange = getTimedRangeFromTask(task)
  return buildMovedTimedRange({
    pointerMinutes,
    pointerOffsetMinutes,
    durationMinutes: normalizedRange.endMinutes - normalizedRange.startMinutes
  })
}

export function buildWeeklyAllDayDropSchedule(
  task: Pick<CalendarTask, 'date' | 'endDate'>,
  date: string
): {
  date: string
  endDate: string | undefined
  time: undefined
  endTime: undefined
} {
  const taskEnd = task.date && task.endDate && task.endDate >= task.date ? task.endDate : task.date
  const durationDays = task.date && taskEnd ? diffIsoDays(task.date, taskEnd) : 0

  return {
    date,
    endDate: durationDays > 0 ? addIsoDays(date, durationDays) : undefined,
    time: undefined,
    endTime: undefined
  }
}

export function buildWeeklyAllDayDropIndicator(
  task: Pick<CalendarTask, 'date' | 'endDate'> | undefined,
  date: string,
  weekStart: string
): {
  startDate: string
  endDate: string
  columnStart: number
  columnSpan: number
} {
  const schedule = task
    ? buildWeeklyAllDayDropSchedule(task, date)
    : {
        date,
        endDate: undefined
      }
  const weekEnd = addIsoDays(weekStart, 6)
  const startDate = schedule.date < weekStart ? weekStart : schedule.date
  const rawEndDate = schedule.endDate ?? schedule.date
  const endDate = rawEndDate > weekEnd ? weekEnd : rawEndDate
  const columnStart = diffIsoDays(weekStart, startDate)
  const columnSpan = diffIsoDays(startDate, endDate) + 1

  return {
    startDate,
    endDate,
    columnStart,
    columnSpan
  }
}

function getTimedRangeFromTask(task: Pick<CalendarTask, 'time' | 'endTime'>): {
  startMinutes: number
  endMinutes: number
} {
  const startMinutes = parseTimeToMinutes(task.time) ?? 9 * 60
  const endMinutes = parseTimeToMinutes(task.endTime) ?? startMinutes + 60
  return normalizeTimedRange(startMinutes, endMinutes)
}

function addIsoDays(iso: string, days: number): string {
  const date = parseIsoDate(iso)
  date.setDate(date.getDate() + days)
  return toIsoDate(date)
}

function diffIsoDays(startIso: string, endIso: string): number {
  const start = parseIsoDate(startIso)
  const end = parseIsoDate(endIso)
  return Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseIsoDate(iso: string): Date {
  const parsed = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) {
    return new Date()
  }
  return parsed
}
