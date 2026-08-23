import * as React from 'react'
import { createPortal } from 'react-dom'
import { type FilledIcon, PanelRightClose, PanelRightOpen, Plus, X } from './icons'

import { cn } from '../lib/utils'
import { ActionButtonGroup } from './button-group'
import { Button } from './button'
import { Shortcut, type ShortcutKey } from './kbd'
import { ToggleGroup, ToggleGroupItem } from './toggle-group'

type WorkspaceTab = {
  id: string
  label: string
  icon?: FilledIcon
  shortcut?: readonly ShortcutKey[]
}

const workspaceTopbarControlClass =
  '[&_[role=group]]:rounded-[var(--radius-button-pill)] [&_button]:rounded-[var(--radius-button-pill)]'

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
        'app-drag-region flex h-10 min-w-0 shrink-0 items-center border-b bg-background px-2',
        workspaceTopbarControlClass,
        className
      )}
      {...props}
    >
      <div className="min-w-0 flex-1 overflow-x-auto" role="tablist" aria-label="Open pages">
        <ToggleGroup
          type="single"
          value={activeTabId}
          onValueChange={(value) => value && onSelectTab(value)}
          variant="outline"
          className={cn(
            'flex min-w-max items-center gap-1.5 border-0 p-0 pr-1',
            workspaceTopbarControlClass
          )}
        >
          {tabs.map((tab) => {
            const TabIcon = tab.icon

            return (
              <div
                key={tab.id}
                data-active={tab.id === activeTabId ? 'true' : 'false'}
                className="workspace-tab-card group app-no-drag flex h-8 w-52 shrink-0 items-center rounded-[var(--radius-button-pill)] border bg-background data-[active=true]:bg-accent"
              >
                <ToggleGroupItem
                  value={tab.id}
                  variant="outline"
                  id={`workspace-tab:${tab.id}`}
                  aria-label={tab.label}
                  data-testid={`workspace-tab:${tab.id}`}
                  className="h-full min-w-0 flex-1 justify-start rounded-none border-0 px-2 text-left text-xs font-medium text-foreground hover:bg-transparent hover:text-foreground data-[state=on]:border-0 data-[state=on]:bg-transparent data-[state=on]:text-foreground"
                >
                  {TabIcon ? (
                    <TabIcon
                      size={14}
                      strokeWidth={1.8}
                      aria-hidden="true"
                      data-testid={`workspace-tab-icon:${tab.id}`}
                      className="shrink-0 text-muted-foreground"
                    />
                  ) : null}
                  <span className="workspace-text-fade workspace-tab-label-fade min-w-0 flex-1">
                    {tab.label}
                  </span>
                  {tab.shortcut ? (
                    <Shortcut
                      keys={tab.shortcut}
                      data-testid={`workspace-tab-shortcut:${tab.id}`}
                      className="pointer-events-none h-4 min-w-0 shrink-0 px-1 text-xs"
                      keyClassName="[&_svg]:h-2 [&_svg]:w-2"
                    />
                  ) : null}
                </ToggleGroupItem>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Close ${tab.label} tab`}
                  title={`Close ${tab.label} tab`}
                  data-testid={`workspace-tab-close:${tab.id}`}
                  className="rounded-[var(--radius-button-pill)]"
                  onClick={() => onCloseTab(tab.id)}
                >
                  <X size={12} aria-hidden="true" />
                </Button>
              </div>
            )
          })}
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="New tab"
            title="New tab (Cmd+T)"
            data-testid="workspace-tab-add"
            disabled={addDisabled}
            className="rounded-[var(--radius-button-pill)]"
            onClick={onAddTab}
          >
            <Plus size={14} aria-hidden="true" />
          </Button>
        </ToggleGroup>
      </div>
    </nav>
  )
)
WorkspaceTabManager.displayName = 'WorkspaceTabManager'

const workspaceMainHeaderClass = 'grid min-h-16 shrink-0 grid-rows-2 border-b bg-background'

const workspacePanelHeaderClass =
  'app-drag-region flex h-10 shrink-0 items-center gap-2 border-b bg-background px-3'

const workspaceHeaderActionRowClass = cn(
  'app-no-drag ml-auto flex shrink-0 items-center gap-2',
  workspaceTopbarControlClass
)

interface WorkspaceHeaderContextValue {
  mainActionSlot: HTMLDivElement | null
  setMainActionSlot: (slot: HTMLDivElement | null) => void
  panelActionSlot: HTMLDivElement | null
  setPanelActionSlot: (slot: HTMLDivElement | null) => void
  footerSlot: HTMLDivElement | null
  setFooterSlot: (slot: HTMLDivElement | null) => void
  hasPanel: boolean
  panelCollapsed: boolean
  onTogglePanel?: () => void
}

const WorkspaceHeaderContext = React.createContext<WorkspaceHeaderContextValue>({
  mainActionSlot: null,
  setMainActionSlot: () => undefined,
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
    const [mainActionSlot, setMainActionSlot] = React.useState<HTMLDivElement | null>(null)
    const [panelActionSlot, setPanelActionSlot] = React.useState<HTMLDivElement | null>(null)
    const [footerSlot, setFooterSlot] = React.useState<HTMLDivElement | null>(null)
    const headerContextValue = React.useMemo(
      () => ({
        mainActionSlot,
        setMainActionSlot,
        panelActionSlot,
        setPanelActionSlot,
        footerSlot,
        setFooterSlot,
        hasPanel,
        panelCollapsed,
        onTogglePanel
      }),
      [footerSlot, hasPanel, mainActionSlot, onTogglePanel, panelActionSlot, panelCollapsed]
    )

    return (
      <WorkspaceHeaderContext.Provider value={headerContextValue}>
        <div
          ref={ref}
          data-has-panel={hasPanel ? 'true' : 'false'}
          className={cn('flex h-full w-full min-w-0 flex-col', className)}
          {...props}
        >
          <div className="flex min-h-0 min-w-0 flex-1 gap-2 overflow-hidden p-3">{children}</div>
          <div className="app-drag-region h-8 shrink-0 border-t">
            <div ref={setFooterSlot} className="app-no-drag flex h-full items-center py-1" />
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
      'flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border bg-background',
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
      'flex w-[var(--workspace-pane-width)] basis-[var(--workspace-pane-width)] shrink-0 flex-col overflow-hidden bg-transparent',
      className
    )}
    {...props}
  />
))
DocumentWorkspacePanel.displayName = 'DocumentWorkspacePanel'

const WorkspacePanelStack = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex min-h-full flex-col gap-3', className)} {...props} />
  )
)
WorkspacePanelStack.displayName = 'WorkspacePanelStack'

interface DocumentWorkspaceMainHeaderProps extends React.HTMLAttributes<HTMLElement> {
  breadcrumb?: React.ReactNode
  actions?: React.ReactNode
  secondaryActions?: React.ReactNode
}

const DocumentWorkspaceMainHeader = React.forwardRef<HTMLElement, DocumentWorkspaceMainHeaderProps>(
  ({ className, breadcrumb, actions, secondaryActions, ...props }, ref) => {
    const { hasPanel, onTogglePanel, panelCollapsed, setMainActionSlot, setPanelActionSlot } =
      React.useContext(WorkspaceHeaderContext)
    const mainActionSlotRef = React.useCallback(
      (slot: HTMLDivElement | null) => setMainActionSlot(slot),
      [setMainActionSlot]
    )
    const panelActionSlotRef = React.useCallback(
      (slot: HTMLDivElement | null) => setPanelActionSlot(slot),
      [setPanelActionSlot]
    )

    return (
      <header ref={ref} className={cn(workspaceMainHeaderClass, className)} {...props}>
        <div className="app-drag-region flex min-w-0 items-center gap-2 border-b px-3">
          <div className="app-no-drag flex min-w-0 items-center gap-3">{breadcrumb}</div>
          {actions ? <div className={workspaceHeaderActionRowClass}>{actions}</div> : null}
        </div>
        <div className="app-drag-region flex min-w-0 items-center justify-between gap-2 px-3">
          <div
            className={cn(
              'app-no-drag flex min-w-0 items-center gap-1.5 overflow-x-auto',
              workspaceTopbarControlClass
            )}
          >
            <div
              ref={mainActionSlotRef}
              className={cn('flex min-w-max items-center gap-1.5', workspaceTopbarControlClass)}
            />
            {secondaryActions}
          </div>
          <div
            className={cn(
              'app-no-drag ml-auto flex shrink-0 items-center gap-1.5',
              workspaceTopbarControlClass
            )}
          >
            <div
              ref={panelActionSlotRef}
              className={cn('flex shrink-0 items-center gap-1.5', workspaceTopbarControlClass)}
            />
            {hasPanel && onTogglePanel ? (
              <WorkspaceIconButton
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

const WorkspaceHeaderSecondaryActions = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  const { mainActionSlot } = React.useContext(WorkspaceHeaderContext)

  if (!mainActionSlot) {
    return null
  }

  return createPortal(
    <div
      ref={ref}
      className={cn(
        'workspace-header-secondary-actions flex min-w-max items-center gap-1.5',
        workspaceTopbarControlClass,
        className
      )}
      {...props}
    >
      {children}
    </div>,
    mainActionSlot
  )
})
WorkspaceHeaderSecondaryActions.displayName = 'WorkspaceHeaderSecondaryActions'

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
    <div ref={ref} className={cn('text-xs text-muted-foreground', className)} {...props} />,
    footerSlot
  )
})
DocumentWorkspaceFooterStatus.displayName = 'DocumentWorkspaceFooterStatus'

const WorkspaceHeaderActions = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex items-center gap-1.5', workspaceTopbarControlClass, className)}
    {...props}
  />
))
WorkspaceHeaderActions.displayName = 'WorkspaceHeaderActions'

const WorkspaceHeaderActionGroup = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof ActionButtonGroup>
>(({ className, ...props }, ref) => (
  <ActionButtonGroup
    ref={ref}
    className={cn('rounded-[var(--radius-button-pill)]', workspaceTopbarControlClass, className)}
    {...props}
  />
))
WorkspaceHeaderActionGroup.displayName = 'WorkspaceHeaderActionGroup'

const WorkspaceHeaderActionDivider = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    aria-hidden="true"
    className={cn('h-5 w-[var(--border-width)] shrink-0 bg-sidebar-border', className)}
    {...props}
  />
))
WorkspaceHeaderActionDivider.displayName = 'WorkspaceHeaderActionDivider'

interface WorkspaceIconButtonProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'children'
> {
  icon: React.ReactNode
  label?: string
  active?: boolean
  'data-testid'?: string
}

const WorkspaceIconButton = React.forwardRef<
  React.ElementRef<typeof Button>,
  WorkspaceIconButtonProps
>(({ className, icon, label, active = false, type = 'button', ...props }, ref) => {
  const inferredLabel =
    label ??
    (typeof props['aria-label'] === 'string' ? props['aria-label'] : undefined) ??
    (typeof props.title === 'string' ? props.title : undefined)

  return (
    <Button
      ref={ref}
      type={type}
      variant={active ? 'secondary' : 'ghost'}
      size={label ? 'sm' : 'icon'}
      data-active={active ? 'true' : 'false'}
      className={cn(
        'shrink-0 rounded-[var(--radius-button-pill)] [&>svg]:h-3.5 [&>svg]:w-3.5',
        label ? 'gap-1.5' : undefined,
        className
      )}
      aria-label={props['aria-label'] ?? inferredLabel}
      title={props.title ?? inferredLabel}
      {...props}
    >
      {icon}
      {label ? <span>{label}</span> : null}
    </Button>
  )
})
WorkspaceIconButton.displayName = 'WorkspaceIconButton'

const DocumentWorkspaceMainContent = React.forwardRef<
  HTMLElement,
  React.HTMLAttributes<HTMLElement>
>(({ className, ...props }, ref) => (
  <main
    ref={ref}
    className={cn('min-h-0 min-w-0 flex-1 overflow-auto p-2', className)}
    {...props}
  />
))
DocumentWorkspaceMainContent.displayName = 'DocumentWorkspaceMainContent'

const DocumentWorkspacePanelContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex min-h-0 flex-1 flex-col overflow-y-auto', className)}
    {...props}
  />
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
  <div ref={ref} className={cn('m-3 rounded-lg border bg-muted p-4', className)} {...props}>
    <p className="text-sm font-semibold">{title}</p>
    <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
  </div>
))
WorkspaceContextEmptyState.displayName = 'WorkspaceContextEmptyState'

export {
  DocumentWorkspace,
  WorkspaceTabManager,
  type WorkspaceTab,
  DocumentWorkspaceMain,
  DocumentWorkspaceMainHeader,
  WorkspaceHeaderSecondaryActions,
  DocumentWorkspaceMainContent,
  DocumentWorkspacePanel,
  WorkspacePanelStack,
  DocumentWorkspacePanelHeader,
  DocumentWorkspacePanelContent,
  DocumentWorkspaceFooterStatus,
  WorkspaceContextEmptyState,
  WorkspaceHeaderActions,
  WorkspaceHeaderActionGroup,
  WorkspaceHeaderActionDivider,
  WorkspaceIconButton,
  WorkspaceIconButton as WorkspaceActionButton
}
