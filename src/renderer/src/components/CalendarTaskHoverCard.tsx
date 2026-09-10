import { ReactElement, ReactNode } from 'react'
import { CalendarTask, Project } from '../../../shared/types'
import { FloatingHoverCard } from './ui/floating-hover-card'
import { formatCalendarTaskTimeLabel } from '../lib/calendarTaskTimeLabel'
import { StatusChip } from './ui/status-chip'
import { getCalendarTaskTypeChipItem, getTaskStatusChipItem } from '../lib/statusChipMeta'
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
          <StatusChip item={getTaskStatusChipItem(task.status, task.completed)} />
        </CalendarTaskPropertyRow>
        <CalendarTaskPropertyRow label="Time">
          {formatCalendarTaskTimeLabel(task)}
        </CalendarTaskPropertyRow>
        {project ? (
          <CalendarTaskPropertyRow label="Project">
            <span className="flex min-w-0 items-center gap-1.5" title={project.name}>
              <NoteShapeIcon icon={project.icon} size={16} />
              <span className="min-w-0 truncate" title={project.name}>
                {project.name}
              </span>
            </span>
          </CalendarTaskPropertyRow>
        ) : task.projectId ? (
          <CalendarTaskPropertyRow label="Project">{task.projectId}</CalendarTaskPropertyRow>
        ) : null}
        <CalendarTaskPropertyRow label={task.date ? 'Date' : 'Due'}>
          {task.date ?? task.endDate ?? 'Unscheduled'}
        </CalendarTaskPropertyRow>
        <CalendarTaskPropertyRow label="Type">
          <StatusChip item={getCalendarTaskTypeChipItem(task.taskType)} />
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
      <dd
        className="min-w-0 truncate text-foreground"
        title={typeof children === 'string' ? children : undefined}
      >
        {children}
      </dd>
    </div>
  )
}
