import { useMemo, useState, type ReactElement } from 'react'
import {
  Bot,
  BookOpen,
  CalendarClock,
  CalendarDays,
  ChevronDown,
  CreditCard,
  FolderKanban,
  House,
  LayoutDashboard,
  ListTodo,
  MessageSquare,
  NotebookTabs,
  Search,
  Settings2,
  type FilledIcon
} from './ui/icons'

import { ALL_APP_PAGES, type AppPage } from '../navigation'
import { cn } from '../lib/utils'
import {
  Button,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator
} from './ui'
import { Shortcut, type ShortcutKey } from './ui/kbd'
import appLogo from '../../../../assets/logo.png'

interface AppSidebarProps {
  activePage: AppPage
  onChange: (page: AppPage) => void
  onOpenSearchPalette: () => void
  onSidebarInteract?: () => void
  notesCount: number
  projectsCount: number
  calendarUndoneCount: number
  profileName: string
  activeVaultPath?: string | null
  isLocked?: boolean
  availablePages?: readonly AppPage[]
  className?: string
  collapsible?: 'offcanvas' | 'icon' | 'none'
}

type SidebarPageItem = {
  id: AppPage
  label: string
  icon: FilledIcon
  shortcut?: readonly ShortcutKey[]
}

type SidebarSection = {
  id: 'board' | 'home' | 'finance' | 'automations'
  label: string
  icon: FilledIcon
  items: readonly SidebarPageItem[]
}

const SIDEBAR_SECTIONS: readonly SidebarSection[] = [
  {
    id: 'board',
    label: 'Board',
    icon: LayoutDashboard,
    items: [{ id: 'knowledge', label: 'Knowledge', icon: BookOpen }]
  },
  {
    id: 'home',
    label: 'Home',
    icon: House,
    items: [
      { id: 'notes', label: 'Notebooks', icon: NotebookTabs },
      { id: 'projects', label: 'Projects', icon: FolderKanban },
      { id: 'calendar', label: 'Calendar', icon: CalendarDays },
      { id: 'weeklyPlan', label: 'Weekly Plan', icon: ListTodo }
    ]
  },
  {
    id: 'finance',
    label: 'Finance',
    icon: CreditCard,
    items: [{ id: 'subscriptions', label: 'Subscriptions', icon: CreditCard }]
  },
  {
    id: 'automations',
    label: 'Automations',
    icon: Bot,
    items: [
      { id: 'schedules', label: 'Schedules', icon: CalendarClock },
      { id: 'agentHistory', label: 'Agent Chat', icon: MessageSquare, shortcut: ['cmd', 'i'] }
    ]
  }
]

const FOOTER_PAGES: readonly SidebarPageItem[] = [
  { id: 'settings', label: 'Settings', icon: Settings2, shortcut: ['cmd', ','] }
]

const SIDEBAR_SECTION_DEFAULTS: Record<SidebarSection['id'], boolean> = {
  board: true,
  home: true,
  finance: true,
  automations: true
}

function getVaultDisplayName(activeVaultPath: string | null): string {
  if (!activeVaultPath) {
    return 'No vault selected'
  }

  const normalized = activeVaultPath.replace(/[\\/]+$/g, '')
  const segments = normalized.split(/[\\/]/)

  return segments[segments.length - 1] || activeVaultPath
}

export function AppSidebar({
  activePage,
  onChange,
  onOpenSearchPalette,
  onSidebarInteract,
  notesCount,
  projectsCount,
  calendarUndoneCount,
  profileName,
  activeVaultPath = null,
  isLocked = false,
  availablePages = ALL_APP_PAGES,
  className,
  collapsible = 'icon'
}: AppSidebarProps): ReactElement {
  const availablePageSet = useMemo(() => new Set(availablePages), [availablePages])
  const [openSections, setOpenSections] =
    useState<Record<SidebarSection['id'], boolean>>(SIDEBAR_SECTION_DEFAULTS)
  const welcomeName = profileName.trim() || 'there'
  const sidebarVaultTitle = isLocked ? 'Select vault' : (activeVaultPath ?? 'No vault selected')
  const sidebarVaultLabel = isLocked ? 'Select vault' : getVaultDisplayName(activeVaultPath)

  const isPageDisabled = (page: SidebarPageItem): boolean => isLocked || page.id === 'weeklyPlan'
  const toBadgeLabel = (count: number): string => (count > 99 ? '99+' : String(count))

  const renderBadge = (pageId: AppPage): ReactElement | null => {
    const count =
      pageId === 'notes'
        ? notesCount
        : pageId === 'projects'
          ? projectsCount
          : pageId === 'calendar'
            ? calendarUndoneCount
            : 0

    return count > 0 ? <SidebarMenuBadge>{toBadgeLabel(count)}</SidebarMenuBadge> : null
  }

  const renderItem = (page: SidebarPageItem): ReactElement => {
    const PageIcon = page.icon
    const disabled = isPageDisabled(page)

    return (
      <SidebarMenuItem key={page.id}>
        <SidebarMenuButton
          isActive={activePage === page.id}
          onClick={disabled ? undefined : () => onChange(page.id)}
          disabled={disabled}
          tooltip={page.label}
          aria-label={page.label}
          data-testid={`sidebar-page:${page.id}`}
        >
          <PageIcon aria-hidden="true" />
          <span>{page.label}</span>
          {page.shortcut ? (
            <Shortcut
              keys={page.shortcut}
              data-testid={`sidebar-shortcut:${page.id}`}
              className="ml-auto shrink-0 group-data-[collapsible=icon]:hidden"
            />
          ) : null}
        </SidebarMenuButton>
        {renderBadge(page.id)}
      </SidebarMenuItem>
    )
  }

  return (
    <Sidebar
      collapsible={collapsible}
      className={cn('border-sidebar-border', className)}
      onPointerDownCapture={() => onSidebarInteract?.()}
    >
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <img
            src={appLogo}
            alt="Xingularity logo"
            className="size-8 shrink-0 rounded-md border border-sidebar-border object-cover"
          />
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm font-semibold">Xingularity</p>
            <p className="truncate text-xs text-muted-foreground">Workspace</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarGroup className="border-b border-sidebar-border group-data-[collapsible=icon]:hidden">
        <p className="text-sm font-medium">
          Welcome back, <span className="text-primary">{welcomeName}</span>
        </p>
        <p className="flex min-w-0 items-center gap-1.5 truncate text-xs text-muted-foreground">
          <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
          <span className="truncate" title={sidebarVaultTitle}>
            {sidebarVaultLabel}
          </span>
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onOpenSearchPalette}
          disabled={isLocked}
          className="mt-2 w-full justify-start"
          aria-label="Open command palette"
        >
          <Search aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-left">Command palette...</span>
          <Shortcut keys={['cmd', 'p']} className="ml-auto shrink-0" />
        </Button>
      </SidebarGroup>

      <SidebarGroup className="hidden p-3 group-data-[collapsible=icon]:block">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={onOpenSearchPalette}
              disabled={isLocked}
              tooltip="Command palette"
              aria-label="Open command palette"
            >
              <Search aria-hidden="true" />
              <span>Command palette</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>

      <SidebarContent>
        {SIDEBAR_SECTIONS.filter((section) =>
          section.items.some((item) => availablePageSet.has(item.id))
        ).map((section) => {
          const isOpen = openSections[section.id]
          const activeInSection = section.items.some((item) => item.id === activePage)
          const SectionIcon = section.icon

          return (
            <SidebarGroup key={section.id}>
              <details
                open={isOpen}
                onToggle={(event) => {
                  const nextIsOpen = event.currentTarget.open

                  setOpenSections((current) => ({
                    ...current,
                    [section.id]: nextIsOpen
                  }))
                }}
                className="group/section"
              >
                <SidebarGroupLabel
                  asChild
                  className="cursor-pointer list-none [&::-webkit-details-marker]:hidden group-data-[collapsible=icon]:m-0 group-data-[collapsible=icon]:h-10 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:opacity-100"
                >
                  <summary
                    className={cn(
                      'flex items-center gap-2',
                      activeInSection && 'text-sidebar-accent-foreground'
                    )}
                    onClick={(event) => {
                      if (isLocked) event.preventDefault()
                    }}
                    aria-disabled={isLocked}
                    title={section.label}
                  >
                    <SectionIcon aria-hidden="true" />
                    <span className="group-data-[collapsible=icon]:hidden">{section.label}</span>
                    <ChevronDown
                      aria-hidden="true"
                      className="ml-auto transition-transform group-open/section:rotate-180 group-data-[collapsible=icon]:hidden"
                    />
                  </summary>
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {section.items.filter((item) => availablePageSet.has(item.id)).map(renderItem)}
                  </SidebarMenu>
                </SidebarGroupContent>
              </details>
            </SidebarGroup>
          )
        })}
      </SidebarContent>

      {FOOTER_PAGES.some((page) => availablePageSet.has(page.id)) ? (
        <>
          <SidebarSeparator />
          <SidebarFooter>
            <SidebarMenu>
              {FOOTER_PAGES.filter((page) => availablePageSet.has(page.id)).map(renderItem)}
            </SidebarMenu>
          </SidebarFooter>
        </>
      ) : null}
    </Sidebar>
  )
}
