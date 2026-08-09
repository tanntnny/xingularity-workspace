import { ReactElement, useMemo, useState, DragEvent } from 'react'
import { CalendarPlus, Plus } from './ui/icons'
import {
  CalendarTask,
  CalendarTaskType,
  Project,
  TaskPriority,
  TaskReminder,
  TaskStatus
} from '../../../shared/types'
import { TaskEditDialog } from './TaskEditDialog'
import { CalendarTaskCard } from './CalendarTaskCard'
import { CalendarTaskHoverCard } from './CalendarTaskHoverCard'
import { TaskContextMenu } from './TaskContextMenu'
import { WorkspacePanelSectionHeader } from './ui/workspace-panel-section'
import { setCalendarTaskDragPreview } from '../lib/calendarTaskDragPreview'
import {
  clearCalendarTaskDragSession,
  setCalendarTaskDragSession
} from '../lib/calendarTaskDragSession'
import { getCalendarTaskHoverPosition } from '../lib/calendarTaskHoverPosition'
import { useStaggeredScrollReveal } from '../hooks/useStaggeredScrollReveal'
import { isDeleteShortcut } from '../lib/isDeleteShortcut'

interface UnscheduledTaskListProps {
  tasks: CalendarTask[]
  projects?: Project[]
  selectedDate: string
  newTaskValue: string
  onNewTaskValueChange: (value: string) => void
  onToggle: (taskId: string) => void
  onDelete: (taskId: string) => void
  onRename: (taskId: string, newTitle: string) => void
  onUpdatePriority: (taskId: string, priority: TaskPriority) => void
  onUpdateTaskType: (taskId: string, taskType: CalendarTaskType) => void
  onUpdateTaskProject?: (taskId: string, projectId: string | undefined) => void
  onUpdateStatus?: (taskId: string, status: TaskStatus) => void
  onUpdateTime: (taskId: string, time: string | undefined) => void
  onUpdateReminders: (taskId: string, reminders: TaskReminder[]) => void
  onScheduleTask: (taskId: string, date: string) => void
  onUnscheduleTask?: (taskId: string) => void
  onInsertTask: () => void
}

export function UnscheduledTaskList({
  tasks,
  projects = [],
  selectedDate,
  newTaskValue,
  onNewTaskValueChange,
  onToggle,
  onDelete,
  onRename,
  onUpdatePriority,
  onUpdateTaskType,
  onUpdateTaskProject,
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
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)

  const pendingCount = tasks.filter((t) => !t.completed).length
  const completedCount = tasks.filter((t) => t.completed).length
  const projectsById = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects]
  )
  const revealItemIds = useMemo(() => tasks.map((task) => task.id), [tasks])
  const { containerRef, getRevealItemProps } = useStaggeredScrollReveal(revealItemIds, {
    baseDelayMs: 0,
    maxStaggerSteps: 0
  })
  const editingTask = editingTaskId ? tasks.find((task) => task.id === editingTaskId) : undefined

  const handleDragOver = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setIsDragOver(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>): void => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false)
    }
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault()
    setIsDragOver(false)
    const payload = e.dataTransfer.getData('text/plain')
    const taskId = payload.startsWith('move:') ? payload.slice(5) : payload
    if (taskId && onUnscheduleTask) {
      onUnscheduleTask(taskId)
    }
  }

  return (
    <div
      data-unscheduled-task-list="true"
      data-unscheduled-drag-over={isDragOver ? 'true' : 'false'}
      className={`flex h-full flex-col overflow-hidden transition-colors ${
        isDragOver ? 'bg-accent' : 'bg-transparent'
      }`}
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
          <button
            type="button"
            onClick={onInsertTask}
            aria-label="Insert task"
            title="Insert task"
            className="border border-input bg-card text-foreground inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus size={13} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="mx-4 border-t border-border" />

      <div ref={containerRef} className="flex-1 overflow-auto px-2 pt-4">
        <div
          data-unscheduled-drop-zone="true"
          data-unscheduled-drag-over={isDragOver ? 'true' : 'false'}
          className={`flex min-h-full flex-col border p-3 transition-all ${
            isDragOver ? 'border-dashed border-ring bg-accent' : 'border-transparent'
          }`}
        >
          {isDragOver ? (
            <div className="border bg-card text-card-foreground mb-2 rounded-none px-2 py-1 text-center text-xs text-primary">
              Drop here to unschedule
            </div>
          ) : null}

          <div className="flex flex-1 flex-col gap-3">
            {tasks.map((task) => {
              const revealProps = getRevealItemProps(task.id)
              return (
                <TaskContextMenu
                  key={task.id}
                  task={task}
                  selectedDate={selectedDate}
                  onToggle={onToggle}
                  onDelete={onDelete}
                  onRename={onRename}
                  onUpdatePriority={onUpdatePriority}
                  onUpdateTaskType={onUpdateTaskType}
                  onUpdateTime={onUpdateTime}
                  onUpdateReminders={onUpdateReminders}
                  onScheduleTask={onScheduleTask}
                  onUnscheduleTask={(taskId) => onUnscheduleTask?.(taskId)}
                >
                  <article
                    ref={revealProps.ref}
                    draggable
                    tabIndex={0}
                    data-unscheduled-task-id={task.id}
                    data-unscheduled-task-title={task.title}
                    style={revealProps.style}
                    onDragStart={(e: DragEvent<HTMLElement>) => {
                      setHoveredTaskCard(null)
                      e.dataTransfer.setData('text/plain', `move:${task.id}`)
                      e.dataTransfer.effectAllowed = 'move'
                      setCalendarTaskDragSession({
                        taskId: task.id,
                        pointerOffsetMinutes: 0
                      })
                      setCalendarTaskDragPreview(e)
                    }}
                    onDragEnd={() => {
                      clearCalendarTaskDragSession()
                    }}
                    onClick={() => {
                      setHoveredTaskCard(null)
                      setEditingTaskId(task.id)
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
                      if (!isDeleteShortcut(event)) {
                        return
                      }
                      event.preventDefault()
                      onDelete(task.id)
                    }}
                    className={`${revealProps.className} cursor-grab rounded-md bg-card transition-colors hover:bg-accent active:cursor-grabbing ${task.completed ? 'line-through' : ''}`}
                  >
                    <CalendarTaskCard
                      task={task}
                      project={task.projectId ? projectsById.get(task.projectId) : undefined}
                      showProject={Boolean(task.projectId)}
                      onStatusChange={(taskId, status) => onUpdateStatus?.(taskId, status)}
                    />
                  </article>
                </TaskContextMenu>
              )
            })}

            {tasks.length === 0 && (
              <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
                <div className="border bg-card text-card-foreground mb-3 flex h-12 w-12 items-center justify-center rounded-lg">
                  <CalendarPlus size={24} className="text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">No unscheduled tasks</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Add a task above or drag from calendar
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
      {hoveredTaskCard ? (
        <CalendarTaskHoverCard
          task={hoveredTaskCard.task}
          x={hoveredTaskCard.x}
          y={hoveredTaskCard.y}
        />
      ) : null}
      {editingTask ? (
        <TaskEditDialog
          task={editingTask}
          projects={projects}
          onClose={() => setEditingTaskId(null)}
          onSave={(taskId, patch) => {
            if (patch.title) onRename(taskId, patch.title)
            if (patch.priority) onUpdatePriority(taskId, patch.priority)
            if (patch.taskType) onUpdateTaskType(taskId, patch.taskType)
            if (patch.status) onUpdateStatus?.(taskId, patch.status)
            if ('projectId' in patch) onUpdateTaskProject?.(taskId, patch.projectId)
            if ('date' in patch || 'time' in patch) {
              if (patch.date) {
                onScheduleTask(taskId, patch.date)
              } else {
                onUnscheduleTask?.(taskId)
              }
              onUpdateTime(taskId, patch.time)
            } else {
              if ('endDate' in patch && patch.endDate) {
                onScheduleTask(taskId, patch.endDate)
              }
            }
          }}
          onDelete={onDelete}
        />
      ) : null}
    </div>
  )
}
