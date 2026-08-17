import type { TaskStatus } from '../../../shared/types'
import type { UiTone } from './uiTone'

export type TaskStatusVisual =
  | 'pending-dash'
  | 'backlog-ring'
  | 'progress-half'
  | 'blocked-cross'
  | 'completed-check'

export const TASK_STATUS_META: Record<
  TaskStatus,
  { label: string; className: string; tone: UiTone; visual: TaskStatusVisual }
> = {
  pending: {
    label: 'Pending',
    className: 'text-muted-foreground',
    tone: 'neutral',
    visual: 'pending-dash'
  },
  backlog: {
    label: 'Backlog',
    className: 'text-warning',
    tone: 'warning',
    visual: 'backlog-ring'
  },
  'in-progress': {
    label: 'In progress',
    className: 'text-primary',
    tone: 'info',
    visual: 'progress-half'
  },
  blocked: {
    label: 'Blocked',
    className: 'text-destructive',
    tone: 'danger',
    visual: 'blocked-cross'
  },
  completed: {
    label: 'Completed',
    className: 'text-success',
    tone: 'success',
    visual: 'completed-check'
  }
}

export function getTaskStatus(status: TaskStatus | undefined, completed = false): TaskStatus {
  return status ?? (completed ? 'completed' : 'pending')
}
