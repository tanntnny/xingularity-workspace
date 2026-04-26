import * as React from 'react'

import { cn } from '../../lib/utils'
import {
  ButtonGroup,
  ButtonGroupItem,
  type ButtonGroupItemProps,
  type ButtonGroupProps
} from './button-group'

type TabMenuVariant = 'boxed' | 'inline-accent'

export interface TabMenuProps extends Omit<ButtonGroupProps, 'variant' | 'size'> {
  variant?: TabMenuVariant
}

const TabMenu = React.forwardRef<HTMLDivElement, TabMenuProps>(
  ({ className, children, variant = 'boxed', ...props }, ref) => (
    <div
      className={cn(
        'tab-menu-shell flex w-full items-center py-2',
        variant === 'inline-accent' ? 'border-b border-[var(--line)] py-0' : null
      )}
    >
      <ButtonGroup
        ref={ref}
        variant={variant === 'inline-accent' ? 'ghost' : 'default'}
        size="default"
        className={cn(
          variant === 'inline-accent'
            ? 'tab-menu-group min-h-10 gap-5 rounded-none border-0 bg-transparent p-0 shadow-none'
            : 'tab-menu-group rounded-md p-1',
          className
        )}
        {...props}
      >
        {children}
        {variant === 'inline-accent' ? null : (
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

const TabMenuItem = React.forwardRef<HTMLButtonElement, TabMenuItemProps>(
  ({ className, children, variant = 'boxed', ...props }, ref) => (
    <ButtonGroupItem
      ref={ref}
      variant="default"
      size="default"
      className={cn(
        variant === 'inline-accent'
          ? 'tab-menu-item relative h-10 rounded-none border-x-0 border-t-0 border-b-2 border-transparent bg-transparent px-0 text-[var(--muted)] shadow-none hover:bg-transparent hover:text-[var(--text)] data-[active=true]:border-[var(--accent)] data-[active=true]:bg-transparent data-[active=true]:text-[var(--accent)] data-[active=true]:shadow-none'
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

export { TabMenu, TabMenuItem }
