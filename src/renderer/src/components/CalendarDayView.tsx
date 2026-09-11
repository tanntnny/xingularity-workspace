import { DragEvent, ReactElement, useMemo, useState } from 'react'
import type { CalendarTask } from '../../../shared/types'
import { isTaskDone, isTaskStatusDone } from '../../../shared/taskStatus'
import { formatCalendarTaskTimeLabel } from '../lib/calendarTaskTimeLabel'
import { getTaskStatus } from '../lib/taskStatus'
import { TaskContextMenu } from './TaskContextMenu'
import { ChevronLeft, ChevronRight, WorkspaceIconButton, WorkspaceTextFade } from './ui'

interface CalendarDayViewProps {
  selectedDate: string
  tasks: CalendarTask[]
  onSelectDate: (date: string) => void
  onRescheduleTask?: (taskId: string, newDate: string | undefined) => void
  onOpenTask?: (taskId: string) => void
  onDuplicateTask?: (taskId: string) => void | Promise<void>
  onDeleteTask?: (taskId: string) => void
  onUpdateTask?: (taskId: string, patch: Partial<CalendarTask>) => void
}

// Time slots from 6 AM to 11 PM
const TIME_SLOTS = Array.from({ length: 18 }, (_, i) => {
  const hour = i + 6
  return {
    hour,
    label: hour === 12 ? '12 PM' : hour < 12 ? `${hour} AM` : `${hour - 12} PM`,
    value: `${String(hour).padStart(2, '0')}:00`
  }
})

export function CalendarDayView({
  selectedDate,
  tasks,
  onSelectDate,
  onRescheduleTask,
  onOpenTask,
  onDuplicateTask,
  onDeleteTask,
  onUpdateTask
}: CalendarDayViewProps): ReactElement {
  const selected = useMemo(() => parseIsoDate(selectedDate), [selectedDate])
  const todayIso = toIsoDate(new Date())
  const isToday = selectedDate === todayIso
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null)

  const dateLabel = useMemo(() => {
    return selected.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    })
  }, [selected])

  // Group tasks by hour
  const tasksByHour = useMemo(() => {
    const grouped: Record<number, CalendarTask[]> = {}

    for (const task of tasks) {
      if (task.time) {
        const hour = parseInt(task.time.split(':')[0], 10)
        if (!grouped[hour]) grouped[hour] = []
        grouped[hour].push(task)
      } else {
        // Tasks without time go to 9 AM by default (or "All Day" section)
        if (!grouped[-1]) grouped[-1] = []
        grouped[-1].push(task)
      }
    }

    return grouped
  }, [tasks])

  const allDayTasks = tasksByHour[-1] || []
  const safeDeleteTask = onDeleteTask ?? (() => undefined)
  const safeUpdateTask = onUpdateTask ?? (() => undefined)
  const wrapTask = (task: CalendarTask, content: ReactElement): ReactElement => (
    <TaskContextMenu
      key={task.id}
      task={task}
      selectedDate={selectedDate}
      onDuplicateTask={onDuplicateTask}
      onDelete={safeDeleteTask}
      onUpdateStatus={(taskId, status) =>
        safeUpdateTask(taskId, { status, completed: isTaskStatusDone(status) })
      }
      onUpdatePriority={(taskId, priority) => safeUpdateTask(taskId, { priority })}
      onUpdateTaskType={(taskId, taskType) => safeUpdateTask(taskId, { taskType })}
      onUpdateTime={(taskId, time) => safeUpdateTask(taskId, { time })}
      onUpdateReminders={(taskId, reminders) => safeUpdateTask(taskId, { reminders })}
      onScheduleTask={onRescheduleTask}
      onUnscheduleTask={
        onRescheduleTask ? (taskId) => onRescheduleTask(taskId, undefined) : undefined
      }
    >
      {content}
    </TaskContextMenu>
  )

  const goToPrevDay = (): void => {
    const prev = new Date(selected)
    prev.setDate(prev.getDate() - 1)
    onSelectDate(toIsoDate(prev))
  }

  const goToNextDay = (): void => {
    const next = new Date(selected)
    next.setDate(next.getDate() + 1)
    onSelectDate(toIsoDate(next))
  }

  return (
    <section className="flex h-full flex-col gap-3 overflow-hidden bg-[var(--calendar-surface)] p-4">
      <div className="flex shrink-0 items-center justify-between">
        <div className="flex items-center gap-2">
          <WorkspaceIconButton
            onClick={goToPrevDay}
            title="Previous day"
            aria-label="Previous day"
            icon={<ChevronLeft size={16} />}
          />
          <h2 className="text-lg font-semibold text-foreground">
            {dateLabel}
            {isToday && (
              <span className="ml-2 rounded-md bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                Today
              </span>
            )}
          </h2>
          <WorkspaceIconButton
            onClick={goToNextDay}
            title="Next day"
            aria-label="Next day"
            icon={<ChevronRight size={16} />}
          />
        </div>
        <span className="inline-flex items-center rounded-md border border-border bg-muted px-2 py-0.5 text-xs leading-[1.2] text-muted-foreground">
          {tasks.length} task{tasks.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* All Day section */}
      {allDayTasks.length > 0 && (
        <div className="border border-panel-border bg-card text-card-foreground shrink-0 rounded-lg p-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            All Day / No Time Set
          </h3>
          <div className="flex flex-wrap gap-2">
            {allDayTasks.map((task) =>
              wrapTask(
                task,
                <button
                  type="button"
                  key={task.id}
                  onClick={() => onOpenTask?.(task.id)}
                  className={`inline-flex items-center rounded-lg border bg-card px-2.5 py-1.5 text-sm ${getTaskStatus(task.status, task.completed) !== 'pending' ? 'opacity-60' : ''} ${isTaskDone(task) ? 'line-through' : ''}`}
                >
                  <WorkspaceTextFade className="text-base font-semibold text-foreground">
                    {task.title}
                  </WorkspaceTextFade>
                </button>
              )
            )}
          </div>
        </div>
      )}

      {/* Time grid */}
      <div className="flex-1 overflow-auto">
        <div className="min-h-[900px]">
          {TIME_SLOTS.map((slot) => {
            const slotTasks = tasksByHour[slot.hour] || []
            const isDragOver = dragOverSlot === slot.value

            const handleDragOver = (e: DragEvent<HTMLDivElement>): void => {
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
              setDragOverSlot(slot.value)
            }

            const handleDragLeave = (): void => {
              setDragOverSlot(null)
            }

            const handleDrop = (e: DragEvent<HTMLDivElement>): void => {
              e.preventDefault()
              setDragOverSlot(null)
              const taskId = e.dataTransfer.getData('text/plain')
              if (taskId && onRescheduleTask) {
                onRescheduleTask(taskId, selectedDate)
              }
            }

            return (
              <div
                key={slot.hour}
                className="flex border-b border-panel-border"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div className="w-16 shrink-0 py-2 pr-2 text-right text-xs text-muted-foreground">
                  {slot.label}
                </div>
                <div
                  className={`min-h-[50px] flex-1 py-1 pl-2 transition-colors ${
                    isDragOver ? 'bg-muted' : ''
                  }`}
                >
                  {slotTasks.map((task) =>
                    wrapTask(
                      task,
                      <button
                        type="button"
                        key={task.id}
                        onClick={() => onOpenTask?.(task.id)}
                        className={`mb-1 inline-flex items-center gap-1.5 rounded-lg border bg-card px-2.5 py-1.5 text-sm ${getTaskStatus(task.status, task.completed) !== 'pending' ? 'opacity-60' : ''} ${isTaskDone(task) ? 'line-through' : ''}`}
                      >
                        <WorkspaceTextFade className="text-base font-semibold text-foreground">
                          {task.title}
                        </WorkspaceTextFade>
                        <span className="text-xs text-muted-foreground">
                          {formatCalendarTaskTimeLabel(task)}
                        </span>
                      </button>
                    )
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseIsoDate(iso: string): Date {
  const parsed = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) {
    return new Date()
  }
  return parsed
}
