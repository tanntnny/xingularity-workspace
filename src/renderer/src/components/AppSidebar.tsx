import { ReactElement } from 'react'
import { ButtonBase } from '@mui/material'
import {
  Bot,
  CalendarDays,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  LayoutGrid,
  FileText,
  FolderKanban,
  GitBranch,
  Search,
  Settings,
  PenTool,
  Zap
} from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator
} from './ui/sidebar'
import { Kbd } from './ui/kbd'
import appLogo from '../../../../assets/workspace_letter.png'
import { GRID_PAGE_ENABLED } from '../lib/featureFlags'

export type AppPage =
  | 'dashboard'
  | 'knowledge'
  | 'notes'
  | 'projects'
  | 'subscriptions'
  | 'grid'
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
  icon: typeof FileText
  shortcut?: string
}

const GRID_HOME_PAGE: SidebarPageItem = {
  id: 'grid',
  label: 'Grid',
  icon: LayoutGrid,
  shortcut: '⌘G'
}

const EXCALIDRAW_PAGE: SidebarPageItem = {
  id: 'excalidraw',
  label: 'Excalidraw',
  icon: PenTool
}

const BOARD_PAGES: SidebarPageItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, shortcut: '⌘D' },
  { id: 'knowledge', label: 'Knowledge', icon: GitBranch, shortcut: '⌘K' },
  ...(GRID_PAGE_ENABLED ? [GRID_HOME_PAGE, EXCALIDRAW_PAGE] : [EXCALIDRAW_PAGE])
]

const HOME_PAGES: SidebarPageItem[] = [
  { id: 'notes', label: 'Notes', icon: FileText, shortcut: '⌘1' },
  { id: 'projects', label: 'Projects', icon: FolderKanban, shortcut: '⌘2' },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays, shortcut: '⌘3' },
  { id: 'weeklyPlan', label: 'Weekly Plan', icon: ClipboardList, shortcut: '⌘4' }
]

const FINANCE_PAGES: SidebarPageItem[] = [
  { id: 'subscriptions', label: 'Subscriptions', icon: CreditCard }
]

const DOCUMENT_PAGES: Array<{ id: AppPage; label: string; icon: typeof Zap; shortcut: string }> = [
  { id: 'schedules', label: 'Schedules', icon: Zap, shortcut: '⌘5' },
  { id: 'agentHistory', label: 'Agent Chat', icon: Bot, shortcut: '⌘I' }
]

const SETTINGS_PAGE: { id: AppPage; label: string; icon: typeof Settings; shortcut: string } = {
  id: 'settings',
  label: 'Settings',
  icon: Settings,
  shortcut: '⌘,'
}

const SIDEBAR_MENU_BUTTON_SX = {
  width: '100%',
  minHeight: '100%',
  justifyContent: 'flex-start',
  alignItems: 'center',
  gap: 1,
  borderRadius: '0.5rem',
  padding: '1.025rem 0.9rem',
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
  const renderShortcut = (shortcut: string): ReactElement => (
    <>
      <span className="text-[12px] leading-none">{shortcut.slice(0, 1)}</span>
      <span className="text-[11px] leading-none">{shortcut.slice(1)}</span>
    </>
  )
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
            <p className="text-sm font-semibold tracking-[0.12em] text-sidebar-foreground/70">
              XINGULARITY
            </p>
            <p className="text-[11px] uppercase tracking-[0.3em] text-sidebar-foreground/45">
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
          className="mt-4 flex w-full items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)]/60 px-2.5 py-1.5 text-left text-sidebar-foreground transition hover:border-[var(--accent)] hover:bg-[var(--panel)]/80"
          style={{
            borderColor: 'var(--accent-line)',
            backgroundColor: 'var(--accent-soft)'
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

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Board</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {BOARD_PAGES.map((page) => (
                <SidebarMenuItem key={page.id}>
                  <SidebarMenuButton
                    asChild
                    isActive={activePage === page.id}
                    onClick={() => onChange(page.id)}
                    tooltip={page.label}
                  >
                    <ButtonBase
                      data-testid={`sidebar-page:${page.id}`}
                      sx={SIDEBAR_MENU_BUTTON_SX}
                      disabled={isLocked}
                    >
                      <page.icon size={17} strokeWidth={2} />
                      <span>{page.label}</span>
                      {page.id === 'notes' || page.id === 'projects' || page.id === 'calendar' ? (
                        <Kbd className="ml-1 shrink-0 gap-0.5 group-data-[collapsible=icon]:hidden">
                          {renderShortcut(page.shortcut ?? '')}
                        </Kbd>
                      ) : null}
                    </ButtonBase>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>Home</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {HOME_PAGES.map((page) => (
                <SidebarMenuItem key={page.id}>
                  <SidebarMenuButton
                    asChild
                    isActive={activePage === page.id}
                    onClick={() => onChange(page.id)}
                    tooltip={page.label}
                  >
                    <ButtonBase
                      data-testid={`sidebar-page:${page.id}`}
                      sx={SIDEBAR_MENU_BUTTON_SX}
                      disabled={isLocked}
                    >
                      <page.icon size={17} strokeWidth={2} />
                      <span>{page.label}</span>
                    </ButtonBase>
                  </SidebarMenuButton>
                  {page.id === 'notes' && notesCount > 0 ? (
                    <SidebarMenuBadge>{notesCountLabel}</SidebarMenuBadge>
                  ) : null}
                  {page.id === 'projects' && projectsCount > 0 ? (
                    <SidebarMenuBadge>{projectsCountLabel}</SidebarMenuBadge>
                  ) : null}
                  {page.id === 'calendar' && calendarUndoneCount > 0 ? (
                    <SidebarMenuBadge>{calendarUndoneCountLabel}</SidebarMenuBadge>
                  ) : null}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>Finance</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {FINANCE_PAGES.map((page) => (
                <SidebarMenuItem key={page.id}>
                  <SidebarMenuButton
                    asChild
                    isActive={activePage === page.id}
                    onClick={() => onChange(page.id)}
                    tooltip={page.label}
                  >
                    <ButtonBase
                      data-testid={`sidebar-page:${page.id}`}
                      sx={SIDEBAR_MENU_BUTTON_SX}
                      disabled={isLocked}
                    >
                      <page.icon size={17} strokeWidth={2} />
                      <span>{page.label}</span>
                    </ButtonBase>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>Automations</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {DOCUMENT_PAGES.map((page) => (
                <SidebarMenuItem key={page.id}>
                  <SidebarMenuButton
                    asChild
                    isActive={activePage === page.id}
                    onClick={() => onChange(page.id)}
                    tooltip={page.label}
                  >
                    <ButtonBase
                      data-testid={`sidebar-page:${page.id}`}
                      sx={SIDEBAR_MENU_BUTTON_SX}
                      disabled={isLocked}
                    >
                      <page.icon size={17} strokeWidth={2} />
                      <span>{page.label}</span>
                    </ButtonBase>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

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
                data-testid={`sidebar-page:${SETTINGS_PAGE.id}`}
                sx={SIDEBAR_MENU_BUTTON_SX}
                disabled={isLocked}
              >
                <SETTINGS_PAGE.icon size={17} strokeWidth={2} />
                <span>{SETTINGS_PAGE.label}</span>
                <Kbd className="ml-1 shrink-0 gap-0.5 group-data-[collapsible=icon]:hidden">
                  {renderShortcut(SETTINGS_PAGE.shortcut)}
                </Kbd>
              </ButtonBase>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
