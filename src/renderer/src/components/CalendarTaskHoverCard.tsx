import { ReactElement } from 'react'
import { CalendarTask } from '../../../shared/types'
import { FloatingHoverCard } from './ui/floating-hover-card'
import { formatCalendarTaskTimeLabel } from '../lib/calendarTaskTimeLabel'
import { CalendarTaskTypeBadge } from './ui/calendar-task-type-badge'
import { TaskStatusIcon } from './TaskStatusIcon'
import { getTaskStatus, TASK_STATUS_META } from '../lib/taskStatus'

interface CalendarTaskHoverCardProps {
  task: CalendarTask
  x: number
  y: number
}

export function CalendarTaskHoverCard({ task, x, y }: CalendarTaskHoverCardProps): ReactElement {
  return (
    <FloatingHoverCard x={x} y={y} className="w-72">
      <div className="mb-1.5 text-sm font-semibold text-foreground">{task.title}</div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <TaskStatusIcon status={task.status} completed={task.completed} size={13} />
          {TASK_STATUS_META[getTaskStatus(task.status, task.completed)].label}
        </span>
        <span>{formatCalendarTaskTimeLabel(task)}</span>
      </div>
      {task.projectId ? <div className="mt-1 text-xs text-muted-foreground">Project: {task.projectId}</div> : null}
      <div className="mt-2 text-xs text-muted-foreground">Date: {task.date ?? 'Unscheduled'}</div>
      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
        <span>Type:</span>
        <CalendarTaskTypeBadge taskType={task.taskType} />
      </div>
      {(task.reminders || []).some((reminder) => reminder.enabled) && (
        <div className="mt-1 text-xs text-muted-foreground">Reminders enabled</div>
      )}
    </FloatingHoverCard>
  )
}
