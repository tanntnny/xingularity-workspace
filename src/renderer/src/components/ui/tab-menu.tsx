import * as React from 'react'

import { cn } from '../../lib/utils'
import {
  ButtonGroup,
  ButtonGroupItem,
  type ButtonGroupItemProps,
  type ButtonGroupProps
} from './button-group'

export interface TabMenuProps extends Omit<ButtonGroupProps, 'variant' | 'size'> {}

const TabMenu = React.forwardRef<HTMLDivElement, TabMenuProps>(
  ({ className, children, ...props }, ref) => (
    <div className="tab-menu-shell flex w-full items-center py-2">
      <ButtonGroup
        ref={ref}
        variant="default"
        size="default"
        className={cn(
          'tab-menu-group rounded-md border border-[var(--line)] bg-[color-mix(in_srgb,var(--panel-2)_78%,var(--panel))] p-1',
          className
        )}
        {...props}
      >
        {children}
        <div className="tab-menu-spacer" aria-hidden="true" />
      </ButtonGroup>
    </div>
  )
)
TabMenu.displayName = 'TabMenu'

export interface TabMenuItemProps extends Omit<ButtonGroupItemProps, 'variant' | 'size'> {}

const TabMenuItem = React.forwardRef<HTMLButtonElement, TabMenuItemProps>(
  ({ className, children, ...props }, ref) => (
    <ButtonGroupItem
      ref={ref}
      variant="default"
      size="default"
      className={cn(
        'tab-menu-item relative data-[active=true]:bg-[var(--accent-soft)] data-[active=true]:text-[var(--accent)] data-[active=true]:shadow-[inset_0_0_0_1px_var(--accent-line)]',
        className
      )}
      {...props}
    >
      {children}
    </ButtonGroupItem>
  )
)
TabMenuItem.displayName = 'TabMenuItem'

export { TabMenu, TabMenuItem }
