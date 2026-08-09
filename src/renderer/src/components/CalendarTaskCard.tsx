import { CSSProperties, forwardRef, HTMLAttributes, MouseEventHandler, ReactElement } from 'react'
import { TaskStatusIcon } from './TaskStatusIcon'
import { CalendarTask, Project, TASK_STATUS_OPTIONS, TaskStatus } from '../../../shared/types'
import { formatCalendarTaskTimeLabel } from '../lib/calendarTaskTimeLabel'
import { NoteShapeIcon } from './NoteShapeIcon'
import { SelectiveChip, type SelectiveChipOption } from './ui/selective-chip'
import {
  getCalendarTaskBackgroundToken,
  getCalendarTaskBorderToken
} from '../lib/calendarTaskTypeBackground'
import { getTaskStatus, TASK_STATUS_META } from '../lib/taskStatus'

interface CalendarTaskCardProps {
  task: CalendarTask
  project?: Pick<Project, 'name' | 'icon'>
  compact?: boolean
  showProject?: boolean
  showTime?: boolean
  onStatusChange?: (taskId: string, status: TaskStatus) => void
  onMouseMove?: MouseEventHandler<HTMLDivElement>
  className?: string
}

export const CalendarTaskCard = forwardRef<
  HTMLDivElement,
  CalendarTaskCardProps & Omit<HTMLAttributes<HTMLDivElement>, keyof CalendarTaskCardProps>
>(function CalendarTaskCard(
  {
    task,
    project,
    compact = false,
    showProject = true,
    showTime = true,
    onStatusChange,
    onMouseMove,
    className,
    style,
    ...rest
  },
  ref
): ReactElement {
  const status = getTaskStatus(task.status, task.completed)
  const priorityMarker = task.priority === 'high' ? '!!' : task.priority === 'medium' ? '!' : null
  const priorityMarkerColor =
    task.priority === 'high' ? '#ef4444' : task.priority === 'medium' ? '#f59e0b' : null
  const taskTypeStyle = {
    '--calendar-task-bg': getCalendarTaskBackgroundToken(task.taskType),
    '--calendar-task-border': getCalendarTaskBorderToken(task.taskType)
  } as CSSProperties
  const statusOptions: readonly SelectiveChipOption[] = TASK_STATUS_OPTIONS.map((option) => ({
    value: option.value,
    label: option.label,
    icon: <TaskStatusIcon status={option.value} size={14} />,
    tone: TASK_STATUS_META[option.value].tone
  }))

  return (
    <div
      ref={ref}
      className={`group flex h-full w-full flex-col justify-start overflow-hidden rounded-md border border-[var(--calendar-task-border)] bg-[var(--calendar-task-bg)] px-1.5 py-1 transition-[filter] hover:brightness-110 ${status !== 'pending' ? 'opacity-60' : ''} ${className ?? ''}`}
      onMouseMove={onMouseMove}
      style={{ ...taskTypeStyle, ...style }}
      data-task-status={status}
      {...rest}
    >
      <div className="flex h-fit min-h-0 min-w-0 shrink-0 items-center justify-between gap-1.5 py-1">
        <div
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <SelectiveChip
            className="!h-4 text-[11px] leading-none text-muted-foreground hover:text-foreground"
            label={`Status for ${task.title}`}
            value={status}
            variant="plain"
            showValue={!compact}
            options={statusOptions}
            onValueChange={(value) => onStatusChange?.(task.id, value as TaskStatus)}
          />
        </div>
        {showTime ? (
          <span className="pointer-events-none shrink-0 text-[11px] text-muted-foreground">
            {formatCalendarTaskTimeLabel(task)}
          </span>
        ) : null}
      </div>
      <div className="mt-0.5 flex min-h-0 min-w-0 shrink-0 items-start gap-1 overflow-hidden">
        {priorityMarker && priorityMarkerColor ? (
          <span
            className="pointer-events-none shrink-0 text-xs font-semibold leading-none"
            style={{ color: priorityMarkerColor }}
            aria-hidden="true"
          >
            {priorityMarker}
          </span>
        ) : null}
        <span
          className={`pointer-events-none min-w-0 flex-1 truncate text-xs font-semibold leading-tight text-foreground ${status === 'completed' ? 'line-through' : ''}`}
        >
          {task.title}
        </span>
        {(task.reminders || []).some((reminder) => reminder.enabled) ? (
          <span className="pointer-events-none shrink-0 text-xs text-muted-foreground">*</span>
        ) : null}
      </div>
      {project && showProject ? (
        <div
          className="mt-auto flex min-h-0 min-w-0 shrink-0 items-center gap-1 overflow-hidden border-t border-current/10 pt-1 text-[10px] text-muted-foreground"
          title={project.name}
          data-testid="calendar-task-project"
        >
          <NoteShapeIcon icon={project.icon} size={13} />
          <span className="min-w-0 truncate">{project.name}</span>
        </div>
      ) : null}
    </div>
  )
})
