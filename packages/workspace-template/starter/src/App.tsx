import { useMemo, useState } from 'react'
import {
  Bot,
  CalendarDays,
  ChevronDown,
  Copy,
  CreditCard,
  Download,
  FolderOpen,
  House,
  LayoutDashboard,
  LayoutGrid,
  Link2,
  NotebookPen,
  Plus,
  Star,
  SlidersHorizontal,
  Trash2
} from 'lucide-react'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  SidebarInset,
  SidebarProvider,
  WorkspaceActionButton,
  WorkspaceContextEmptyState,
  WorkspaceHeaderActionDivider,
  WorkspaceHeaderActionGroup,
  WorkspaceHeaderActions,
  WorkspaceMain,
  WorkspaceMainContent,
  WorkspaceMainHeader,
  WorkspacePanelSection,
  WorkspacePanelSectionHeader,
  WorkspaceShell,
  WorkspaceSidePanel,
  WorkspaceSidePanelContent,
  WorkspaceSidePanelHeader,
  WorkspaceSidebar,
  type WorkspaceSidebarItem,
  type WorkspaceSidebarSection,
  WorkspaceTabManager,
  useWorkspaceShellShortcuts
} from '@xingularity/workspace-template'

import appLogo from '../../../../assets/logo.png'

type StarterNavigationId =
  | 'knowledge'
  | 'notes'
  | 'projects'
  | 'calendar'
  | 'weeklyPlan'
  | 'subscriptions'
  | 'schedules'
  | 'agentHistory'
  | 'settings'

type SidebarItem = WorkspaceSidebarItem & { id: StarterNavigationId }

const PAGE_LABELS: Record<StarterNavigationId, string> = {
  knowledge: 'Knowledge',
  notes: 'Notebooks',
  projects: 'Projects',
  calendar: 'Calendar',
  weeklyPlan: 'Weekly Plan',
  subscriptions: 'Subscriptions',
  schedules: 'Schedules',
  agentHistory: 'Agent Chat',
  settings: 'Settings'
}

const PAGE_ICONS: Record<StarterNavigationId, typeof LayoutDashboard> = {
  knowledge: LayoutGrid,
  notes: NotebookPen,
  projects: FolderOpen,
  calendar: CalendarDays,
  weeklyPlan: LayoutDashboard,
  subscriptions: CreditCard,
  schedules: CalendarDays,
  agentHistory: Bot,
  settings: SlidersHorizontal
}

const SIDEBAR_SECTIONS: ReadonlyArray<
  Omit<WorkspaceSidebarSection, 'items'> & { items: readonly SidebarItem[] }
> = [
  {
    id: 'board',
    label: 'Board',
    icon: LayoutDashboard,
    items: [{ id: 'knowledge', label: 'Knowledge' }]
  },
  {
    id: 'home',
    label: 'Home',
    icon: House,
    items: [
      { id: 'notes', label: 'Notebooks' },
      { id: 'projects', label: 'Projects' },
      { id: 'calendar', label: 'Calendar' },
      { id: 'weeklyPlan', label: 'Weekly Plan' }
    ]
  },
  {
    id: 'finance',
    label: 'Finance',
    icon: CreditCard,
    items: [{ id: 'subscriptions', label: 'Subscriptions' }]
  },
  {
    id: 'automations',
    label: 'Automations',
    icon: Bot,
    items: [
      { id: 'schedules', label: 'Schedules' },
      { id: 'agentHistory', label: 'Agent Chat', shortcut: ['cmd', 'i'] }
    ]
  }
]

const FOOTER_ITEMS: readonly SidebarItem[] = [
  { id: 'settings', label: 'Settings', shortcut: ['cmd', ','] }
]

export default function App(): React.JSX.Element {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isFocusMode, setIsFocusMode] = useState(false)
  const [isRightPanelCollapsed, setIsRightPanelCollapsed] = useState(false)
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false)
  const [activeNavigationId, setActiveNavigationId] = useState<StarterNavigationId>('notes')

  const sections = useMemo<WorkspaceSidebarSection[]>(
    () =>
      SIDEBAR_SECTIONS.map((section) => ({
        ...section,
        items: section.items.map((item, index) => ({
          ...item,
          testId: `starter-sidebar-page:${section.id}:${index}`,
          shortcutTestId: item.shortcut
            ? `starter-sidebar-shortcut:${section.id}:${index}`
            : undefined
        }))
      })),
    []
  )

  useWorkspaceShellShortcuts({
    enabled: true,
    hasRightPanel: true,
    onOpenSearchPalette: () => setIsCommandPaletteOpen(true),
    onOpenCommandPalette: () => setIsCommandPaletteOpen(true),
    onToggleRightPanel: () => setIsRightPanelCollapsed((current) => !current),
    onToggleFocusMode: () => {
      setIsFocusMode((current) => !current)
      setIsSidebarOpen((current) => !current)
    },
    onRunUndo: () => undefined,
    onRunRedo: () => undefined,
    onNavigateToPage: () => undefined,
    isPageAvailable: () => true,
    isTypingTarget: (target) =>
      target instanceof HTMLElement &&
      Boolean(
        target.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""]')
      )
  })

  return (
    <div className="flex h-screen">
      <SidebarProvider
        className="h-full"
        data-focus-mode={isFocusMode ? 'true' : 'false'}
        open={isFocusMode ? false : isSidebarOpen}
        onOpenChange={setIsSidebarOpen}
      >
        <WorkspaceSidebar
          activeItemId={activeNavigationId}
          sections={sections}
          footerItems={FOOTER_ITEMS}
          brand={{
            logo: (
              <img
                src={appLogo}
                alt="Xingularity logo"
                className="h-11 w-11 shrink-0 rounded-lg border border-white/10 shadow-[0_12px_30px_rgba(7,5,18,0.35)]"
              />
            ),
            name: 'XINGULARITY',
            subtitle: 'Workspace'
          }}
          context={{
            heading: (
              <>
                Welcome back, <span className="text-[var(--accent)]">there</span>
              </>
            ),
            detail: 'No vault selected'
          }}
          onSelect={(pageId) => setActiveNavigationId(pageId as StarterNavigationId)}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          collapsible={isFocusMode ? 'offcanvas' : 'icon'}
        />

        <SidebarInset
          data-workspace-vibrancy="on"
          className="!min-h-0 overflow-hidden text-[var(--text)] antialiased [font-family:var(--app-font-family)]"
        >
          <div className="workspace-vibrancy-scope flex h-full min-w-0 flex-col">
            <WorkspaceTabManager
              tabs={[
                {
                  id: 'workspace-tab-1',
                  label: PAGE_LABELS[activeNavigationId],
                  icon: PAGE_ICONS[activeNavigationId],
                  shortcut: ['cmd', '1']
                }
              ]}
              activeTabId="workspace-tab-1"
              onSelectTab={() => undefined}
              onCloseTab={() => undefined}
              onAddTab={() => undefined}
              addDisabled
            />

            <WorkspaceShell
              hasPanel
              panelCollapsed={isRightPanelCollapsed}
              onTogglePanel={() => setIsRightPanelCollapsed((current) => !current)}
            >
              <WorkspaceMain>
                <WorkspaceMainHeader
                  breadcrumb={
                    <Breadcrumb>
                      <BreadcrumbList className="text-[var(--muted)]">
                        <BreadcrumbItem>
                          <BreadcrumbPage className="text-sm text-[var(--muted)]">
                            {PAGE_LABELS[activeNavigationId]}
                          </BreadcrumbPage>
                        </BreadcrumbItem>
                      </BreadcrumbList>
                    </Breadcrumb>
                  }
                  actions={
                    <WorkspaceHeaderActions>
                      <WorkspaceActionButton title="Show backlinks" icon={<Link2 size={18} />} />
                      <WorkspaceActionButton title="Copy Raw Markdown" icon={<Copy size={18} />} />
                      <WorkspaceActionButton title="Export Note" icon={<Download size={18} />} />
                      <WorkspaceHeaderActionDivider />
                      <WorkspaceHeaderActionGroup>
                        <WorkspaceActionButton title="Add to Favorites" icon={<Star size={18} />} />
                      </WorkspaceHeaderActionGroup>
                      <WorkspaceHeaderActionDivider />
                      <WorkspaceHeaderActionGroup>
                        <WorkspaceActionButton title="Delete Note" icon={<Trash2 size={18} />} />
                      </WorkspaceHeaderActionGroup>
                    </WorkspaceHeaderActions>
                  }
                />
                <WorkspaceMainContent>
                  <div className="flex h-full items-center justify-center p-8">
                    <WorkspaceContextEmptyState
                      className="m-0 w-full max-w-lg"
                      title="Your workspace"
                      description="This is the one placeholder page. Replace its content, but keep this shared Xingularity shell intact."
                    />
                  </div>
                </WorkspaceMainContent>
              </WorkspaceMain>

              <WorkspaceSidePanel
                data-panel-state={isRightPanelCollapsed ? 'collapsed' : 'open'}
                className={`${isRightPanelCollapsed ? 'pointer-events-none translate-x-full opacity-0' : 'translate-x-0 opacity-100'} overflow-hidden transition-[transform,opacity,width,flex-basis] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]`}
                style={
                  isRightPanelCollapsed
                    ? { width: '0px', flexBasis: '0px', borderWidth: '0px' }
                    : undefined
                }
              >
                <div className="flex h-full flex-col">
                  <WorkspaceSidePanelHeader
                    actions={
                      <WorkspaceHeaderActions>
                        <WorkspaceActionButton
                          title="Collapse all folders"
                          icon={<ChevronDown size={18} />}
                        />
                        <WorkspaceActionButton title="Notebook actions" icon={<Plus size={18} />} />
                      </WorkspaceHeaderActions>
                    }
                  />
                  <WorkspaceSidePanelContent>
                    <WorkspacePanelSection>
                      <WorkspacePanelSectionHeader
                        icon={<FolderOpen size={16} />}
                        iconContainerClassName="bg-[var(--accent-soft)] text-[var(--accent)]"
                        heading="Workspace context"
                        description="The starter deliberately contains one placeholder page."
                      />
                    </WorkspacePanelSection>
                  </WorkspaceSidePanelContent>
                </div>
              </WorkspaceSidePanel>
            </WorkspaceShell>
          </div>
        </SidebarInset>
      </SidebarProvider>

      {isCommandPaletteOpen ? (
        <button type="button" className="sr-only" onClick={() => setIsCommandPaletteOpen(false)}>
          Close command palette
        </button>
      ) : null}
    </div>
  )
}
