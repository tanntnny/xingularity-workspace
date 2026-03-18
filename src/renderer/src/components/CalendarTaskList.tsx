import { ReactElement, useMemo, useState, useRef, useEffect, DragEvent } from 'react'
import {
  ArrowDown,
  ArrowUp,
  Check,
  Circle,
  Trash2,
  Flag,
  Target,
  ListTodo,
  Bell,
  BellRing,
  Pencil,
  Plus,
  X,
  Clock
} from 'lucide-react'
import { CalendarTask, CalendarItem, TaskPriority, TaskReminder } from '../../../shared/types'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuDestructiveItem,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
  isDeleteShortcut
} from './ui/context-menu'

type TaskFilterMode = 'all' | 'pending' | 'completed'
type ItemTypeFilter = 'all' | 'tasks' | 'milestones' | 'subtasks'
type TaskSortField = 'name' | 'created' | 'status' | 'priority' | 'type'
type TaskSortDirection = 'asc' | 'desc'

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; sortOrder: number }> = {
  high: { label: 'High', color: '#ef4444', sortOrder: 1 },
  medium: { label: 'Medium', color: '#f59e0b', sortOrder: 2 },
  low: { label: 'Low', color: '#22c55e', sortOrder: 3 }
}

const TYPE_SORT_ORDER = { task: 1, milestone: 2, subtask: 3 }

interface CalendarTaskListProps {
  selectedDate: string
  tasks: CalendarTask[]
  calendarItems: CalendarItem[]
  filter: string
  onToggle: (taskId: string) => void
  onDelete: (taskId: string) => void
  onRename: (taskId: string, newTitle: string) => void
  onUpdatePriority: (taskId: string, priority: TaskPriority) => void
  onUpdateTime: (taskId: string, time: string | undefined) => void
  onUpdateReminders: (taskId: string, reminders: TaskReminder[]) => void
  onToggleMilestone?: (projectId: string, milestoneId: string) => void
  onToggleSubtask?: (projectId: string, milestoneId: string, subtaskId: string) => void
}

export function CalendarTaskList({
  selectedDate,
  tasks,
  calendarItems,
  filter,
  onToggle,
  onDelete,
  onRename,
  onUpdatePriority,
  onUpdateTime,
  onUpdateReminders,
  onToggleMilestone,
  onToggleSubtask
}: CalendarTaskListProps): ReactElement {
  const neutralChipClass =
    'inline-flex min-w-0 shrink-0 items-center gap-1 rounded-full border border-[var(--tag-neutral-line)] bg-[var(--tag-neutral-bg)] px-2 py-0.5 text-xs leading-[1.2] text-[var(--tag-neutral-text)]'

  const [filterMode, setFilterMode] = useState<TaskFilterMode>('all')
  const [itemTypeFilter, setItemTypeFilter] = useState<ItemTypeFilter>('all')
  const [sortField, setSortField] = useState<TaskSortField>('created')
  const [sortDirection, setSortDirection] = useState<TaskSortDirection>('desc')
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [priorityMenuTaskId, setPriorityMenuTaskId] = useState<string | null>(null)
  const [reminderMenuTaskId, setReminderMenuTaskId] = useState<string | null>(null)
  const [timeEditingTaskId, setTimeEditingTaskId] = useState<string | null>(null)
  const [newReminderValue, setNewReminderValue] = useState<number>(30)
  const [newReminderType, setNewReminderType] = useState<'minutes' | 'hours' | 'days'>('minutes')
  const editInputRef = useRef<HTMLInputElement>(null)
  const priorityMenuRef = useRef<HTMLDivElement>(null)
  const reminderMenuRef = useRef<HTMLDivElement>(null)

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

  // Close reminder menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      if (reminderMenuRef.current && !reminderMenuRef.current.contains(event.target as Node)) {
        setReminderMenuTaskId(null)
      }
    }

    if (reminderMenuTaskId) {
      document.addEventListener('mousedown', handleClickOutside)
      return (): void => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
    return undefined
  }, [reminderMenuTaskId])

  // Helper to generate unique ID for reminders
  const generateReminderId = (): string => {
    return `reminder-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  }

  // Helper to format reminder for display
  const formatReminder = (reminder: TaskReminder): string => {
    const { value, type } = reminder
    const unit = value === 1 ? type.slice(0, -1) : type // Remove 's' for singular
    return `${value} ${unit} before`
  }

  // Add a new reminder to a task
  const handleAddReminder = (taskId: string, task: CalendarTask): void => {
    const newReminder: TaskReminder = {
      id: generateReminderId(),
      type: newReminderType,
      value: newReminderValue,
      enabled: true
    }
    onUpdateReminders(taskId, [...(task.reminders || []), newReminder])
    // Reset form
    setNewReminderValue(30)
    setNewReminderType('minutes')
  }

  // Remove a reminder from a task
  const handleRemoveReminder = (taskId: string, reminderId: string, task: CalendarTask): void => {
    const updatedReminders = (task.reminders || []).filter((r) => r.id !== reminderId)
    onUpdateReminders(taskId, updatedReminders)
  }

  // Toggle reminder enabled/disabled
  const handleToggleReminder = (taskId: string, reminderId: string, task: CalendarTask): void => {
    const updatedReminders = (task.reminders || []).map((r) =>
      r.id === reminderId ? { ...r, enabled: !r.enabled } : r
    )
    onUpdateReminders(taskId, updatedReminders)
  }

  // Filter and sort tasks
  const filteredTasks = useMemo(() => {
    if (itemTypeFilter !== 'all' && itemTypeFilter !== 'tasks') {
      return []
    }

    const query = filter.trim().toLowerCase()
    const base = [...tasks]

    const byStatusMode =
      filterMode === 'pending'
        ? base.filter((task) => !task.completed)
        : filterMode === 'completed'
          ? base.filter((task) => task.completed)
          : base

    const byQuery =
      query.length > 0
        ? byStatusMode.filter((task) => task.title.toLowerCase().includes(query))
        : byStatusMode

    const sorted = [...byQuery]
    if (sortField === 'status') {
      sorted.sort((a, b) => {
        if (a.completed === b.completed) {
          return sortDirection === 'asc'
            ? a.createdAt.localeCompare(b.createdAt)
            : b.createdAt.localeCompare(a.createdAt)
        }
        if (sortDirection === 'asc') {
          return a.completed ? 1 : -1
        }
        return a.completed ? -1 : 1
      })
      return sorted
    }

    if (sortField === 'priority') {
      sorted.sort((a, b) => {
        const priorityA = PRIORITY_CONFIG[a.priority || 'medium'].sortOrder
        const priorityB = PRIORITY_CONFIG[b.priority || 'medium'].sortOrder
        if (priorityA === priorityB) {
          return sortDirection === 'asc'
            ? a.createdAt.localeCompare(b.createdAt)
            : b.createdAt.localeCompare(a.createdAt)
        }
        return sortDirection === 'asc' ? priorityA - priorityB : priorityB - priorityA
      })
      return sorted
    }

    if (sortField === 'created') {
      sorted.sort((a, b) =>
        sortDirection === 'asc'
          ? a.createdAt.localeCompare(b.createdAt)
          : b.createdAt.localeCompare(a.createdAt)
      )
      return sorted
    }

    sorted.sort((a, b) =>
      sortDirection === 'asc' ? a.title.localeCompare(b.title) : b.title.localeCompare(a.title)
    )
    return sorted
  }, [filter, tasks, filterMode, itemTypeFilter, sortField, sortDirection])

  // Filter milestones and subtasks from calendarItems
  const filteredProjectItems = useMemo(() => {
    const query = filter.trim().toLowerCase()

    let items = calendarItems.filter((item) => item.type === 'milestone' || item.type === 'subtask')

    // Filter by item type
    if (itemTypeFilter === 'milestones') {
      items = items.filter((item) => item.type === 'milestone')
    } else if (itemTypeFilter === 'subtasks') {
      items = items.filter((item) => item.type === 'subtask')
    } else if (itemTypeFilter === 'tasks') {
      items = []
    }

    // Filter by status
    if (filterMode === 'pending') {
      items = items.filter((item) => !item.completed)
    } else if (filterMode === 'completed') {
      items = items.filter((item) => item.completed)
    }

    // Filter by query
    if (query.length > 0) {
      items = items.filter(
        (item) =>
          item.title.toLowerCase().includes(query) ||
          item.projectName?.toLowerCase().includes(query)
      )
    }

    // Sort
    if (sortField === 'type') {
      items.sort((a, b) => {
        const orderA = TYPE_SORT_ORDER[a.type]
        const orderB = TYPE_SORT_ORDER[b.type]
        return sortDirection === 'asc' ? orderA - orderB : orderB - orderA
      })
    } else if (sortField === 'name') {
      items.sort((a, b) =>
        sortDirection === 'asc' ? a.title.localeCompare(b.title) : b.title.localeCompare(a.title)
      )
    } else if (sortField === 'status') {
      items.sort((a, b) => {
        if (a.completed === b.completed) return 0
        if (sortDirection === 'asc') return a.completed ? 1 : -1
        return a.completed ? -1 : 1
      })
    }

    return items
  }, [calendarItems, filter, filterMode, itemTypeFilter, sortField, sortDirection])

  const toggleSort = (field: TaskSortField): void => {
    if (sortField === field) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
      return
    }

    setSortField(field)
    setSortDirection(field === 'name' ? 'asc' : 'desc')
  }

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

  const formatDateLabel = (isoString: string): string => {
    const date = new Date(isoString)
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }

  const pendingCount = tasks.filter((t) => !t.completed).length
  const completedCount = tasks.filter((t) => t.completed).length
  const milestonesCount = calendarItems.filter((i) => i.type === 'milestone').length
  const subtasksCount = calendarItems.filter((i) => i.type === 'subtask').length
  const totalItems = tasks.length + milestonesCount + subtasksCount

  return (
    <div className="flex h-full flex-col gap-2.5 overflow-auto p-3">
      {/* Item type filter */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="px-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
          Show
        </span>
        <button
          type="button"
          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
            itemTypeFilter === 'all'
              ? 'border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--text)]'
              : 'border-[var(--line)] bg-[var(--panel)] text-[var(--muted)] hover:border-[var(--accent)]'
          }`}
          onClick={() => setItemTypeFilter('all')}
        >
          All ({totalItems})
        </button>
        <button
          type="button"
          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
            itemTypeFilter === 'tasks'
              ? 'border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--text)]'
              : 'border-[var(--line)] bg-[var(--panel)] text-[var(--muted)] hover:border-[var(--accent)]'
          }`}
          onClick={() => setItemTypeFilter('tasks')}
        >
          Tasks ({tasks.length})
        </button>
        <button
          type="button"
          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
            itemTypeFilter === 'milestones'
              ? 'border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--text)]'
              : 'border-[var(--line)] bg-[var(--panel)] text-[var(--muted)] hover:border-[var(--accent)]'
          }`}
          onClick={() => setItemTypeFilter('milestones')}
        >
          <Target size={12} />
          Milestones ({milestonesCount})
        </button>
        <button
          type="button"
          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
            itemTypeFilter === 'subtasks'
              ? 'border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--text)]'
              : 'border-[var(--line)] bg-[var(--panel)] text-[var(--muted)] hover:border-[var(--accent)]'
          }`}
          onClick={() => setItemTypeFilter('subtasks')}
        >
          <ListTodo size={12} />
          Subtasks ({subtasksCount})
        </button>
      </div>

      {/* Status filter */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="px-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
          Filter
        </span>
        <button
          type="button"
          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
            filterMode === 'all'
              ? 'border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--text)]'
              : 'border-[var(--line)] bg-[var(--panel)] text-[var(--muted)] hover:border-[var(--accent)]'
          }`}
          onClick={() => setFilterMode('all')}
        >
          All ({tasks.length + calendarItems.filter((i) => i.type !== 'task').length})
        </button>
        <button
          type="button"
          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
            filterMode === 'pending'
              ? 'border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--text)]'
              : 'border-[var(--line)] bg-[var(--panel)] text-[var(--muted)] hover:border-[var(--accent)]'
          }`}
          onClick={() => setFilterMode('pending')}
        >
          Pending ({pendingCount + calendarItems.filter((i) => !i.completed).length})
        </button>
        <button
          type="button"
          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
            filterMode === 'completed'
              ? 'border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--text)]'
              : 'border-[var(--line)] bg-[var(--panel)] text-[var(--muted)] hover:border-[var(--accent)]'
          }`}
          onClick={() => setFilterMode('completed')}
        >
          Completed ({completedCount + calendarItems.filter((i) => i.completed).length})
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="px-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
          Sort
        </span>
        <button
          type="button"
          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
            sortField === 'name'
              ? 'border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--text)]'
              : 'border-[var(--line)] bg-[var(--panel)] text-[var(--muted)] hover:border-[var(--accent)]'
          }`}
          onClick={() => toggleSort('name')}
        >
          {sortField === 'name' && sortDirection === 'desc' ? (
            <ArrowDown size={12} aria-hidden="true" />
          ) : (
            <ArrowUp size={12} aria-hidden="true" />
          )}
          Name
        </button>
        <button
          type="button"
          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
            sortField === 'created'
              ? 'border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--text)]'
              : 'border-[var(--line)] bg-[var(--panel)] text-[var(--muted)] hover:border-[var(--accent)]'
          }`}
          onClick={() => toggleSort('created')}
        >
          {sortField === 'created' && sortDirection === 'asc' ? (
            <ArrowUp size={12} aria-hidden="true" />
          ) : (
            <ArrowDown size={12} aria-hidden="true" />
          )}
          Created
        </button>
        <button
          type="button"
          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
            sortField === 'status'
              ? 'border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--text)]'
              : 'border-[var(--line)] bg-[var(--panel)] text-[var(--muted)] hover:border-[var(--accent)]'
          }`}
          onClick={() => toggleSort('status')}
        >
          {sortField === 'status' && sortDirection === 'asc' ? (
            <ArrowUp size={12} aria-hidden="true" />
          ) : (
            <ArrowDown size={12} aria-hidden="true" />
          )}
          Status
        </button>
        <button
          type="button"
          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
            sortField === 'priority'
              ? 'border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--text)]'
              : 'border-[var(--line)] bg-[var(--panel)] text-[var(--muted)] hover:border-[var(--accent)]'
          }`}
          onClick={() => toggleSort('priority')}
        >
          {sortField === 'priority' && sortDirection === 'desc' ? (
            <ArrowDown size={12} aria-hidden="true" />
          ) : (
            <ArrowUp size={12} aria-hidden="true" />
          )}
          Priority
        </button>
      </div>
      <h2 className="text-lg font-semibold text-[var(--text)]">
        Items for {formatCalendarDateHeading(selectedDate)}
      </h2>

      {/* Tasks section */}
      {(itemTypeFilter === 'all' || itemTypeFilter === 'tasks') && filteredTasks.length > 0 && (
        <>
          {itemTypeFilter === 'all' && (
            <h3 className="text-sm font-medium text-[var(--muted)]">Tasks</h3>
          )}
          {filteredTasks.map((task) => {
            const isEditing = editingTaskId === task.id
            const createdLabel = formatDateLabel(task.createdAt)
            const priorityConfig = PRIORITY_CONFIG[task.priority || 'medium']
            const showPriorityMenu = priorityMenuTaskId === task.id
            const showReminderMenu = reminderMenuTaskId === task.id
            const isEditingTime = timeEditingTaskId === task.id
            const hasReminders = task.reminders && task.reminders.length > 0
            const enabledReminders = (task.reminders || []).filter((r) => r.enabled)

            return (
              <ContextMenu key={task.id}>
                <ContextMenuTrigger asChild>
                  <article
                    draggable
                    tabIndex={0}
                    onDragStart={(e: DragEvent<HTMLElement>) => {
                      e.dataTransfer.setData('text/plain', task.id)
                      e.dataTransfer.effectAllowed = 'move'
                    }}
                    onKeyDown={(event) => {
                      if (!isDeleteShortcut(event)) {
                        return
                      }
                      event.preventDefault()
                      onDelete(task.id)
                    }}
                    className={`flex w-full cursor-grab items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors active:cursor-grabbing ${
                      task.completed
                        ? 'border-[var(--line)] bg-[var(--panel-2)] opacity-70'
                        : 'border-[var(--line)] bg-[var(--panel-2)] hover:border-[var(--accent)]'
                    }`}
                  >
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
                          className="w-full rounded-md border border-[var(--accent-line)] bg-[var(--panel)] px-2 py-1 text-base font-medium text-[var(--text)] outline-none"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEditing(task)}
                          className={`w-full text-left text-base font-medium text-[var(--text)] hover:text-[var(--accent)] whitespace-normal break-words ${
                            task.completed ? 'line-through' : ''
                          }`}
                          title="Click to edit"
                        >
                          {task.title}
                        </button>
                      )}

                      <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-[var(--muted)]">
                        <span className={neutralChipClass}>
                          {task.completed ? (
                            <Check size={12} aria-hidden="true" />
                          ) : (
                            <Circle size={12} aria-hidden="true" />
                          )}
                          {task.completed ? 'Completed' : 'Pending'}
                        </span>
                        <span className={neutralChipClass}>{createdLabel}</span>

                        {/* Time chip/editor */}
                        <div className="relative">
                          {isEditingTime ? (
                            <input
                              type="time"
                              value={task.time || ''}
                              onChange={(e) => {
                                onUpdateTime(task.id, e.target.value || undefined)
                              }}
                              onBlur={() => setTimeEditingTaskId(null)}
                              onKeyDown={(e) => {
                                if (e.key === 'Escape') {
                                  setTimeEditingTaskId(null)
                                }
                              }}
                              autoFocus
                              className="rounded-md border border-[var(--accent-line)] bg-[var(--panel)] px-2 py-0.5 text-xs text-[var(--text)] outline-none"
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={() => setTimeEditingTaskId(task.id)}
                              className="inline-flex min-w-0 shrink-0 items-center gap-1 rounded-full border border-[var(--tag-neutral-line)] bg-[var(--tag-neutral-bg)] px-2 py-0.5 text-xs leading-[1.2] text-[var(--tag-neutral-text)] hover:border-[var(--accent)]"
                              title={task.time ? 'Change time' : 'Set time'}
                            >
                              <Clock size={12} aria-hidden="true" />
                              {task.time || 'No time'}
                            </button>
                          )}
                        </div>

                        {/* Priority menu */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setPriorityMenuTaskId(showPriorityMenu ? null : task.id)}
                            className="inline-flex min-w-0 shrink-0 items-center gap-1 rounded-full border border-[var(--tag-neutral-line)] bg-[var(--tag-neutral-bg)] px-2 py-0.5 text-xs leading-[1.2] text-[var(--tag-neutral-text)] hover:border-[var(--accent)]"
                            title="Change priority"
                          >
                            <Flag
                              size={12}
                              style={{ color: priorityConfig.color }}
                              aria-hidden="true"
                            />
                            {priorityConfig.label}
                          </button>
                          {showPriorityMenu && (
                            <div
                              ref={priorityMenuRef}
                              className="absolute left-0 top-full z-10 mt-1 w-28 rounded-lg border border-[var(--line)] bg-[var(--panel)] py-1 shadow-lg"
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
                                    <Flag size={12} style={{ color: config.color }} />
                                    {config.label}
                                  </button>
                                )
                              })}
                            </div>
                          )}
                        </div>

                        {/* Reminder button and menu */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setReminderMenuTaskId(showReminderMenu ? null : task.id)}
                            className={`inline-flex min-w-0 shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs leading-[1.2] hover:border-[var(--accent)] ${
                              hasReminders && enabledReminders.length > 0
                                ? 'border-amber-500/40 bg-amber-500/10 text-amber-600'
                                : 'border-[var(--tag-neutral-line)] bg-[var(--tag-neutral-bg)] text-[var(--tag-neutral-text)]'
                            }`}
                            title={
                              hasReminders
                                ? `${enabledReminders.length} reminder(s) set`
                                : 'Add reminder'
                            }
                          >
                            {hasReminders && enabledReminders.length > 0 ? (
                              <BellRing size={12} aria-hidden="true" />
                            ) : (
                              <Bell size={12} aria-hidden="true" />
                            )}
                            {hasReminders ? `${enabledReminders.length}` : 'Remind'}
                          </button>
                          {showReminderMenu && (
                            <div
                              ref={reminderMenuRef}
                              className="absolute left-0 top-full z-20 mt-1 w-64 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3 shadow-lg"
                            >
                              <div className="mb-2 flex items-center justify-between">
                                <span className="text-xs font-semibold text-[var(--text)]">
                                  Reminders
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setReminderMenuTaskId(null)}
                                  className="rounded p-0.5 text-[var(--muted)] hover:bg-[var(--panel-2)] hover:text-[var(--text)]"
                                >
                                  <X size={14} />
                                </button>
                              </div>

                              {/* List existing reminders */}
                              {task.reminders && task.reminders.length > 0 ? (
                                <div className="mb-3 space-y-1.5">
                                  {task.reminders.map((reminder) => (
                                    <div
                                      key={reminder.id}
                                      className={`flex items-center justify-between rounded-md border px-2 py-1.5 text-xs ${
                                        reminder.enabled
                                          ? 'border-[var(--accent-line)] bg-[var(--accent-soft)]'
                                          : 'border-[var(--line)] bg-[var(--panel-2)] opacity-60'
                                      }`}
                                    >
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleToggleReminder(task.id, reminder.id, task)
                                        }
                                        className="flex items-center gap-1.5 text-[var(--text)]"
                                        title={
                                          reminder.enabled ? 'Disable reminder' : 'Enable reminder'
                                        }
                                      >
                                        {reminder.enabled ? (
                                          <BellRing size={12} className="text-amber-500" />
                                        ) : (
                                          <Bell size={12} className="text-[var(--muted)]" />
                                        )}
                                        {formatReminder(reminder)}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleRemoveReminder(task.id, reminder.id, task)
                                        }
                                        className="rounded p-0.5 text-[var(--muted)] hover:bg-[var(--panel)] hover:text-red-500"
                                        title="Remove reminder"
                                      >
                                        <X size={12} />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="mb-3 text-xs text-[var(--muted)]">
                                  No reminders set. Add one below.
                                </p>
                              )}

                              {/* Add new reminder form */}
                              <div className="border-t border-[var(--line)] pt-2">
                                <div className="mb-2 text-xs text-[var(--muted)]">Add reminder</div>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    min="1"
                                    max="999"
                                    value={newReminderValue}
                                    onChange={(e) =>
                                      setNewReminderValue(
                                        Math.max(1, parseInt(e.target.value) || 1)
                                      )
                                    }
                                    className="w-16 rounded-md border border-[var(--line)] bg-[var(--panel)] px-2 py-1 text-xs text-[var(--text)] outline-none focus:border-[var(--accent)]"
                                  />
                                  <select
                                    value={newReminderType}
                                    onChange={(e) =>
                                      setNewReminderType(
                                        e.target.value as 'minutes' | 'hours' | 'days'
                                      )
                                    }
                                    className="flex-1 rounded-md border border-[var(--line)] bg-[var(--panel)] px-2 py-1 text-xs text-[var(--text)] outline-none focus:border-[var(--accent)]"
                                  >
                                    <option value="minutes">minutes</option>
                                    <option value="hours">hours</option>
                                    <option value="days">days</option>
                                  </select>
                                  <button
                                    type="button"
                                    onClick={() => handleAddReminder(task.id, task)}
                                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white"
                                    title="Add reminder"
                                  >
                                    <Plus size={14} />
                                  </button>
                                </div>
                                {!task.time && (
                                  <p className="mt-2 text-[10px] text-amber-600">
                                    Set a time for this task to enable time-based reminders
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onDelete(task.id)}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-[var(--line)] bg-[var(--panel)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--text)]"
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
                  <ContextMenuDestructiveItem
                    onClick={() => onDelete(task.id)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                    <ContextMenuShortcut keys={['cmd', 'backspace']} />
                  </ContextMenuDestructiveItem>
                </ContextMenuContent>
              </ContextMenu>
            )
          })}
        </>
      )}

      {/* Project Milestones and Subtasks section */}
      {(itemTypeFilter === 'all' ||
        itemTypeFilter === 'milestones' ||
        itemTypeFilter === 'subtasks') &&
        filteredProjectItems.length > 0 && (
          <>
            {itemTypeFilter === 'all' && (
              <h3 className="mt-2 text-sm font-medium text-[var(--muted)]">Project Items</h3>
            )}
            {filteredProjectItems.map((item) => (
              <article
                key={`${item.type}-${item.id}`}
                className={`flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
                  item.completed
                    ? 'border-[var(--line)] bg-[var(--panel-2)] opacity-70'
                    : 'border-[var(--line)] bg-[var(--panel-2)] hover:border-[var(--accent)]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (item.type === 'milestone' && item.projectId && onToggleMilestone) {
                      onToggleMilestone(item.projectId, item.id)
                    } else if (
                      item.type === 'subtask' &&
                      item.projectId &&
                      item.milestoneId &&
                      onToggleSubtask
                    ) {
                      onToggleSubtask(item.projectId, item.milestoneId, item.id)
                    }
                  }}
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                    item.completed
                      ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                      : 'border-[var(--line)] bg-[var(--panel)] hover:border-[var(--accent)]'
                  }`}
                  title={item.completed ? 'Mark as pending' : 'Mark as complete'}
                >
                  {item.completed ? <Check size={12} /> : <Circle size={12} />}
                </button>

                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span
                    className={`text-base font-medium text-[var(--text)] whitespace-normal break-words ${
                      item.completed ? 'line-through' : ''
                    }`}
                  >
                    {item.title}
                  </span>
                  <div className="flex min-w-0 items-center gap-1.5 overflow-hidden text-xs text-[var(--muted)]">
                    <span
                      className={`inline-flex min-w-0 shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs leading-[1.2] ${
                        item.type === 'milestone'
                          ? 'border-blue-500/30 bg-blue-500/10 text-blue-600'
                          : 'border-purple-500/30 bg-purple-500/10 text-purple-600'
                      }`}
                    >
                      {item.type === 'milestone' ? (
                        <Target size={12} aria-hidden="true" />
                      ) : (
                        <ListTodo size={12} aria-hidden="true" />
                      )}
                      {item.type === 'milestone' ? 'Milestone' : 'Subtask'}
                    </span>
                    {item.projectName && (
                      <span className={neutralChipClass}>{item.projectName}</span>
                    )}
                    {item.type === 'subtask' && item.milestoneName && (
                      <span className={neutralChipClass}>{item.milestoneName}</span>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </>
        )}

      {/* Empty state */}
      {filteredTasks.length === 0 && filteredProjectItems.length === 0 && (
        <div className="p-2 text-sm text-[var(--muted)]">
          {totalItems === 0 ? 'No items for this date' : 'No items match the current filter'}
        </div>
      )}
    </div>
  )
}

function formatCalendarDateHeading(isoDate: string): string {
  const parsed = new Date(`${isoDate}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) {
    return isoDate
  }

  return parsed.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  })
}
