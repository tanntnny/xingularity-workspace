import { isSameDay, isSameMonth, isSameWeek, parseISO } from 'date-fns'

import type { Project, ProjectStatus } from '../../../shared/types'
import type { UiTone } from './uiTone'

export type ProjectBoardGroupBy = 'status' | 'updatedAt'

export interface ProjectBoardGroup {
  key: string
  label: string
  badgeLabel: string
  badgeTone: UiTone
  projects: Project[]
}

const BOARD_WEEK_STARTS_ON = 1

const STATUS_GROUPS: Array<{
  key: ProjectStatus
  label: string
  badgeLabel: string
  badgeTone: UiTone
}> = [
  {
    key: 'on-track',
    label: 'On Track',
    badgeLabel: 'On Track',
    badgeTone: 'success'
  },
  {
    key: 'at-risk',
    label: 'At Risk',
    badgeLabel: 'At Risk',
    badgeTone: 'warning'
  },
  {
    key: 'blocked',
    label: 'Blocked',
    badgeLabel: 'Blocked',
    badgeTone: 'danger'
  },
  {
    key: 'completed',
    label: 'Completed',
    badgeLabel: 'Completed',
    badgeTone: 'success'
  }
]

const UPDATED_AT_GROUPS: Array<{
  key: string
  label: string
  badgeLabel: string
  badgeTone: UiTone
}> = [
  {
    key: 'today',
    label: 'Updated Today',
    badgeLabel: 'Today',
    badgeTone: 'info'
  },
  {
    key: 'this-week',
    label: 'Updated This Week',
    badgeLabel: 'This Week',
    badgeTone: 'accent'
  },
  {
    key: 'this-month',
    label: 'Updated This Month',
    badgeLabel: 'This Month',
    badgeTone: 'attention'
  },
  {
    key: 'older',
    label: 'Older',
    badgeLabel: 'Older',
    badgeTone: 'neutral'
  }
]

export function buildProjectBoardGroups(
  projects: Project[],
  groupBy: ProjectBoardGroupBy,
  today: Date = new Date()
): ProjectBoardGroup[] {
  const sortedProjects = [...projects].sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt)
  )

  if (groupBy === 'status') {
    return STATUS_GROUPS.map((group) => ({
      key: group.key,
      label: group.label,
      badgeLabel: group.badgeLabel,
      badgeTone: group.badgeTone,
      projects: sortedProjects.filter((project) => project.status === group.key)
    }))
  }

  const groups = new Map(
    UPDATED_AT_GROUPS.map((group) => [
      group.key,
      {
        key: group.key,
        label: group.label,
        badgeLabel: group.badgeLabel,
        badgeTone: group.badgeTone,
        projects: [] as Project[]
      }
    ])
  )

  sortedProjects.forEach((project) => {
    const group = groups.get(getUpdatedAtGroupKey(project.updatedAt, today))
    group?.projects.push(project)
  })

  return UPDATED_AT_GROUPS.map((group) => groups.get(group.key)!)
}

function getUpdatedAtGroupKey(value: string, today: Date): string {
  const updatedAt = parseISO(value)

  if (isSameDay(updatedAt, today)) {
    return 'today'
  }

  if (isSameWeek(updatedAt, today, { weekStartsOn: BOARD_WEEK_STARTS_ON })) {
    return 'this-week'
  }

  if (isSameMonth(updatedAt, today)) {
    return 'this-month'
  }

  return 'older'
}
