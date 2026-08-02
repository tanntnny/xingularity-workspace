import * as React from 'react'

import { cn } from '../../lib/utils'

interface WorkspacePanelSectionProps extends React.HTMLAttributes<HTMLElement> {}

const WorkspacePanelSection = React.forwardRef<HTMLElement, WorkspacePanelSectionProps>(
  ({ className, ...props }, ref) => (
    <section
      ref={ref}
      className={cn(
        'flex flex-col gap-3 rounded-lg border bg-card p-4 text-card-foreground',
        className
      )}
      {...props}
    />
  )
)
WorkspacePanelSection.displayName = 'WorkspacePanelSection'

interface WorkspacePanelSectionHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  heading: React.ReactNode
  description: React.ReactNode
  actions?: React.ReactNode
}

const WorkspacePanelSectionHeader = React.forwardRef<
  HTMLDivElement,
  WorkspacePanelSectionHeaderProps
>(({ className, heading, description, actions, ...props }, ref) => {
  return (
    <div ref={ref} className={cn('flex items-start justify-between gap-3', className)} {...props}>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold">{heading}</h2>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  )
})
WorkspacePanelSectionHeader.displayName = 'WorkspacePanelSectionHeader'

export { WorkspacePanelSection, WorkspacePanelSectionHeader }
