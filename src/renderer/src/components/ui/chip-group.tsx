import * as React from 'react'

import { cn } from '../../lib/utils'

export interface ChipGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  'data-testid'?: string
}

export const ChipGroup = React.forwardRef<HTMLDivElement, ChipGroupProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      role="group"
      className={cn(
        'inline-flex min-w-0 max-w-full items-stretch overflow-hidden rounded-[var(--radius-button-pill)] border border-border bg-surface-subtle divide-x divide-foreground/30 [&>*]:w-fit [&>*:hover]:!bg-surface-subtle-hover [&>*:focus-visible]:!bg-surface-subtle-hover focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background',
        className
      )}
      {...props}
    />
  )
)
ChipGroup.displayName = 'ChipGroup'
