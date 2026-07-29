import { CSSProperties, forwardRef, HTMLAttributes, MouseEventHandler, ReactElement } from 'react'
import { Check } from './ui/icons'
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
      className={`group mx-1 flex h-full w-[calc(100%-0.5rem)] flex-col justify-start rounded-md border border-[var(--calendar-task-border)] bg-[var(--calendar-task-bg)] px-1.5 py-1 transition-[filter] hover:brightness-110 ${className ?? ''}`}
      onMouseMove={onMouseMove}
      style={{ ...taskTypeStyle, ...style }}
      {...rest}
    >
      <div className="flex items-center justify-between gap-1.5">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            event.preventDefault()
            onToggle?.(task.id)
          }}
          className="inline-flex items-center gap-1 rounded-[var(--radius-control)] px-1 transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          title={task.completed ? 'Mark as pending' : 'Mark as complete'}
        >
          <span
            className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border-2 ${
              task.completed
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card'
            }`}
          >
            {task.completed ? <Check size={8} strokeWidth={3} /> : null}
          </span>
          <span className="text-[11px] font-medium text-muted-foreground">
            {task.completed ? 'Completed' : 'Pending'}
          </span>
        </button>
        <span className="pointer-events-none shrink-0 text-[11px] text-muted-foreground">
          {formatCalendarTaskTimeLabel(task)}
        </span>
      </div>
      <div className="mt-0.5 flex items-start gap-1">
        {priorityMarker && priorityMarkerColor ? (
          <span
            className="pointer-events-none shrink-0 text-xs font-semibold leading-none"
            style={{ color: priorityMarkerColor }}
            aria-hidden="true"
          >
            {priorityMarker}
          </span>
        ) : null}
        <span className="pointer-events-none truncate text-xs font-semibold leading-tight text-foreground">
          {task.title}
        </span>
        {(task.reminders || []).some((reminder) => reminder.enabled) ? (
          <span className="pointer-events-none shrink-0 text-xs text-muted-foreground">*</span>
        ) : null}
      </div>
    </div>
  )
})
