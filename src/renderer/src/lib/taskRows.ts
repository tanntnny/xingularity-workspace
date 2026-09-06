import type {
  CalendarTask,
  CalendarTaskType,
  Project,
  ProjectMilestone,
  TaskPriority,
  TaskStatus
} from '../../../shared/types'
import { formatCalendarTaskType, TASK_STATUS_VALUES } from '../../../shared/types'
import { isTaskDone } from '../../../shared/taskStatus'
import { normalizeTaskTags } from '../../../shared/taskTags'
import { TASK_STATUS_META, getTaskStatus } from './taskStatus'
import { getTaskPriorityChipItem } from './statusChipMeta'

export const UNASSIGNED_TASK_PROJECT_FILTER = '__unassigned_project__'
export const UNASSIGNED_TASK_MILESTONE_FILTER = '__unassigned_milestone__'

export const TASK_SCHEDULE_FILTER_VALUES = ['scheduled', 'unscheduled', 'overdue'] as const
export type TaskScheduleFilter = (typeof TASK_SCHEDULE_FILTER_VALUES)[number]

export type TaskGroupBy = 'none' | 'project' | 'milestone' | 'type' | 'status' | 'priority'

export const TASK_GROUP_BY_OPTIONS: readonly { value: TaskGroupBy; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'project', label: 'Project' },
  { value: 'milestone', label: 'Milestone' },
  { value: 'type', label: 'Type' },
  { value: 'status', label: 'Status' },
  { value: 'priority', label: 'Priority' }
]

export interface TaskPageRow {
  task: CalendarTask
  project: Project | null
  milestone: ProjectMilestone | null
  projectLabel: string
  milestoneLabel: string
  status: TaskStatus
  taskType: CalendarTaskType
  priority: TaskPriority
  tags: string[]
}

export interface TaskFilterState {
  searchQuery?: string
  statuses?: readonly TaskStatus[]
  taskTypes?: readonly CalendarTaskType[]
  priorities?: readonly TaskPriority[]
  projectIds?: readonly string[]
  milestoneIds?: readonly string[]
  scheduleStates?: readonly TaskScheduleFilter[]
  tags?: readonly string[]
}

export interface TaskFilterOption {
  value: string
  label: string
}

export interface TaskFilterOptions {
  statuses: TaskFilterOption[]
  types: TaskFilterOption[]
  priorities: TaskFilterOption[]
  projects: TaskFilterOption[]
  milestones: TaskFilterOption[]
  schedules: TaskFilterOption[]
  tags: TaskFilterOption[]
}

export interface TaskGroup {
  id: string
  label: string
  sortValue: string | number
}

export function getTaskPageRows(
  tasks: readonly CalendarTask[],
  projects: readonly Project[]
): TaskPageRow[] {
  const projectById = new Map(projects.map((project) => [project.id, project]))

  return normalizeTaskCollection(tasks).map((task) => {
    const project = task.projectId ? (projectById.get(task.projectId) ?? null) : null
    const milestone =
      project && task.milestoneId
        ? (project.milestones?.find((candidate) => candidate.id === task.milestoneId) ?? null)
        : null

    return {
      task,
      project,
      milestone,
      projectLabel: project?.name ?? 'Unassigned',
      milestoneLabel: milestone?.title ?? 'Unassigned',
      status: getTaskStatus(task.status, task.completed),
      taskType: task.taskType ?? 'assignment',
      priority: task.priority ?? 'low',
      tags: normalizeTaskTags(task.tags)
    }
  })
}

export function filterTaskRows(
  rows: readonly TaskPageRow[],
  filters: TaskFilterState,
  today = toIsoDate(new Date())
): TaskPageRow[] {
  const query = filters.searchQuery?.trim().toLocaleLowerCase() ?? ''

  return rows.filter((row) => {
    if (query && !taskRowSearchText(row).includes(query)) return false
    if (!matchesSelectedValue(filters.statuses, row.status)) return false
    if (!matchesSelectedValue(filters.taskTypes, row.taskType)) return false
    if (!matchesSelectedValue(filters.priorities, row.priority)) return false

    if (
      !matchesSelectedValue(
        filters.projectIds,
        row.project ? row.project.id : UNASSIGNED_TASK_PROJECT_FILTER
      )
    ) {
      return false
    }

    if (
      !matchesSelectedValue(
        filters.milestoneIds,
        row.milestone ? row.milestone.id : UNASSIGNED_TASK_MILESTONE_FILTER
      )
    ) {
      return false
    }

    if (filters.scheduleStates?.length) {
      const matchesSchedule = filters.scheduleStates.some((scheduleState) =>
        matchesTaskScheduleState(row, scheduleState, today)
      )
      if (!matchesSchedule) return false
    }

    if (filters.tags?.length && !row.tags.some((tag) => filters.tags?.includes(tag))) {
      return false
    }

    return true
  })
}

export function hasTaskFilters(filters: TaskFilterState): boolean {
  return Boolean(
    filters.statuses?.length ||
    filters.taskTypes?.length ||
    filters.priorities?.length ||
    filters.projectIds?.length ||
    filters.milestoneIds?.length ||
    filters.scheduleStates?.length ||
    filters.tags?.length
  )
}

export function getTaskFilterOptions(
  rows: readonly TaskPageRow[],
  projects: readonly Project[],
  today = toIsoDate(new Date())
): TaskFilterOptions {
  const statuses = uniqueOptions(
    rows.map((row) => row.status),
    (value) => TASK_STATUS_META[value].label
  )
  const types = uniqueOptions(
    rows.map((row) => row.taskType),
    (value) => formatCalendarTaskType(value)
  )
  const priorities = uniqueOptions(
    rows.map((row) => row.priority),
    (value) => String(getTaskPriorityChipItem(value).label)
  )

  const projectOptions = projects
    .map((project) => ({ value: project.id, label: project.name }))
    .sort((left, right) => left.label.localeCompare(right.label))
  if (rows.some((row) => !row.project)) {
    projectOptions.push({ value: UNASSIGNED_TASK_PROJECT_FILTER, label: 'Unassigned' })
  }

  const milestoneOptions = projects
    .flatMap((project) =>
      (project.milestones ?? []).map((milestone) => ({
        value: milestone.id,
        label: `${project.name} · ${milestone.title}`
      }))
    )
    .sort((left, right) => left.label.localeCompare(right.label))
  if (rows.some((row) => !row.milestone)) {
    milestoneOptions.push({ value: UNASSIGNED_TASK_MILESTONE_FILTER, label: 'Unassigned' })
  }

  const schedules = TASK_SCHEDULE_FILTER_VALUES.flatMap((value) => {
    if (!rows.some((row) => matchesTaskScheduleState(row, value, today))) return []
    return [{ value, label: formatScheduleFilter(value) }]
  })

  const tags = uniqueOptions(
    rows.flatMap((row) => row.tags),
    (value) => value
  )

  return {
    statuses,
    types,
    priorities,
    projects: projectOptions,
    milestones: milestoneOptions,
    schedules,
    tags
  }
}

export function taskRowSearchText(row: TaskPageRow): string {
  return [
    row.task.title,
    TASK_STATUS_META[row.status].label,
    formatCalendarTaskType(row.taskType),
    String(getTaskPriorityChipItem(row.priority).label),
    row.projectLabel,
    row.milestoneLabel,
    ...row.tags
  ]
    .join(' ')
    .toLocaleLowerCase()
}

export function getTaskGroup(row: TaskPageRow, groupBy: Exclude<TaskGroupBy, 'none'>): TaskGroup {
  switch (groupBy) {
    case 'project':
      return {
        id: row.project ? `project:${row.project.id}` : UNASSIGNED_TASK_PROJECT_FILTER,
        label: row.projectLabel,
        sortValue: row.project ? row.projectLabel : '\uffff'
      }
    case 'milestone':
      return {
        id: row.milestone ? `milestone:${row.milestone.id}` : UNASSIGNED_TASK_MILESTONE_FILTER,
        label: row.milestoneLabel,
        sortValue: row.milestone ? row.milestoneLabel : '\uffff'
      }
    case 'type':
      return {
        id: `type:${row.taskType}`,
        label: formatCalendarTaskType(row.taskType),
        sortValue: formatCalendarTaskType(row.taskType)
      }
    case 'status':
      return {
        id: `status:${row.status}`,
        label: TASK_STATUS_META[row.status].label,
        sortValue: TASK_STATUS_VALUES.indexOf(row.status)
      }
    case 'priority': {
      const priorityOrder: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 }
      return {
        id: `priority:${row.priority}`,
        label: String(getTaskPriorityChipItem(row.priority).label),
        sortValue: priorityOrder[row.priority]
      }
    }
  }
}

export function getTaskGroupLabel(groupBy: TaskGroupBy): string {
  return TASK_GROUP_BY_OPTIONS.find((option) => option.value === groupBy)?.label ?? 'Group by'
}

function normalizeTaskCollection(tasks: readonly CalendarTask[]): CalendarTask[] {
  const latestTaskById = new Map<string, CalendarTask>()
  const orderedIds: string[] = []

  for (const task of tasks) {
    if (!latestTaskById.has(task.id)) orderedIds.push(task.id)
    latestTaskById.set(task.id, task)
  }

  return orderedIds.flatMap((taskId) => {
    const task = latestTaskById.get(taskId)
    return task ? [task] : []
  })
}

function matchesSelectedValue<T extends string>(
  selected: readonly T[] | undefined,
  value: T
): boolean {
  return !selected?.length || selected.includes(value)
}

function matchesTaskScheduleState(
  row: TaskPageRow,
  scheduleState: TaskScheduleFilter,
  today: string
): boolean {
  if (scheduleState === 'scheduled') return Boolean(row.task.date || row.task.endDate)
  if (scheduleState === 'unscheduled') return !row.task.date && !row.task.endDate

  const dueDate = row.task.endDate ?? row.task.date
  return !isTaskDone(row.task) && Boolean(dueDate) && dueDate! < today
}

function formatScheduleFilter(value: TaskScheduleFilter): string {
  switch (value) {
    case 'scheduled':
      return 'Scheduled'
    case 'unscheduled':
      return 'Unscheduled'
    case 'overdue':
      return 'Overdue'
  }
}

function uniqueOptions<T extends string>(
  values: readonly T[],
  getLabel: (value: T) => string
): TaskFilterOption[] {
  return Array.from(new Set(values))
    .map((value) => ({ value, label: getLabel(value) }))
    .sort((left, right) => left.label.localeCompare(right.label))
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
