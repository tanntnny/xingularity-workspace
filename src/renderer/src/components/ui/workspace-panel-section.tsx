import * as React from 'react'

import { cn } from '../../lib/utils'
import { ChevronDown } from './icons'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './collapsible'

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

interface CollapsibleWorkspacePanelSectionProps extends Omit<
  WorkspacePanelSectionProps,
  'children'
> {
  heading: React.ReactNode
  description?: React.ReactNode
  defaultOpen?: boolean
  children?: React.ReactNode
}

const CollapsibleWorkspacePanelSection = React.forwardRef<
  HTMLElement,
  CollapsibleWorkspacePanelSectionProps
>(({ className, heading, description, defaultOpen = true, children, ...props }, ref) => (
  <Collapsible defaultOpen={defaultOpen} asChild>
    <WorkspacePanelSection
      ref={ref}
      className={cn('gap-0 overflow-hidden p-0', className)}
      {...props}
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="group flex min-h-[var(--control-height)] w-full items-center justify-between gap-3 bg-transparent px-4 py-3 text-left text-sm font-semibold text-muted-foreground transition-colors hover:bg-transparent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        >
          <span className="min-w-0 truncate">{heading}</span>
          <ChevronDown
            aria-hidden="true"
            className="size-[var(--control-icon-size)] shrink-0 text-muted-foreground transition-colors transition-transform duration-200 ease-out group-hover:text-foreground group-data-[state=open]:rotate-180 motion-reduce:transition-none"
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div>
          {description ? (
            <p className="px-4 pb-1 pt-3 text-xs text-muted-foreground">{description}</p>
          ) : null}
          {children}
        </div>
      </CollapsibleContent>
    </WorkspacePanelSection>
  </Collapsible>
))
CollapsibleWorkspacePanelSection.displayName = 'CollapsibleWorkspacePanelSection'

export { CollapsibleWorkspacePanelSection, WorkspacePanelSection, WorkspacePanelSectionHeader }
