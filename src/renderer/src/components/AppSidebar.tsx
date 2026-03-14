import { ReactElement } from 'react'
import { ButtonBase } from '@mui/material'
import { CalendarDays, ClipboardList, FileText, FolderKanban, Settings, Zap } from 'lucide-react'
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

export type AppPage =
  | 'notes'
  | 'projects'
  | 'weeklyPlan'
  | 'calendar'
  | 'settings'
  | 'schedules'

interface AppSidebarProps {
  activePage: AppPage
  onChange: (page: AppPage) => void
  notesCount: number
  projectsCount: number
  calendarUndoneCount: number
  profileName: string
}

const HOME_PAGES: Array<{ id: AppPage; label: string; icon: typeof FileText; shortcut: string }> = [
  { id: 'notes', label: 'Notes', icon: FileText, shortcut: '⌘1' },
  { id: 'projects', label: 'Projects', icon: FolderKanban, shortcut: '⌘2' },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays, shortcut: '⌘3' },
  { id: 'weeklyPlan', label: 'Weekly Plan', icon: ClipboardList, shortcut: '⌘4' }
]

const DOCUMENT_PAGES: Array<{ id: AppPage; label: string; icon: typeof Zap; shortcut: string }> = [
  { id: 'schedules', label: 'Schedules', icon: Zap, shortcut: '⌘5' }
]

const SETTINGS_PAGE: { id: AppPage; label: string; icon: typeof Settings; shortcut: string } = {
  id: 'settings',
  label: 'Settings',
  icon: Settings,
  shortcut: '⌘6'
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
  notesCount,
  projectsCount,
  calendarUndoneCount,
  profileName
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
    <Sidebar collapsible="icon" className="app-sidebar-glass">
      <SidebarHeader className="flex flex-col items-center h-[80px] shrink-0 justify-center border-b border-[var(--line)] px-2 pb-0">
        <p className="text-sidebar-foreground group-data-[collapsible=icon]:hidden">Xingularity</p>
      </SidebarHeader>

      <div className="px-4 py-6 leading-tight group-data-[collapsible=icon]:hidden">
        <p className="text-[1.1rem] font-semibold text-sidebar-foreground">
          Welcome back, {welcomeName}
        </p>
        <p className="pt-1 text-xs tracking-[0.01em] text-sidebar-foreground/60">Status: Synced</p>
      </div>
      <SidebarSeparator />

      <SidebarContent>
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
                    <ButtonBase sx={SIDEBAR_MENU_BUTTON_SX}>
                      <page.icon size={17} strokeWidth={2} />
                      <span>{page.label}</span>
                      <Kbd className="ml-1 shrink-0 gap-0.5 group-data-[collapsible=icon]:hidden">
                        {renderShortcut(page.shortcut)}
                      </Kbd>
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
          <SidebarGroupLabel>Plugins</SidebarGroupLabel>
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
                    <ButtonBase sx={SIDEBAR_MENU_BUTTON_SX}>
                      <page.icon size={17} strokeWidth={2} />
                      <span>{page.label}</span>
                      <Kbd className="ml-1 shrink-0 gap-0.5 group-data-[collapsible=icon]:hidden">
                        {renderShortcut(page.shortcut)}
                      </Kbd>
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
              <ButtonBase sx={SIDEBAR_MENU_BUTTON_SX}>
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
