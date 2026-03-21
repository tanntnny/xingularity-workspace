import * as React from 'react'

import { cn } from '../../lib/utils'

interface WorkspacePanelSectionProps extends React.HTMLAttributes<HTMLElement> {}

const WorkspacePanelSection = React.forwardRef<HTMLElement, WorkspacePanelSectionProps>(
  ({ className, ...props }, ref) => (
    <section ref={ref} className={cn('flex flex-col gap-3', className)} {...props} />
  )
)
WorkspacePanelSection.displayName = 'WorkspacePanelSection'

interface WorkspacePanelSectionHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  icon: React.ReactNode
  heading: React.ReactNode
  description: React.ReactNode
  actions?: React.ReactNode
}

const WorkspacePanelSectionHeader = React.forwardRef<
  HTMLDivElement,
  WorkspacePanelSectionHeaderProps
>(({ className, icon, heading, description, actions, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex items-start justify-between gap-3', className)}
    {...props}
  >
    <div className="flex min-w-0 items-center gap-2">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]">
        {icon}
      </div>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-[var(--text)]">{heading}</h2>
        <p className="text-xs text-[var(--muted)]">{description}</p>
      </div>
    </div>
    {actions ? <div className="shrink-0">{actions}</div> : null}
  </div>
))
WorkspacePanelSectionHeader.displayName = 'WorkspacePanelSectionHeader'

export { WorkspacePanelSection, WorkspacePanelSectionHeader }
