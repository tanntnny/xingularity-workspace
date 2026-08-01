import { CSSProperties, forwardRef, HTMLAttributes, MouseEventHandler, ReactElement } from 'react'
import { TaskStatusIcon } from './TaskStatusIcon'
import { CalendarTask } from '../../../shared/types'
import { formatCalendarTaskTimeLabel } from '../lib/calendarTaskTimeLabel'
import {
  getCalendarTaskBackgroundToken,
  getCalendarTaskBorderToken
} from '../lib/calendarTaskTypeBackground'

interface CalendarTaskCardProps {
  task: CalendarTask
  onToggle?: (taskId: string) => void
  onMouseMove?: MouseEventHandler<HTMLDivElement>
  className?: string
}

export const CalendarTaskCard = forwardRef<
  HTMLDivElement,
  CalendarTaskCardProps & Omit<HTMLAttributes<HTMLDivElement>, keyof CalendarTaskCardProps>
>(function CalendarTaskCard(
  { task, onToggle, onMouseMove, className, style, ...rest },
  ref
): ReactElement {
  const priorityMarker = task.priority === 'high' ? '!!' : task.priority === 'medium' ? '!' : null
  const priorityMarkerColor =
    task.priority === 'high' ? '#ef4444' : task.priority === 'medium' ? '#f59e0b' : null
  const taskTypeStyle = {
    '--calendar-task-bg': getCalendarTaskBackgroundToken(task.taskType),
    '--calendar-task-border': getCalendarTaskBorderToken(task.taskType)
  } as CSSProperties

  return (
    <div
      ref={ref}
      className={`group flex h-full w-full flex-col justify-start overflow-hidden rounded-md border border-[var(--calendar-task-border)] bg-[var(--calendar-task-bg)] px-1.5 py-1 transition-[filter] hover:brightness-110 ${className ?? ''}`}
      onMouseMove={onMouseMove}
      style={{ ...taskTypeStyle, ...style }}
      {...rest}
    >
      <div className="flex min-w-0 items-center justify-between gap-1.5">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            event.preventDefault()
            onToggle?.(task.id)
          }}
          className="inline-flex min-w-0 flex-1 items-center gap-1 rounded-[var(--radius-control)] px-1 transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          title={task.completed ? 'Mark as pending' : 'Mark as in progress'}
        >
          <TaskStatusIcon status={task.status} completed={task.completed} size={14} />
          <span className="truncate text-[11px] font-medium text-muted-foreground">
            {task.completed ? 'Completed' : 'Pending'}
          </span>
        </button>
        <span className="pointer-events-none shrink-0 text-[11px] text-muted-foreground">
          {formatCalendarTaskTimeLabel(task)}
        </span>
      </div>
      <div className="mt-0.5 flex min-w-0 items-start gap-1 overflow-hidden">
        {priorityMarker && priorityMarkerColor ? (
          <span
            className="pointer-events-none shrink-0 text-xs font-semibold leading-none"
            style={{ color: priorityMarkerColor }}
            aria-hidden="true"
          >
            {priorityMarker}
          </span>
        ) : null}
        <span className="pointer-events-none min-w-0 flex-1 truncate text-xs font-semibold leading-tight text-foreground">
          {task.title}
        </span>
        {(task.reminders || []).some((reminder) => reminder.enabled) ? (
          <span className="pointer-events-none shrink-0 text-xs text-muted-foreground">*</span>
        ) : null}
      </div>
    </div>
  )
})
