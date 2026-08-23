import * as React from 'react'

import type { TaskPriority } from '../../../../shared/types'
import { getTaskPriorityChipItem } from '../../lib/statusChipMeta'
import { StatusChip } from './status-chip'

export interface TaskPriorityBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  priority?: TaskPriority
}

export function TaskPriorityBadge({
  priority,
  className,
  ...props
}: TaskPriorityBadgeProps): React.ReactElement {
  return <StatusChip item={getTaskPriorityChipItem(priority)} className={className} {...props} />
}
