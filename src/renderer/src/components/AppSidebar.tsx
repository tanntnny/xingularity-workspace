import { ReactElement } from 'react'
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
  SidebarRail
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

export function AppSidebar({ activePage, onChange, notesCount }: AppSidebarProps): ReactElement {
  const notesCountLabel = notesCount > 99 ? '99+' : String(notesCount)

  return (
    <Sidebar collapsible="icon">
      {/* Empty spacer for top bar area - traffic lights live in TopBar now */}
      <SidebarHeader className="app-drag-region h-[44px] shrink-0" />

      {/* Sidebar title row - separate from top bar */}
      <div className="flex h-[50px] shrink-0 items-center border-b border-sidebar-border px-3 group-data-[collapsible=icon]:justify-center">
        <span className="text-base font-semibold text-sidebar-foreground group-data-[collapsible=icon]:hidden">
          Beacon
        </span>
        <span className="text-base font-semibold text-sidebar-foreground hidden group-data-[collapsible=icon]:block">
          B
        </span>
      </div>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Home</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {HOME_PAGES.map((page) => (
                <SidebarMenuItem key={page.id}>
                  <SidebarMenuButton
                    isActive={activePage === page.id}
                    onClick={() => onChange(page.id)}
                    tooltip={page.label}
                  >
                    <page.icon size={17} strokeWidth={2} />
                    <span>{page.label}</span>
                  </SidebarMenuButton>
                  {page.id === 'notes' && notesCount > 0 && (
                    <SidebarMenuBadge>{notesCountLabel}</SidebarMenuBadge>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Documents</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {DOCUMENT_PAGES.map((page) => (
                <SidebarMenuItem key={page.id}>
                  <SidebarMenuButton
                    isActive={activePage === page.id}
                    onClick={() => onChange(page.id)}
                    tooltip={page.label}
                  >
                    <page.icon size={17} strokeWidth={2} />
                    <span>{page.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={activePage === 'settings'}
              onClick={() => onChange('settings')}
              tooltip="Settings"
            >
              <Settings size={17} strokeWidth={2} />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
