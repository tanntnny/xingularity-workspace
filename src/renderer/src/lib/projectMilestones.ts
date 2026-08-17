import type { CalendarTask } from '../../../shared/types'
import { getTaskStatus } from './taskStatus'

export interface ProjectMilestoneProgress {
  completed: number
  total: number
  isComplete: boolean
}

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

export function getProjectMilestoneProgress(tasks: CalendarTask[]): ProjectMilestoneProgress {
  const completed = tasks.filter(
    (task) => getTaskStatus(task.status, task.completed) === 'completed'
  ).length
  const total = tasks.length

  return {
    completed,
    total,
    isComplete: total > 0 && completed === total
  }
}
