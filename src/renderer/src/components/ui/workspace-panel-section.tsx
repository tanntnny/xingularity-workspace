import * as React from 'react'

import { cn } from '../../lib/utils'
import { ChevronDown } from './icons'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './collapsible'
import { getButtonTooltipLabel, TooltipButton } from './tooltip'

interface WorkspacePanelSectionProps extends React.HTMLAttributes<HTMLElement> {}

const WorkspacePanelSection = React.forwardRef<HTMLElement, WorkspacePanelSectionProps>(
  ({ className, ...props }, ref) => (
    <section
      ref={ref}
      className={cn(
        'flex shrink-0 flex-col gap-3 rounded-shell border border-panel-border bg-panel p-4 text-card-foreground',
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
  actions?: React.ReactNode
  contentClassName?: string
  children?: React.ReactNode
}

const CollapsibleWorkspacePanelSection = React.forwardRef<
  HTMLElement,
  CollapsibleWorkspacePanelSectionProps
>(
  (
    {
      className,
      heading,
      description,
      defaultOpen = true,
      actions,
      contentClassName,
      children,
      ...props
    },
    ref
  ) => (
    <Collapsible defaultOpen={defaultOpen} asChild>
      <WorkspacePanelSection
        ref={ref}
        className={cn('gap-0 overflow-hidden p-0', className)}
        {...props}
      >
        <div className="flex min-h-[var(--control-height)] items-center gap-2 px-4 py-3">
          <TooltipButton
            label={
              getButtonTooltipLabel(undefined, undefined, undefined, heading) ?? 'Toggle section'
            }
          >
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="group flex min-w-0 flex-1 items-center justify-between gap-3 bg-transparent p-0 text-left text-sm font-semibold text-muted-foreground transition-colors motion-reduce:transition-none hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
              >
                <span className="min-w-0 truncate">{heading}</span>
                <ChevronDown
                  aria-hidden="true"
                  className="motion-state-chevron size-[var(--control-icon-size)] shrink-0 text-muted-foreground group-hover:text-foreground group-data-[state=open]:rotate-180"
                />
              </button>
            </CollapsibleTrigger>
          </TooltipButton>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
        <CollapsibleContent className={contentClassName}>
          {description ? (
            <p className="px-4 pb-1 pt-3 text-xs text-muted-foreground">{description}</p>
          ) : null}
          {children}
        </CollapsibleContent>
      </WorkspacePanelSection>
    </Collapsible>
  )
)
CollapsibleWorkspacePanelSection.displayName = 'CollapsibleWorkspacePanelSection'

export { CollapsibleWorkspacePanelSection, WorkspacePanelSection, WorkspacePanelSectionHeader }
