import { forwardRef, HTMLAttributes, MouseEventHandler, ReactElement } from 'react'
import { Check } from 'lucide-react'
import { CalendarTask } from '../../../shared/types'

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
  { task, onToggle, onMouseMove, className, ...rest },
  ref
): ReactElement {
  return (
    <div
      ref={ref}
      className={`beacon-task-inner group w-full rounded px-1.5 py-1 ${className ?? ''}`}
      onMouseMove={onMouseMove}
      {...rest}
    >
      <div className="beacon-task-row flex items-center justify-between gap-1.5">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            event.preventDefault()
            onToggle?.(task.id)
          }}
          className="inline-flex items-center gap-1"
          title={task.completed ? 'Mark as pending' : 'Mark as complete'}
        >
          <span
            className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border ${
              task.completed
                ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                : 'border-[var(--line-strong)] bg-[var(--panel)]'
            }`}
          >
            {task.completed ? <Check size={8} strokeWidth={3} /> : null}
          </span>
          <span className="text-[10px] font-medium text-[var(--muted)]">
            {task.completed ? 'Completed' : 'Pending'}
          </span>
        </button>
        <span className="pointer-events-none shrink-0 text-[10px] text-[var(--muted)]">
          {task.time || 'No time'}
        </span>
      </div>
      <div className="mt-0.5 flex items-center gap-1">
        <span className="pointer-events-none truncate text-[11px] font-medium text-[var(--text)]">
          {task.title}
        </span>
        {(task.reminders || []).some((reminder) => reminder.enabled) ? (
          <span className="pointer-events-none shrink-0 text-[10px] text-[var(--muted)]">*</span>
        ) : null}
      </div>
    </div>
  )
})
