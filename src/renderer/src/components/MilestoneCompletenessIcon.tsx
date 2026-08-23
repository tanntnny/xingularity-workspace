import type { ReactElement } from 'react'
import { cn } from '../lib/utils'
import type { ProjectMilestoneStatus } from '../lib/projectMilestones'
import { Milestone, MilestoneFilled } from './ui/icons'

export function MilestoneCompletenessIcon({
  status,
  size = 18,
  className = '',
  dataTestId
}: {
  status: ProjectMilestoneStatus
  size?: number
  className?: string
  dataTestId?: string
}): ReactElement {
  const completed = status === 'complete'
  const Icon = completed ? MilestoneFilled : Milestone
  const statusClassName = {
    current: 'text-milestone-current',
    complete: 'text-milestone-complete',
    unreached: 'text-milestone-unreached'
  }[status]

  return (
    <Icon
      aria-hidden="true"
      className={cn('shrink-0', statusClassName, className)}
      data-completed={completed ? 'true' : 'false'}
      data-milestone-status={status}
      data-testid={dataTestId}
      size={size}
    />
  )
}
