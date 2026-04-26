import { ReactElement, useMemo, useState, DragEvent } from 'react'
import { CalendarPlus, Plus } from 'lucide-react'
import { CalendarTask, CalendarTaskType, TaskPriority, TaskReminder } from '../../../shared/types'
import { TaskEditDialog } from './CalendarMonthView'
import { CalendarTaskCard } from './CalendarTaskCard'
import { CalendarTaskHoverCard } from './CalendarTaskHoverCard'
import { TaskContextMenu } from './TaskContextMenu'
import { isDeleteShortcut } from './ui/context-menu'
import { WorkspacePanelSectionHeader } from './ui/workspace-panel-section'
import { getCalendarTaskHoverPosition } from '../lib/calendarTaskHoverPosition'
import { useStaggeredScrollReveal } from '../hooks/useStaggeredScrollReveal'

interface UnscheduledTaskListProps {
  tasks: CalendarTask[]
  selectedDate: string
  newTaskValue: string
  onNewTaskValueChange: (value: string) => void
  onToggle: (taskId: string) => void
  onDelete: (taskId: string) => void
  onRename: (taskId: string, newTitle: string) => void
  onUpdatePriority: (taskId: string, priority: TaskPriority) => void
  onUpdateTaskType: (taskId: string, taskType: CalendarTaskType) => void
  onUpdateTime: (taskId: string, time: string | undefined) => void
  onUpdateReminders: (taskId: string, reminders: TaskReminder[]) => void
  onScheduleTask: (taskId: string, date: string) => void
  onUnscheduleTask?: (taskId: string) => void
  onInsertTask: () => void
}

export function UnscheduledTaskList({
  tasks,
  selectedDate,
  newTaskValue,
  onNewTaskValueChange,
  onToggle,
  onDelete,
  onRename,
  onUpdatePriority,
  onUpdateTaskType,
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
  const revealItemIds = useMemo(() => tasks.map((task) => task.id), [tasks])
  const { containerRef, getRevealItemProps } = useStaggeredScrollReveal(revealItemIds)
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
        isDragOver
          ? 'bg-[color:color-mix(in_srgb,var(--accent)_10%,transparent)]'
          : 'workspace-clear-surface'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="shrink-0 px-4 py-4">
        <WorkspacePanelSectionHeader
          icon={<CalendarPlus size={16} aria-hidden="true" />}
          heading="Unscheduled"
          description={`${pendingCount} pending${completedCount > 0 ? ` · ${completedCount} done` : ''}`}
        />
      </div>

      <div className="shrink-0 px-4 pb-3">
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
            className="workspace-subtle-control h-8 min-w-0 flex-1 rounded-md border border-[var(--line)] px-2.5 text-sm text-[var(--text)] outline-none hover:border-[var(--accent)] focus:border-[var(--accent)] transition"
          />
          <button
            type="button"
            onClick={onInsertTask}
            aria-label="Insert task"
            title="Insert task"
            className="workspace-subtle-control inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--line)] text-[var(--text)] transition-colors"
          >
            <Plus size={13} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="mx-4 border-t border-[var(--line)]" />

      <div ref={containerRef} className="flex-1 overflow-auto px-4 py-3">
        <div
          data-unscheduled-drop-zone="true"
          data-unscheduled-drag-over={isDragOver ? 'true' : 'false'}
          className={`flex min-h-full flex-col border p-2 transition-all ${
            isDragOver
              ? 'border-dashed border-[color:color-mix(in_srgb,var(--accent)_72%,transparent)] bg-[color:color-mix(in_srgb,var(--accent)_16%,transparent)]'
              : 'border-transparent'
          }`}
        >
          {isDragOver ? (
            <div className="workspace-subtle-surface mb-2 rounded-none px-2 py-1 text-center text-[11px] text-[var(--accent)]">
              Drop here to unschedule
            </div>
          ) : null}

          <div className="flex flex-1 flex-col gap-2">
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
                      const dragPreview = e.currentTarget.cloneNode(true)
                      if (dragPreview instanceof HTMLElement) {
                        const rect = e.currentTarget.getBoundingClientRect()
                        dragPreview.style.position = 'fixed'
                        dragPreview.style.top = '-9999px'
                        dragPreview.style.left = '-9999px'
                        dragPreview.style.width = `${rect.width}px`
                        dragPreview.style.pointerEvents = 'none'
                        dragPreview.style.transform = 'none'
                        dragPreview.style.opacity = '1'
                        dragPreview.classList.add('calendar-task-drag-preview')
                        document.body.appendChild(dragPreview)
                        e.dataTransfer.setDragImage(
                          dragPreview,
                          e.clientX - rect.left,
                          e.clientY - rect.top
                        )
                        window.setTimeout(() => dragPreview.remove(), 0)
                      }
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
                    className={`${revealProps.className} calendar-task-card-shell beacon-task-surface beacon-task-event beacon-task-${task.taskType || 'assignment'} ${
                      task.completed ? 'beacon-task-completed' : ''
                    } cursor-grab rounded-md border transition-shadow active:cursor-grabbing`}
                  >
                    <CalendarTaskCard task={task} onToggle={onToggle} />
                  </article>
                </TaskContextMenu>
              )
            })}

            {tasks.length === 0 && (
              <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
                <div className="workspace-subtle-surface mb-3 flex h-12 w-12 items-center justify-center rounded-2xl">
                  <CalendarPlus size={24} className="text-[var(--muted)]" />
                </div>
                <p className="text-sm font-medium text-[var(--text)]">No unscheduled tasks</p>
                <p className="mt-1 text-xs text-[var(--muted)]">
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
          onClose={() => setEditingTaskId(null)}
          onRename={onRename}
          onUpdateTaskPriority={onUpdatePriority}
          onUpdateTaskType={onUpdateTaskType}
          onUpdateTaskTime={onUpdateTime}
          onRescheduleTask={(taskId, date) => {
            if (date) {
              onScheduleTask(taskId, date)
              return
            }
            onUnscheduleTask?.(taskId)
          }}
          onDelete={onDelete}
        />
      ) : null}
    </div>
  )
}
