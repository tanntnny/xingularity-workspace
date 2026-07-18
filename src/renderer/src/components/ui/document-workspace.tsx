import * as React from 'react'

import { cn } from '../../lib/utils'

interface DocumentWorkspaceProps extends React.HTMLAttributes<HTMLDivElement> {
  tabLabel?: string
}

interface WorkspaceTabManagerProps extends React.HTMLAttributes<HTMLElement> {
  label: string
}

const WorkspaceTabManager = React.forwardRef<HTMLElement, WorkspaceTabManagerProps>(
  ({ className, label, ...props }, ref) => (
    <nav
      ref={ref}
      aria-label="Current workspace"
      className={cn(
        'document-workspace-tab-manager app-drag-region mb-1 flex h-11 shrink-0 items-end py-1',
        className
      )}
      {...props}
    >
      <span
        aria-current="page"
        data-testid="workspace-current-tab"
        className="app-no-drag document-workspace-current-tab inline-flex items-center rounded-t-lg border-y border-r border-b-0 border-[var(--shell-border)] px-3 py-1 text-sm font-medium text-[var(--text)]"
      >
        {label}
      </span>
    </nav>
  )
)
WorkspaceTabManager.displayName = 'WorkspaceTabManager'

const workspaceMainHeaderClass =
  'document-workspace-header document-workspace-main-header app-drag-region flex h-[72px] shrink-0 items-center gap-2 border-b border-[var(--shell-border)] bg-[var(--shell-breadcrumb-surface)] px-3'

const workspacePanelHeaderClass =
  'document-workspace-header document-workspace-panel-header app-drag-region flex h-[72px] shrink-0 items-center gap-2 border-b border-[var(--shell-border)] bg-[var(--shell-breadcrumb-surface)] px-3'

const workspaceHeaderActionRowClass = 'app-no-drag ml-auto flex shrink-0 items-center gap-2'

const DocumentWorkspace = React.forwardRef<HTMLDivElement, DocumentWorkspaceProps>(
  ({ className, tabLabel, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('document-workspace-frame flex h-full w-full min-w-0 flex-col p-2', className)}
      {...props}
    >
      {tabLabel ? <WorkspaceTabManager label={tabLabel} /> : null}
      <div className="document-workspace-body flex min-h-0 min-w-0 flex-1 gap-2 overflow-hidden rounded-xl border border-[var(--shell-border)] p-2">
        {children}
      </div>
      <div
        aria-hidden="true"
        className="document-workspace-footer app-drag-region mt-1 h-11 shrink-0"
      />
    </div>
  )
)
DocumentWorkspace.displayName = 'DocumentWorkspace'

const DocumentWorkspaceMain = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <section
    ref={ref}
    className={cn(
      'document-workspace-main-surface flex min-w-0 flex-1 flex-col overflow-hidden',
      className
    )}
    {...props}
  />
))
DocumentWorkspaceMain.displayName = 'DocumentWorkspaceMain'

const DocumentWorkspacePanel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'document-workspace-panel-surface flex w-[var(--workspace-pane-width)] basis-[var(--workspace-pane-width)] shrink-0 flex-col overflow-hidden rounded-xl border border-[var(--shell-border)] bg-[var(--workspace-main-panel)] p-2',
      className
    )}
    {...props}
  />
))
DocumentWorkspacePanel.displayName = 'DocumentWorkspacePanel'

interface DocumentWorkspaceMainHeaderProps extends React.HTMLAttributes<HTMLElement> {
  breadcrumb?: React.ReactNode
  actions?: React.ReactNode
}

const DocumentWorkspaceMainHeader = React.forwardRef<HTMLElement, DocumentWorkspaceMainHeaderProps>(
  ({ className, breadcrumb, actions, ...props }, ref) => (
    <header ref={ref} className={cn(workspaceMainHeaderClass, className)} {...props}>
      <div className="app-no-drag flex min-w-0 items-center gap-3">{breadcrumb}</div>
      {actions ? <div className={workspaceHeaderActionRowClass}>{actions}</div> : null}
    </header>
  )
)
DocumentWorkspaceMainHeader.displayName = 'DocumentWorkspaceMainHeader'

interface DocumentWorkspacePanelHeaderProps extends React.HTMLAttributes<HTMLElement> {
  leading?: React.ReactNode
  actions?: React.ReactNode
}

const DocumentWorkspacePanelHeader = React.forwardRef<
  HTMLElement,
  DocumentWorkspacePanelHeaderProps
>(({ className, leading, actions, children, ...props }, ref) => {
  const resolvedLeading = leading ?? (!actions ? children : null)

  return (
    <header ref={ref} className={cn(workspacePanelHeaderClass, className)} {...props}>
      {resolvedLeading ? (
        <div className="app-no-drag flex min-w-0 items-center gap-3">{resolvedLeading}</div>
      ) : null}
      {actions ? <div className={workspaceHeaderActionRowClass}>{actions}</div> : null}
    </header>
  )
})
DocumentWorkspacePanelHeader.displayName = 'DocumentWorkspacePanelHeader'

const WorkspaceHeaderActions = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('flex items-center gap-2', className)} {...props} />
))
WorkspaceHeaderActions.displayName = 'WorkspaceHeaderActions'

const WorkspaceHeaderActionGroup = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('flex items-center gap-2', className)} {...props} />
))
WorkspaceHeaderActionGroup.displayName = 'WorkspaceHeaderActionGroup'

const WorkspaceHeaderActionDivider = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    aria-hidden="true"
    className={cn('h-5 w-px shrink-0 bg-[var(--sidebar-border)]', className)}
    {...props}
  />
))
WorkspaceHeaderActionDivider.displayName = 'WorkspaceHeaderActionDivider'

interface WorkspaceActionButtonProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'children'
> {
  icon: React.ReactNode
  label?: string
  active?: boolean
}

const WorkspaceActionButton = React.forwardRef<HTMLButtonElement, WorkspaceActionButtonProps>(
  ({ className, icon, label, active = false, type = 'button', ...props }, ref) => {
    const inferredLabel =
      label ??
      (typeof props['aria-label'] === 'string' ? props['aria-label'] : undefined) ??
      (typeof props.title === 'string' ? props.title : undefined)

    return (
      <button
        ref={ref}
        type={type}
        data-active={active ? 'true' : 'false'}
        data-no-ripple
        className={cn(
          'workspace-action-button inline-flex shrink-0 items-center justify-center overflow-hidden border text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-50',
          label ? 'h-8 gap-2 rounded-lg px-3 text-sm font-medium' : 'h-8 w-8 rounded-lg',
          className
        )}
        aria-label={props['aria-label'] ?? inferredLabel}
        title={props.title ?? inferredLabel}
        {...props}
      >
        {icon}
        {label ? <span>{label}</span> : null}
      </button>
    )
  }
)
WorkspaceActionButton.displayName = 'WorkspaceActionButton'

const DocumentWorkspaceMainContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'document-workspace-main-content min-h-0 min-w-0 flex-1 overflow-hidden',
      className
    )}
    {...props}
  />
))
DocumentWorkspaceMainContent.displayName = 'DocumentWorkspaceMainContent'

const DocumentWorkspacePanelContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('min-h-0 flex-1 overflow-y-auto', className)} {...props} />
))
DocumentWorkspacePanelContent.displayName = 'DocumentWorkspacePanelContent'

interface WorkspaceContextEmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string
  description: string
}

const WorkspaceContextEmptyState = React.forwardRef<
  HTMLDivElement,
  WorkspaceContextEmptyStateProps
>(({ className, title = 'Context', description, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('document-workspace-context-empty m-3 rounded-xl p-4', className)}
    {...props}
  >
    <p className="text-sm font-semibold text-[var(--text)]">{title}</p>
    <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{description}</p>
  </div>
))
WorkspaceContextEmptyState.displayName = 'WorkspaceContextEmptyState'

export {
  DocumentWorkspace,
  WorkspaceTabManager,
  DocumentWorkspaceMain,
  DocumentWorkspaceMainHeader,
  DocumentWorkspaceMainContent,
  DocumentWorkspacePanel,
  DocumentWorkspacePanelHeader,
  DocumentWorkspacePanelContent,
  WorkspaceContextEmptyState,
  WorkspaceHeaderActions,
  WorkspaceHeaderActionGroup,
  WorkspaceHeaderActionDivider,
  WorkspaceActionButton
}
