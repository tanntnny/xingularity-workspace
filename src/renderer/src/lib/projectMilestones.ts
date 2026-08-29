import type { CalendarTask, ProjectMilestone } from '../../../shared/types'
import { isTaskDone } from '../../../shared/taskStatus'

export interface ProjectMilestoneProgress {
  completed: number
  total: number
  isComplete: boolean
}

export type ProjectMilestoneStatus = 'current' | 'complete' | 'unreached'

export function getProjectMilestoneTasks(
  tasks: CalendarTask[],
  projectId: string,
  milestoneId: string
): CalendarTask[] {
  return tasks.filter((task) => task.projectId === projectId && task.milestoneId === milestoneId)
}

export function getProjectDirectTasks(tasks: CalendarTask[], projectId: string): CalendarTask[] {
  return tasks.filter((task) => task.projectId === projectId && !task.milestoneId)
}

const TASK_PRIORITY_RANK: Record<CalendarTask['priority'], number> = {
  low: 0,
  medium: 1,
  high: 2
}

function compareProjectTaskUrgency(left: CalendarTask, right: CalendarTask): number {
  const priorityDifference = TASK_PRIORITY_RANK[right.priority] - TASK_PRIORITY_RANK[left.priority]
  if (priorityDifference !== 0) {
    return priorityDifference
  }

  const leftDueDate = left.endDate ?? left.date
  const rightDueDate = right.endDate ?? right.date
  if (leftDueDate && rightDueDate) {
    const dueDateDifference = leftDueDate.localeCompare(rightDueDate)
    if (dueDateDifference !== 0) {
      return dueDateDifference
    }
  } else if (leftDueDate) {
    return -1
  } else if (rightDueDate) {
    return 1
  }

  const createdAtDifference = left.createdAt.localeCompare(right.createdAt)
  if (createdAtDifference !== 0) {
    return createdAtDifference
  }

  return left.id.localeCompare(right.id)
}

export function getMostUrgentProjectTask(
  tasks: CalendarTask[],
  projectId: string
): CalendarTask | null {
  return tasks
    .filter((task) => task.projectId === projectId && !isTaskDone(task))
    .reduce<CalendarTask | null>((mostUrgent, task) => {
      if (!mostUrgent || compareProjectTaskUrgency(task, mostUrgent) < 0) {
        return task
      }

      return mostUrgent
    }, null)
}

export function moveProjectMilestone(
  milestones: readonly ProjectMilestone[],
  milestoneId: string,
  targetIndex: number
): ProjectMilestone[] {
  const sourceIndex = milestones.findIndex((milestone) => milestone.id === milestoneId)
  if (sourceIndex < 0 || milestones.length === 0) {
    return Array.from(milestones)
  }

  const next = Array.from(milestones)
  const [moved] = next.splice(sourceIndex, 1)
  const boundedTargetIndex = Math.max(0, Math.min(targetIndex, next.length))
  next.splice(boundedTargetIndex, 0, moved)
  return next
}

export function getProjectMilestoneProgress(tasks: CalendarTask[]): ProjectMilestoneProgress {
  const completed = tasks.filter((task) => isTaskDone(task)).length
  const total = tasks.length

  return {
    completed,
    total,
    isComplete: total > 0 && completed === total
  }
}

export function getCurrentProjectMilestone(
  milestones: readonly ProjectMilestone[],
  tasks: CalendarTask[],
  projectId: string
): ProjectMilestone | null {
  return (
    milestones.find((milestone) => {
      const milestoneTasks = getProjectMilestoneTasks(tasks, projectId, milestone.id)
      return !getProjectMilestoneProgress(milestoneTasks).isComplete
    }) ?? null
  )
}

export function getProjectMilestoneStatus(
  milestone: ProjectMilestone,
  milestones: readonly ProjectMilestone[],
  tasks: CalendarTask[],
  projectId: string
): ProjectMilestoneStatus {
  const milestoneTasks = getProjectMilestoneTasks(tasks, projectId, milestone.id)
  if (getProjectMilestoneProgress(milestoneTasks).isComplete) {
    return 'complete'
  }

  return getCurrentProjectMilestone(milestones, tasks, projectId)?.id === milestone.id
    ? 'current'
    : 'unreached'
}
