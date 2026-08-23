import type { TaskStatus } from '../../../shared/types'
import type { UiTone } from './uiTone'

export type TaskStatusVisual =
  | 'pending-dash'
  | 'backlog-dashed-minus'
  | 'progress-half'
  | 'blocked-cancel'
  | 'canceled-dashed-x'
  | 'completed-check'

export const TASK_STATUS_META: Record<
  TaskStatus,
  {
    label: string
    className: string
    tone: UiTone
    visual: TaskStatusVisual
    iconColorToken: string
  }
> = {
  pending: {
    label: 'Pending',
    className: 'text-muted-foreground',
    tone: 'neutral',
    visual: 'pending-dash',
    iconColorToken: 'var(--status-chip-task-status-pending-icon)'
  },
  backlog: {
    label: 'Backlog',
    className: 'text-warning',
    tone: 'warning',
    visual: 'backlog-dashed-minus',
    iconColorToken: 'var(--status-chip-task-status-backlog-icon)'
  },
  'in-progress': {
    label: 'In progress',
    className: 'text-warning',
    tone: 'info',
    visual: 'progress-half',
    iconColorToken: 'var(--status-chip-task-status-in-progress-icon)'
  },
  blocked: {
    label: 'Blocked',
    className: 'text-warning',
    tone: 'warning',
    visual: 'blocked-cancel',
    iconColorToken: 'var(--status-chip-task-status-blocked-icon)'
  },
  canceled: {
    label: 'Canceled',
    className: 'text-destructive',
    tone: 'danger',
    visual: 'canceled-dashed-x',
    iconColorToken: 'var(--status-chip-task-status-canceled-icon)'
  },
  completed: {
    label: 'Completed',
    className: 'text-success',
    tone: 'success',
    visual: 'completed-check',
    iconColorToken: 'var(--status-chip-task-status-completed-icon)'
  }
}

export function getTaskStatus(status: TaskStatus | undefined, completed = false): TaskStatus {
  return status ?? (completed ? 'completed' : 'pending')
}
