import { ReactElement, useState, DragEvent } from 'react'
import { CalendarPlus, Plus } from 'lucide-react'
import { CalendarTask, CalendarTaskType, TaskReminder } from '../../../shared/types'
import { CalendarTaskCard } from './CalendarTaskCard'
import { TaskContextMenu } from './TaskContextMenu'
import { isDeleteShortcut } from './ui/context-menu'
import { WorkspacePanelSectionHeader } from './ui/workspace-panel-section'

interface UnscheduledTaskListProps {
  tasks: CalendarTask[]
  selectedDate: string
  newTaskValue: string
  onNewTaskValueChange: (value: string) => void
  onToggle: (taskId: string) => void
  onDelete: (taskId: string) => void
  onRename: (taskId: string, newTitle: string) => void
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
  onUpdateTaskType,
  onUpdateTime,
  onUpdateReminders,
  onScheduleTask,
  onUnscheduleTask,
  onInsertTask
}: UnscheduledTaskListProps): ReactElement {
  const [isDragOver, setIsDragOver] = useState(false)

  const pendingCount = tasks.filter((t) => !t.completed).length
  const completedCount = tasks.filter((t) => t.completed).length

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
      className={`flex h-full flex-col overflow-hidden transition-colors ${
        isDragOver ? 'bg-[var(--accent-soft)]/40' : 'bg-[var(--panel)]'
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
            className="h-8 min-w-0 flex-1 rounded-md border border-[var(--line)] bg-[var(--panel-2)] px-2.5 text-sm text-[var(--text)] outline-none"
          />
          <button
            type="button"
            onClick={onInsertTask}
            aria-label="Insert task"
            title="Insert task"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--line)] bg-[var(--panel-2)] text-[var(--text)] transition-colors hover:border-[var(--accent)]"
          >
            <Plus size={13} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="mx-4 border-t border-[var(--line)]" />

      <div className="flex-1 overflow-auto px-4 py-3">
        <div
          className={`rounded-xl border p-2 transition-all ${
            isDragOver
              ? 'border-dashed border-[var(--accent)] bg-[var(--accent-soft)]/50'
              : 'border-transparent'
          }`}
        >
          {isDragOver ? (
            <div className="mb-2 rounded-md bg-[var(--panel)] px-2 py-1 text-center text-[11px] text-[var(--accent)]">
              Drop here to unschedule
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            {tasks.map((task) => (
              <TaskContextMenu
                key={task.id}
                task={task}
                selectedDate={selectedDate}
                onToggle={onToggle}
                onDelete={onDelete}
                onRename={onRename}
                onUpdateTaskType={onUpdateTaskType}
                onUpdateTime={onUpdateTime}
                onUpdateReminders={onUpdateReminders}
                onScheduleTask={onScheduleTask}
                onUnscheduleTask={(taskId) => onUnscheduleTask?.(taskId)}
              >
                <article
                  draggable
                  tabIndex={0}
                  data-unscheduled-task-id={task.id}
                  data-unscheduled-task-title={task.title}
                  onDragStart={(e: DragEvent<HTMLElement>) => {
                    e.dataTransfer.setData('text/plain', `move:${task.id}`)
                    e.dataTransfer.effectAllowed = 'move'
                  }}
                  onKeyDown={(event) => {
                    if (!isDeleteShortcut(event)) {
                      return
                    }
                    event.preventDefault()
                    onDelete(task.id)
                  }}
                  className={`beacon-task-surface beacon-task-event beacon-task-${task.taskType || 'assignment'} ${
                    task.completed ? 'beacon-task-completed' : ''
                  } cursor-grab rounded-md border transition-shadow active:cursor-grabbing`}
                >
                  <CalendarTaskCard task={task} onToggle={onToggle} />
                </article>
              </TaskContextMenu>
            ))}

            {tasks.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--panel-2)]">
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
    </div>
  )
}
