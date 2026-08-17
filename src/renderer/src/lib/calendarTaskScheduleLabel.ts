import type { CalendarTask } from '../../../shared/types'

type CalendarTaskSchedule = Pick<CalendarTask, 'date' | 'time' | 'endDate' | 'endTime'>

export function formatCalendarTaskScheduleLabel(task: CalendarTaskSchedule): string {
  const start = formatDateTime(task.date, task.time)
  const hasEnd = Boolean(task.endDate || task.endTime)

  if (!task.date && task.endDate) {
    return `Due ${formatDateTime(task.endDate, task.endTime)}`
  }

  if (!hasEnd) {
    return start || 'Unscheduled'
  }

  const end = formatDateTime(task.endDate ?? task.date, task.endTime)
  if (!start) {
    return end ? `→ ${end}` : 'Unscheduled'
  }

  return `${start} → ${end || 'Unscheduled'}`
}

function formatDateTime(date: string | undefined, time: string | undefined): string {
  const dateLabel = date ? formatDate(date) : ''
  return [dateLabel, time].filter(Boolean).join(' ')
}

function formatDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) {
    return date
  }

  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric'
  })
}
