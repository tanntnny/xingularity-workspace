import { CalendarTask } from '../../../shared/types'

export function formatCalendarTaskTimeLabel(task: Pick<CalendarTask, 'time' | 'endTime'>): string {
  if (task.time && task.endTime) {
    return `${task.time} - ${task.endTime}`
  }

  if (task.time) {
    return task.time
  }

  if (task.endTime) {
    return `Ends ${task.endTime}`
  }

  return 'No time'
}
