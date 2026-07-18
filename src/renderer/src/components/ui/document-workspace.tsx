import * as React from 'react'
import { createPortal } from 'react-dom'
import { PanelRightClose, PanelRightOpen, Plus, X } from 'lucide-react'

import { cn } from '../../lib/utils'

type WorkspaceTab = {
  id: string
  label: string
}

interface WorkspaceTabManagerProps extends React.HTMLAttributes<HTMLElement> {
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
                  data-testid={`workspace-tab:${tab.id}`}
                  className="min-w-0 flex-1 truncate px-2 text-left text-xs font-medium text-[var(--text)]"
                  onClick={() => onSelectTab(tab.id)}
                >
                  {tab.label}
                </button>
                <button
                  type="button"
                  aria-label={`Close ${tab.label} tab`}
                  title={`Close ${tab.label} tab`}
                  data-testid={`workspace-tab-close:${tab.id}`}
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
            data-testid="workspace-tab-add"
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
  'document-workspace-header document-workspace-main-header grid h-[90px] shrink-0 grid-rows-2 bg-[var(--shell-breadcrumb-surface)]'

const workspacePanelHeaderClass =
  'document-workspace-header document-workspace-panel-header app-drag-region flex h-9 shrink-0 items-center gap-2 border-b border-[var(--shell-border)] bg-[var(--shell-breadcrumb-surface)] px-3'

const workspaceHeaderActionRowClass = 'app-no-drag ml-auto flex shrink-0 items-center gap-1.5'

interface WorkspaceHeaderContextValue {
  panelActionSlot: HTMLDivElement | null
  setPanelActionSlot: (slot: HTMLDivElement | null) => void
  footerSlot: HTMLDivElement | null
  setFooterSlot: (slot: HTMLDivElement | null) => void
  hasPanel: boolean
  panelCollapsed: boolean
  onTogglePanel?: () => void
}

const WorkspaceHeaderContext = React.createContext<WorkspaceHeaderContextValue>({
  panelActionSlot: null,
  setPanelActionSlot: () => undefined,
  footerSlot: null,
  setFooterSlot: () => undefined,
  hasPanel: false,
  panelCollapsed: false
})

interface DocumentWorkspaceProps extends React.HTMLAttributes<HTMLDivElement> {
  hasPanel?: boolean
  panelCollapsed?: boolean
  onTogglePanel?: () => void
}

const DocumentWorkspace = React.forwardRef<HTMLDivElement, DocumentWorkspaceProps>(
  (
    { className, children, hasPanel = true, panelCollapsed = false, onTogglePanel, ...props },
    ref
  ) => {
    const [panelActionSlot, setPanelActionSlot] = React.useState<HTMLDivElement | null>(null)
    const [footerSlot, setFooterSlot] = React.useState<HTMLDivElement | null>(null)
    const headerContextValue = React.useMemo(
      () => ({
        panelActionSlot,
        setPanelActionSlot,
        footerSlot,
        setFooterSlot,
        hasPanel,
        panelCollapsed,
        onTogglePanel
      }),
      [footerSlot, hasPanel, onTogglePanel, panelActionSlot, panelCollapsed]
    )

    return (
      <WorkspaceHeaderContext.Provider value={headerContextValue}>
        <div
          ref={ref}
          data-has-panel={hasPanel ? 'true' : 'false'}
          className={cn(
            'document-workspace-frame flex h-full w-full min-w-0 flex-col px-2',
            className
          )}
          {...props}
        >
          <div className="document-workspace-body flex min-h-0 min-w-0 flex-1 gap-2 overflow-hidden rounded-xl border border-[var(--shell-border)] p-2 pt-0">
            {children}
          </div>
          <div className="document-workspace-footer app-drag-region mt-1 h-9 shrink-0">
            <div
              ref={setFooterSlot}
              className="document-workspace-footer-content app-no-drag flex h-full items-center px-3"
            />
          </div>
        </div>
      </WorkspaceHeaderContext.Provider>
    )
  }
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
  ({ className, breadcrumb, actions, ...props }, ref) => {
    const { hasPanel, onTogglePanel, panelCollapsed, setPanelActionSlot } =
      React.useContext(WorkspaceHeaderContext)
    const panelActionSlotRef = React.useCallback(
      (slot: HTMLDivElement | null) => setPanelActionSlot(slot),
      [setPanelActionSlot]
    )

    return (
      <header ref={ref} className={cn(workspaceMainHeaderClass, className)} {...props}>
        <div className="document-workspace-main-header-primary app-drag-region flex min-w-0 items-center gap-2 border-b border-[var(--shell-border)] px-3">
          <div className="app-no-drag flex min-w-0 items-center gap-3">{breadcrumb}</div>
          {actions ? <div className={workspaceHeaderActionRowClass}>{actions}</div> : null}
        </div>
        <div className="document-workspace-panel-action-row app-drag-region">
          <div aria-hidden="true" />
          <div className="document-workspace-panel-action-slot app-no-drag">
            <div ref={panelActionSlotRef} className="flex shrink-0 items-center gap-1.5" />
            {hasPanel && onTogglePanel ? (
              <WorkspaceActionButton
                aria-label={panelCollapsed ? 'Open right sidebar' : 'Close right sidebar'}
                title={panelCollapsed ? 'Open right sidebar' : 'Close right sidebar'}
                icon={panelCollapsed ? <PanelRightOpen /> : <PanelRightClose />}
                onClick={onTogglePanel}
              />
            ) : null}
          </div>
        </div>
      </header>
    )
  }
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
  const { panelActionSlot } = React.useContext(WorkspaceHeaderContext)
  const resolvedLeading = leading ?? (!actions ? children : null)
  const panelActions = actions && panelActionSlot ? createPortal(actions, panelActionSlot) : null

  if (!resolvedLeading) {
    return panelActions
  }

  return (
    <>
      {panelActions}
      <header ref={ref} className={cn(workspacePanelHeaderClass, className)} {...props}>
        <div className="app-no-drag flex min-w-0 items-center gap-3">{resolvedLeading}</div>
      </header>
    </>
  )
})
DocumentWorkspacePanelHeader.displayName = 'DocumentWorkspacePanelHeader'

const DocumentWorkspaceFooterStatus = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const { footerSlot } = React.useContext(WorkspaceHeaderContext)

  if (!footerSlot) {
    return null
  }

  return createPortal(
    <div ref={ref} className={cn('text-xs text-[var(--muted)]', className)} {...props} />,
    footerSlot
  )
})
DocumentWorkspaceFooterStatus.displayName = 'DocumentWorkspaceFooterStatus'

const WorkspaceHeaderActions = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('flex items-center gap-1.5', className)} {...props} />
))
WorkspaceHeaderActions.displayName = 'WorkspaceHeaderActions'

const WorkspaceHeaderActionGroup = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('flex items-center gap-1.5', className)} {...props} />
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
          'workspace-action-button inline-flex shrink-0 items-center justify-center overflow-hidden border text-[var(--text)] [&>svg]:h-3.5 [&>svg]:w-3.5 disabled:cursor-not-allowed disabled:opacity-50',
          label ? 'h-7 gap-1.5 rounded-full px-2.5 text-xs font-medium' : 'h-8 w-8 rounded-full',
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
  type WorkspaceTab,
  DocumentWorkspaceMain,
  DocumentWorkspaceMainHeader,
  DocumentWorkspaceMainContent,
  DocumentWorkspacePanel,
  DocumentWorkspacePanelHeader,
  DocumentWorkspacePanelContent,
  DocumentWorkspaceFooterStatus,
  WorkspaceContextEmptyState,
  WorkspaceHeaderActions,
  WorkspaceHeaderActionGroup,
  WorkspaceHeaderActionDivider,
  WorkspaceActionButton
}
