import { useMemo, useState } from 'react'
import {
  Bot,
  ChevronDown,
  ChevronRight,
  Command,
  CreditCard,
  Folder,
  LayoutDashboard,
  Search,
  Sparkles
} from 'lucide-react'
import {
  Button,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
  Field,
  Input,
  Pressable,
  Select,
  Shortcut,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  Switch,
  TabMenu,
  TabMenuItem,
  WorkspaceEmptyState,
  WorkspaceMain,
  WorkspaceMainContent,
  WorkspaceMainHeader,
  WorkspacePage,
  WorkspacePanelSection,
  WorkspacePanelSectionHeader,
  WorkspaceSectionCard,
  WorkspaceShell,
  WorkspaceSidePanel,
  WorkspaceSidePanelContent,
  WorkspaceSidePanelHeader,
  useWorkspaceShellShortcuts
} from '@xingularity/workspace-template'

type StarterPage = 'dashboard' | 'knowledge' | 'automations' | 'settings'
type PaletteMode = 'search' | 'command'

type SidebarItem = {
  id: StarterPage
  label: string
  shortcut?: readonly string[]
}

type SidebarSection = {
  id: string
  label: string
  icon: typeof LayoutDashboard | typeof Folder | typeof Bot | typeof CreditCard
  items: SidebarItem[]
}

const SIDEBAR_SECTIONS: SidebarSection[] = [
  {
    id: 'board',
    label: 'Board',
    icon: LayoutDashboard,
    items: [
      { id: 'dashboard', label: 'Dashboard', shortcut: ['cmd', 'd'] },
      { id: 'knowledge', label: 'Knowledge', shortcut: ['cmd', 'k'] }
    ]
  },
  {
    id: 'workspace',
    label: 'Workspace',
    icon: Folder,
    items: [{ id: 'automations', label: 'Automations', shortcut: ['cmd', 'i'] }]
  }
]

const SETTINGS_ITEM: SidebarItem = {
  id: 'settings',
  label: 'Settings',
  shortcut: ['cmd', ',']
}

const PAGE_LABELS: Record<StarterPage, string> = {
  dashboard: 'Dashboard',
  knowledge: 'Knowledge',
  automations: 'Automations',
  settings: 'Settings'
}

export default function App(): React.JSX.Element {
  const [activePage, setActivePage] = useState<StarterPage>('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [focusMode, setFocusMode] = useState(false)
  const [rightPanelOpen, setRightPanelOpen] = useState(true)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [paletteMode, setPaletteMode] = useState<PaletteMode>('search')
  const [profileName, setProfileName] = useState('Workspace team')
  const [accentProfile, setAccentProfile] = useState('indigo')
  const [vibrancyEnabled, setVibrancyEnabled] = useState(true)

  useWorkspaceShellShortcuts({
    enabled: true,
    hasRightPanel: true,
    onOpenSearchPalette: () => {
      setPaletteMode('search')
      setPaletteOpen(true)
    },
    onOpenCommandPalette: () => {
      setPaletteMode('command')
      setPaletteOpen(true)
    },
    onToggleRightPanel: () => setRightPanelOpen((current) => !current),
    onToggleFocusMode: () => {
      setFocusMode((current) => !current)
      setSidebarOpen((current) => !current)
    },
    onRunUndo: () => undefined,
    onRunRedo: () => undefined,
    onNavigateToPage: (page) => {
      if (page === 'notes') {
        setActivePage('knowledge')
        return
      }

      if (page === 'agentHistory') {
        setActivePage('automations')
        return
      }

      if (page === 'settings' || page === 'dashboard' || page === 'knowledge') {
        setActivePage(page)
      }
    },
    isPageAvailable: (page) =>
      ['dashboard', 'knowledge', 'settings', 'notes', 'agentHistory'].includes(page),
    isTypingTarget: (target) => {
      if (!(target instanceof HTMLElement)) {
        return false
      }

      return Boolean(
        target.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""]')
      )
    }
  })

  const paletteItems = useMemo(
    () => [
      {
        value: 'dashboard',
        label: 'Open Dashboard',
        shortcut: ['cmd', 'd'] as const,
        onSelect: () => setActivePage('dashboard')
      },
      {
        value: 'knowledge',
        label: 'Open Knowledge',
        shortcut: ['cmd', 'k'] as const,
        onSelect: () => setActivePage('knowledge')
      },
      {
        value: 'automations',
        label: 'Open Automations',
        shortcut: ['cmd', 'i'] as const,
        onSelect: () => setActivePage('automations')
      },
      {
        value: 'settings',
        label: 'Open Settings',
        shortcut: ['cmd', ','] as const,
        onSelect: () => setActivePage('settings')
      }
    ],
    []
  )

  return (
    <>
      <SidebarProvider
        className="h-full"
        open={focusMode ? false : sidebarOpen}
        onOpenChange={setSidebarOpen}
      >
        <StarterSidebar
          activePage={activePage}
          onChange={setActivePage}
          onOpenPalette={() => {
            setPaletteMode('search')
            setPaletteOpen(true)
          }}
          profileName={profileName}
        />

        <SidebarInset
          data-workspace-vibrancy={vibrancyEnabled ? 'on' : 'off'}
          className="!min-h-0 overflow-hidden text-[var(--text)] antialiased [font-family:var(--app-font-family)]"
        >
          <div className="workspace-vibrancy-scope flex h-full min-w-0">
            <WorkspaceShell>
              <WorkspaceMain>
                <WorkspaceMainHeader
                  breadcrumb={
                    <div className="text-sm font-medium text-[var(--muted)]">
                      {PAGE_LABELS[activePage]}
                    </div>
                  }
                />
                <WorkspaceMainContent>
                  {activePage === 'dashboard' ? <StarterDashboardPage /> : null}
                  {activePage === 'knowledge' ? <StarterKnowledgePage /> : null}
                  {activePage === 'automations' ? <StarterAutomationsPage /> : null}
                  {activePage === 'settings' ? (
                    <StarterSettingsPage
                      profileName={profileName}
                      onProfileNameChange={setProfileName}
                      accentProfile={accentProfile}
                      onAccentProfileChange={setAccentProfile}
                      vibrancyEnabled={vibrancyEnabled}
                      onVibrancyChange={setVibrancyEnabled}
                    />
                  ) : null}
                </WorkspaceMainContent>
              </WorkspaceMain>

              <WorkspaceSidePanel className={rightPanelOpen ? 'flex' : 'hidden'}>
                <WorkspaceSidePanelHeader />
                <WorkspaceSidePanelContent className="space-y-3 p-3">
                  <WorkspacePanelSection>
                    <WorkspacePanelSectionHeader
                      icon={<Sparkles size={16} />}
                      heading="Template notes"
                      description="This starter demonstrates the shell, not product logic."
                    />
                    <p className="text-sm text-[var(--muted)]">
                      Swap page content freely, but keep shared shell behavior and primitives as the
                      default path.
                    </p>
                  </WorkspacePanelSection>
                  <WorkspacePanelSection>
                    <WorkspacePanelSectionHeader
                      icon={<Command size={16} />}
                      heading="Shortcuts"
                      description="Default shell keyboard behavior"
                    />
                    <div className="grid gap-2 text-sm text-[var(--muted)]">
                      <div className="flex items-center justify-between gap-3">
                        <span>Palette</span>
                        <Shortcut keys={['cmd', 'p']} />
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>Command mode</span>
                        <Shortcut keys={['cmd', 'shift', 'p']} />
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>Right panel</span>
                        <Shortcut keys={['alt', 'b']} />
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>Focus mode</span>
                        <Shortcut keys={['cmd', 'f']} />
                      </div>
                    </div>
                  </WorkspacePanelSection>
                </WorkspaceSidePanelContent>
              </WorkspaceSidePanel>
            </WorkspaceShell>
          </div>
        </SidebarInset>
      </SidebarProvider>

      <CommandDialog open={paletteOpen} onOpenChange={setPaletteOpen}>
        <CommandInput
          placeholder={paletteMode === 'command' ? 'Run a command…' : 'Search pages…'}
        />
        <CommandList>
          <CommandEmpty>No results.</CommandEmpty>
          <CommandGroup heading={paletteMode === 'command' ? 'Commands' : 'Pages'}>
            {paletteItems.map((item) => (
              <CommandItem
                key={item.value}
                value={item.value}
                onSelect={() => {
                  item.onSelect()
                  setPaletteOpen(false)
                }}
              >
                <span>{item.label}</span>
                <CommandShortcut keys={item.shortcut} />
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Shell">
            <CommandItem
              value="toggle-right-panel"
              onSelect={() => {
                setRightPanelOpen((current) => !current)
                setPaletteOpen(false)
              }}
            >
              Toggle right panel
              <CommandShortcut keys={['alt', 'b']} />
            </CommandItem>
            <CommandItem
              value="toggle-focus-mode"
              onSelect={() => {
                setFocusMode((current) => !current)
                setPaletteOpen(false)
              }}
            >
              Toggle focus mode
              <CommandShortcut keys={['cmd', 'f']} />
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  )
}

function StarterSidebar({
  activePage,
  onChange,
  onOpenPalette,
  profileName
}: {
  activePage: StarterPage
  onChange: (page: StarterPage) => void
  onOpenPalette: () => void
  profileName: string
}): React.JSX.Element {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    board: true,
    workspace: true
  })

  return (
    <Sidebar collapsible="icon" className="app-sidebar-glass">
      <SidebarHeader className="flex h-[96px] shrink-0 items-center justify-center border-b border-[var(--line)] px-3 mt-3 pb-0">
        <div className="flex items-center gap-3 group-data-[collapsible=icon]:justify-center">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-[var(--accent-soft)] text-lg font-semibold text-[var(--accent)] shadow-[0_12px_30px_rgba(7,5,18,0.35)]">
            X
          </div>
          <div className="leading-tight group-data-[collapsible=icon]:hidden">
            <p className="sidebar-brand-shimmer text-sm font-semibold tracking-[0.12em] text-sidebar-foreground/70">
              XINGULARITY
            </p>
            <p className="sidebar-brand-shimmer sidebar-brand-shimmer-subtle text-[11px] uppercase tracking-[0.3em] text-sidebar-foreground/45">
              Starter
            </p>
          </div>
        </div>
      </SidebarHeader>

      <div className="px-4 py-6 leading-tight group-data-[collapsible=icon]:hidden">
        <p className="text-[1.1rem] font-semibold text-sidebar-foreground">
          Hello, <span style={{ color: 'var(--accent)' }}>{profileName || 'team'}</span>
        </p>
        <p className="pt-1 text-xs tracking-[0.01em] text-sidebar-foreground/60">
          Shared shell starter
        </p>
        <button
          type="button"
          onClick={onOpenPalette}
          className="mt-4 flex w-full items-center gap-2 rounded-xl border border-[var(--line)] px-2.5 py-1.5 text-left text-sidebar-foreground transition hover:border-[var(--accent)]"
          style={{ borderColor: 'var(--accent-line)' }}
        >
          <Search size={15} className="shrink-0 opacity-70" style={{ color: 'var(--accent)' }} />
          <span className="min-w-0 flex-1 whitespace-nowrap text-sm text-sidebar-foreground/70">
            Command palette...
          </span>
          <Shortcut keys={['cmd', 'p']} className="ml-auto shrink-0" />
        </button>
      </div>
      <SidebarSeparator />

      <SidebarContent>
        {SIDEBAR_SECTIONS.map((section) => {
          const isOpen = openSections[section.id]
          const activeInSection = section.items.some((item) => item.id === activePage)
          const ChevronIcon = isOpen ? ChevronDown : ChevronRight

          return (
            <SidebarGroup key={section.id} className="sidebar-section-group px-3 py-2">
              <Pressable
                className="sidebar-section-trigger"
                data-active={activeInSection}
                data-open={isOpen}
                onClick={() =>
                  setOpenSections((current) => ({ ...current, [section.id]: !current[section.id] }))
                }
                title={section.label}
                data-no-ripple
                sx={{
                  width: '100%',
                  justifyContent: 'flex-start',
                  alignItems: 'center',
                  gap: 0.6,
                  borderRadius: '0.5rem',
                  padding: '0.35rem 0.15rem 0.35rem 0.42rem',
                  border: '1px solid transparent',
                  background: 'transparent',
                  color: 'color-mix(in srgb, var(--sidebar-foreground) 72%, transparent)',
                  '.group[data-collapsible="icon"] &': {
                    padding: '0.5rem 0',
                    justifyContent: 'center',
                    borderRadius: '0.75rem'
                  },
                  '&[data-active="true"]': {
                    color: 'var(--sidebar-foreground)'
                  }
                }}
              >
                <span className="sidebar-section-icon">
                  <section.icon size={14} strokeWidth={2} />
                </span>
                <span className="sidebar-section-label">{section.label}</span>
                <ChevronIcon
                  size={13}
                  strokeWidth={2.2}
                  className="sidebar-section-chevron ml-auto shrink-0"
                />
              </Pressable>
              <SidebarGroupContent
                className="pt-0.5 group-data-[collapsible=icon]:hidden"
                hidden={!isOpen}
              >
                <div className="sidebar-section-stack">
                  <span className="sidebar-section-rail" aria-hidden="true" />
                  <SidebarMenu className="sidebar-section-items">
                    {section.items.map((page) => (
                      <SidebarMenuItem key={page.id}>
                        <SidebarMenuButton
                          asChild
                          isActive={activePage === page.id}
                          onClick={() => onChange(page.id)}
                          tooltip={page.label}
                        >
                          <Pressable
                            className="sidebar-menu-card sidebar-menu-card-nested"
                            data-testid={`starter-sidebar-page:${page.id}`}
                            sx={{
                              width: '100%',
                              minHeight: '100%',
                              justifyContent: 'flex-start',
                              alignItems: 'center',
                              gap: 1,
                              borderRadius: '0.5rem',
                              padding: '1.025rem 0.9rem 1.025rem 1.75rem',
                              border: '1px solid transparent',
                              color:
                                'color-mix(in srgb, var(--sidebar-foreground) 60%, transparent)',
                              background: 'transparent',
                              fontWeight: 400,
                              '.group[data-collapsible="icon"] &': {
                                padding: 0,
                                borderRadius: '0.75rem'
                              },
                              '&[data-active="true"]': {
                                background:
                                  'linear-gradient(135deg, var(--sidebar-active-bg-start), var(--sidebar-active-bg-end)) padding-box, linear-gradient(135deg, var(--sidebar-active-border-start), var(--sidebar-active-border-end)) border-box',
                                color: 'var(--sidebar-foreground)',
                                fontWeight: 500
                              }
                            }}
                          >
                            <span>{page.label}</span>
                          </Pressable>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </div>
              </SidebarGroupContent>
            </SidebarGroup>
          )
        })}
      </SidebarContent>

      <SidebarSeparator />
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={activePage === SETTINGS_ITEM.id}
              onClick={() => onChange(SETTINGS_ITEM.id)}
              tooltip={SETTINGS_ITEM.label}
            >
              <Pressable
                className="sidebar-menu-card"
                sx={{
                  width: '100%',
                  minHeight: '100%',
                  justifyContent: 'flex-start',
                  alignItems: 'center',
                  gap: 1,
                  borderRadius: '0.5rem',
                  padding: '1.025rem 0.9rem 1.025rem 1.75rem',
                  border: '1px solid transparent',
                  color: 'color-mix(in srgb, var(--sidebar-foreground) 60%, transparent)',
                  background: 'transparent',
                  fontWeight: 400
                }}
              >
                <span>{SETTINGS_ITEM.label}</span>
                <Shortcut
                  keys={SETTINGS_ITEM.shortcut}
                  className="ml-auto shrink-0 group-data-[collapsible=icon]:hidden"
                />
              </Pressable>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}

function StarterDashboardPage(): React.JSX.Element {
  return (
    <WorkspacePage width="wide">
      <WorkspaceSectionCard>
        <div className="flex items-center gap-3">
          <LayoutDashboard size={20} className="text-[var(--accent)]" />
          <div>
            <h2 className="text-lg font-semibold text-[var(--text)]">Dashboard shell</h2>
            <p className="text-sm text-[var(--muted)]">
              Use shared cards, action buttons, and layout wrappers before creating page-local
              shells.
            </p>
          </div>
        </div>
      </WorkspaceSectionCard>

      <div className="grid gap-4 md:grid-cols-3">
        {['Focus', 'Health', 'Momentum'].map((label) => (
          <WorkspaceSectionCard key={label} className="p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
              {label}
            </div>
            <div className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-[var(--text)]">
              07
            </div>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Starter metric content using the workspace surface language.
            </p>
          </WorkspaceSectionCard>
        ))}
      </div>
    </WorkspacePage>
  )
}

function StarterKnowledgePage(): React.JSX.Element {
  return (
    <WorkspacePage width="wide">
      <WorkspaceEmptyState
        icon={<Sparkles className="text-[var(--accent)]" size={18} />}
        heading="Knowledge surface"
        description="Replace this with your own graph, canvas, or document-first surface while preserving the shared shell."
      />
    </WorkspacePage>
  )
}

function StarterAutomationsPage(): React.JSX.Element {
  return (
    <WorkspacePage width="wide">
      <WorkspaceSectionCard>
        <div className="flex items-center gap-3">
          <Bot size={20} className="text-[var(--accent)]" />
          <div>
            <h2 className="text-lg font-semibold text-[var(--text)]">Automation workspace</h2>
            <p className="text-sm text-[var(--muted)]">
              This page shows the neutral shell for tool-centric or workflow-centric content.
            </p>
          </div>
        </div>
      </WorkspaceSectionCard>
    </WorkspacePage>
  )
}

function StarterSettingsPage({
  profileName,
  onProfileNameChange,
  accentProfile,
  onAccentProfileChange,
  vibrancyEnabled,
  onVibrancyChange
}: {
  profileName: string
  onProfileNameChange: (value: string) => void
  accentProfile: string
  onAccentProfileChange: (value: string) => void
  vibrancyEnabled: boolean
  onVibrancyChange: (value: boolean) => void
}): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<'profile' | 'appearance'>('profile')

  return (
    <WorkspacePage width="wide">
      <WorkspaceSectionCard className="grid gap-4 p-5">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text)]">Settings starter</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Shared fields, tabs, and toggles for settings-heavy pages.
          </p>
        </div>

        <TabMenu
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as typeof activeTab)}
          variant="inline-accent"
        >
          <TabMenuItem value="profile" variant="inline-accent">
            Profile
          </TabMenuItem>
          <TabMenuItem value="appearance" variant="inline-accent">
            Appearance
          </TabMenuItem>
        </TabMenu>

        {activeTab === 'profile' ? (
          <Field
            label="Profile name"
            description="Keep forms routed through `Field` and shared inputs."
          >
            <Input
              value={profileName}
              onChange={(event) => onProfileNameChange(event.currentTarget.value)}
              className="workspace-subtle-control"
            />
          </Field>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Accent profile">
              <Select
                value={accentProfile}
                onChange={(event) => onAccentProfileChange(event.currentTarget.value)}
                className="workspace-subtle-control"
              >
                <option value="indigo">Indigo</option>
                <option value="emerald">Emerald</option>
                <option value="mono">Monotone</option>
              </Select>
            </Field>
            <div className="workspace-subtle-surface flex items-start justify-between rounded-lg p-4">
              <div>
                <p className="text-sm font-semibold text-[var(--text)]">Workspace vibrancy</p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Keep the glass shell around the main workspace and side panel.
                </p>
              </div>
              <Switch
                checked={vibrancyEnabled}
                onChange={(_event, checked) => onVibrancyChange(checked)}
                inputProps={{ 'aria-label': 'Toggle workspace vibrancy' }}
              />
            </div>
          </div>
        )}

        <Button className="w-fit">Primary action</Button>
      </WorkspaceSectionCard>
    </WorkspacePage>
  )
}
