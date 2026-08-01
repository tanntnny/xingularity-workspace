import * as React from 'react'

import type { CalendarTaskType } from '../../../../shared/types'
import { formatCalendarTaskType } from '../../../../shared/types'
import {
  getCalendarTaskBackgroundToken,
  getCalendarTaskBorderToken
} from '../../lib/calendarTaskTypeBackground'
import { cn } from '../../lib/utils'

export interface CalendarTaskTypeBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  taskType?: CalendarTaskType
}

export function CalendarTaskTypeBadge({
  taskType,
  className,
  children,
  style,
  ...props
}: CalendarTaskTypeBadgeProps): React.ReactElement {
  const resolvedTaskType = taskType ?? 'assignment'

  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center whitespace-nowrap rounded-[var(--radius-control)] border px-2 py-0.5 text-xs font-semibold text-foreground transition-colors',
        className
      )}
      style={{
        backgroundColor: getCalendarTaskBackgroundToken(resolvedTaskType),
        borderColor: getCalendarTaskBorderToken(resolvedTaskType),
        ...style
      }}
      {...props}
    >
      {children ?? formatCalendarTaskType(resolvedTaskType)}
    </span>
  )
}
