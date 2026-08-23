import * as React from 'react'
import { createPortal } from 'react-dom'
import type { PanelImperativeHandle } from 'react-resizable-panels'
import { MoreVertical, PanelRightClose, PanelRightOpen, Plus, X } from './icons'

import { cn } from '../../lib/utils'
import { ActionButtonGroup } from './button-group'
import { Button, type ButtonProps } from './button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from './dropdown-menu'
import { Shortcut, type ShortcutKey } from './kbd'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from './resizable'
import { ToggleGroup, ToggleGroupItem } from './toggle-group'

type WorkspaceTab = {
  id: string
  label: string
  icon?: React.ReactNode
  shortcut?: readonly ShortcutKey[]
}

const workspaceTopbarControlClass =
  '[&_[role=group]]:rounded-[var(--radius-button-pill)] [&_button]:rounded-[var(--radius-button-pill)]'

const workspacePrimaryHeaderControlClass = [
  '[&_button]:border-0',
  '[&_button:not(.bg-accent)]:bg-transparent',
  '[&_button:not(.bg-accent):hover]:bg-muted',
  '[&_button:not(.bg-accent):focus-visible]:bg-muted'
].join(' ')

const workspaceSecondaryControlClass = [
  workspaceTopbarControlClass,
  '[&_[role=group]]:bg-panel',
  '[&_button:not([data-tab-toggle-group-item])]:bg-panel',
  '[&_button:not([data-tab-toggle-group-item]):hover]:bg-panel-hover',
  '[&_button:not([data-tab-toggle-group-item]):focus-visible]:bg-panel-hover',
  '[&_[data-state=on]:not([data-tab-toggle-group-item])]:bg-panel-hover',
  '[&_[data-active=true]:not([data-tab-toggle-group-item])]:bg-panel-hover',
  '[&_[data-toggle-group-indicator]:not([data-tab-toggle-group-item])]:bg-panel-hover'
].join(' ')

type WorkspaceHeaderActionAppearance = 'default' | 'muted' | 'plain'

const WorkspaceHeaderActionAppearanceContext =
  React.createContext<WorkspaceHeaderActionAppearance>('default')

interface WorkspaceIconButtonProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'children'
> {
  icon: React.ReactNode
  label?: string
  active?: boolean
  bordered?: boolean
  borderless?: boolean
  variant?: ButtonProps['variant']
  'data-testid'?: string
}

const WorkspaceIconButton = React.forwardRef<
  React.ElementRef<typeof Button>,
  WorkspaceIconButtonProps
>(({ className, icon, label, active = false, type = 'button', variant, ...props }, ref) => {
  const { bordered = false, borderless = false, ...buttonProps } = props
  const actionAppearance = React.useContext(WorkspaceHeaderActionAppearanceContext)
  const isPlainAppearance = actionAppearance === 'plain'
  const isMutedAppearance = actionAppearance === 'muted'
  const inferredLabel =
    label ??
    (typeof buttonProps['aria-label'] === 'string' ? buttonProps['aria-label'] : undefined) ??
    (typeof buttonProps.title === 'string' ? buttonProps.title : undefined)

  return (
    <Button
      ref={ref}
      type={type}
      variant={variant ?? (active ? 'secondary' : 'ghost')}
      size={label ? 'sm' : 'icon'}
      data-active={active ? 'true' : 'false'}
      className={cn(
        'ui-compact-control shrink-0 rounded-[var(--radius-button-pill)] [&>svg]:size-[var(--control-icon-size)]',
        isPlainAppearance
          ? 'border-0'
          : bordered || (!label && !borderless)
            ? 'border border-input'
            : undefined,
        isPlainAppearance && !active
          ? 'bg-transparent hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:text-foreground'
          : undefined,
        isMutedAppearance && !label && !active
          ? 'text-muted-foreground hover:text-foreground focus-visible:text-foreground'
          : undefined,
        label ? 'gap-1.5' : undefined,
        className
      )}
      aria-label={buttonProps['aria-label'] ?? inferredLabel}
      title={buttonProps.title ?? inferredLabel}
      {...buttonProps}
    >
      {icon}
      {label ? <span>{label}</span> : null}
    </Button>
  )
})
WorkspaceIconButton.displayName = 'WorkspaceIconButton'

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
        'app-drag-region flex h-[var(--workspace-chrome-height)] min-w-0 shrink-0 items-center py-2',
        className
      )}
      {...props}
    >
      <div className="app-drag-region min-w-0 flex-1 overflow-x-auto">
        <div className="app-no-drag flex w-max items-center gap-1">
          <ToggleGroup
            type="single"
            value={activeTabId}
            onValueChange={(value) => value && onSelectTab(value)}
            variant="outline"
            className="flex min-w-max items-center gap-2 border-0 bg-transparent p-0 pr-1"
            role="tablist"
            aria-label="Open pages"
            selectionIndicatorAnimated={false}
          >
            {tabs.map((tab) => {
              return (
                <div
                  key={tab.id}
                  role="presentation"
                  data-active={tab.id === activeTabId ? 'true' : 'false'}
                  data-toggle-group-indicator-target="true"
                  className="workspace-tab-card group app-no-drag relative z-10 flex h-[var(--workspace-tab-control-height)] w-52 shrink-0 items-center overflow-hidden rounded-sm bg-workspace data-[active=true]:bg-transparent"
                >
                  <ToggleGroupItem
                    value={tab.id}
                    variant="outline"
                    id={`workspace-tab:${tab.id}`}
                    aria-label={tab.label}
                    title={tab.label}
                    aria-selected={tab.id === activeTabId}
                    role="tab"
                    data-testid={`workspace-tab:${tab.id}`}
                    className="relative h-full min-w-0 flex-1 justify-start rounded-none border-0 px-2 text-left text-xs font-semibold text-muted-foreground transition-none hover:bg-surface-subtle-hover hover:text-foreground data-[state=on]:border-0 data-[state=on]:bg-transparent data-[state=on]:text-foreground"
                  >
                    {tab.icon ? (
                      <span
                        aria-hidden="true"
                        data-testid={`workspace-tab-icon:${tab.id}`}
                        className="flex shrink-0 items-center justify-center text-muted-foreground [&>svg]:size-3.5 [&>svg]:shrink-0"
                      >
                        {tab.icon}
                      </span>
                    ) : null}
                    <span
                      data-testid={`workspace-tab-label:${tab.id}`}
                      className="workspace-text-fade workspace-tab-label-fade block max-w-full min-w-0 flex-1"
                    >
                      {tab.label}
                    </span>
                    {tab.shortcut ? (
                      <Shortcut
                        keys={tab.shortcut}
                        data-testid={`workspace-tab-shortcut:${tab.id}`}
                        className="workspace-tab-shortcut-overlay pointer-events-none absolute right-7 top-1/2 z-20 h-4 -translate-y-1/2 px-1 text-xs opacity-0 transition-opacity motion-reduce:transition-none group-hover:opacity-100 group-focus-within:opacity-100"
                        keyClassName="[&_svg]:h-2 [&_svg]:w-2"
                      />
                    ) : null}
                  </ToggleGroupItem>
                  <WorkspaceIconButton
                    variant="rowAction"
                    aria-label={`Close ${tab.label} tab`}
                    title={`Close ${tab.label} tab`}
                    data-testid={`workspace-tab-close:${tab.id}`}
                    borderless
                    className="workspace-tab-close-overlay absolute right-0 top-0 z-20 h-[var(--workspace-tab-control-height)] w-[var(--workspace-tab-control-height)] rounded-[var(--radius-button-pill)] opacity-0 transition-opacity motion-reduce:transition-none group-hover:opacity-100 group-focus-within:opacity-100 [&>svg]:size-3.5"
                    icon={<X size={14} aria-hidden="true" />}
                    onClick={() => onCloseTab(tab.id)}
                  />
                </div>
              )
            })}
          </ToggleGroup>
          <WorkspaceIconButton
            aria-label="New tab"
            title="New tab (Cmd+T)"
            data-testid="workspace-tab-add"
            disabled={addDisabled}
            className="h-[var(--workspace-tab-control-height)] w-[var(--workspace-tab-control-height)] rounded-[var(--radius-button-pill)] [&>svg]:size-3.5"
            icon={<Plus size={14} aria-hidden="true" />}
            onClick={onAddTab}
          />
        </div>
      </div>
    </nav>
  )
)
WorkspaceTabManager.displayName = 'WorkspaceTabManager'

const workspaceMainHeaderClass = 'grid h-24 min-h-24 shrink-0 grid-rows-[48px_48px]'

const workspacePanelHeaderClass =
  'app-drag-region flex h-10 shrink-0 items-center gap-2 border-b border-panel-border bg-card px-3'

interface WorkspaceHeaderContextValue {
  mainActionSlot: HTMLDivElement | null
  setMainActionSlot: (slot: HTMLDivElement | null) => void
  secondaryRightActionSlot: HTMLDivElement | null
  setSecondaryRightActionSlot: (slot: HTMLDivElement | null) => void
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
  secondaryRightActionSlot: null,
  setSecondaryRightActionSlot: () => undefined,
  panelActionSlot: null,
  setPanelActionSlot: () => undefined,
  footerSlot: null,
  setFooterSlot: () => undefined,
  hasPanel: false,
  panelCollapsed: false
})

interface WorkspaceContextProviderProps {
  children?: React.ReactNode
  hasPanel?: boolean
  panelCollapsed?: boolean
  onTogglePanel?: () => void
}

const WorkspaceContextProvider = ({
  children,
  hasPanel = false,
  panelCollapsed = false,
  onTogglePanel
}: WorkspaceContextProviderProps): React.ReactElement => {
  const [mainActionSlot, setMainActionSlot] = React.useState<HTMLDivElement | null>(null)
  const [secondaryRightActionSlot, setSecondaryRightActionSlot] =
    React.useState<HTMLDivElement | null>(null)
  const [panelActionSlot, setPanelActionSlot] = React.useState<HTMLDivElement | null>(null)
  const [footerSlot, setFooterSlot] = React.useState<HTMLDivElement | null>(null)
  const headerContextValue = React.useMemo(
    () => ({
      mainActionSlot,
      setMainActionSlot,
      secondaryRightActionSlot,
      setSecondaryRightActionSlot,
      panelActionSlot,
      setPanelActionSlot,
      footerSlot,
      setFooterSlot,
      hasPanel,
      panelCollapsed,
      onTogglePanel
    }),
    [
      footerSlot,
      hasPanel,
      mainActionSlot,
      onTogglePanel,
      panelActionSlot,
      panelCollapsed,
      secondaryRightActionSlot
    ]
  )

  return (
    <WorkspaceHeaderContext.Provider value={headerContextValue}>
      {children}
    </WorkspaceHeaderContext.Provider>
  )
}

interface DocumentWorkspaceProps extends React.HTMLAttributes<HTMLDivElement> {
  hasPanel?: boolean
}

const DocumentWorkspace = React.forwardRef<HTMLDivElement, DocumentWorkspaceProps>(
  ({ className, children, hasPanel = true, ...props }, ref) => (
    <div
      ref={ref}
      data-has-panel={hasPanel ? 'true' : 'false'}
      className={cn(
        'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-shell border border-panel-border bg-workspace',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
)
DocumentWorkspace.displayName = 'DocumentWorkspace'

const WorkspaceFooter = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  ({ className, ...props }, ref) => {
    const { setFooterSlot } = React.useContext(WorkspaceHeaderContext)

    return (
      <footer
        ref={ref}
        className={cn(
          'app-drag-region h-[var(--workspace-chrome-height)] shrink-0 bg-transparent',
          className
        )}
        {...props}
      >
        <div ref={setFooterSlot} className="app-no-drag flex h-full items-center py-1" />
      </footer>
    )
  }
)
WorkspaceFooter.displayName = 'WorkspaceFooter'

const DocumentWorkspaceMain = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <section
    ref={ref}
    className={cn(
      'relative flex min-h-0 min-w-0 flex-1 gap-2 overflow-hidden rounded-surface p-2',
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
      'motion-workspace-panel flex h-full min-h-0 w-[var(--workspace-pane-width)] basis-[var(--workspace-pane-width)] shrink-0 flex-col overflow-hidden bg-transparent',
      className
    )}
    {...props}
  />
))
DocumentWorkspacePanel.displayName = 'DocumentWorkspacePanel'

interface WorkspaceRightPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  hasPanel?: boolean
  panelCollapsed?: boolean
  panelHidden?: boolean
}

const WorkspaceRightPanel = React.forwardRef<HTMLDivElement, WorkspaceRightPanelProps>(
  (
    {
      children,
      className,
      hasPanel = true,
      panelCollapsed = false,
      panelHidden = false,
      style,
      ...props
    },
    ref
  ) => {
    const isOpen = hasPanel && !panelCollapsed && !panelHidden

    return (
      <div
        ref={ref}
        data-panel-state={isOpen ? 'open' : 'collapsed'}
        data-panel-resizable={hasPanel ? 'true' : undefined}
        className={cn(
          'motion-workspace-panel flex h-full min-h-0 w-full min-w-0 basis-auto shrink-0 flex-col gap-3 overflow-y-auto',
          isOpen ? 'translate-x-0 opacity-100' : 'pointer-events-none translate-x-full opacity-0',
          className
        )}
        style={
          isOpen
            ? style
            : {
                ...style,
                width: '0px',
                flexBasis: '0px',
                borderWidth: '0px'
              }
        }
        {...props}
      >
        {children}
      </div>
    )
  }
)
WorkspaceRightPanel.displayName = 'WorkspaceRightPanel'

function useIsNarrowWorkspace(): boolean {
  const [isNarrow, setIsNarrow] = React.useState(() => {
    if (typeof window === 'undefined') {
      return false
    }

    return window.matchMedia('(max-width: 900px)').matches
  })

  React.useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 900px)')
    const handleChange = (): void => setIsNarrow(mediaQuery.matches)

    handleChange()
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  return isNarrow
}

interface WorkspaceResizableLayoutProps extends React.HTMLAttributes<HTMLDivElement> {
  hasPanel?: boolean
  panelWidth: number
  panelCollapsed?: boolean
  panelHidden?: boolean
  onPanelWidthChange?: (width: number) => void
  onPanelCollapsedChange?: (collapsed: boolean) => void
}

const WorkspaceResizableLayout = React.forwardRef<HTMLDivElement, WorkspaceResizableLayoutProps>(
  (
    {
      children,
      className,
      hasPanel = true,
      panelWidth,
      panelCollapsed = false,
      panelHidden = false,
      onPanelWidthChange,
      onPanelCollapsedChange,
      ...props
    },
    ref
  ) => {
    const isNarrow = useIsNarrowWorkspace()
    const panelRef = React.useRef<PanelImperativeHandle | null>(null)
    const panelElementRef = React.useRef<HTMLDivElement | null>(null)
    const latestPanelWidthRef = React.useRef(panelWidth)
    const persistLayoutFrameRef = React.useRef<number | null>(null)
    const [initialPanelWidth] = React.useState(panelWidth)
    const [mainContent, ...panelContents] = React.Children.toArray(children)
    const hasPanelContent = panelContents.length > 0

    React.useEffect(() => {
      return () => {
        if (persistLayoutFrameRef.current !== null) {
          window.cancelAnimationFrame(persistLayoutFrameRef.current)
        }
      }
    }, [])

    React.useEffect(() => {
      if (isNarrow) {
        return
      }

      const panel = panelRef.current
      if (!panel) {
        return
      }

      const shouldCollapse = panelCollapsed || panelHidden
      if (shouldCollapse && !panel.isCollapsed()) {
        panel.collapse()
      } else if (!shouldCollapse && panel.isCollapsed()) {
        panel.expand()
      }
    }, [isNarrow, panelCollapsed, panelHidden])

    if (!hasPanel || !hasPanelContent) {
      return <>{mainContent}</>
    }

    const rightPanelContent =
      panelContents.length === 1 ? (
        panelContents[0]
      ) : (
        <WorkspaceRightPanel
          hasPanel={hasPanel}
          panelCollapsed={panelCollapsed}
          panelHidden={panelHidden}
        >
          {panelContents}
        </WorkspaceRightPanel>
      )

    if (isNarrow) {
      return (
        <>
          {mainContent}
          {rightPanelContent}
        </>
      )
    }

    return (
      <ResizablePanelGroup
        ref={ref}
        className={cn('min-h-0 min-w-0 flex-1 overflow-hidden', className)}
        orientation="horizontal"
        {...props}
        onLayoutChanged={() => {
          if (persistLayoutFrameRef.current !== null) {
            window.cancelAnimationFrame(persistLayoutFrameRef.current)
          }

          persistLayoutFrameRef.current = window.requestAnimationFrame(() => {
            persistLayoutFrameRef.current = null
            if (panelHidden || panelRef.current?.isCollapsed()) {
              return
            }

            const width =
              panelElementRef.current?.getBoundingClientRect().width ?? latestPanelWidthRef.current
            if (!width || width <= 0) {
              return
            }

            onPanelWidthChange?.(width)
            if (panelCollapsed) {
              onPanelCollapsedChange?.(false)
            }
          })
        }}
      >
        <ResizablePanel
          className="min-w-0"
          minSize={320}
          groupResizeBehavior="preserve-relative-size"
        >
          {mainContent}
        </ResizablePanel>
        <ResizableHandle
          id="workspace-right-panel-resize"
          data-testid="workspace-right-panel-resize"
          aria-label="Resize right sidebar"
          disableDoubleClick
        />
        <ResizablePanel
          id="workspace-right-panel"
          className="min-w-0"
          defaultSize={initialPanelWidth}
          minSize={220}
          maxSize={480}
          collapsedSize={0}
          collapsible
          groupResizeBehavior="preserve-pixel-size"
          ref={panelElementRef}
          panelRef={panelRef}
          onResize={(size) => {
            latestPanelWidthRef.current = size.inPixels
            if (size.inPixels <= 0) {
              if (!panelHidden) {
                onPanelCollapsedChange?.(true)
              }
              return
            }
          }}
        >
          {rightPanelContent}
        </ResizablePanel>
      </ResizablePanelGroup>
    )
  }
)
WorkspaceResizableLayout.displayName = 'WorkspaceResizableLayout'

const WorkspacePanelStack = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex h-full min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-y-auto scrollbar-none',
        className
      )}
      {...props}
    />
  )
)
WorkspacePanelStack.displayName = 'WorkspacePanelStack'

interface DocumentWorkspaceMainHeaderProps extends React.HTMLAttributes<HTMLElement> {
  breadcrumb?: React.ReactNode
  pageContextMenu?: React.ReactNode
  primaryRightActions?: React.ReactNode
  secondaryActions?: React.ReactNode
}

interface WorkspacePageContextMenuProps {
  children: React.ReactNode
}

const WorkspacePageContextMenu = ({
  children
}: WorkspacePageContextMenuProps): React.ReactElement => {
  const label = 'Open page context menu'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <WorkspaceIconButton
          icon={<MoreVertical size={18} aria-hidden="true" />}
          aria-label={label}
          title={label}
          data-testid="workspace-page-context-menu-trigger"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        data-testid="workspace-page-context-menu"
        aria-label="Page actions"
      >
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const DocumentWorkspaceMainHeader = React.forwardRef<HTMLElement, DocumentWorkspaceMainHeaderProps>(
  (
    { className, breadcrumb, pageContextMenu, primaryRightActions, secondaryActions, ...props },
    ref
  ) => {
    const {
      hasPanel,
      onTogglePanel,
      panelCollapsed,
      setMainActionSlot,
      setPanelActionSlot,
      setSecondaryRightActionSlot
    } = React.useContext(WorkspaceHeaderContext)
    const mainActionSlotRef = React.useCallback(
      (slot: HTMLDivElement | null) => setMainActionSlot(slot),
      [setMainActionSlot]
    )
    const panelActionSlotRef = React.useCallback(
      (slot: HTMLDivElement | null) => setPanelActionSlot(slot),
      [setPanelActionSlot]
    )
    const secondaryRightActionSlotRef = React.useCallback(
      (slot: HTMLDivElement | null) => setSecondaryRightActionSlot(slot),
      [setSecondaryRightActionSlot]
    )

    return (
      <WorkspaceHeaderActionAppearanceContext.Provider value="muted">
        <header ref={ref} className={cn(workspaceMainHeaderClass, className)} {...props}>
          <div
            data-workspace-header-row="primary"
            className={cn(
              'app-drag-region flex min-w-0 items-center gap-1.5 border-b border-panel-border px-3',
              workspacePrimaryHeaderControlClass
            )}
          >
            <div className="app-no-drag flex min-w-0 items-center gap-1.5">
              <div className="min-w-0">{breadcrumb}</div>
              {pageContextMenu ? <div className="shrink-0">{pageContextMenu}</div> : null}
            </div>
            {primaryRightActions ? (
              <div
                className={cn(
                  'app-no-drag ml-auto flex min-w-0 shrink-0 items-center gap-1.5',
                  workspaceTopbarControlClass
                )}
              >
                {primaryRightActions}
              </div>
            ) : null}
          </div>
          <div
            data-workspace-header-row="secondary"
            className={cn(
              'app-drag-region flex min-w-0 items-center justify-between gap-2 px-3',
              workspaceSecondaryControlClass
            )}
          >
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
                ref={secondaryRightActionSlotRef}
                className={cn('flex shrink-0 items-center gap-1.5', workspaceTopbarControlClass)}
              />
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
      </WorkspaceHeaderActionAppearanceContext.Provider>
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

const WorkspaceHeaderSecondaryActionsRight = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  const { secondaryRightActionSlot } = React.useContext(WorkspaceHeaderContext)

  if (!secondaryRightActionSlot) {
    return null
  }

  return createPortal(
    <div
      ref={ref}
      className={cn(
        'workspace-header-secondary-actions-right flex min-w-max items-center gap-1.5',
        workspaceTopbarControlClass,
        className
      )}
      {...props}
    >
      {children}
    </div>,
    secondaryRightActionSlot
  )
})
WorkspaceHeaderSecondaryActionsRight.displayName = 'WorkspaceHeaderSecondaryActionsRight'

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
  React.HTMLAttributes<HTMLDivElement> & {
    appearance?: WorkspaceHeaderActionAppearance
  }
>(({ className, appearance = 'muted', ...props }, ref) => (
  <WorkspaceHeaderActionAppearanceContext.Provider value={appearance}>
    <div
      ref={ref}
      data-workspace-header-appearance={appearance}
      className={cn('flex items-center gap-1.5', workspaceTopbarControlClass, className)}
      {...props}
    />
  </WorkspaceHeaderActionAppearanceContext.Provider>
))
WorkspaceHeaderActions.displayName = 'WorkspaceHeaderActions'

const WorkspaceHeaderActionGroup = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof ActionButtonGroup>
>(({ className, ...props }, ref) => {
  const actionAppearance = React.useContext(WorkspaceHeaderActionAppearanceContext)
  const isPlainAppearance = actionAppearance === 'plain'

  return (
    <ActionButtonGroup
      ref={ref}
      className={cn(
        'ui-compact-control rounded-[var(--radius-button-pill)]',
        workspaceTopbarControlClass,
        isPlainAppearance && 'border-0 bg-transparent [&>*:not(:first-child)]:border-l-0',
        className
      )}
      {...props}
    />
  )
})
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

const DocumentWorkspaceMainContent = React.forwardRef<
  HTMLElement,
  React.HTMLAttributes<HTMLElement>
>(({ className, ...props }, ref) => (
  <main
    ref={ref}
    className={cn(
      'document-workspace-main-content h-full min-h-0 min-w-0 w-full max-w-none flex-1 overflow-auto scrollbar-none px-2',
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
  <div
    ref={ref}
    className={cn('flex min-h-0 flex-1 flex-col overflow-y-auto scrollbar-none', className)}
    {...props}
  />
))
DocumentWorkspacePanelContent.displayName = 'DocumentWorkspacePanelContent'

export {
  WorkspaceContextProvider,
  DocumentWorkspace,
  WorkspaceTabManager,
  type WorkspaceTab,
  DocumentWorkspaceMain,
  DocumentWorkspaceMainHeader,
  WorkspaceHeaderSecondaryActions,
  WorkspaceHeaderSecondaryActionsRight,
  DocumentWorkspaceMainContent,
  DocumentWorkspacePanel,
  WorkspaceRightPanel,
  WorkspaceResizableLayout,
  WorkspacePanelStack,
  DocumentWorkspacePanelHeader,
  DocumentWorkspacePanelContent,
  DocumentWorkspaceFooterStatus,
  WorkspaceFooter,
  WorkspaceHeaderActions,
  WorkspaceHeaderActionGroup,
  WorkspaceHeaderActionDivider,
  WorkspaceIconButton,
  WorkspacePageContextMenu,
  WorkspaceIconButton as WorkspaceActionButton
}
