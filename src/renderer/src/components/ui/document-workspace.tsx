import * as React from 'react'

import { cn } from '../../lib/utils'

const workspaceHeaderClass =
  'app-drag-region flex h-[80px] shrink-0 items-center gap-2 border-b border-[var(--line-strong)] bg-[var(--panel)] px-3'

const workspaceHeaderActionRowClass = 'app-no-drag ml-auto flex shrink-0 items-center gap-2'

const DocumentWorkspace = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex h-full w-full min-w-0', className)} {...props} />
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
      'flex min-w-0 flex-1 flex-col border-r border-[var(--line)] bg-[var(--panel)]',
      className
    )}
    {...props}
  />
))
DocumentWorkspaceMain.displayName = 'DocumentWorkspaceMain'

const DocumentWorkspacePanel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, style, ...props }, ref) => (
  <aside
    ref={ref}
    className={cn('flex w-[300px] shrink-0 flex-col bg-[var(--panel)]', className)}
    style={{
      width: 'var(--workspace-pane-width)',
      flexBasis: 'var(--workspace-pane-width)',
      ...style
    }}
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
    <header ref={ref} className={cn(workspaceHeaderClass, className)} {...props}>
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
    <header ref={ref} className={cn(workspaceHeaderClass, className)} {...props}>
      {resolvedLeading ? (
        <div className="app-no-drag flex min-w-0 items-center gap-3">{resolvedLeading}</div>
      ) : null}
      {actions ? <div className={workspaceHeaderActionRowClass}>{actions}</div> : null}
    </header>
  )
})
DocumentWorkspacePanelHeader.displayName = 'DocumentWorkspacePanelHeader'

const WorkspaceHeaderActions = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex items-center gap-2', className)} {...props} />
  )
)
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
    className={cn('h-5 w-px shrink-0 bg-[var(--line)]', className)}
    {...props}
  />
))
WorkspaceHeaderActionDivider.displayName = 'WorkspaceHeaderActionDivider'

interface WorkspaceActionButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: React.ReactNode
  label?: string
  active?: boolean
}

const WorkspaceActionButton = React.forwardRef<HTMLButtonElement, WorkspaceActionButtonProps>(
  ({ className, icon, label, active = false, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex shrink-0 items-center justify-center border transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        label
          ? 'h-9 gap-2 rounded-full px-3 text-xs font-medium'
          : 'h-8 w-8 rounded-lg',
        active
          ? 'border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--accent)]'
          : 'border-[var(--line)] bg-[var(--panel-2)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]',
        className
      )}
      {...props}
    >
      {icon}
      {label ? <span>{label}</span> : null}
    </button>
  )
)
WorkspaceActionButton.displayName = 'WorkspaceActionButton'

const DocumentWorkspaceMainContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('min-h-0 flex-1 overflow-hidden', className)} {...props} />
))
DocumentWorkspaceMainContent.displayName = 'DocumentWorkspaceMainContent'

const DocumentWorkspacePanelContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('min-h-0 flex-1 overflow-y-auto', className)} {...props} />
))
DocumentWorkspacePanelContent.displayName = 'DocumentWorkspacePanelContent'

export {
  DocumentWorkspace,
  DocumentWorkspaceMain,
  DocumentWorkspaceMainHeader,
  DocumentWorkspaceMainContent,
  DocumentWorkspacePanel,
  DocumentWorkspacePanelHeader,
  DocumentWorkspacePanelContent,
  WorkspaceHeaderActions,
  WorkspaceHeaderActionGroup,
  WorkspaceHeaderActionDivider,
  WorkspaceActionButton
}
