import * as React from 'react'

import { cn } from '../../lib/utils'

type WorkspacePageProps = React.HTMLAttributes<HTMLDivElement>

const WorkspacePage = React.forwardRef<HTMLDivElement, WorkspacePageProps>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={cn('flex min-h-full w-full flex-col gap-6', className)} {...props}>
      {children}
    </div>
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

interface WorkspacePageLayoutProps extends React.HTMLAttributes<HTMLElement> {
  heading?: React.ReactNode
  description?: React.ReactNode
  toolbar?: React.ReactNode
  aside?: React.ReactNode
  asideLabel?: string
}

const WorkspacePageLayout = React.forwardRef<HTMLElement, WorkspacePageLayoutProps>(
  (
    {
      className,
      heading,
      description,
      toolbar,
      aside,
      asideLabel = 'Context panel',
      children,
      ...props
    },
    ref
  ) => (
    <section
      ref={ref}
      className={cn(
        'grid min-h-full w-full min-w-0 grid-cols-1',
        aside && 'lg:grid-cols-[minmax(0,1fr)_18rem]',
        className
      )}
      {...props}
    >
      <div className="min-w-0 w-full p-3">
        <div className="flex min-h-full w-full flex-col gap-6">
          {heading || description || toolbar ? (
            <header className="flex flex-col gap-4 border-b pb-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                {heading ? (
                  <h1 className="text-2xl font-semibold tracking-tight">{heading}</h1>
                ) : null}
                {description ? (
                  <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                ) : null}
              </div>
              {toolbar ? <div className="flex shrink-0 items-center gap-2">{toolbar}</div> : null}
            </header>
          ) : null}
          {children}
        </div>
      </div>
      {aside ? (
        <aside
          aria-label={asideLabel}
          className="min-h-0 overflow-y-auto border-t bg-muted p-3 lg:border-l lg:border-t-0"
        >
          {aside}
        </aside>
      ) : null}
    </section>
  )
)

WorkspacePageLayout.displayName = 'WorkspacePageLayout'

const WorkspaceSectionCard = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('rounded-lg border bg-card p-6 text-card-foreground', className)}
      {...props}
    />
  )
)

WorkspaceSectionCard.displayName = 'WorkspaceSectionCard'

export { WorkspacePage, WorkspacePageHeader, WorkspacePageLayout, WorkspaceSectionCard }
