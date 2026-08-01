import { CheckCircle2, Circle, CircleAlert, CircleDashed } from '../components/ui/icons'
import type { TaskStatus } from '../../../shared/types'

export const TASK_STATUS_META: Record<
  TaskStatus,
  { label: string; className: string; Icon: typeof Circle }
> = {
  pending: { label: 'Pending', className: 'text-muted-foreground', Icon: Circle },
  'in-progress': { label: 'In progress', className: 'text-primary', Icon: CircleDashed },
  blocked: { label: 'Blocked', className: 'text-destructive', Icon: CircleAlert },
  completed: { label: 'Completed', className: 'text-emerald-500', Icon: CheckCircle2 }
}

export function getTaskStatus(status: TaskStatus | undefined, completed = false): TaskStatus {
  return status ?? (completed ? 'completed' : 'pending')
}
