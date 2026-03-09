import { ReactElement, useState, useRef, useEffect, DragEvent } from 'react'
import { Check, Trash2, Flag, Plus, Pencil, CalendarPlus } from 'lucide-react'
import { CalendarTask, TaskPriority } from '../../../shared/types'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger
} from './ui/context-menu'

const PRIORITY_CONFIG: Record<
  TaskPriority,
  { label: string; color: string; bg: string; border: string }
> = {
  high: {
    label: 'High',
    color: '#ef4444',
    bg: 'bg-red-50 dark:bg-red-950/30',
    border: 'border-red-200 dark:border-red-800/50'
  },
  medium: {
    label: 'Medium',
    color: '#f59e0b',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-800/50'
  },
  low: {
    label: 'Low',
    color: '#22c55e',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    border: 'border-emerald-200 dark:border-emerald-800/50'
  }
}

interface UnscheduledTaskListProps {
  tasks: CalendarTask[]
  onToggle: (taskId: string) => void
  onDelete: (taskId: string) => void
  onRename: (taskId: string, newTitle: string) => void
  onUpdatePriority: (taskId: string, priority: TaskPriority) => void
  onCreate: (title: string) => void
}

export function UnscheduledTaskList({
  tasks,
  onToggle,
  onDelete,
  onRename,
  onUpdatePriority,
  onCreate
}: UnscheduledTaskListProps): ReactElement {
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [priorityMenuTaskId, setPriorityMenuTaskId] = useState<string | null>(null)
  const editInputRef = useRef<HTMLInputElement>(null)
  const priorityMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (editingTaskId && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [editingTaskId])

  // Close priority menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      if (priorityMenuRef.current && !priorityMenuRef.current.contains(event.target as Node)) {
        setPriorityMenuTaskId(null)
      }
    }

    if (priorityMenuTaskId) {
      document.addEventListener('mousedown', handleClickOutside)
      return (): void => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
    return undefined
  }, [priorityMenuTaskId])

  const startEditing = (task: CalendarTask): void => {
    setEditingTaskId(task.id)
    setEditingValue(task.title)
  }

  const commitEdit = (): void => {
    if (editingTaskId && editingValue.trim()) {
      onRename(editingTaskId, editingValue.trim())
    }
    setEditingTaskId(null)
    setEditingValue('')
  }

  const cancelEdit = (): void => {
    setEditingTaskId(null)
    setEditingValue('')
  }

  const handleCreateTask = (): void => {
    const title = newTaskTitle.trim()
    if (title) {
      onCreate(title)
      setNewTaskTitle('')
    }
  }

  const pendingCount = tasks.filter((t) => !t.completed).length
  const completedCount = tasks.filter((t) => t.completed).length

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[var(--panel)]">
      {/* Header */}
      <div className="shrink-0 px-4 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent-soft)]">
            <CalendarPlus size={16} className="text-[var(--accent)]" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[var(--text)]">Unscheduled</h2>
            <p className="text-xs text-[var(--muted)]">
              {pendingCount} pending{completedCount > 0 && ` · ${completedCount} done`}
            </p>
          </div>
        </div>
      </div>

      {/* Add task input */}
      <div className="shrink-0 px-4 pb-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleCreateTask()
              }
            }}
            placeholder="Add a task..."
            className="flex-1 rounded-xl border border-[var(--line)] bg-[var(--panel-2)] px-3 py-2.5 text-sm text-[var(--text)] placeholder-[var(--muted)] outline-none transition-colors focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
          />
          <button
            type="button"
            onClick={handleCreateTask}
            disabled={!newTaskTitle.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] text-white shadow-sm transition-all hover:bg-[var(--accent)]/90 hover:shadow-md disabled:opacity-50 disabled:shadow-none disabled:hover:bg-[var(--accent)]"
            title="Add task"
          >
            <Plus size={18} />
          </button>
        </div>
        <p className="mt-2 text-center text-[11px] text-[var(--muted)]">
          Drag tasks to the calendar to schedule
        </p>
      </div>

      {/* Divider */}
      <div className="mx-4 border-t border-[var(--line)]" />

      {/* Task list */}
      <div className="flex-1 overflow-auto px-4 py-3">
        <div className="flex flex-col gap-2">
          {tasks.map((task) => {
            const isEditing = editingTaskId === task.id
            const priorityConfig = PRIORITY_CONFIG[task.priority || 'medium']
            const showPriorityMenu = priorityMenuTaskId === task.id

            return (
              <ContextMenu key={task.id}>
                <ContextMenuTrigger asChild>
                  <article
                    draggable
                    onDragStart={(e: DragEvent<HTMLElement>) => {
                      e.dataTransfer.setData('text/plain', task.id)
                      e.dataTransfer.effectAllowed = 'move'
                    }}
                    className={`group flex w-full cursor-grab items-start gap-3 rounded-xl border p-3 shadow-sm transition-all duration-150 active:cursor-grabbing active:shadow-md ${
                      task.completed
                        ? 'border-[var(--line)] bg-[var(--panel-2)] opacity-60'
                        : `${priorityConfig.bg} ${priorityConfig.border} hover:shadow-md`
                    }`}
                  >
                    {/* Checkbox */}
                    <button
                      type="button"
                      onClick={() => onToggle(task.id)}
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                        task.completed
                          ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                          : 'border-[var(--line-strong)] bg-[var(--panel)] hover:border-[var(--accent)] hover:scale-110'
                      }`}
                      title={task.completed ? 'Mark as pending' : 'Mark as complete'}
                    >
                      {task.completed ? <Check size={12} strokeWidth={3} /> : null}
                    </button>

                    {/* Task content */}
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      {isEditing ? (
                        <input
                          ref={editInputRef}
                          type="text"
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onBlur={commitEdit}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              commitEdit()
                            } else if (e.key === 'Escape') {
                              cancelEdit()
                            }
                          }}
                          className="w-full rounded-lg border border-[var(--accent-line)] bg-[var(--panel)] px-2 py-1 text-sm font-medium text-[var(--text)] outline-none"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEditing(task)}
                          className={`truncate text-left text-sm font-medium text-[var(--text)] transition-colors hover:text-[var(--accent)] ${
                            task.completed ? 'line-through' : ''
                          }`}
                          title="Click to edit"
                        >
                          {task.title}
                        </button>
                      )}

                      {/* Priority badge */}
                      <div className="relative inline-flex">
                        <button
                          type="button"
                          onClick={() => setPriorityMenuTaskId(showPriorityMenu ? null : task.id)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--panel)] px-2 py-0.5 text-[11px] font-medium text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--text)]"
                          title="Change priority"
                        >
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: priorityConfig.color }}
                          />
                          {priorityConfig.label}
                        </button>
                        {showPriorityMenu && (
                          <div
                            ref={priorityMenuRef}
                            className="absolute left-0 top-full z-10 mt-1 w-28 rounded-xl border border-[var(--line)] bg-[var(--panel)] py-1 shadow-lg"
                          >
                            {(['high', 'medium', 'low'] as TaskPriority[]).map((priority) => {
                              const config = PRIORITY_CONFIG[priority]
                              return (
                                <button
                                  key={priority}
                                  type="button"
                                  onClick={() => {
                                    onUpdatePriority(task.id, priority)
                                    setPriorityMenuTaskId(null)
                                  }}
                                  className={`flex w-full items-center gap-2 px-3 py-2 text-xs font-medium transition-colors hover:bg-[var(--panel-2)] ${
                                    task.priority === priority
                                      ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                                      : 'text-[var(--text)]'
                                  }`}
                                >
                                  <span
                                    className="h-2 w-2 rounded-full"
                                    style={{ backgroundColor: config.color }}
                                  />
                                  {config.label}
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Delete button - visible on hover */}
                    <button
                      type="button"
                      onClick={() => onDelete(task.id)}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-transparent bg-transparent text-[var(--muted)] opacity-0 transition-all hover:border-red-300 hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 dark:hover:border-red-800 dark:hover:bg-red-950/30"
                      title="Delete task"
                    >
                      <Trash2 size={14} />
                    </button>
                  </article>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem onClick={() => startEditing(task)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Rename
                  </ContextMenuItem>
                  <ContextMenuSub>
                    <ContextMenuSubTrigger>
                      <Flag className="mr-2 h-4 w-4" />
                      Set priority
                    </ContextMenuSubTrigger>
                    <ContextMenuSubContent>
                      {(['high', 'medium', 'low'] as TaskPriority[]).map((priority) => {
                        const config = PRIORITY_CONFIG[priority]
                        return (
                          <ContextMenuItem
                            key={priority}
                            onClick={() => onUpdatePriority(task.id, priority)}
                          >
                            <span
                              className="mr-2 h-2 w-2 rounded-full"
                              style={{ backgroundColor: config.color }}
                            />
                            {config.label}
                            {task.priority === priority && <Check className="ml-auto h-4 w-4" />}
                          </ContextMenuItem>
                        )
                      })}
                    </ContextMenuSubContent>
                  </ContextMenuSub>
                  <ContextMenuSeparator />
                  <ContextMenuItem
                    onClick={() => onDelete(task.id)}
                    className="text-red-500 focus:text-red-500"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            )
          })}

          {/* Empty state */}
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
  )
}
