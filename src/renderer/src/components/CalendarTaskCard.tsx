import { CSSProperties, forwardRef, HTMLAttributes, MouseEventHandler, ReactElement } from 'react'
import { CalendarTask, Project, TaskStatus } from '../../../shared/types'
import { formatCalendarTaskTimeLabel } from '../lib/calendarTaskTimeLabel'
import { NoteShapeIcon } from './NoteShapeIcon'
import { StatusChipSelect } from './ui/status-chip-select'
import { WorkspaceTextClip } from './ui/workspace-text-clip'
import { WorkspaceTextFade } from './ui/workspace-text-fade'
import {
  getCalendarTaskBackgroundToken,
  getCalendarTaskBorderToken
} from '../lib/calendarTaskTypeBackground'
import { getTaskStatus } from '../lib/taskStatus'
import { isTaskDone } from '../../../shared/taskStatus'
import { TASK_STATUS_CHIP_OPTIONS } from '../lib/statusChipMeta'

interface CalendarTaskCardProps {
  task: CalendarTask
  project?: Pick<Project, 'name' | 'icon'>
  compact?: boolean
  showStatusValue?: boolean
  showProject?: boolean
  showTime?: boolean
  strikeCompleted?: boolean
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
    compact: _compact,
    showStatusValue: _showStatusValue,
    showProject = true,
    showTime = true,
    strikeCompleted = true,
    heightMode = 'fill',
    onStatusChange,
    onMouseMove,
    className,
    style,
    ...rest
  },
  ref
): ReactElement {
  void _compact
  void _showStatusValue
  const status = getTaskStatus(task.status, task.completed)
  const statusOption = TASK_STATUS_CHIP_OPTIONS.find((option) => option.value === status)
  const statusLabel = typeof statusOption?.label === 'string' ? statusOption.label : status
  const timeLabel = formatCalendarTaskTimeLabel(task)
  const isDeadlineOnly = !task.date && Boolean(task.endDate)
  const taskTypeStyle = {
    '--calendar-task-bg': getCalendarTaskBackgroundToken(task.taskType),
    '--calendar-task-border': getCalendarTaskBorderToken(task.taskType)
  } as CSSProperties
  return (
    <div
      ref={ref}
      className={`group flex ${heightMode === 'content' ? 'h-fit' : 'h-full'} w-full flex-col justify-start overflow-hidden rounded-md border border-[var(--calendar-task-border)] bg-[var(--calendar-task-bg)] px-1.5 py-1 transition-[filter] hover:brightness-110 ${isDeadlineOnly ? 'border-warning/70' : ''} ${status !== 'pending' ? 'opacity-60' : ''} ${className ?? ''}`}
      onMouseMove={onMouseMove}
      style={{ ...taskTypeStyle, ...style }}
      data-task-status={status}
      {...rest}
    >
      <div
        className={`grid h-fit min-h-0 min-w-0 shrink-0 items-center gap-1.5 ${showTime ? 'grid-cols-2' : 'grid-cols-1'}`}
      >
        <div
          data-calendar-task-field="status"
          className="min-w-0 overflow-hidden"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <StatusChipSelect
            className="w-full min-w-0 max-w-full"
            label={`Status for ${task.title}`}
            value={status}
            options={TASK_STATUS_CHIP_OPTIONS}
            variant="bare"
            labelOverflow="clip"
            title={`Status: ${statusLabel}`}
            onValueChange={(value) => onStatusChange?.(task.id, value as TaskStatus)}
          />
        </div>
        {showTime ? (
          <WorkspaceTextFade
            data-calendar-task-field="time"
            className="pointer-events-none min-w-0 w-full text-right text-[11px] text-muted-foreground"
            title={timeLabel}
          >
            {timeLabel}
          </WorkspaceTextFade>
        ) : null}
      </div>
      <div className="flex min-h-0 min-w-0 shrink-0 items-start gap-1 overflow-hidden">
        <WorkspaceTextClip
          data-calendar-task-field="title"
          className={`pointer-events-none min-w-0 flex-1 text-sm font-bold leading-tight text-foreground ${strikeCompleted && isTaskDone(task) ? 'line-through' : ''}`}
          title={task.title}
        >
          {task.title}
        </WorkspaceTextClip>
      </div>
      {project && showProject ? (
        <div
          className="mt-1 flex min-h-0 min-w-0 shrink-0 items-center gap-1 overflow-hidden text-sm text-muted-foreground"
          title={project.name}
          data-testid="calendar-task-project"
          data-calendar-task-field="project"
        >
          <NoteShapeIcon icon={project.icon} size={18} />
          <WorkspaceTextFade className="min-w-0 flex-1" title={project.name}>
            {project.name}
          </WorkspaceTextFade>
        </div>
      ) : null}
    </div>
  )
})
