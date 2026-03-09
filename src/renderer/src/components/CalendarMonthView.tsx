import { ReactElement, useMemo, useState, DragEvent } from 'react'
import { Check } from 'lucide-react'
import { CalendarTask, TaskPriority } from '../../../shared/types'

interface CalendarMonthViewProps {
  selectedDate: string
  tasksByDate: Record<string, CalendarTask[]>
  onSelectDate: (date: string) => void
  onRescheduleTask?: (taskId: string, newDate: string | undefined) => void
  onToggleTask?: (taskId: string) => void
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const PRIORITY_COLORS: Record<TaskPriority, { bg: string; border: string; dot: string }> = {
  high: {
    bg: 'bg-red-50 dark:bg-red-950/30',
    border: 'border-red-200 dark:border-red-800/50',
    dot: '#ef4444'
  },
  medium: {
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-800/50',
    dot: '#f59e0b'
  },
  low: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    border: 'border-emerald-200 dark:border-emerald-800/50',
    dot: '#22c55e'
  }
}

const MAX_VISIBLE_TASKS = 3

export function CalendarMonthView({
  selectedDate,
  tasksByDate,
  onSelectDate,
  onRescheduleTask,
  onToggleTask
}: CalendarMonthViewProps): ReactElement {
  const todayIso = toIsoDate(new Date())
  const [dragOverDate, setDragOverDate] = useState<string | null>(null)

  // Derive viewMonth from selectedDate
  const viewMonth = useMemo(() => {
    const d = parseIsoDate(selectedDate)
    return { year: d.getFullYear(), month: d.getMonth() }
  }, [selectedDate])

  const monthDays = useMemo(() => {
    const { year, month } = viewMonth
    const firstOfMonth = new Date(year, month, 1)
    const startOffset = firstOfMonth.getDay()
    const start = new Date(year, month, 1 - startOffset)

    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(start)
      day.setDate(start.getDate() + index)
      return day
    })
  }, [viewMonth])

  return (
    <section className="flex h-full flex-col overflow-hidden p-4">
      {/* Calendar container with rounded corners */}
      <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)]">
        {/* Weekday headers */}
        <div className="grid shrink-0 grid-cols-7 border-b border-[var(--line)] bg-[var(--panel-2)]">
          {WEEKDAYS.map((day, index) => (
            <div
              key={day}
              className={`py-3 text-center text-xs font-semibold uppercase tracking-wider text-[var(--muted)] ${
                index === 0 ? 'rounded-tl-2xl' : ''
              } ${index === 6 ? 'rounded-tr-2xl' : ''}`}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid flex-1 grid-cols-7 grid-rows-6">
          {monthDays.map((day, index) => {
            const iso = toIsoDate(day)
            const inMonth = day.getMonth() === viewMonth.month
            const isSelected = iso === selectedDate
            const isToday = iso === todayIso
            const tasks = tasksByDate[iso] || []
            const isDragOver = dragOverDate === iso
            const visibleTasks = tasks.slice(0, MAX_VISIBLE_TASKS)
            const hiddenCount = tasks.length - MAX_VISIBLE_TASKS

            // Calculate corner rounding for edge cells
            const isLastRow = index >= 35
            const isFirstCol = index % 7 === 0
            const isLastCol = index % 7 === 6
            const cornerClass = `${isLastRow && isFirstCol ? 'rounded-bl-2xl' : ''} ${isLastRow && isLastCol ? 'rounded-br-2xl' : ''}`

            // Border classes - only right and bottom borders for inner cells
            const borderClass = `${isLastCol ? '' : 'border-r'} ${isLastRow ? '' : 'border-b'} border-[var(--line)]`

            const handleDragOver = (e: DragEvent<HTMLDivElement>): void => {
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
              setDragOverDate(iso)
            }

            const handleDragLeave = (): void => {
              setDragOverDate(null)
            }

            const handleDrop = (e: DragEvent<HTMLDivElement>): void => {
              e.preventDefault()
              setDragOverDate(null)
              const taskId = e.dataTransfer.getData('text/plain')
              if (taskId && onRescheduleTask) {
                onRescheduleTask(taskId, iso)
              }
            }

            return (
              <div
                key={iso}
                onClick={() => onSelectDate(iso)}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`flex cursor-pointer flex-col overflow-hidden p-2 transition-all duration-150 ${borderClass} ${cornerClass} ${
                  isSelected
                    ? 'bg-[var(--accent-soft)] ring-2 ring-inset ring-[var(--accent-line)]'
                    : isDragOver
                      ? 'bg-[var(--accent-soft)] ring-2 ring-inset ring-dashed ring-[var(--accent)]'
                      : 'hover:bg-[var(--panel-2)]'
                } ${inMonth ? '' : 'bg-[var(--panel-2)]/50 opacity-50'}`}
              >
                {/* Day number */}
                <div className="mb-1.5 flex shrink-0 items-start justify-between">
                  <span
                    className={`flex h-7 w-7 items-center justify-center text-sm font-medium transition-all ${
                      isToday
                        ? 'rounded-full bg-[var(--accent)] text-white shadow-sm'
                        : isSelected
                          ? 'rounded-full bg-[var(--accent)]/10 text-[var(--accent)]'
                          : 'text-[var(--text)]'
                    }`}
                  >
                    {day.getDate()}
                  </span>
                  {tasks.length > 0 && !isToday && (
                    <span className="mt-1 flex h-2 w-2 rounded-full bg-[var(--accent)]/60" />
                  )}
                </div>

                {/* Task list - mini cards */}
                <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden">
                  {visibleTasks.map((task) => {
                    const priorityStyle = PRIORITY_COLORS[task.priority || 'medium']

                    return (
                      <div
                        key={task.id}
                        onClick={(e) => {
                          e.stopPropagation()
                          onToggleTask?.(task.id)
                        }}
                        draggable
                        onDragStart={(e: DragEvent<HTMLDivElement>) => {
                          e.stopPropagation()
                          e.dataTransfer.setData('text/plain', task.id)
                          e.dataTransfer.effectAllowed = 'move'
                        }}
                        className={`group flex min-w-0 cursor-pointer items-center gap-1.5 rounded-lg border px-2 py-1 shadow-sm transition-all duration-150 hover:shadow-md ${
                          task.completed
                            ? 'border-[var(--line)] bg-[var(--panel-2)] opacity-60'
                            : `${priorityStyle.bg} ${priorityStyle.border}`
                        }`}
                        title={task.title}
                      >
                        {/* Checkbox */}
                        <span
                          className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                            task.completed
                              ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                              : 'border-[var(--line-strong)] bg-[var(--panel)] group-hover:border-[var(--accent)]'
                          }`}
                        >
                          {task.completed && <Check size={8} strokeWidth={3} />}
                        </span>

                        {/* Priority dot */}
                        {!task.completed && (
                          <span
                            className="h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{ backgroundColor: priorityStyle.dot }}
                          />
                        )}

                        {/* Title */}
                        <span
                          className={`truncate text-xs font-medium ${
                            task.completed
                              ? 'text-[var(--muted)] line-through'
                              : 'text-[var(--text)]'
                          }`}
                        >
                          {task.title}
                        </span>
                      </div>
                    )
                  })}

                  {/* Hidden count indicator */}
                  {hiddenCount > 0 && (
                    <div className="flex items-center gap-1 px-1 py-0.5">
                      <span className="text-xs font-medium text-[var(--muted)]">
                        +{hiddenCount} more
                      </span>
                    </div>
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
