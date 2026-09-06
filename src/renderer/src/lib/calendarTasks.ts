import { CalendarTask, CalendarTaskType, TaskPriority, TaskStatus } from '../../../shared/types'
import { normalizeCalendarEndDate } from '../../../shared/calendarTaskDates'
import { normalizeTaskTags } from '../../../shared/taskTags'

export type CalendarContentFilter = 'all' | 'projectTasks' | 'nonProjectTasks'

export interface CalendarTaskTagOption {
  value: string
  count: number
}

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
    deadlineOnly?: boolean
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
  deadlineOnly?: boolean
  task?: CalendarTask
}

export interface WeeklyCalendarAllDayLayout extends WeeklyCalendarAllDayItem {
  topPx: number
  heightPx: number
  columnStart: number
  columnSpan: number
}

export const WEEKLY_ALL_DAY_TASK_MIN_HEIGHT_PX = 44
export const WEEKLY_ALL_DAY_TASK_GAP_PX = 8

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

export function filterCalendarTasks(
  tasks: CalendarTask[],
  filter: CalendarContentFilter
): CalendarTask[] {
  const normalizedTasks = normalizeCalendarTasks(tasks)

  if (filter === 'projectTasks') {
    return normalizedTasks.filter((task) => Boolean(task.projectId))
  }

  if (filter === 'nonProjectTasks') {
    return normalizedTasks.filter((task) => !task.projectId)
  }

  return normalizedTasks
}

export function filterCalendarTasksByTags(
  tasks: CalendarTask[],
  selectedTags: readonly string[]
): CalendarTask[] {
  const normalizedSelectedTags = new Set(normalizeTaskTags(selectedTags))
  const normalizedTasks = normalizeCalendarTasks(tasks)

  if (normalizedSelectedTags.size === 0) {
    return normalizedTasks
  }

  return normalizedTasks.filter((task) =>
    normalizeTaskTags(task.tags).some((tag) => normalizedSelectedTags.has(tag))
  )
}

export function getCalendarTaskTagOptions(tasks: CalendarTask[]): CalendarTaskTagOption[] {
  const counts = new Map<string, number>()

  for (const task of normalizeCalendarTasks(tasks)) {
    for (const tag of normalizeTaskTags(task.tags)) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
  }

  return Array.from(counts, ([value, count]) => ({ value, count })).sort((left, right) =>
    left.value.localeCompare(right.value)
  )
}

export function isCalendarTaskOnDate(
  task: Pick<CalendarTask, 'date' | 'endDate'>,
  date: string
): boolean {
  const startDate = task.date ?? task.endDate
  if (!startDate) {
    return false
  }

  const endDate = normalizeCalendarEndDate(task.date, task.endDate) ?? startDate
  return startDate <= date && endDate >= date
}

export function buildCalendarEvents(tasks: CalendarTask[]): CalendarEventInput[] {
  return normalizeCalendarTasks(tasks)
    .filter((task) => Boolean(task.date || task.endDate))
    .map((task) => {
      const deadlineOnly = !task.date && Boolean(task.endDate)
      const startIso = (task.date ?? task.endDate) as string
      const endIso =
        !deadlineOnly && task.endDate && task.endDate >= startIso ? task.endDate : undefined
      return {
        id: task.id,
        title: task.title,
        start: startIso,
        end: endIso ? toIsoDate(addIsoDays(parseIsoDate(endIso), 1)) : undefined,
        allDay: true as const,
        durationEditable: true,
        extendedProps: {
          source: 'task',
          taskId: task.id,
          taskType: task.taskType,
          priority: task.priority,
          status: task.status,
          completed: task.completed,
          ...(deadlineOnly ? { deadlineOnly: true } : {})
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
    const taskDate = task.date ?? task.endDate
    if (!taskDate) {
      continue
    }

    const deadlineOnly = !task.date && Boolean(task.endDate)
    const taskEnd =
      !deadlineOnly && task.endDate && task.endDate >= taskDate ? task.endDate : taskDate
    const overlapsWeek = taskDate <= weekEnd && taskEnd >= weekStart

    if (!overlapsWeek) {
      continue
    }

    const startMinutes = parseTimeToMinutes(task.time)
    const endMinutes = parseTimeToMinutes(task.endTime)
    const isSingleDay = taskEnd === taskDate

    if (startMinutes !== null && isSingleDay) {
      const durationMinutes =
        endMinutes !== null && endMinutes > startMinutes ? endMinutes - startMinutes : 60

      timedTasks.push({
        task,
        date: taskDate,
        startMinutes,
        durationMinutes
      })
      continue
    }

    allDayItems.push({
      id: task.id,
      source: 'task',
      startDate: taskDate < weekStart ? weekStart : taskDate,
      endDate: taskEnd > weekEnd ? weekEnd : taskEnd,
      title: task.title,
      ...(deadlineOnly ? { deadlineOnly: true } : {}),
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
  weekStart: string,
  measuredHeights: Readonly<Record<string, number>> = {},
  gapPx = WEEKLY_ALL_DAY_TASK_GAP_PX,
  minHeightPx = WEEKLY_ALL_DAY_TASK_MIN_HEIGHT_PX
): WeeklyCalendarAllDayLayout[] {
  const layouts: WeeklyCalendarAllDayLayout[] = []

  for (const item of items) {
    const columnStart = clampNumber(diffIsoDays(weekStart, item.startDate), 0, 6)
    const columnEnd = clampNumber(diffIsoDays(weekStart, item.endDate), columnStart, 6)

    const height = measuredHeights[item.id]
    const heightPx = Number.isFinite(height) ? Math.max(minHeightPx, height) : minHeightPx
    const topPx = layouts.reduce((maxTop, previous) => {
      const previousColumnEnd = previous.columnStart + previous.columnSpan - 1
      const overlaps = previous.columnStart <= columnEnd && previousColumnEnd >= columnStart

      return overlaps ? Math.max(maxTop, previous.topPx + previous.heightPx + gapPx) : maxTop
    }, 0)

    layouts.push({
      ...item,
      topPx,
      heightPx,
      columnStart,
      columnSpan: columnEnd - columnStart + 1
    })
  }

  return layouts
}

export function getWeeklyAllDaySurfaceHeightPx(
  layouts: WeeklyCalendarAllDayLayout[],
  minSurfaceHeightPx: number,
  paddingPx: number
): number {
  const maxBottomPx = layouts.reduce(
    (maxBottom, layout) => Math.max(maxBottom, layout.topPx + layout.heightPx),
    0
  )

  return Math.max(minSurfaceHeightPx, maxBottomPx + paddingPx * 2)
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
