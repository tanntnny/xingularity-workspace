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
