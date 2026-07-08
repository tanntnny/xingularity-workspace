import type {
  Project,
  ProjectMilestone,
  ProjectStatus,
  ProjectSubtask,
  TaskPriority
} from '../../../shared/types'

export type ProjectsWorkspaceFilterMode = 'all' | 'favorites' | 'active' | 'completed'

export const PROJECTS_WORKSPACE_FILTER_OPTIONS: Array<{
  value: ProjectsWorkspaceFilterMode
  label: string
}> = [
  { value: 'all', label: 'All' },
  { value: 'favorites', label: 'Favorites' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' }
]

export interface ProjectTaskRow {
  id: string
  kind: 'milestone' | 'subtask'
  title: string
  completed: boolean
  priority?: TaskPriority
  dueDate?: string
  projectId: string
  projectName: string
  projectIcon: Project['icon']
  projectStatus: ProjectStatus
  milestoneId: string
  milestoneTitle: string
  milestoneDueDate?: string
  milestonePriority?: TaskPriority
  milestoneStatus: ProjectMilestone['status']
  milestoneCompletedSubtaskCount: number
  milestoneSubtaskCount: number
  milestoneProgressPercent: number
  subtaskId?: string
}

export type ProjectTaskSortKey =
  | 'status'
  | 'title'
  | 'project'
  | 'milestone'
  | 'priority'
  | 'dueDate'

export type ProjectTaskSortDirection = 'asc' | 'desc'

export function filterProjectsForWorkspace(
  projects: Project[],
  favoriteProjectIds: string[],
  filterMode: ProjectsWorkspaceFilterMode
): Project[] {
  if (filterMode === 'favorites') {
    const favoriteIds = new Set(favoriteProjectIds)
    return projects.filter((project) => favoriteIds.has(project.id))
  }

  if (filterMode === 'active') {
    return projects.filter((project) => project.status !== 'completed')
  }

  if (filterMode === 'completed') {
    return projects.filter((project) => project.status === 'completed')
  }

  return projects
}

export function buildProjectTaskRows(projects: Project[]): ProjectTaskRow[] {
  return projects.flatMap((project) =>
    project.milestones.flatMap((milestone) => buildMilestoneRows(project, milestone))
  )
}

function buildMilestoneRows(project: Project, milestone: ProjectMilestone): ProjectTaskRow[] {
  const milestoneCompletedSubtaskCount = milestone.subtasks.filter(
    (subtask) => subtask.completed
  ).length
  const milestoneSubtaskCount = milestone.subtasks.length
  const milestoneProgressPercent = getMilestoneProgressPercent(
    milestone,
    milestoneCompletedSubtaskCount
  )

  const milestoneRow: ProjectTaskRow = {
    id: `milestone:${project.id}:${milestone.id}`,
    kind: 'milestone',
    title: milestone.title,
    completed: milestone.status === 'completed',
    priority: milestone.priority,
    dueDate: milestone.dueDate,
    projectId: project.id,
    projectName: project.name,
    projectIcon: project.icon,
    projectStatus: project.status,
    milestoneId: milestone.id,
    milestoneTitle: milestone.title,
    milestoneDueDate: milestone.dueDate,
    milestonePriority: milestone.priority,
    milestoneStatus: milestone.status,
    milestoneCompletedSubtaskCount,
    milestoneSubtaskCount,
    milestoneProgressPercent
  }

  const subtaskRows = milestone.subtasks.map((subtask) =>
    buildSubtaskRow(
      project,
      milestone,
      subtask,
      milestoneCompletedSubtaskCount,
      milestoneSubtaskCount,
      milestoneProgressPercent
    )
  )

  return [milestoneRow, ...subtaskRows]
}

function buildSubtaskRow(
  project: Project,
  milestone: ProjectMilestone,
  subtask: ProjectSubtask,
  milestoneCompletedSubtaskCount: number,
  milestoneSubtaskCount: number,
  milestoneProgressPercent: number
): ProjectTaskRow {
  return {
    id: `subtask:${project.id}:${milestone.id}:${subtask.id}`,
    kind: 'subtask',
    title: subtask.title,
    completed: subtask.completed,
    priority: subtask.priority,
    dueDate: subtask.dueDate ?? milestone.dueDate,
    projectId: project.id,
    projectName: project.name,
    projectIcon: project.icon,
    projectStatus: project.status,
    milestoneId: milestone.id,
    milestoneTitle: milestone.title,
    milestoneDueDate: milestone.dueDate,
    milestonePriority: milestone.priority,
    milestoneStatus: milestone.status,
    milestoneCompletedSubtaskCount,
    milestoneSubtaskCount,
    milestoneProgressPercent,
    subtaskId: subtask.id
  }
}

export function compareProjectTaskRows(
  left: ProjectTaskRow,
  right: ProjectTaskRow,
  key: ProjectTaskSortKey,
  direction: ProjectTaskSortDirection
): number {
  const factor = direction === 'asc' ? 1 : -1
  let result = 0

  if (key === 'status') {
    result = Number(left.completed) - Number(right.completed)
  } else if (key === 'title') {
    result = left.title.localeCompare(right.title)
  } else if (key === 'project') {
    result = left.projectName.localeCompare(right.projectName)
  } else if (key === 'milestone') {
    result = left.milestoneTitle.localeCompare(right.milestoneTitle)
  } else if (key === 'priority') {
    result = comparePriority(left.priority, right.priority)
  } else {
    result = compareOptionalText(left.dueDate, right.dueDate)
  }

  if (result !== 0) {
    return result * factor
  }

  return compareProjectTaskRowFallback(left, right)
}

function compareProjectTaskRowFallback(left: ProjectTaskRow, right: ProjectTaskRow): number {
  const projectCompare = left.projectName.localeCompare(right.projectName)
  if (projectCompare !== 0) {
    return projectCompare
  }

  const milestoneCompare = left.milestoneTitle.localeCompare(right.milestoneTitle)
  if (milestoneCompare !== 0) {
    return milestoneCompare
  }

  if (left.kind !== right.kind) {
    return left.kind === 'milestone' ? -1 : 1
  }

  const titleCompare = left.title.localeCompare(right.title)
  if (titleCompare !== 0) {
    return titleCompare
  }

  return left.id.localeCompare(right.id)
}

function comparePriority(left: TaskPriority | undefined, right: TaskPriority | undefined): number {
  return PROJECT_TASK_PRIORITY_ORDER[left ?? 'none'] - PROJECT_TASK_PRIORITY_ORDER[right ?? 'none']
}

function compareOptionalText(left: string | undefined, right: string | undefined): number {
  if (left && right) {
    return left.localeCompare(right)
  }

  if (left) {
    return -1
  }

  if (right) {
    return 1
  }

  return 0
}

const PROJECT_TASK_PRIORITY_ORDER: Record<TaskPriority | 'none', number> = {
  high: 0,
  medium: 1,
  low: 2,
  none: 3
}

function getMilestoneProgressPercent(
  milestone: ProjectMilestone,
  completedSubtaskCount: number
): number {
  if (milestone.status === 'completed') {
    return 100
  }

  if (milestone.subtasks.length === 0) {
    return 0
  }

  return Math.round((completedSubtaskCount / milestone.subtasks.length) * 100)
}
