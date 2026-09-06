import { DragEvent, ReactElement, useEffect, useMemo, useState } from 'react'
import { CalendarPlus, Plus } from './ui/icons'
import {
  CalendarTask,
  CalendarTaskType,
  Project,
  TaskPriority,
  TaskReminder,
  TaskStatus
} from '../../../shared/types'
import type { TaskScheduleOverride } from '../../../shared/types'
import { isTaskDone, isTaskStatusDone } from '../../../shared/taskStatus'
import { CalendarTaskCard } from './CalendarTaskCard'
import { CalendarTaskHoverCard } from './CalendarTaskHoverCard'
import { TaskContextMenu } from './TaskContextMenu'
import { DragSource } from './ui/drag-source'
import { DropZone } from './ui/drop-zone'
import { WorkspacePanelSectionHeader } from './ui/workspace-panel-section'
import { WorkspaceIconButton } from './ui/document-workspace'
import { TooltipButton } from './ui/tooltip'
import {
  clearCalendarTaskDragSession,
  getCalendarTaskDragSession,
  parseCalendarTaskDragPayload,
  setCalendarTaskDragSession,
  setCalendarTaskUnscheduledDragOver,
  subscribeCalendarTaskUnscheduledDragOver
} from '../lib/calendarTaskDragSession'
import { getCalendarTaskHoverPosition } from '../lib/calendarTaskHoverPosition'
import { useStaggeredScrollReveal } from '../hooks/useStaggeredScrollReveal'
import { isDeleteShortcut } from '../lib/isDeleteShortcut'

export interface UnscheduledTaskListProps {
  tasks: CalendarTask[]
  dragPreview?: 'clone' | 'floating'
  hasActiveFilter?: boolean
  projects?: Project[]
  selectedDate: string
  newTaskValue: string
  onNewTaskValueChange: (value: string) => void
  onOpenTask?: (taskId: string) => void
  onDuplicateTask?: (taskId: string) => void | Promise<void>
  onCopyTaskToSchedule?: (taskId: string, schedule: TaskScheduleOverride) => void | Promise<void>
  onDelete: (taskId: string) => void
  onUpdatePriority: (taskId: string, priority: TaskPriority) => void
  onUpdateTaskType: (taskId: string, taskType: CalendarTaskType) => void
  onUpdateTask?: (taskId: string, patch: Partial<CalendarTask>) => void
  onUpdateStatus?: (taskId: string, status: TaskStatus) => void
  onUpdateTime: (taskId: string, time: string | undefined) => void
  onUpdateReminders: (taskId: string, reminders: TaskReminder[]) => void
  onScheduleTask: (taskId: string, date: string) => void
  onUnscheduleTask?: (taskId: string) => void
  onInsertTask: () => void
}

export function UnscheduledTaskList({
  tasks,
  dragPreview = 'clone',
  hasActiveFilter = false,
  projects = [],
  selectedDate,
  newTaskValue,
  onNewTaskValueChange,
  onOpenTask,
  onDuplicateTask,
  onCopyTaskToSchedule,
  onDelete,
  onUpdatePriority,
  onUpdateTaskType,
  onUpdateTask,
  onUpdateStatus,
  onUpdateTime,
  onUpdateReminders,
  onScheduleTask,
  onUnscheduleTask,
  onInsertTask
}: UnscheduledTaskListProps): ReactElement {
  const [isDragOver, setIsDragOver] = useState(false)
  const [hoveredTaskCard, setHoveredTaskCard] = useState<{
    task: CalendarTask
    x: number
    y: number
  } | null>(null)

  const pendingCount = tasks.filter((task) => !isTaskDone(task)).length
  const completedCount = tasks.filter((task) => isTaskDone(task)).length
  const projectsById = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects]
  )
  const revealItemIds = useMemo(() => tasks.map((task) => task.id), [tasks])
  const { containerRef, getRevealItemProps } = useStaggeredScrollReveal(revealItemIds, {
    baseDelayMs: 0,
    maxStaggerSteps: 0
  })

  useEffect(() => subscribeCalendarTaskUnscheduledDragOver(setIsDragOver), [])

  const handleDragOver = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault()
    e.dataTransfer.dropEffect = getCalendarTaskDragSession()?.mode === 'copy' ? 'copy' : 'move'
    setCalendarTaskUnscheduledDragOver(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>): void => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setCalendarTaskUnscheduledDragOver(false)
    }
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault()
    setCalendarTaskUnscheduledDragOver(false)
    const parsed =
      getCalendarTaskDragSession() ??
      parseCalendarTaskDragPayload(e.dataTransfer.getData('text/plain'))
    if (!parsed) return

    if (parsed.mode === 'copy') {
      void onCopyTaskToSchedule?.(parsed.taskId, {})
      return
    }

    if (onUnscheduleTask) {
      onUnscheduleTask(parsed.taskId)
    }
  }

  return (
    <div
      data-unscheduled-task-list="true"
      data-unscheduled-drag-over={isDragOver ? 'true' : 'false'}
      className="flex flex-col bg-transparent"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="shrink-0 p-3 pb-4">
        <WorkspacePanelSectionHeader
          heading="Unscheduled"
          description={`${pendingCount} pending${completedCount > 0 ? ` · ${completedCount} done` : ''}`}
        />
      </div>

      <div className="shrink-0 px-2 pb-4">
        <div className="mb-2 flex items-center gap-2">
          <input
            type="text"
            aria-label="Add a task"
            placeholder="Add a task..."
            value={newTaskValue}
            onChange={(event) => onNewTaskValueChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                onInsertTask()
              }
            }}
            className="border border-input bg-card text-foreground h-8 min-w-0 flex-1 rounded-md border border-border px-2.5 text-sm text-foreground outline-none hover:border-primary focus:border-primary transition"
          />
          <TooltipButton label="Insert task">
            <WorkspaceIconButton
              onClick={onInsertTask}
              aria-label="Insert task"
              title="Insert task"
              borderless
              icon={<Plus size={13} aria-hidden="true" />}
            />
          </TooltipButton>
        </div>
      </div>

      <div className="mx-4 border-t border-border" />

      <div ref={containerRef} className="px-2 pt-4">
        <DropZone
          as="div"
          data-unscheduled-drop-zone="true"
          data-unscheduled-drag-over={isDragOver ? 'true' : 'false'}
          active={isDragOver}
          tone="calendar-unscheduled"
          variant="surface"
          aria-label="Unscheduled task drop zone"
          className="flex flex-col p-3"
        >
          <div className="flex flex-col gap-3">
            {tasks.map((task) => {
              const revealProps = getRevealItemProps(task.id)
              return (
                <TaskContextMenu
                  key={task.id}
                  task={task}
                  selectedDate={selectedDate}
                  onDuplicateTask={onDuplicateTask}
                  showCopyGestureHint
                  onDelete={onDelete}
                  onUpdateStatus={(taskId, status) => {
                    if (onUpdateStatus) {
                      onUpdateStatus(taskId, status)
                      return
                    }
                    onUpdateTask?.(taskId, {
                      status,
                      completed: isTaskStatusDone(status)
                    })
                  }}
                  onUpdatePriority={onUpdatePriority}
                  onUpdateTaskType={onUpdateTaskType}
                  onUpdateTime={onUpdateTime}
                  onUpdateReminders={onUpdateReminders}
                  onScheduleTask={onScheduleTask}
                  onUnscheduleTask={(taskId) => onUnscheduleTask?.(taskId)}
                >
                  <DragSource
                    as="article"
                    preview={dragPreview}
                    previewVariant="content"
                    previewSizing="fit-content"
                    ref={revealProps.ref}
                    tabIndex={0}
                    role="group"
                    aria-label={`Task ${task.title}`}
                    data-unscheduled-task-id={task.id}
                    data-unscheduled-task-title={task.title}
                    style={revealProps.style}
                    onDragStart={(e: DragEvent<HTMLElement>) => {
                      setHoveredTaskCard(null)
                      const mode = e.altKey ? 'copy' : 'move'
                      e.dataTransfer.setData('text/plain', `${mode}:${task.id}`)
                      e.dataTransfer.effectAllowed = 'copyMove'
                      setCalendarTaskDragSession({
                        taskId: task.id,
                        pointerOffsetMinutes: 0,
                        mode
                      })
                    }}
                    onDragOperationChange={(mode) => {
                      const session = getCalendarTaskDragSession()
                      if (!session || session.taskId !== task.id || session.mode === mode) {
                        return
                      }

                      setCalendarTaskDragSession({ ...session, mode })
                    }}
                    onDragEnd={() => {
                      clearCalendarTaskDragSession()
                    }}
                    onClick={() => {
                      setHoveredTaskCard(null)
                      onOpenTask?.(task.id)
                    }}
                    onMouseMove={(event) => {
                      const { x, y } = getCalendarTaskHoverPosition(event.clientX, event.clientY)
                      setHoveredTaskCard((current) => {
                        if (!current || current.task.id !== task.id) {
                          return { task, x, y }
                        }
                        return { ...current, x, y }
                      })
                    }}
                    onMouseLeave={() => setHoveredTaskCard(null)}
                    onKeyDown={(event) => {
                      if (isDeleteShortcut(event)) {
                        event.preventDefault()
                        onDelete(task.id)
                        return
                      }

                      if (event.key !== 'Enter' && event.key !== ' ') {
                        return
                      }
                      if (event.target instanceof HTMLElement && event.target.closest('button')) {
                        return
                      }

                      event.preventDefault()
                      setHoveredTaskCard(null)
                      onOpenTask?.(task.id)
                    }}
                    className={`${revealProps.className} cursor-grab rounded-md bg-card transition-colors hover:bg-muted active:cursor-grabbing ${isTaskDone(task) ? 'line-through' : ''}`}
                  >
                    <CalendarTaskCard
                      task={task}
                      project={task.projectId ? projectsById.get(task.projectId) : undefined}
                      showProject={Boolean(task.projectId)}
                      onStatusChange={(taskId, status) => onUpdateStatus?.(taskId, status)}
                    />
                  </DragSource>
                </TaskContextMenu>
              )
            })}

            {tasks.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="border bg-card text-card-foreground mb-3 flex h-12 w-12 items-center justify-center rounded-lg">
                  <CalendarPlus size={24} className="text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">
                  {hasActiveFilter
                    ? 'No unscheduled tasks match current filters'
                    : 'No unscheduled tasks'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {hasActiveFilter
                    ? 'Clear a filter to see other unscheduled tasks'
                    : 'Add a task above or drag from calendar'}
                </p>
              </div>
            )}
          </div>
        </DropZone>
      </div>
      {hoveredTaskCard ? (
        <CalendarTaskHoverCard
          task={hoveredTaskCard.task}
          project={
            hoveredTaskCard.task.projectId
              ? projectsById.get(hoveredTaskCard.task.projectId)
              : undefined
          }
          x={hoveredTaskCard.x}
          y={hoveredTaskCard.y}
        />
      ) : null}
    </div>
  )
}
