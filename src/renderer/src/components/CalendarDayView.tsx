import { ReactElement, useMemo, useState, DragEvent } from 'react'
import { CalendarTask, CalendarTaskType } from '../../../shared/types'

interface CalendarDayViewProps {
  selectedDate: string
  tasks: CalendarTask[]
  onSelectDate: (date: string) => void
  onRescheduleTask?: (taskId: string, newDate: string) => void
}

const TASK_TYPE_COLORS: Record<CalendarTaskType, string> = {
  meeting: '#3b82f6',
  assignment: '#f59e0b',
  review: '#8b5cf6',
  personal: '#22c55e',
  other: '#64748b'
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
  onRescheduleTask
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
    <section className="flex h-full flex-col gap-3 overflow-hidden p-4">
      <div className="flex shrink-0 items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goToPrevDay}
            className="workspace-subtle-control flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] text-[var(--muted)] hover:text-[var(--text)]"
          >
            &lt;
          </button>
          <h2 className="text-lg font-semibold text-[var(--text)]">
            {dateLabel}
            {isToday && (
              <span className="ml-2 rounded-full bg-[var(--accent)] px-2 py-0.5 text-xs font-medium text-white">
                Today
              </span>
            )}
          </h2>
          <button
            type="button"
            onClick={goToNextDay}
            className="workspace-subtle-control flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] text-[var(--muted)] hover:text-[var(--text)]"
          >
            &gt;
          </button>
        </div>
        <span className="inline-flex items-center rounded-full border border-[var(--tag-neutral-line)] bg-[var(--tag-neutral-bg)] px-2 py-0.5 text-xs leading-[1.2] text-[var(--tag-neutral-text)]">
          {tasks.length} task{tasks.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* All Day section */}
      {allDayTasks.length > 0 && (
        <div className="workspace-subtle-surface shrink-0 rounded-xl p-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            All Day / No Time Set
          </h3>
          <div className="flex flex-wrap gap-2">
            {allDayTasks.map((task) => (
              <div
                key={task.id}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm ${
                  task.completed
                    ? 'workspace-subtle-control border-[var(--line)] opacity-60 line-through'
                    : 'border-[var(--accent-line)] bg-[var(--accent-soft)]'
                }`}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: TASK_TYPE_COLORS[task.taskType || 'assignment'] }}
                />
                {task.title}
              </div>
            ))}
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
                className="flex border-b border-[var(--line)]"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div className="w-16 shrink-0 py-2 pr-2 text-right text-xs text-[var(--muted)]">
                  {slot.label}
                </div>
                <div
                  className={`min-h-[50px] flex-1 py-1 pl-2 transition-colors ${
                    isDragOver ? 'bg-[var(--accent-soft)]' : ''
                  }`}
                >
                  {slotTasks.map((task) => (
                    <div
                      key={task.id}
                      className={`mb-1 inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm ${
                        task.completed
                          ? 'workspace-subtle-control border-[var(--line)] opacity-60 line-through'
                          : 'border-[var(--accent-line)] bg-[var(--accent-soft)]'
                      }`}
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: TASK_TYPE_COLORS[task.taskType || 'assignment'] }}
                      />
                      {task.title}
                      <span className="text-xs text-[var(--muted)]">{task.time}</span>
                    </div>
                  ))}
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
