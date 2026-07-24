import * as React from 'react'
import { type LucideIcon, Plus, X } from 'lucide-react'

import { cn } from '../lib/utils'
import { Shortcut, type ShortcutKey } from './kbd'

export interface WorkspaceTab {
  id: string
  label: string
  icon?: LucideIcon
  shortcut?: readonly ShortcutKey[]
}

export interface WorkspaceTabManagerProps extends React.HTMLAttributes<HTMLElement> {
  tabs: readonly WorkspaceTab[]
  activeTabId: string
  onSelectTab: (tabId: string) => void
  onCloseTab: (tabId: string) => void
  onAddTab: () => void
  addDisabled?: boolean
}

const WorkspaceTabManager = React.forwardRef<HTMLElement, WorkspaceTabManagerProps>(
  (
    {
      className,
      tabs,
      activeTabId,
      onSelectTab,
      onCloseTab,
      onAddTab,
      addDisabled = false,
      ...props
    },
    ref
  ) => (
    <nav
      ref={ref}
      aria-label="Workspace tabs"
      className={cn(
        'document-workspace-tab-manager app-drag-region mb-1 flex h-9 min-w-0 shrink-0 items-center',
        className
      )}
      {...props}
    >
      <div className="min-w-0 flex-1 overflow-x-auto" role="tablist" aria-label="Open pages">
        <div className="flex min-w-max items-center gap-1.5 pr-1">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId
            const TabIcon = tab.icon

            return (
              <div
                key={tab.id}
                data-active={isActive ? 'true' : 'false'}
                className="document-workspace-tab group app-no-drag flex h-7 w-52 shrink-0 items-center rounded-md border border-[var(--shell-border)]"
              >
                <button
                  type="button"
                  role="tab"
                  id={`workspace-tab:${tab.id}`}
                  aria-selected={isActive}
                  className="flex min-w-0 flex-1 items-center gap-1.5 px-2 text-left text-xs font-medium text-[var(--text)]"
                  onClick={() => onSelectTab(tab.id)}
                >
                  {TabIcon ? (
                    <TabIcon
                      size={14}
                      strokeWidth={1.8}
                      aria-hidden="true"
                      className="shrink-0 text-[var(--muted)]"
                    />
                  ) : null}
                  <span className="min-w-0 flex-1 truncate">{tab.label}</span>
                  {tab.shortcut ? (
                    <Shortcut
                      keys={tab.shortcut}
                      className="pointer-events-none h-4 min-w-0 shrink-0 px-1 text-[9px]"
                      keyClassName="[&_svg]:h-2 [&_svg]:w-2"
                    />
                  ) : null}
                </button>
                <button
                  type="button"
                  aria-label={`Close ${tab.label} tab`}
                  title={`Close ${tab.label} tab`}
                  className="mr-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-[var(--muted)] transition hover:bg-[var(--accent-soft)] hover:text-[var(--text)]"
                  onClick={() => onCloseTab(tab.id)}
                >
                  <X size={12} aria-hidden="true" />
                </button>
              </div>
            )
          })}
          <button
            type="button"
            aria-label="New tab"
            title="New tab (Cmd+T)"
            disabled={addDisabled}
            className="app-no-drag inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[var(--shell-border)] text-[var(--text)] transition hover:bg-[var(--accent-soft)] disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onAddTab}
          >
            <Plus size={14} aria-hidden="true" />
          </button>
        </div>
      </div>
    </nav>
  )
)
WorkspaceTabManager.displayName = 'WorkspaceTabManager'

const workspaceMainHeaderClass =
  'document-workspace-header document-workspace-main-header app-drag-region flex h-[80px] shrink-0 items-center gap-2 border-b border-[var(--sidebar-border)] bg-[var(--workspace-main-panel)] px-3'

const workspacePanelHeaderClass =
  'document-workspace-header document-workspace-panel-header app-drag-region flex h-[80px] shrink-0 items-center gap-2 border-b border-[var(--sidebar-border)] bg-[var(--workspace-main-panel)] px-3'

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
      'document-workspace-main-surface flex min-w-0 flex-1 flex-col bg-[var(--workspace-main-panel)]',
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
  <aside
    ref={ref}
    className={cn(
      'document-workspace-panel-surface flex w-[var(--workspace-pane-width)] basis-[var(--workspace-pane-width)] shrink-0 flex-col border-l border-[var(--sidebar-border)] bg-[var(--workspace-main-panel)]',
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
        className={cn(
          'inline-flex shrink-0 items-center justify-center border transition-colors disabled:cursor-not-allowed disabled:opacity-50',
          label ? 'h-9 gap-2 rounded-full px-3 text-xs font-medium' : 'h-8 w-8 rounded-lg',
          active
            ? 'border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--accent)]'
            : 'workspace-subtle-control border-[var(--line)] text-[var(--muted)] hover:text-[var(--accent)]',
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
  WorkspaceTabManager,
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
