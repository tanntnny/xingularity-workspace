import { CalendarTask } from '../../../shared/types'

export interface CalendarEventInput {
  id: string
  title: string
  start: string
  end?: string
  allDay: true
  extendedProps: {
    taskId: string
    syncSignature?: string
  }
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
          taskId: task.id
        }
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
