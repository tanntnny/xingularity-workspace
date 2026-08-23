import * as React from 'react'
import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group'

import { cn } from '../../lib/utils'
import { statusChipVariants } from './status-chip-variants'

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
  'items-center text-left hover:bg-card-hover hover:text-foreground focus-visible:bg-card-hover data-[state=on]:bg-card-hover data-[state=on]:text-foreground data-[state=on]:shadow-sm'
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
    className={cn('flex min-w-0 flex-wrap items-center gap-1.5', className)}
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
    <span className="min-w-0 truncate text-left">{children}</span>
  </ToggleGroupPrimitive.Item>
))
StatusChipToggleItem.displayName = 'StatusChipToggleItem'

export { StatusChipToggleGroup, StatusChipToggleItem }
