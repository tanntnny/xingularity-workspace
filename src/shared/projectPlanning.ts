import type { CalendarTask, Project } from './types'
import { isTaskDone } from './taskStatus'

const PROJECT_MILESTONE_ORDER_ERROR = 'Milestone order must include every milestone exactly once'

export interface ProjectHealth {
  totalTasks: number
  completedTasks: number
  blockedTasks: number
  overdueTasks: number
  dependencyCycle: boolean
  completionRatio: number
}

export function applyProjectMilestoneOrder(project: Project, milestoneIds: string[]): Project {
  const milestones = project.milestones ?? []
  const existingIds = new Set(milestones.map((milestone) => milestone.id))
  const requestedIds = new Set(milestoneIds)

  if (
    milestoneIds.length !== milestones.length ||
    requestedIds.size !== milestoneIds.length ||
    milestoneIds.some((milestoneId) => !existingIds.has(milestoneId))
  ) {
    throw new Error(PROJECT_MILESTONE_ORDER_ERROR)
  }

  const milestonesById = new Map(milestones.map((milestone) => [milestone.id, milestone]))
  return {
    ...project,
    milestones: milestoneIds.map((milestoneId) => milestonesById.get(milestoneId)!)
  }
}

export function validateTaskDependencies(tasks: CalendarTask[]): string[] {
  const taskIds = new Set(tasks.map((task) => task.id))
  const graph = new Map<string, string[]>()
  const errors: string[] = []

  for (const task of tasks) {
    const dependencies = Array.from(new Set(task.dependencyIds ?? []))
    graph.set(
      task.id,
      dependencies.filter((id) => taskIds.has(id) && id !== task.id)
    )
    for (const dependencyId of dependencies) {
      if (!taskIds.has(dependencyId)) {
        errors.push(`${task.id} depends on missing task ${dependencyId}`)
      }
      if (dependencyId === task.id) {
        errors.push(`${task.id} cannot depend on itself`)
      }
    }
  }

  const visiting = new Set<string>()
  const visited = new Set<string>()
  const visit = (taskId: string): void => {
    if (visiting.has(taskId)) {
      errors.push(`Dependency cycle includes ${taskId}`)
      return
    }
    if (visited.has(taskId)) {
      return
    }
    visiting.add(taskId)
    for (const dependencyId of graph.get(taskId) ?? []) {
      visit(dependencyId)
    }
    visiting.delete(taskId)
    visited.add(taskId)
  }

  for (const task of tasks) {
    visit(task.id)
  }
  return Array.from(new Set(errors))
}

export function validateTaskRelationships(tasks: CalendarTask[]): string[] {
  const errors = validateTaskDependencies(tasks)
  const taskIds = new Set(tasks.map((task) => task.id))
  const parentGraph = new Map<string, string>()

  for (const task of tasks) {
    const parentTaskId = task.parentTaskId
    if (!parentTaskId) {
      continue
    }
    if (!taskIds.has(parentTaskId)) {
      errors.push(`${task.id} has missing parent task ${parentTaskId}`)
      continue
    }
    if (parentTaskId === task.id) {
      errors.push(`${task.id} cannot be its own parent`)
      continue
    }
    parentGraph.set(task.id, parentTaskId)
  }

  const visiting = new Set<string>()
  const visited = new Set<string>()
  const visitParent = (taskId: string): void => {
    if (visiting.has(taskId)) {
      errors.push(`Parent task cycle includes ${taskId}`)
      return
    }
    if (visited.has(taskId)) {
      return
    }
    visiting.add(taskId)
    const parentTaskId = parentGraph.get(taskId)
    if (parentTaskId) {
      visitParent(parentTaskId)
    }
    visiting.delete(taskId)
    visited.add(taskId)
  }

  for (const task of tasks) {
    visitParent(task.id)
  }

  return Array.from(new Set(errors))
}

export function getBlockedByDependencies(
  task: CalendarTask,
  tasks: CalendarTask[]
): CalendarTask[] {
  const taskMap = new Map(tasks.map((candidate) => [candidate.id, candidate]))
  return (task.dependencyIds ?? []).flatMap((dependencyId) => {
    const dependency = taskMap.get(dependencyId)
    return dependency && !isTaskDone(dependency) ? [dependency] : []
  })
}

export function calculateProjectHealth(
  project: Project,
  tasks: CalendarTask[],
  today = toIsoDate(new Date())
): ProjectHealth {
  const projectTasks = tasks.filter((task) => task.projectId === project.id)
  const completedTasks = projectTasks.filter((task) => isTaskDone(task)).length
  const blockedTasks = projectTasks.filter(
    (task) => task.status === 'blocked' || getBlockedByDependencies(task, tasks).length > 0
  ).length
  const overdueTasks = projectTasks.filter(
    (task) =>
      !isTaskDone(task) &&
      Boolean(task.endDate ?? task.date) &&
      (task.endDate ?? task.date)! < today
  ).length
  const dependencyCycle = validateTaskDependencies(projectTasks).some((error) =>
    error.includes('cycle')
  )

  return {
    totalTasks: projectTasks.length,
    completedTasks,
    blockedTasks,
    overdueTasks,
    dependencyCycle,
    completionRatio: projectTasks.length === 0 ? 0 : completedTasks / projectTasks.length
  }
}

export function getProjectTaskIds(project: Project, tasks: CalendarTask[]): string[] {
  return tasks.filter((task) => task.projectId === project.id).map((task) => task.id)
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
