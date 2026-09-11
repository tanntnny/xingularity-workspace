import * as React from 'react'

import { Button, type ButtonProps } from './button'
import { cn } from '../../lib/utils'
import { WorkspaceTextFadeContent } from './workspace-text-fade'

export interface WorkspaceListRailProps extends React.HTMLAttributes<HTMLElement> {
  emptyState?: React.ReactNode
}

export interface WorkspaceListRailItemProps extends Omit<
  ButtonProps,
  'asChild' | 'className' | 'size' | 'variant'
> {
  active?: boolean
  className?: string
  description?: React.ReactNode
  leading?: React.ReactNode
  trailing?: React.ReactNode
}

const WorkspaceListRail = React.forwardRef<HTMLElement, WorkspaceListRailProps>(
  ({ children, className, emptyState, ...props }, ref) => {
    const hasItems = React.Children.count(children) > 0

    return (
      <nav ref={ref} className={cn('flex flex-col p-3', className)} {...props}>
        {hasItems ? (
          <ul className="flex min-w-0 flex-col gap-2">{children}</ul>
        ) : emptyState ? (
          <div className="p-1 text-sm text-muted-foreground">{emptyState}</div>
        ) : null}
      </nav>
    )
  }
)
WorkspaceListRail.displayName = 'WorkspaceListRail'

const WorkspaceListRailItem = React.forwardRef<HTMLButtonElement, WorkspaceListRailItemProps>(
  (
    {
      active = false,
      children,
      className,
      description,
      leading,
      trailing,
      ...props
    },
    ref
  ) => {
    return (
      <li className="min-w-0">
        <Button
          ref={ref}
          type="button"
          variant={active ? 'secondary' : 'ghost'}
          aria-current={active ? 'page' : undefined}
          data-active={active}
          className={cn(
            'h-auto min-h-[var(--control-height)] w-full justify-start gap-2 rounded-[var(--radius-button)] px-3 py-2 text-left',
            className
          )}
          {...props}
        >
          {leading ? <span className="shrink-0">{leading}</span> : null}
          <span className="min-w-0 flex-1">
            <WorkspaceTextFadeContent className="max-w-full min-w-0">
              {children}
            </WorkspaceTextFadeContent>
            {description ? (
              <WorkspaceTextFadeContent className="min-w-0 text-xs text-muted-foreground">
                {description}
              </WorkspaceTextFadeContent>
            ) : null}
          </span>
          {trailing ? <span className="shrink-0">{trailing}</span> : null}
        </Button>
      </li>
    )
  }
)
WorkspaceListRailItem.displayName = 'WorkspaceListRailItem'

export { WorkspaceListRail, WorkspaceListRailItem }
