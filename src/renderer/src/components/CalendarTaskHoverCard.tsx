import { ReactElement } from 'react'
import { CalendarTask, formatCalendarTaskType } from '../../../shared/types'
import { FloatingHoverCard } from './ui/floating-hover-card'

interface CalendarTaskHoverCardProps {
  task: CalendarTask
  x: number
  y: number
}

export function CalendarTaskHoverCard({ task, x, y }: CalendarTaskHoverCardProps): ReactElement {
  return (
    <FloatingHoverCard x={x} y={y} className="w-72">
      <div className="mb-1.5 text-sm font-semibold text-[var(--text)]">{task.title}</div>
      <div className="flex items-center justify-between text-xs text-[var(--muted)]">
        <span>{task.completed ? 'Completed' : 'Pending'}</span>
        <span>{task.time || 'No time'}</span>
      </div>
      <div className="mt-2 text-xs text-[var(--muted)]">Date: {task.date ?? 'Unscheduled'}</div>
      <div className="mt-1 text-xs text-[var(--muted)]">
        Type: {formatCalendarTaskType(task.taskType || 'assignment')}
      </div>
      {(task.reminders || []).some((reminder) => reminder.enabled) && (
        <div className="mt-1 text-xs text-[var(--muted)]">Reminders enabled</div>
      )}
    </FloatingHoverCard>
  )
}
