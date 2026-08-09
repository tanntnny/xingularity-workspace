import { CalendarTask, CalendarTaskType, TaskPriority, TaskStatus } from '../../../shared/types'

export interface CalendarEventInput {
  id: string
  title: string
  start: string
  end?: string
  allDay: true
  editable?: boolean
  startEditable?: boolean
  durationEditable?: boolean
  extendedProps: {
    source: 'task'
    taskId?: string
    taskType?: CalendarTaskType
    priority?: TaskPriority
    status?: TaskStatus
    completed?: boolean
    syncSignature?: string
  }
}

export interface WeeklyCalendarTimedEntry {
  task: CalendarTask
  date: string
  startMinutes: number
  durationMinutes: number
}

export interface WeeklyCalendarAllDayItem {
  id: string
  source: 'task'
  startDate: string
  endDate: string
  title: string
  task?: CalendarTask
}

export interface WeeklyCalendarAllDayLayout extends WeeklyCalendarAllDayItem {
  row: number
  columnStart: number
  columnSpan: number
}

export function normalizeCalendarTasks(tasks: CalendarTask[]): CalendarTask[] {
  const latestTaskById = new Map<string, CalendarTask>()
  const orderedIds: string[] = []

  for (const task of tasks) {
    if (!latestTaskById.has(task.id)) {
      orderedIds.push(task.id)
    }
    latestTaskById.set(task.id, task)
  }

  return orderedIds
    .map((taskId) => latestTaskById.get(taskId))
    .filter((task): task is CalendarTask => Boolean(task))
}

export function buildCalendarEvents(tasks: CalendarTask[]): CalendarEventInput[] {
  return normalizeCalendarTasks(tasks)
    .filter((task) => Boolean(task.date))
    .map((task) => {
      const startIso = task.date as string
      const endIso = task.endDate && task.endDate >= startIso ? task.endDate : undefined
      return {
        id: task.id,
        title: task.title,
        start: startIso,
        end: endIso ? toIsoDate(addIsoDays(parseIsoDate(endIso), 1)) : undefined,
        allDay: true as const,
        extendedProps: {
          source: 'task',
          taskId: task.id,
          taskType: task.taskType,
          priority: task.priority,
          status: task.status,
          completed: task.completed
        }
      }
    })
}

export function buildWeeklyCalendarEntries(
  tasks: CalendarTask[],
  weekStart: string
): {
  timedTasks: WeeklyCalendarTimedEntry[]
  allDayItems: WeeklyCalendarAllDayItem[]
} {
  const weekEnd = addIsoDaysToIso(weekStart, 6)
  const timedTasks: WeeklyCalendarTimedEntry[] = []
  const allDayItems: WeeklyCalendarAllDayItem[] = []

  for (const task of normalizeCalendarTasks(tasks)) {
    if (!task.date) {
      continue
    }

    const taskEnd = task.endDate && task.endDate >= task.date ? task.endDate : task.date
    const overlapsWeek = task.date <= weekEnd && taskEnd >= weekStart

    if (!overlapsWeek) {
      continue
    }

    const startMinutes = parseTimeToMinutes(task.time)
    const endMinutes = parseTimeToMinutes(task.endTime)
    const isSingleDay = taskEnd === task.date

    if (startMinutes !== null && isSingleDay) {
      const durationMinutes =
        endMinutes !== null && endMinutes > startMinutes ? endMinutes - startMinutes : 60

      timedTasks.push({
        task,
        date: task.date,
        startMinutes,
        durationMinutes
      })
      continue
    }

    allDayItems.push({
      id: task.id,
      source: 'task',
      startDate: task.date < weekStart ? weekStart : task.date,
      endDate: taskEnd > weekEnd ? weekEnd : taskEnd,
      title: task.title,
      task
    })
  }

  timedTasks.sort((left, right) => {
    if (left.date !== right.date) {
      return left.date.localeCompare(right.date)
    }
    if (left.startMinutes !== right.startMinutes) {
      return left.startMinutes - right.startMinutes
    }
    return left.task.title.localeCompare(right.task.title)
  })

  allDayItems.sort((left, right) => {
    if (left.startDate !== right.startDate) {
      return left.startDate.localeCompare(right.startDate)
    }
    const leftDurationDays = diffIsoDays(left.startDate, left.endDate)
    const rightDurationDays = diffIsoDays(right.startDate, right.endDate)
    if (leftDurationDays !== rightDurationDays) {
      return rightDurationDays - leftDurationDays
    }
    return left.title.localeCompare(right.title)
  })

  return { timedTasks, allDayItems }
}

export function layoutWeeklyAllDayItems(
  items: WeeklyCalendarAllDayItem[],
  weekStart: string
): WeeklyCalendarAllDayLayout[] {
  const laneEndByRow: number[] = []

  return items.map((item) => {
    const columnStart = clampNumber(diffIsoDays(weekStart, item.startDate), 0, 6)
    const columnEnd = clampNumber(diffIsoDays(weekStart, item.endDate), columnStart, 6)
    let row = laneEndByRow.findIndex((laneEnd) => laneEnd < columnStart)

    if (row === -1) {
      row = laneEndByRow.length
      laneEndByRow.push(columnEnd)
    } else {
      laneEndByRow[row] = columnEnd
    }

    return {
      ...item,
      row,
      columnStart,
      columnSpan: columnEnd - columnStart + 1
    }
  })
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

function addIsoDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function addIsoDaysToIso(iso: string, days: number): string {
  return toIsoDate(addIsoDays(parseIsoDate(iso), days))
}

function diffIsoDays(startIso: string, endIso: string): number {
  const start = parseIsoDate(startIso)
  const end = parseIsoDate(endIso)
  return Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function parseTimeToMinutes(time: string | undefined): number | null {
  if (!time || !/^\d{2}:\d{2}$/.test(time)) {
    return null
  }

  const [hour, minute] = time.split(':').map((value) => Number.parseInt(value, 10))
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return null
  }

  return hour * 60 + minute
}
