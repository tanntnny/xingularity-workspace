import * as React from 'react'

import type { CalendarTaskType } from '../../../../shared/types'
import { getCalendarTaskTypeChipItem } from '../../lib/statusChipMeta'
import { StatusChip } from './status-chip'

export interface CalendarTaskTypeBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  taskType?: CalendarTaskType
}

export function CalendarTaskTypeBadge({
  taskType,
  className,
  children,
  ...props
}: CalendarTaskTypeBadgeProps): React.ReactElement {
  const item = getCalendarTaskTypeChipItem(taskType)

  return (
    <StatusChip
      item={{ ...item, label: children ?? item.label }}
      className={className}
      {...props}
    />
  )
}
