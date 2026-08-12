import { CheckCircle2, Circle, CircleAlert, CircleDashed, Inbox } from '../components/ui/icons'
import type { TaskStatus } from '../../../shared/types'
import type { UiTone } from './uiTone'

export const TASK_STATUS_META: Record<
  TaskStatus,
  { label: string; className: string; tone: UiTone; Icon: typeof Circle }
> = {
  pending: { label: 'Pending', className: 'text-muted-foreground', tone: 'neutral', Icon: Circle },
  backlog: { label: 'Backlog', className: 'text-warning', tone: 'warning', Icon: Inbox },
  'in-progress': {
    label: 'In progress',
    className: 'text-primary',
    tone: 'info',
    Icon: CircleDashed
  },
  blocked: { label: 'Blocked', className: 'text-destructive', tone: 'danger', Icon: CircleAlert },
  completed: {
    label: 'Completed',
    className: 'text-success',
    tone: 'success',
    Icon: CheckCircle2
  }
}

export function getTaskStatus(status: TaskStatus | undefined, completed = false): TaskStatus {
  return status ?? (completed ? 'completed' : 'pending')
}
