import { ReactElement } from 'react'
import { ButtonBase } from '@mui/material'
import { CalendarDays, FileText, FolderKanban, LibraryBig, Settings } from 'lucide-react'
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
  SidebarSeparator,
  SidebarTrigger
} from './ui/sidebar'

export type AppPage = 'notes' | 'projects' | 'resources' | 'calendar' | 'settings'

interface AppSidebarProps {
  activePage: AppPage
  onChange: (page: AppPage) => void
  notesCount: number
}

const HOME_PAGES: Array<{ id: AppPage; label: string; icon: typeof FileText }> = [
  { id: 'notes', label: 'Notes', icon: FileText },
  { id: 'projects', label: 'Projects', icon: FolderKanban },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays }
]

const DOCUMENT_PAGES: Array<{ id: AppPage; label: string; icon: typeof LibraryBig }> = [
  { id: 'resources', label: 'Data Library', icon: LibraryBig }
]

const SIDEBAR_MENU_BUTTON_SX = {
  width: '100%',
  minHeight: '100%',
  justifyContent: 'flex-start',
  alignItems: 'center',
  gap: 1,
  borderRadius: '0.5rem',
  padding: '1.025rem 0.9rem',
  border: '1px solid transparent',
  color: 'var(--sidebar-foreground)',
  background: 'transparent',
  '.group[data-collapsible="icon"] &': {
    padding: 0,
    borderRadius: '0.75rem'
  },
  '&[data-active="true"]': {
    background:
      'linear-gradient(135deg, var(--sidebar-active-bg-start), var(--sidebar-active-bg-end)) padding-box, linear-gradient(135deg, var(--sidebar-active-border-start), var(--sidebar-active-border-end)) border-box',
    color: 'var(--sidebar-foreground)'
  },
  '&[data-active="true"]:hover': {
    background:
      'linear-gradient(135deg, var(--sidebar-active-bg-start), var(--sidebar-active-bg-end)) padding-box, linear-gradient(135deg, var(--sidebar-active-border-start), var(--sidebar-active-border-end)) border-box'
  }
} as const

export function AppSidebar({ activePage, onChange, notesCount }: AppSidebarProps): ReactElement {
  const notesCountLabel = notesCount > 99 ? '99+' : String(notesCount)

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="pt-10">
        <div className="flex items-center gap-2 px-2 group-data-[collapsible=icon]:justify-center">
          <SidebarTrigger className="h-8 w-8 shrink-0" />
          <span className="text-sm font-semibold text-sidebar-foreground group-data-[collapsible=icon]:hidden">
            Beacon
          </span>
        </div>
      </SidebarHeader>
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
                    </ButtonBase>
                  </SidebarMenuButton>
                  {page.id === 'notes' && notesCount > 0 && (
                    <SidebarMenuBadge>{notesCountLabel}</SidebarMenuBadge>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>Documents</SidebarGroupLabel>
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
              isActive={activePage === 'settings'}
              onClick={() => onChange('settings')}
              tooltip="Settings"
            >
              <ButtonBase sx={SIDEBAR_MENU_BUTTON_SX}>
                <Settings size={17} strokeWidth={2} />
                <span>Settings</span>
              </ButtonBase>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
