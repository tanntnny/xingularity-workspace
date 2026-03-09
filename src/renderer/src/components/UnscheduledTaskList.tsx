import { ReactElement, useState, useRef, useEffect, DragEvent } from 'react'
import { Check, Circle, Trash2, Flag, Plus, Pencil } from 'lucide-react'
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

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string }> = {
  high: { label: 'High', color: '#ef4444' },
  medium: { label: 'Medium', color: '#f59e0b' },
  low: { label: 'Low', color: '#22c55e' }
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

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-[var(--line)] px-4 py-3">
        <h2 className="text-base font-semibold text-[var(--text)]">Unscheduled Tasks</h2>
        <p className="mt-0.5 text-xs text-[var(--muted)]">
          {pendingCount} pending · Drag to calendar to schedule
        </p>
      </div>

      {/* Add task input */}
      <div className="shrink-0 border-b border-[var(--line)] px-4 py-3">
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
            placeholder="Add a new task..."
            className="flex-1 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--muted)] outline-none focus:border-[var(--accent)]"
          />
          <button
            type="button"
            onClick={handleCreateTask}
            disabled={!newTaskTitle.trim()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--accent)] transition-colors hover:bg-[var(--accent)] hover:text-white disabled:opacity-50 disabled:hover:bg-[var(--accent-soft)] disabled:hover:text-[var(--accent)]"
            title="Add task"
          >
            <Plus size={18} />
          </button>
        </div>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-auto p-3">
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
                    className={`flex w-full cursor-grab items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors active:cursor-grabbing ${
                      task.completed
                        ? 'border-[var(--line)] bg-[var(--panel-2)] opacity-60'
                        : 'border-[var(--line)] bg-[var(--panel-2)] hover:border-[var(--accent)]'
                    }`}
                  >
                    {/* Checkbox */}
                    <button
                      type="button"
                      onClick={() => onToggle(task.id)}
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                        task.completed
                          ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                          : 'border-[var(--line)] bg-[var(--panel)] hover:border-[var(--accent)]'
                      }`}
                      title={task.completed ? 'Mark as pending' : 'Mark as complete'}
                    >
                      {task.completed ? <Check size={12} /> : <Circle size={12} />}
                    </button>

                    {/* Task content */}
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
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
                          className="w-full rounded-md border border-[var(--accent-line)] bg-[var(--panel)] px-2 py-1 text-sm font-medium text-[var(--text)] outline-none"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEditing(task)}
                          className={`truncate text-left text-sm font-medium text-[var(--text)] hover:text-[var(--accent)] ${
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
                          className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--panel)] px-2 py-0.5 text-[11px] text-[var(--muted)] hover:border-[var(--accent)]"
                          title="Change priority"
                        >
                          <Flag size={10} style={{ color: priorityConfig.color }} />
                          {priorityConfig.label}
                        </button>
                        {showPriorityMenu && (
                          <div
                            ref={priorityMenuRef}
                            className="absolute left-0 top-full z-10 mt-1 w-24 rounded-lg border border-[var(--line)] bg-[var(--panel)] py-1 shadow-lg"
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
                                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-[var(--panel-2)] ${
                                    task.priority === priority ? 'bg-[var(--accent-soft)]' : ''
                                  }`}
                                >
                                  <Flag size={10} style={{ color: config.color }} />
                                  {config.label}
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={() => onDelete(task.id)}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-[var(--line)] bg-[var(--panel)] text-[var(--muted)] hover:border-red-400 hover:text-red-500"
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
                            <Flag className="mr-2 h-4 w-4" style={{ color: config.color }} />
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
            <div className="py-8 text-center text-sm text-[var(--muted)]">
              No unscheduled tasks. Add one above or drag tasks here from the calendar.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
