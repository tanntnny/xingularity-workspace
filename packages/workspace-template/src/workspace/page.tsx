import * as React from 'react'
import { ArrowRight } from 'lucide-react'

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
    <section ref={ref} className={cn('h-full overflow-y-auto px-8 py-7', className)} {...props}>
      <div className={cn('mx-auto flex flex-col gap-6', pageWidthClass[width])}>{children}</div>
    </section>
  )
)

WorkspacePage.displayName = 'WorkspacePage'

interface WorkspacePageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  eyebrow?: React.ReactNode
  heading: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  icon?: React.ReactNode
}

const WorkspacePageHeader = React.forwardRef<HTMLDivElement, WorkspacePageHeaderProps>(
  ({ className, eyebrow, heading, description, actions, icon, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between', className)}
      {...props}
    >
      <div className="min-w-0">
        {eyebrow ? <p className="workspace-eyebrow">{eyebrow}</p> : null}
        <h1 className="mt-2 inline-flex items-center gap-3 text-4xl font-semibold tracking-[-0.03em] text-[var(--text)]">
          {icon}
          <span>{heading}</span>
        </h1>
        {description ? (
          <p className="mt-3 max-w-2xl text-sm workspace-meta">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  )
)

WorkspacePageHeader.displayName = 'WorkspacePageHeader'

const WorkspaceSectionCard = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  ({ className, ...props }, ref) => (
    <section
      ref={ref}
      className={cn('workspace-subtle-surface rounded-lg p-6', className)}
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
        'workspace-subtle-surface rounded-lg border border-dashed border-[var(--line)] px-4 py-6',
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-2 text-[var(--text)]">
        {icon}
        <p className="font-medium">{heading}</p>
      </div>
      <p className="mt-2 text-sm workspace-meta">{description}</p>
      {actionLabel && onAction ? (
        <Button
          type="button"
          variant="outline"
          className="workspace-subtle-control mt-4 inline-flex gap-1 border-[var(--line)]"
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
