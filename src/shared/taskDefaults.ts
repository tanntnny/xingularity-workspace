import type { TaskPriority } from './types'

export const DEFAULT_TASK_PRIORITY: TaskPriority = 'medium'

export function resolveTaskPriority(priority: TaskPriority | undefined): TaskPriority {
  return priority ?? DEFAULT_TASK_PRIORITY
}
