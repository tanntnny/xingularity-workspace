import { CalendarTask, CalendarTaskType, Project, TaskPriority } from '../../../shared/types'

export type CalendarEventSource = 'task' | 'milestone'

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
    source: CalendarEventSource
    taskId?: string
    projectId?: string
    projectName?: string
    milestoneId?: string
    taskType?: CalendarTaskType
    priority?: TaskPriority
    completed?: boolean
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
          source: 'task',
          taskId: task.id,
          taskType: task.taskType,
          priority: task.priority
        }
      }
    })
}

export function buildMilestoneCalendarEvents(projects: Project[]): CalendarEventInput[] {
  return projects.flatMap((project) =>
    project.milestones.flatMap((milestone) => {
      if (!milestone.dueDate) {
        return []
      }

      return [
        {
          id: getMilestoneCalendarEventId(project.id, milestone.id),
          title: milestone.title,
          start: milestone.dueDate,
          allDay: true as const,
          editable: true,
          startEditable: true,
          durationEditable: false,
          extendedProps: {
            source: 'milestone',
            projectId: project.id,
            projectName: project.name,
            milestoneId: milestone.id,
            completed: milestone.status === 'completed'
          }
        }
      ]
    })
  )
}

export function getMilestoneCalendarEventId(projectId: string, milestoneId: string): string {
  return `calendar-milestone:${projectId}:${milestoneId}`
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
