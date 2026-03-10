import { DragEvent, ReactElement, useMemo, useState } from 'react'
import { Check } from 'lucide-react'
import { CalendarTask, TaskPriority } from '../../../shared/types'
import { TaskContextMenu } from './TaskContextMenu'

interface CalendarMonthViewProps {
  selectedDate: string
  tasks: CalendarTask[]
  onSelectDate: (date: string) => void
  onRescheduleTask?: (taskId: string, newDate: string | undefined) => void
  onResizeTaskStart?: (taskId: string, newStartDate: string) => void
  onResizeTaskEnd?: (taskId: string, newEndDate: string) => void
  onToggleTask?: (taskId: string) => void
  onDeleteTask?: (taskId: string) => void
  onRenameTask?: (taskId: string, newTitle: string) => void
  onUpdateTaskPriority?: (taskId: string, priority: TaskPriority) => void
  onUpdateTaskTime?: (taskId: string, time: string | undefined) => void
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const PRIORITY_STYLE: Record<TaskPriority, { bg: string; border: string }> = {
  high: { bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-300 dark:border-red-700/50' },
  medium: {
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-300 dark:border-amber-700/50'
  },
  low: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    border: 'border-emerald-300 dark:border-emerald-700/50'
  }
}

interface WeekSegment {
  task: CalendarTask
  startCol: number
  endCol: number
  lane: number
}

export function CalendarMonthView({
  selectedDate,
  tasks,
  onSelectDate,
  onRescheduleTask,
  onResizeTaskStart,
  onResizeTaskEnd,
  onToggleTask,
  onDeleteTask,
  onRenameTask,
  onUpdateTaskPriority,
  onUpdateTaskTime
}: CalendarMonthViewProps): ReactElement {
  const todayIso = toIsoDate(new Date())
  const [dragOverDate, setDragOverDate] = useState<string | null>(null)

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

  const weekRows = useMemo(
    () => Array.from({ length: 6 }, (_, rowIdx) => monthDays.slice(rowIdx * 7, rowIdx * 7 + 7)),
    [monthDays]
  )

  const scheduledTasks = useMemo(() => tasks.filter((task) => Boolean(task.date)), [tasks])

  const rowLayout = useMemo(() => {
    return weekRows.map((rowDays) => {
      const rowStartIso = toIsoDate(rowDays[0])
      const rowEndIso = toIsoDate(rowDays[6])
      const rawSegments: Omit<WeekSegment, 'lane'>[] = []

      for (const task of scheduledTasks) {
        const startIso = task.date as string
        const endIso = task.endDate && task.endDate >= startIso ? task.endDate : startIso
        if (endIso < rowStartIso || startIso > rowEndIso) {
          continue
        }

        const segmentStart = maxIso(startIso, rowStartIso)
        const segmentEnd = minIso(endIso, rowEndIso)
        rawSegments.push({
          task,
          startCol: diffIsoDays(rowStartIso, segmentStart),
          endCol: diffIsoDays(rowStartIso, segmentEnd)
        })
      }

      rawSegments.sort((a, b) => a.startCol - b.startCol || a.endCol - b.endCol)

      const laneEnds: number[] = []
      const segments: WeekSegment[] = rawSegments.map((segment) => {
        let lane = laneEnds.findIndex((endCol) => segment.startCol > endCol)
        if (lane === -1) {
          lane = laneEnds.length
          laneEnds.push(segment.endCol)
        } else {
          laneEnds[lane] = segment.endCol
        }

        return {
          ...segment,
          lane
        }
      })

      return {
        rowDays,
        segments,
        laneCount: Math.max(laneEnds.length, 1)
      }
    })
  }, [scheduledTasks, weekRows])

  const handleDayDragOver = (event: DragEvent<HTMLButtonElement>, isoDate: string): void => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setDragOverDate(isoDate)
  }

  const handleDayDrop = (event: DragEvent<HTMLButtonElement>, isoDate: string): void => {
    event.preventDefault()
    setDragOverDate(null)
    const payload = event.dataTransfer.getData('text/plain')
    if (!payload) {
      return
    }

    if (payload.startsWith('resize-start:')) {
      const taskId = payload.replace('resize-start:', '')
      onResizeTaskStart?.(taskId, isoDate)
      return
    }

    if (payload.startsWith('resize-end:')) {
      const taskId = payload.replace('resize-end:', '')
      onResizeTaskEnd?.(taskId, isoDate)
      return
    }

    if (payload.startsWith('move:')) {
      const taskId = payload.replace('move:', '')
      onRescheduleTask?.(taskId, isoDate)
      return
    }

    onRescheduleTask?.(payload, isoDate)
  }

  return (
    <section className="flex h-full flex-col overflow-hidden p-4">
      <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)]">
        <div className="grid shrink-0 grid-cols-7 border-b border-[var(--line)] bg-[var(--panel-2)]">
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="py-2 text-center text-xs font-semibold uppercase text-[var(--muted)]"
            >
              {day}
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-auto">
          {rowLayout.map((row, rowIndex) => {
            const rowHasBottomBorder = rowIndex < rowLayout.length - 1
            return (
              <div
                key={toIsoDate(row.rowDays[0])}
                className={rowHasBottomBorder ? 'border-b border-[var(--line)]' : ''}
              >
                <div className="grid grid-cols-7 border-b border-[var(--line)]/70">
                  {row.rowDays.map((day, dayIndex) => {
                    const iso = toIsoDate(day)
                    const inMonth = day.getMonth() === viewMonth.month
                    const isSelected = iso === selectedDate
                    const isToday = iso === todayIso
                    const isDragOver = dragOverDate === iso
                    const dayTaskCount = scheduledTasks.filter((task) => {
                      if (!task.date) return false
                      const endIso =
                        task.endDate && task.endDate >= task.date ? task.endDate : task.date
                      return iso >= task.date && iso <= endIso
                    }).length

                    return (
                      <button
                        key={iso}
                        type="button"
                        onClick={() => onSelectDate(iso)}
                        onDragOver={(event) => handleDayDragOver(event, iso)}
                        onDragLeave={() => setDragOverDate(null)}
                        onDrop={(event) => handleDayDrop(event, iso)}
                        className={`flex min-h-[64px] flex-col items-start px-2 py-1 text-left transition-colors ${
                          dayIndex < 6 ? 'border-r border-[var(--line)]/70' : ''
                        } ${
                          isSelected
                            ? 'bg-[var(--accent-soft)]'
                            : isDragOver
                              ? 'bg-[var(--accent-soft)]/70 ring-1 ring-inset ring-[var(--accent)]'
                              : 'hover:bg-[var(--panel-2)]/60'
                        } ${inMonth ? '' : 'bg-[var(--panel-2)]/40 opacity-60'}`}
                      >
                        <span
                          className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                            isToday
                              ? 'bg-[var(--accent)] text-white'
                              : isSelected
                                ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                                : 'text-[var(--text)]'
                          }`}
                        >
                          {day.getDate()}
                        </span>
                        {dayTaskCount > 0 && (
                          <span className="mt-1 text-[10px] text-[var(--muted)]">
                            {dayTaskCount} task{dayTaskCount > 1 ? 's' : ''}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>

                <div className="relative" style={{ height: `${row.laneCount * 30 + 6}px` }}>
                  {row.segments.map((segment) => {
                    const { task } = segment
                    const priorityStyle = PRIORITY_STYLE[task.priority || 'medium']
                    const span = segment.endCol - segment.startCol + 1
                    const leftPercent = (segment.startCol / 7) * 100
                    const widthPercent = (span / 7) * 100
                    const onToggle = onToggleTask ?? (() => undefined)
                    const onDelete = onDeleteTask ?? (() => undefined)
                    const onRename = onRenameTask ?? (() => undefined)
                    const onUpdatePriority = onUpdateTaskPriority ?? (() => undefined)
                    const onUpdateTime = onUpdateTaskTime ?? (() => undefined)
                    const onSchedule = (taskId: string, date: string): void => {
                      onRescheduleTask?.(taskId, date)
                    }
                    const onUnschedule = (taskId: string): void => {
                      onRescheduleTask?.(taskId, undefined)
                    }

                    return (
                      <TaskContextMenu
                        key={`${task.id}-${segment.startCol}-${segment.endCol}-${segment.lane}`}
                        task={task}
                        selectedDate={selectedDate}
                        onToggle={onToggle}
                        onDelete={onDelete}
                        onRename={onRename}
                        onUpdatePriority={onUpdatePriority}
                        onUpdateTime={onUpdateTime}
                        onScheduleTask={onSchedule}
                        onUnscheduleTask={onUnschedule}
                      >
                        <div
                          draggable
                          onDragStart={(event) => {
                            event.dataTransfer.setData('text/plain', `move:${task.id}`)
                            event.dataTransfer.effectAllowed = 'move'
                          }}
                          className={`group absolute flex h-7 cursor-grab items-center gap-2 rounded-md border px-2 text-xs shadow-sm active:cursor-grabbing ${priorityStyle.bg} ${priorityStyle.border} ${
                            task.completed ? 'opacity-60' : ''
                          }`}
                          style={{
                            left: `calc(${leftPercent}% + 4px)`,
                            width: `calc(${widthPercent}% - 8px)`,
                            top: `${segment.lane * 30 + 4}px`
                          }}
                          title={task.title}
                        >
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              onToggleTask?.(task.id)
                            }}
                            className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border ${
                              task.completed
                                ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                                : 'border-[var(--line-strong)] bg-[var(--panel)]'
                            }`}
                          >
                            {task.completed ? <Check size={8} strokeWidth={3} /> : null}
                          </button>
                          <span className="truncate text-[var(--text)]">{task.title}</span>
                          {task.time && (
                            <span className="ml-auto text-[10px] text-[var(--muted)]">
                              {task.time}
                            </span>
                          )}

                          <div
                            draggable
                            onDragStart={(event) => {
                              event.stopPropagation()
                              event.dataTransfer.setData('text/plain', `resize-start:${task.id}`)
                              event.dataTransfer.effectAllowed = 'move'
                            }}
                            className="absolute -left-1 top-0 h-7 w-2 cursor-ew-resize"
                            title="Drag to change start date"
                          />
                          <div
                            draggable
                            onDragStart={(event) => {
                              event.stopPropagation()
                              event.dataTransfer.setData('text/plain', `resize-end:${task.id}`)
                              event.dataTransfer.effectAllowed = 'move'
                            }}
                            className="absolute -right-1 top-0 h-7 w-2 cursor-ew-resize"
                            title="Drag to change end date"
                          />
                        </div>
                      </TaskContextMenu>
                    )
                  })}
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

function diffIsoDays(startIso: string, endIso: string): number {
  const start = parseIsoDate(startIso)
  const end = parseIsoDate(endIso)
  const diff = end.getTime() - start.getTime()
  return Math.round(diff / (24 * 60 * 60 * 1000))
}

function minIso(a: string, b: string): string {
  return a <= b ? a : b
}

function maxIso(a: string, b: string): string {
  return a >= b ? a : b
}
