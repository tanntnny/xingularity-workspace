import * as React from 'react'
import { ArrowRight } from '../ui/icons'

import { cn } from '../lib/utils'
import { Button } from '../ui/button'

interface WorkspacePageProps extends React.HTMLAttributes<HTMLElement> {
  width?: 'default' | 'wide' | 'full'
}

const pageWidthClass: Record<NonNullable<WorkspacePageProps['width']>, string> = {
  default: 'max-w-5xl',
  wide: 'max-w-6xl',
  full: 'max-w-none'
}

const WorkspacePage = React.forwardRef<HTMLElement, WorkspacePageProps>(
  ({ className, width = 'default', children, ...props }, ref) => (
    <main ref={ref} className={cn('h-full overflow-y-auto p-2', className)} {...props}>
      <div className={cn('mx-auto flex flex-col gap-6', pageWidthClass[width])}>{children}</div>
    </main>
  )
)

WorkspacePage.displayName = 'WorkspacePage'

interface WorkspacePageHeaderProps extends React.HTMLAttributes<HTMLElement> {
  eyebrow?: React.ReactNode
  heading: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  icon?: React.ReactNode
}

const WorkspacePageHeader = React.forwardRef<HTMLElement, WorkspacePageHeaderProps>(
  ({ className, eyebrow, heading, description, actions, icon, ...props }, ref) => (
    <header
      ref={ref}
      className={cn('flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between', className)}
      {...props}
    >
      <div className="min-w-0">
        {eyebrow ? <p className="text-sm font-medium text-muted-foreground">{eyebrow}</p> : null}
        <h1 className="mt-2 inline-flex items-center gap-3 text-3xl font-semibold tracking-tight text-foreground">
          {icon}
          <span>{heading}</span>
        </h1>
        {description ? (
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </header>
  )
)

WorkspacePageHeader.displayName = 'WorkspacePageHeader'

const WorkspaceSectionCard = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  ({ className, ...props }, ref) => (
    <section
      ref={ref}
      className={cn('rounded-lg border bg-card p-6 text-card-foreground', className)}
      {...props}
    />
  )
)

WorkspaceSectionCard.displayName = 'WorkspaceSectionCard'

interface WorkspaceEmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon: React.ReactNode
  heading: React.ReactNode
  description: React.ReactNode
  actionLabel?: string
  onAction?: () => void
}

const WorkspaceEmptyState = React.forwardRef<HTMLDivElement, WorkspaceEmptyStateProps>(
  ({ className, icon, heading, description, actionLabel, onAction, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-lg border border-dashed bg-card px-4 py-6 text-card-foreground',
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-2 text-foreground">
        {icon}
        <p className="font-medium">{heading}</p>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      {actionLabel && onAction ? (
        <Button
          type="button"
          variant="outline"
          className="mt-4 inline-flex gap-1"
          onClick={onAction}
        >
          <span>{actionLabel}</span>
          <ArrowRight size={15} />
        </Button>
      ) : null}
    </div>
  )
)

WorkspaceEmptyState.displayName = 'WorkspaceEmptyState'

export { WorkspacePage, WorkspacePageHeader, WorkspaceSectionCard, WorkspaceEmptyState }
