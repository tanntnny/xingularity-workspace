import * as React from 'react'

import type { TaskPriority } from '../../../../shared/types'
import { cn } from '../../lib/utils'

const TASK_PRIORITY_META: Record<TaskPriority, { label: string; className: string }> = {
  low: {
    label: 'Low',
    className: 'border-border bg-muted text-muted-foreground'
  },
  medium: {
    label: 'Medium',
    className: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
  },
  high: {
    label: 'High',
    className: 'border-destructive/40 bg-destructive/10 text-destructive'
  }
}

export interface TaskPriorityBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  priority?: TaskPriority
}

export function TaskPriorityBadge({
  priority,
  className,
  ...props
}: TaskPriorityBadgeProps): React.ReactElement {
  const meta = TASK_PRIORITY_META[priority ?? 'low']

  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center whitespace-nowrap rounded-[var(--radius-control)] border px-2 py-0.5 text-xs font-semibold transition-colors',
        meta.className,
        className
      )}
      {...props}
    >
      {meta.label}
    </span>
  )
}
