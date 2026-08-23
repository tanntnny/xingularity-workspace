import type { CalendarTask, TaskStatus } from './types'

export const TASK_DONE_STATUSES: readonly TaskStatus[] = ['canceled', 'completed']

export function isTaskStatusDone(status: TaskStatus | undefined): boolean {
  return status === 'canceled' || status === 'completed'
}

export function isTaskDone(task: Pick<CalendarTask, 'status' | 'completed'>): boolean {
  return task.status === undefined ? task.completed : isTaskStatusDone(task.status)
}
