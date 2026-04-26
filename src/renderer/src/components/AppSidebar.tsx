import { type CSSProperties, ReactElement, useState } from 'react'
import { ButtonBase } from '@mui/material'
import {
  Bot,
  ChevronDown,
  ChevronRight,
  CreditCard,
  LayoutDashboard,
  House,
  Search
} from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator
} from './ui/sidebar'
import { Kbd } from './ui/kbd'
import appLogo from '../../../../assets/workspace_letter.png'

export type AppPage =
  | 'dashboard'
  | 'knowledge'
  | 'notes'
  | 'projects'
  | 'subscriptions'
  | 'excalidraw'
  | 'weeklyPlan'
  | 'calendar'
  | 'settings'
  | 'schedules'
  | 'scheduleDocs'
  | 'agentHistory'

interface AppSidebarProps {
  activePage: AppPage
  onChange: (page: AppPage) => void
  onOpenSearchPalette: () => void
  onSidebarInteract?: () => void
  notesCount: number
  projectsCount: number
  calendarUndoneCount: number
  profileName: string
  isLocked?: boolean
  className?: string
  collapsible?: 'offcanvas' | 'icon' | 'none'
}

type SidebarPageItem = {
  id: AppPage
  label: string
  shortcut?: string
}

type SidebarSection = {
  id: 'board' | 'home' | 'finance' | 'automations'
  label: string
  icon: typeof LayoutDashboard | typeof House | typeof CreditCard | typeof Bot
  items: SidebarPageItem[]
}

const EXCALIDRAW_PAGE: SidebarPageItem = {
  id: 'excalidraw',
  label: 'Excalidraw'
}

const BOARD_PAGES: SidebarPageItem[] = [
  { id: 'dashboard', label: 'Dashboard', shortcut: '⌘D' },
  { id: 'knowledge', label: 'Knowledge', shortcut: '⌘K' },
  EXCALIDRAW_PAGE
]

const HOME_PAGES: SidebarPageItem[] = [
  { id: 'notes', label: 'Notes', shortcut: '⌘1' },
  { id: 'projects', label: 'Projects', shortcut: '⌘2' },
  { id: 'calendar', label: 'Calendar', shortcut: '⌘3' },
  { id: 'weeklyPlan', label: 'Weekly Plan', shortcut: '⌘4' }
]

const FINANCE_PAGES: SidebarPageItem[] = [{ id: 'subscriptions', label: 'Subscriptions' }]

const DOCUMENT_PAGES: SidebarPageItem[] = [
  { id: 'schedules', label: 'Schedules', shortcut: '⌘5' },
  { id: 'agentHistory', label: 'Agent Chat', shortcut: '⌘I' }
]

const SETTINGS_PAGE: SidebarPageItem = {
  id: 'settings',
  label: 'Settings',
  shortcut: '⌘,'
}

const SIDEBAR_SECTIONS: SidebarSection[] = [
  { id: 'board', label: 'Board', icon: LayoutDashboard, items: BOARD_PAGES },
  { id: 'home', label: 'Home', icon: House, items: HOME_PAGES },
  { id: 'finance', label: 'Finance', icon: CreditCard, items: FINANCE_PAGES },
  { id: 'automations', label: 'Automations', icon: Bot, items: DOCUMENT_PAGES }
]

const SIDEBAR_SECTION_DEFAULTS: Record<SidebarSection['id'], boolean> = {
  board: true,
  home: true,
  finance: true,
  automations: true
}

const SIDEBAR_MENU_BUTTON_SX = {
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
  },
  '&[data-active="true"]:hover': {
    background:
      'linear-gradient(135deg, var(--sidebar-active-bg-start), var(--sidebar-active-bg-end)) padding-box, linear-gradient(135deg, var(--sidebar-active-border-start), var(--sidebar-active-border-end)) border-box'
  }
} as const

const SIDEBAR_SECTION_BUTTON_SX = {
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
} as const

export function AppSidebar({
  activePage,
  onChange,
  onOpenSearchPalette,
  onSidebarInteract,
  notesCount,
  projectsCount,
  calendarUndoneCount,
  profileName,
  isLocked = false,
  className,
  collapsible = 'icon'
}: AppSidebarProps): ReactElement {
  const toBadgeLabel = (count: number): string => (count > 99 ? '99+' : String(count))
  const notesCountLabel = toBadgeLabel(notesCount)
  const projectsCountLabel = toBadgeLabel(projectsCount)
  const calendarUndoneCountLabel = toBadgeLabel(calendarUndoneCount)
  const welcomeName = profileName.trim() || 'there'
  const [openSections, setOpenSections] =
    useState<Record<SidebarSection['id'], boolean>>(SIDEBAR_SECTION_DEFAULTS)

  const renderShortcut = (shortcut: string): ReactElement => (
    <>
      <span className="text-[12px] leading-none">{shortcut.slice(0, 1)}</span>
      <span className="text-[11px] leading-none">{shortcut.slice(1)}</span>
    </>
  )
  const toggleSection = (sectionId: SidebarSection['id']): void => {
    setOpenSections((current) => ({ ...current, [sectionId]: !current[sectionId] }))
  }

  const renderBadge = (pageId: AppPage): ReactElement | null => {
    if (pageId === 'notes' && notesCount > 0) {
      return <SidebarMenuBadge>{notesCountLabel}</SidebarMenuBadge>
    }

    if (pageId === 'projects' && projectsCount > 0) {
      return <SidebarMenuBadge>{projectsCountLabel}</SidebarMenuBadge>
    }

    if (pageId === 'calendar' && calendarUndoneCount > 0) {
      return <SidebarMenuBadge>{calendarUndoneCountLabel}</SidebarMenuBadge>
    }

    return null
  }

  const renderSection = (section: SidebarSection): ReactElement => {
    const isOpen = openSections[section.id]
    const activeInSection = section.items.some((item) => item.id === activePage)
    const ChevronIcon = isOpen ? ChevronDown : ChevronRight

    return (
      <SidebarGroup
        key={section.id}
        className="sidebar-section-group px-3 py-2"
        style={
          {
            '--sidebar-section-icon-color':
              'color-mix(in srgb, var(--sidebar-foreground) 82%, transparent)'
          } as CSSProperties
        }
      >
        <ButtonBase
          className="sidebar-section-trigger"
          data-active={activeInSection}
          data-open={isOpen}
          onClick={() => toggleSection(section.id)}
          disabled={isLocked}
          title={section.label}
          sx={SIDEBAR_SECTION_BUTTON_SX}
          data-no-ripple
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
        </ButtonBase>
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
                    <ButtonBase
                      className="sidebar-menu-card sidebar-menu-card-nested"
                      data-testid={`sidebar-page:${page.id}`}
                      sx={SIDEBAR_MENU_BUTTON_SX}
                      disabled={isLocked}
                    >
                      <span>{page.label}</span>
                    </ButtonBase>
                  </SidebarMenuButton>
                  {renderBadge(page.id)}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    )
  }

  return (
    <Sidebar
      collapsible={collapsible}
      className={`app-sidebar-glass ${className ?? ''}`.trim()}
      onPointerDownCapture={() => onSidebarInteract?.()}
    >
      <SidebarHeader className="flex h-[96px] shrink-0 items-center justify-center border-b border-[var(--line)] px-3 mt-3 pb-0">
        <div className="flex items-center gap-3 group-data-[collapsible=icon]:justify-center">
          <img
            src={appLogo}
            alt="Xingularity logo"
            className="h-11 w-11 shrink-0 rounded-lg border border-white/10 shadow-[0_12px_30px_rgba(7,5,18,0.35)]"
          />
          <div className="leading-tight group-data-[collapsible=icon]:hidden">
            <p className="sidebar-brand-shimmer text-sm font-semibold tracking-[0.12em] text-sidebar-foreground/70">
              XINGULARITY
            </p>
            <p className="sidebar-brand-shimmer sidebar-brand-shimmer-subtle text-[11px] uppercase tracking-[0.3em] text-sidebar-foreground/45">
              Workspace
            </p>
          </div>
        </div>
      </SidebarHeader>

      <div className="px-4 py-6 leading-tight group-data-[collapsible=icon]:hidden">
        <div className="flex items-center">
          <div className="min-w-0">
            <p className="text-[1.1rem] font-semibold text-sidebar-foreground">
              Welcome back, <span style={{ color: 'var(--accent)' }}>{welcomeName}</span>
            </p>
            <div className="flex items-center gap-1.5 pt-1 text-xs tracking-[0.01em] text-sidebar-foreground/60">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--accent)' }} />
              <span>Status: {isLocked ? 'Select vault' : 'Synced'}</span>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenSearchPalette}
          disabled={isLocked}
          className="mt-4 flex w-full items-center gap-2 rounded-xl border border-[var(--line)] px-2.5 py-1.5 text-left text-sidebar-foreground transition hover:border-[var(--accent)]"
          style={{
            borderColor: 'var(--accent-line)'
          }}
          aria-label="Open command palette"
          title="Open command palette"
        >
          <Search size={15} className="shrink-0 opacity-70" style={{ color: 'var(--accent)' }} />
          <span className="min-w-0 flex-1 text-sm text-sidebar-foreground/70">
            Command palette...
          </span>
        </button>
      </div>
      <SidebarSeparator />

      <SidebarContent>{SIDEBAR_SECTIONS.map(renderSection)}</SidebarContent>

      <SidebarSeparator />
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={activePage === SETTINGS_PAGE.id}
              onClick={() => onChange(SETTINGS_PAGE.id)}
              tooltip={SETTINGS_PAGE.label}
            >
              <ButtonBase
                className="sidebar-menu-card"
                data-testid={`sidebar-page:${SETTINGS_PAGE.id}`}
                sx={SIDEBAR_MENU_BUTTON_SX}
                disabled={isLocked}
              >
                <span>{SETTINGS_PAGE.label}</span>
                <Kbd className="ml-auto shrink-0 gap-0.5 group-data-[collapsible=icon]:hidden">
                  {renderShortcut(SETTINGS_PAGE.shortcut ?? '')}
                </Kbd>
              </ButtonBase>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
