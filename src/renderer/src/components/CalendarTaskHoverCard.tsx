import { ReactElement, ReactNode } from 'react'
import { CalendarTask, Project } from '../../../shared/types'
import { FloatingHoverCard } from './ui/floating-hover-card'
import { formatCalendarTaskTimeLabel } from '../lib/calendarTaskTimeLabel'
import { CalendarTaskTypeBadge } from './ui/calendar-task-type-badge'
import { TaskStatusIcon } from './TaskStatusIcon'
import { getTaskStatus, TASK_STATUS_META } from '../lib/taskStatus'
import { NoteShapeIcon } from './NoteShapeIcon'
import { TaskTagSummary } from './TaskTagSummary'

interface CalendarTaskHoverCardProps {
  task: CalendarTask
  project?: Pick<Project, 'name' | 'icon'>
  x: number
  y: number
}

export function CalendarTaskHoverCard({
  task,
  project,
  x,
  y
}: CalendarTaskHoverCardProps): ReactElement {
  return (
    <FloatingHoverCard
      x={x}
      y={y}
      className="w-72 rounded-lg border-border bg-card p-4 text-card-foreground shadow-sm"
    >
      <div className="mb-2 truncate text-base font-bold text-foreground" title={task.title}>
        {task.title}
      </div>
      <dl className="space-y-1.5">
        <CalendarTaskPropertyRow label="Status">
          <span className="flex min-w-0 items-center gap-1.5">
            <TaskStatusIcon status={task.status} completed={task.completed} size={18} />
            {TASK_STATUS_META[getTaskStatus(task.status, task.completed)].label}
          </span>
        </CalendarTaskPropertyRow>
        <CalendarTaskPropertyRow label="Time">
          {formatCalendarTaskTimeLabel(task)}
        </CalendarTaskPropertyRow>
        {project ? (
          <CalendarTaskPropertyRow label="Project">
            <span className="flex min-w-0 items-center gap-1.5" title={project.name}>
              <NoteShapeIcon icon={project.icon} size={14} />
              <span className="min-w-0 truncate">{project.name}</span>
            </span>
          </CalendarTaskPropertyRow>
        ) : task.projectId ? (
          <CalendarTaskPropertyRow label="Project">{task.projectId}</CalendarTaskPropertyRow>
        ) : null}
        <CalendarTaskPropertyRow label={task.date ? 'Date' : 'Due'}>
          {task.date ?? task.endDate ?? 'Unscheduled'}
        </CalendarTaskPropertyRow>
        <CalendarTaskPropertyRow label="Type">
          <CalendarTaskTypeBadge taskType={task.taskType} />
        </CalendarTaskPropertyRow>
        {task.tags.length > 0 ? (
          <CalendarTaskPropertyRow label="Tags">
            <TaskTagSummary tags={task.tags} mode="compact" />
          </CalendarTaskPropertyRow>
        ) : null}
        {(task.reminders || []).some((reminder) => reminder.enabled) ? (
          <CalendarTaskPropertyRow label="Reminders">Enabled</CalendarTaskPropertyRow>
        ) : null}
      </dl>
    </FloatingHoverCard>
  )
}

function CalendarTaskPropertyRow({
  label,
  children
}: {
  label: string
  children: ReactNode
}): ReactElement {
  return (
    <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-start gap-x-3 text-xs">
      <dt className="font-medium text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-foreground">{children}</dd>
    </div>
  )
}
