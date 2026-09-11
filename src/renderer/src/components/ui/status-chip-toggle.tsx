import * as React from 'react'
import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group'

import { cn } from '../../lib/utils'
import { statusChipVariants } from './status-chip-variants'
import { WorkspaceTextFade } from './workspace-text-fade'

export type StatusChipToggleGroupProps = Omit<
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root>,
  'type' | 'value' | 'defaultValue' | 'onValueChange'
> & {
  value: string
  onValueChange: (value: string) => void
}

export type StatusChipToggleItemProps = React.ComponentPropsWithoutRef<
  typeof ToggleGroupPrimitive.Item
>

const statusChipToggleItemClassName = cn(
  statusChipVariants({ variant: 'default', surface: 'none' }),
  'items-center rounded-none border-0 bg-transparent text-left hover:bg-surface-subtle-hover hover:text-foreground focus-visible:bg-surface-subtle-hover data-[state=on]:bg-surface-subtle-hover data-[state=on]:text-foreground data-[state=on]:shadow-sm'
)

const StatusChipToggleGroup = React.forwardRef<
  React.ComponentRef<typeof ToggleGroupPrimitive.Root>,
  StatusChipToggleGroupProps
>(({ className, value, onValueChange, children, ...props }, ref) => (
  <ToggleGroupPrimitive.Root
    ref={ref}
    {...props}
    type="single"
    value={value}
    onValueChange={(nextValue) => {
      if (nextValue) onValueChange(nextValue)
    }}
    className={cn(
      'inline-flex min-w-0 max-w-full items-stretch overflow-hidden rounded-[var(--radius-button-pill)] border border-border bg-surface-subtle divide-x divide-foreground/30 [&>*]:w-fit focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background',
      className
    )}
  >
    {children}
  </ToggleGroupPrimitive.Root>
))
StatusChipToggleGroup.displayName = 'StatusChipToggleGroup'

const StatusChipToggleItem = React.forwardRef<
  React.ComponentRef<typeof ToggleGroupPrimitive.Item>,
  StatusChipToggleItemProps
>(({ className, children, ...props }, ref) => (
  <ToggleGroupPrimitive.Item
    ref={ref}
    {...props}
    className={cn(statusChipToggleItemClassName, className)}
  >
    <WorkspaceTextFade className="min-w-0 flex-1 text-left">{children}</WorkspaceTextFade>
  </ToggleGroupPrimitive.Item>
))
StatusChipToggleItem.displayName = 'StatusChipToggleItem'

export { StatusChipToggleGroup, StatusChipToggleItem }
