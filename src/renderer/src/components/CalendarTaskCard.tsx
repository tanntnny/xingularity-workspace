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
import { TaskTagSummary } from './TaskTagSummary'
import { Bell } from './ui/icons'

interface CalendarTaskCardProps {
  task: CalendarTask
  project?: Pick<Project, 'name' | 'icon'>
  compact?: boolean
  showStatusValue?: boolean
  showProject?: boolean
  showTime?: boolean
  heightMode?: 'fill' | 'content'
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
    showStatusValue,
    showProject = true,
    showTime = true,
    heightMode = 'fill',
    onStatusChange,
    onMouseMove,
    className,
    style,
    ...rest
  },
  ref
): ReactElement {
  const status = getTaskStatus(task.status, task.completed)
  const isDeadlineOnly = !task.date && Boolean(task.endDate)
  const priorityMarker = task.priority === 'high' ? '!!' : task.priority === 'medium' ? '!' : null
  const priorityMarkerClass =
    task.priority === 'high'
      ? 'text-destructive'
      : task.priority === 'medium'
        ? 'text-warning'
        : null
  const priorityLabel =
    task.priority === 'high'
      ? 'High priority'
      : task.priority === 'medium'
        ? 'Medium priority'
        : null
  const hasEnabledReminder = (task.reminders || []).some((reminder) => reminder.enabled)
  const taskTypeStyle = {
    '--calendar-task-bg': getCalendarTaskBackgroundToken(task.taskType),
    '--calendar-task-border': getCalendarTaskBorderToken(task.taskType)
  } as CSSProperties
  const statusOptions: readonly SelectiveChipOption[] = TASK_STATUS_OPTIONS.map((option) => ({
    value: option.value,
    label: option.label,
    icon: <TaskStatusIcon status={option.value} size={18} />,
    tone: TASK_STATUS_META[option.value].tone
  }))

  return (
    <div
      ref={ref}
      className={`group flex ${heightMode === 'content' ? 'h-fit' : 'h-full'} w-full flex-col justify-start overflow-hidden rounded-md border border-[var(--calendar-task-border)] bg-[var(--calendar-task-bg)] px-1.5 py-1 transition-[filter] hover:brightness-110 ${isDeadlineOnly ? 'border-warning/70' : ''} ${status !== 'pending' ? 'opacity-60' : ''} ${className ?? ''}`}
      onMouseMove={onMouseMove}
      style={{ ...taskTypeStyle, ...style }}
      data-task-status={status}
      {...rest}
    >
      <div className="flex h-fit min-h-0 min-w-0 shrink-0 items-start justify-between gap-1.5">
        <div
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <SelectiveChip
            className="!h-4 text-[11px] leading-none text-muted-foreground hover:text-foreground"
            label={`Status for ${task.title}`}
            value={status}
            variant="plain"
            showValue={showStatusValue ?? !compact}
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
      <div className="flex min-h-0 min-w-0 shrink-0 items-start gap-1 overflow-hidden">
        <span
          className={`pointer-events-none min-w-0 flex-1 truncate text-sm font-bold leading-tight text-foreground ${status === 'completed' ? 'line-through' : ''}`}
        >
          {task.title}
        </span>
      </div>
      {project && showProject ? (
        <div
          className="mt-1 flex min-h-0 min-w-0 shrink-0 items-center gap-1 overflow-hidden text-[10px] text-muted-foreground"
          title={project.name}
          data-testid="calendar-task-project"
        >
          <NoteShapeIcon icon={project.icon} size={13} />
          <span className="min-w-0 truncate">{project.name}</span>
        </div>
      ) : null}
      {task.tags.length > 0 || priorityMarker || hasEnabledReminder ? (
        <div className="mt-1 flex min-h-0 min-w-0 shrink-0 items-center gap-1">
          <div className="flex shrink-0 items-center gap-1">
            {priorityMarker && priorityMarkerClass && priorityLabel ? (
              <span
                role="img"
                aria-label={priorityLabel}
                className={`pointer-events-none text-xs font-semibold leading-none ${priorityMarkerClass}`}
                title={priorityLabel}
              >
                {priorityMarker}
              </span>
            ) : null}
            {hasEnabledReminder ? (
              <span
                role="img"
                aria-label="Reminder enabled"
                className="pointer-events-none inline-flex items-center text-muted-foreground"
                title="Reminder enabled"
              >
                <Bell size={12} aria-hidden="true" />
              </span>
            ) : null}
          </div>
          {task.tags.length > 0 ? (
            <TaskTagSummary tags={task.tags} className="min-w-0 flex-1" />
          ) : (
            <span className="min-w-0 flex-1" aria-hidden="true" />
          )}
        </div>
      ) : null}
    </div>
  )
})
