import * as React from 'react'

import { cn } from '../../lib/utils'
import {
  ButtonGroup,
  ButtonGroupItem,
  type ButtonGroupItemProps,
  type ButtonGroupProps
} from './button-group'

type TabMenuVariant = 'boxed' | 'inline-accent' | 'toolbar'

export interface TabMenuProps extends Omit<ButtonGroupProps, 'variant' | 'size'> {
  variant?: TabMenuVariant
  fullWidth?: boolean
  withSpacer?: boolean
  trailingAccessory?: React.ReactNode
}

const TabMenu = React.forwardRef<HTMLDivElement, TabMenuProps>(
  (
    {
      className,
      children,
      variant = 'boxed',
      fullWidth = true,
      withSpacer,
      trailingAccessory,
      ...props
    },
    ref
  ) => (
    <div
      className={cn(
        'tab-menu-shell flex min-w-0 items-center py-2',
        fullWidth ? 'w-full' : 'w-auto shrink-0',
        variant === 'inline-accent'
          ? 'border-b border-[var(--line)] py-0'
          : variant === 'toolbar'
            ? 'h-7 py-0'
            : null
      )}
    >
      <ButtonGroup
        ref={ref}
        variant={variant === 'inline-accent' ? 'ghost' : 'default'}
        size="default"
        className={cn(
          variant === 'inline-accent'
            ? 'tab-menu-group min-h-10 gap-5 rounded-none border-0 bg-transparent p-0 shadow-none'
            : variant === 'toolbar'
              ? 'tab-menu-group workspace-action-group h-full w-auto gap-0 rounded-full p-0'
              : 'tab-menu-group rounded-md p-1',
          className
        )}
        {...props}
      >
        {children}
        {trailingAccessory ? (
          <div
            className={cn(
              'tab-menu-accessory flex shrink-0 items-center',
              variant === 'inline-accent' ? 'pl-3' : variant === 'toolbar' ? 'pl-1 pr-1.5' : 'pl-1'
            )}
          >
            {trailingAccessory}
          </div>
        ) : null}
        {variant === 'inline-accent' || withSpacer === false ? null : (
          <div className="tab-menu-spacer" aria-hidden="true" />
        )}
      </ButtonGroup>
    </div>
  )
)
TabMenu.displayName = 'TabMenu'

export interface TabMenuItemProps extends Omit<ButtonGroupItemProps, 'variant' | 'size'> {
  variant?: TabMenuVariant
}

interface TabMenuCountBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  count: number
}

const TabMenuItem = React.forwardRef<HTMLButtonElement, TabMenuItemProps>(
  ({ className, children, variant = 'boxed', ...props }, ref) => (
    <ButtonGroupItem
      ref={ref}
      variant="default"
      size="default"
      className={cn(
        variant === 'inline-accent'
          ? 'tab-menu-item relative h-10 rounded-none border-x-0 border-t-0 border-b-2 border-transparent bg-transparent px-0 text-[var(--muted)] shadow-none hover:bg-transparent hover:text-[var(--text)] data-[active=true]:border-[var(--accent)] data-[active=true]:bg-transparent data-[active=true]:text-[var(--accent)] data-[active=true]:shadow-none'
          : variant === 'toolbar'
            ? 'tab-menu-item relative h-full rounded-full border border-transparent px-3 text-sm font-medium text-[var(--control-glass-muted-text)] shadow-none hover:border-[var(--control-glass-border-hover)] hover:bg-[var(--control-glass-bg-hover)] hover:text-[var(--control-glass-text)] data-[active=true]:border-[var(--control-glass-border-active)] data-[active=true]:bg-[var(--control-glass-bg-active)] data-[active=true]:text-[var(--control-glass-text)] data-[active=true]:shadow-none'
            : 'tab-menu-item relative data-[active=true]:bg-[var(--accent-soft)] data-[active=true]:text-[var(--accent)] data-[active=true]:shadow-[inset_0_0_0_1px_var(--accent-line)]',
        className
      )}
      {...props}
    >
      {children}
    </ButtonGroupItem>
  )
)
TabMenuItem.displayName = 'TabMenuItem'

function TabMenuCountBadge({
  count,
  className,
  ...props
}: TabMenuCountBadgeProps): React.ReactNode {
  return (
    <span
      className={cn(
        'inline-flex h-[1.2rem] min-w-[1.2rem] items-center justify-center rounded-full border border-[color:color-mix(in_srgb,var(--line)_78%,transparent)] bg-[color:color-mix(in_srgb,var(--panel)_82%,transparent)] px-1.5 text-[10px] font-semibold leading-none text-[var(--muted)]',
        className
      )}
      {...props}
    >
      {count}
    </span>
  )
}

export { TabMenu, TabMenuItem, TabMenuCountBadge }
