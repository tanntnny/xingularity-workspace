import { ReactElement, useMemo, useState, DragEvent } from 'react'
import { TaskPriority } from '../../../shared/types'

interface TaskSummaryByDate {
  total: number
  highPriority: number
  mediumPriority: number
  lowPriority: number
}

interface CalendarWeekViewProps {
  selectedDate: string
  taskCountByDate: Record<string, number>
  taskSummaryByDate: Record<string, TaskSummaryByDate>
  onSelectDate: (date: string) => void
  onRescheduleTask?: (taskId: string, newDate: string) => void
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#22c55e'
}

// Time slots from 6 AM to 11 PM
const TIME_SLOTS = Array.from({ length: 18 }, (_, i) => {
  const hour = i + 6
  return {
    hour,
    label: hour === 12 ? '12 PM' : hour < 12 ? `${hour} AM` : `${hour - 12} PM`
  }
})

export function CalendarWeekView({
  selectedDate,
  taskCountByDate,
  taskSummaryByDate,
  onSelectDate,
  onRescheduleTask
}: CalendarWeekViewProps): ReactElement {
  const selected = useMemo(() => parseIsoDate(selectedDate), [selectedDate])
  const todayIso = toIsoDate(new Date())
  const [dragOverDate, setDragOverDate] = useState<string | null>(null)

  // Get the week containing the selected date (Sunday to Saturday)
  const weekDays = useMemo(() => {
    const dayOfWeek = selected.getDay()
    const startOfWeek = new Date(selected)
    startOfWeek.setDate(selected.getDate() - dayOfWeek)

    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(startOfWeek)
      day.setDate(startOfWeek.getDate() + index)
      return day
    })
  }, [selected])

  const weekLabel = useMemo(() => {
    const start = weekDays[0]
    const end = weekDays[6]
    const startMonth = start.toLocaleDateString(undefined, { month: 'short' })
    const endMonth = end.toLocaleDateString(undefined, { month: 'short' })

    if (startMonth === endMonth) {
      return `${startMonth} ${start.getDate()} - ${end.getDate()}, ${end.getFullYear()}`
    }
    return `${startMonth} ${start.getDate()} - ${endMonth} ${end.getDate()}, ${end.getFullYear()}`
  }, [weekDays])

  const totalTasksThisWeek = useMemo(() => {
    return weekDays.reduce((sum, day) => {
      const iso = toIsoDate(day)
      return sum + (taskCountByDate[iso] ?? 0)
    }, 0)
  }, [weekDays, taskCountByDate])

  return (
    <section className="flex h-full flex-col gap-3 overflow-hidden p-4">
      <div className="flex shrink-0 items-center justify-between">
        <h2 className="text-lg font-semibold text-[var(--text)]">{weekLabel}</h2>
        {totalTasksThisWeek > 0 && (
          <span className="inline-flex items-center rounded-full border border-[var(--tag-neutral-line)] bg-[var(--tag-neutral-bg)] px-2 py-0.5 text-xs leading-[1.2] text-[var(--tag-neutral-text)]">
            {totalTasksThisWeek} task{totalTasksThisWeek !== 1 ? 's' : ''} this week
          </span>
        )}
      </div>

      {/* Week header with day names and dates */}
      <div className="grid shrink-0 grid-cols-[60px_repeat(7,1fr)] gap-1">
        <div /> {/* Empty cell for time column */}
        {weekDays.map((day, index) => {
          const iso = toIsoDate(day)
          const isSelected = iso === selectedDate
          const isToday = iso === todayIso

          return (
            <button
              key={iso}
              type="button"
              onClick={() => onSelectDate(iso)}
              className={`flex flex-col items-center rounded-lg border p-2 text-center transition-colors ${
                isSelected
                  ? 'border-[var(--accent-line)] bg-[var(--accent-soft)]'
                  : 'border-transparent hover:border-[var(--accent)]'
              }`}
            >
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                {WEEKDAYS[index]}
              </span>
              <span
                className={`mt-1 text-lg font-medium ${
                  isToday
                    ? 'flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent)] text-white'
                    : ''
                }`}
              >
                {day.getDate()}
              </span>
            </button>
          )
        })}
      </div>

      {/* Time grid */}
      <div className="flex-1 overflow-auto">
        <div className="grid min-h-[900px] grid-cols-[60px_repeat(7,1fr)] gap-px bg-[var(--line)]">
          {TIME_SLOTS.map((slot) => (
            <>
              {/* Time label */}
              <div
                key={`time-${slot.hour}`}
                className="flex h-[50px] items-start justify-end bg-[var(--panel)] pr-2 pt-1 text-[10px] text-[var(--muted)]"
              >
                {slot.label}
              </div>

              {/* Day cells for this time slot */}
              {weekDays.map((day) => {
                const iso = toIsoDate(day)
                const isDragOver = dragOverDate === iso
                const summary = taskSummaryByDate[iso]

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
                    key={`${iso}-${slot.hour}`}
                    onClick={() => onSelectDate(iso)}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`h-[50px] cursor-pointer bg-[var(--panel-2)] transition-colors hover:bg-[var(--accent-soft)] ${
                      isDragOver
                        ? 'bg-[var(--accent-soft)] ring-1 ring-inset ring-[var(--accent)]'
                        : ''
                    }`}
                  >
                    {/* Show priority dots in the first slot of each day */}
                    {slot.hour === 6 && summary && (
                      <div className="flex gap-0.5 p-1">
                        {summary.highPriority > 0 && (
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: PRIORITY_COLORS.high }}
                            title={`${summary.highPriority} high priority`}
                          />
                        )}
                        {summary.mediumPriority > 0 && (
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: PRIORITY_COLORS.medium }}
                            title={`${summary.mediumPriority} medium priority`}
                          />
                        )}
                        {summary.lowPriority > 0 && (
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: PRIORITY_COLORS.low }}
                            title={`${summary.lowPriority} low priority`}
                          />
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </>
          ))}
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
