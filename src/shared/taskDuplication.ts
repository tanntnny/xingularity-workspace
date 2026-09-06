import { normalizeCalendarEndDate } from './calendarTaskDates'
import type { CalendarTask, DuplicateTaskInput } from './types'

export interface DuplicateTaskRecordOptions extends Omit<DuplicateTaskInput, 'taskId'> {
  id: string
  now: string
  reminderId?: (sourceReminderId: string, index: number) => string
}

export function duplicateTaskRecord(
  source: CalendarTask,
  options: DuplicateTaskRecordOptions
): CalendarTask {
  const schedule = options.schedule
  const date = schedule === undefined ? source.date : normalizeOptional(schedule.date)
  const endDate = normalizeCalendarEndDate(
    date,
    schedule === undefined ? source.endDate : normalizeOptional(schedule.endDate)
  )
  const titleSuffix = ' (copy)'
  const title = `${source.title.slice(0, 200 - titleSuffix.length)}${titleSuffix}`

  return {
    ...source,
    id: options.id,
    title,
    date,
    endDate,
    time: schedule === undefined ? source.time : normalizeOptional(schedule.time),
    endTime: schedule === undefined ? source.endTime : normalizeOptional(schedule.endTime),
    weeklyHeightMode:
      schedule === undefined
        ? source.weeklyHeightMode
        : normalizeOptional(schedule.weeklyHeightMode),
    completed: false,
    status: 'pending',
    createdAt: options.now,
    updatedAt: options.now,
    automationSource: undefined,
    automationSourceKey: undefined,
    recurrence: undefined,
    tags: [...source.tags],
    reminders: source.reminders.map((reminder, index) => ({
      ...reminder,
      id: options.reminderId?.(reminder.id, index) ?? reminder.id
    })),
    dependencyIds: source.dependencyIds ? [...source.dependencyIds] : undefined
  }
}

function normalizeOptional<T>(value: T | null | undefined): T | undefined {
  return value ?? undefined
}
