import type { UiTone } from './uiTone'
import type { Project, ProjectMilestone, ProjectStatus } from '../../../shared/types'

export const PROJECT_STATUS_META: Record<
  ProjectStatus,
  { label: string; titleLabel: string; tone: UiTone }
> = {
  'on-track': {
    label: 'on-track',
    titleLabel: 'On Track',
    tone: 'success'
  },
  'at-risk': {
    label: 'at-risk',
    titleLabel: 'At Risk',
    tone: 'warning'
  },
  blocked: {
    label: 'blocked',
    titleLabel: 'Blocked',
    tone: 'danger'
  },
  completed: {
    label: 'completed',
    titleLabel: 'Completed',
    tone: 'success'
  }
}

export interface ProjectHealthSummary {
  status: ProjectStatus
  totalMilestones: number
  completedMilestones: number
  inProgressMilestones: number
  pendingMilestones: number
  blockedMilestones: number
  overdueMilestones: number
  reason: string
}

export function toLocalIsoDate(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
}

export function deriveMilestoneStatus(milestone: ProjectMilestone): ProjectMilestone['status'] {
  const subtasks = milestone.subtasks ?? []
  const completedCount = subtasks.filter((subtask) => subtask.completed).length

  if (subtasks.length === 0) {
    if (milestone.status === 'completed') {
      return 'completed'
    }

    if (milestone.status === 'blocked') {
      return 'blocked'
    }

    return 'pending'
  }

  if (completedCount === subtasks.length) {
    return 'completed'
  }

  if (milestone.status === 'blocked') {
    return 'blocked'
  }

  if (completedCount > 0) {
    return 'in-progress'
  }

  return 'pending'
}

export function computeProjectProgress(
  milestones: ProjectMilestone[],
  status?: ProjectStatus
): number {
  if (status === 'completed') {
    return 100
  }

  if (milestones.length === 0) {
    return 0
  }

  const total = milestones.reduce((sum, milestone) => {
    if (milestone.status === 'completed') {
      return sum + 1
    }

    if (milestone.status === 'in-progress') {
      return sum + 0.5
    }

    return sum
  }, 0)

  return Math.round((total / milestones.length) * 100)
}

export function getProjectHealthSummary(
  project: Pick<Project, 'milestones'>,
  todayIso: string = toLocalIsoDate(new Date())
): ProjectHealthSummary {
  const milestones = project.milestones
  const totalMilestones = milestones.length
  const completedMilestones = milestones.filter(
    (milestone) => milestone.status === 'completed'
  ).length
  const blockedMilestones = milestones.filter((milestone) => milestone.status === 'blocked').length
  const inProgressMilestones = milestones.filter(
    (milestone) => milestone.status === 'in-progress'
  ).length
  const pendingMilestones = milestones.filter((milestone) => milestone.status === 'pending').length
  const overdueMilestones = milestones.filter((milestone) =>
    isOverdueOpenMilestone(milestone, todayIso)
  ).length

  if (totalMilestones === 0) {
    return {
      status: 'on-track',
      totalMilestones,
      completedMilestones,
      inProgressMilestones,
      pendingMilestones,
      blockedMilestones,
      overdueMilestones,
      reason: 'No milestones yet.'
    }
  }

  if (completedMilestones === totalMilestones) {
    return {
      status: 'completed',
      totalMilestones,
      completedMilestones,
      inProgressMilestones,
      pendingMilestones,
      blockedMilestones,
      overdueMilestones,
      reason: 'All milestones are complete.'
    }
  }

  if (blockedMilestones > 0) {
    return {
      status: 'blocked',
      totalMilestones,
      completedMilestones,
      inProgressMilestones,
      pendingMilestones,
      blockedMilestones,
      overdueMilestones,
      reason: `${blockedMilestones} blocked milestone${blockedMilestones === 1 ? '' : 's'}.`
    }
  }

  if (overdueMilestones > 0) {
    return {
      status: 'at-risk',
      totalMilestones,
      completedMilestones,
      inProgressMilestones,
      pendingMilestones,
      blockedMilestones,
      overdueMilestones,
      reason: `${overdueMilestones} overdue open milestone${overdueMilestones === 1 ? '' : 's'}.`
    }
  }

  return {
    status: 'on-track',
    totalMilestones,
    completedMilestones,
    inProgressMilestones,
    pendingMilestones,
    blockedMilestones,
    overdueMilestones,
    reason:
      inProgressMilestones > 0
        ? `${inProgressMilestones} milestone${inProgressMilestones === 1 ? '' : 's'} in progress with no overdue or blocked work.`
        : 'No blocked or overdue milestones.'
  }
}

function isOverdueOpenMilestone(milestone: ProjectMilestone, todayIso: string): boolean {
  if (milestone.status === 'completed' || milestone.status === 'blocked') {
    return false
  }

  if (!milestone.dueDate) {
    return false
  }

  return milestone.dueDate < todayIso
}
