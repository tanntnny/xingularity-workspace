import * as React from 'react'
import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group'
import { cva } from 'class-variance-authority'

import { cn } from '../../lib/utils'
import { getButtonTooltipLabel, TooltipButton } from './tooltip'

const tabToggleGroupItemVariants = cva(
  'ui-control inline-flex h-[var(--control-height)] min-w-0 max-w-full shrink-0 items-center justify-center gap-1 overflow-hidden text-ellipsis whitespace-nowrap rounded-[var(--radius-button)] border border-input bg-panel px-[var(--control-padding-x)] font-medium text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none [&>span:first-of-type]:min-w-0 [&>span:first-of-type]:flex-1 [&>span:first-of-type]:truncate',
  {
    variants: {
      state: {
        idle: 'hover:bg-muted hover:text-foreground',
        selected: 'bg-panel-hover text-foreground shadow-sm'
      }
    },
    defaultVariants: {
      state: 'idle'
    }
  }
)

interface TabToggleGroupContextValue {
  value: string
}

const TabToggleGroupContext = React.createContext<TabToggleGroupContextValue>({ value: '' })

export type TabToggleGroupProps = Omit<
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root>,
  'type' | 'value' | 'defaultValue' | 'onValueChange' | 'role'
> & {
  value: string
  onValueChange: (value: string) => void
}

export type TabToggleGroupItemProps = Omit<
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item>,
  'role' | 'aria-selected' | 'aria-checked' | 'aria-pressed'
> & {
  tooltip?: string
  tooltipWrapperClassName?: string
}

const TabToggleGroup = React.forwardRef<
  React.ComponentRef<typeof ToggleGroupPrimitive.Root>,
  TabToggleGroupProps
>(({ className, value, onValueChange, children, ...props }, ref) => (
  <ToggleGroupPrimitive.Root
    ref={ref}
    type="single"
    value={value}
    onValueChange={(nextValue) => {
      if (nextValue) onValueChange(nextValue)
    }}
    className={cn(
      'inline-flex min-w-0 max-w-full items-center gap-1 overflow-x-auto scrollbar-none',
      className
    )}
    {...props}
    role="tablist"
  >
    <TabToggleGroupContext.Provider value={{ value }}>{children}</TabToggleGroupContext.Provider>
  </ToggleGroupPrimitive.Root>
))
TabToggleGroup.displayName = 'TabToggleGroup'

const TabToggleGroupItem = React.forwardRef<
  React.ComponentRef<typeof ToggleGroupPrimitive.Item>,
  TabToggleGroupItemProps
>(
  (
    {
      className,
      value,
      children,
      tooltip,
      tooltipWrapperClassName,
      title,
      'aria-label': ariaLabel,
      ...props
    },
    ref
  ) => {
    const context = React.useContext(TabToggleGroupContext)
    const selected = context.value === value
    const resolvedTooltip = getButtonTooltipLabel(tooltip, ariaLabel, title, children)
    const item = (
      <ToggleGroupPrimitive.Item
        ref={ref}
        value={value}
        data-tab-toggle-group-item="true"
        className={cn(
          tabToggleGroupItemVariants({ state: selected ? 'selected' : 'idle' }),
          className
        )}
        {...props}
        role="tab"
        aria-label={ariaLabel}
        title={title}
        aria-selected={selected}
        aria-checked={undefined}
        aria-pressed={undefined}
      >
        {children}
      </ToggleGroupPrimitive.Item>
    )

    return resolvedTooltip ? (
      <TooltipButton
        label={resolvedTooltip}
        disabled={props.disabled}
        wrapperClassName={tooltipWrapperClassName}
        preserveChildAttributes
      >
        {item}
      </TooltipButton>
    ) : (
      item
    )
  }
)
TabToggleGroupItem.displayName = 'TabToggleGroupItem'

export { TabToggleGroup, TabToggleGroupItem }
