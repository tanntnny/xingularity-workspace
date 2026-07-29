import { useMemo, useState, type ReactElement } from 'react'
import {
  BookOpen,
  CalendarDays,
  ChevronDown,
  CreditCard,
  FolderKanban,
  ListTodo,
  NotebookTabs,
  Search,
  Settings2,
  type FilledIcon
} from './ui/icons'

import { ALL_APP_PAGES, type AppPage } from '../navigation'
import { cn } from '../lib/utils'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
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
  SidebarRail,
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
  isLocked?: boolean
  availablePages?: readonly AppPage[]
  className?: string
  collapsible?: 'offcanvas' | 'icon' | 'min' | 'none'
  macosTrafficLightInset?: boolean
}

type SidebarPageItem = {
  id: AppPage
  label: string
  icon: FilledIcon
  shortcut?: readonly ShortcutKey[]
}

type SidebarSection = {
  id: 'board' | 'home' | 'finance'
  label: string
  items: readonly SidebarPageItem[]
}

const SIDEBAR_SECTIONS: readonly SidebarSection[] = [
  {
    id: 'board',
    label: 'Board',
    items: [{ id: 'knowledge', label: 'Knowledge', icon: BookOpen }]
  },
  {
    id: 'home',
    label: 'Home',
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
    items: [{ id: 'subscriptions', label: 'Subscriptions', icon: CreditCard }]
  }
]

const FOOTER_PAGES: readonly SidebarPageItem[] = [
  { id: 'settings', label: 'Settings', icon: Settings2, shortcut: ['cmd', ','] }
]

const SIDEBAR_SECTION_DEFAULTS: Record<SidebarSection['id'], boolean> = {
  board: true,
  home: true,
  finance: true
}

export function AppSidebar({
  activePage,
  onChange,
  onOpenSearchPalette,
  onSidebarInteract,
  notesCount,
  projectsCount,
  calendarUndoneCount,
  isLocked = false,
  availablePages = ALL_APP_PAGES,
  className,
  collapsible = 'min',
  macosTrafficLightInset = false
}: AppSidebarProps): ReactElement {
  const availablePageSet = useMemo(() => new Set(availablePages), [availablePages])
  const [openSections, setOpenSections] =
    useState<Record<SidebarSection['id'], boolean>>(SIDEBAR_SECTION_DEFAULTS)
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
      className={cn('px-2', className)}
      onPointerDownCapture={() => onSidebarInteract?.()}
    >
      <SidebarHeader
        className={cn('border-b border-sidebar-border py-4', macosTrafficLightInset && '!pt-11')}
      >
        <div className="flex w-full min-w-0 items-center justify-center gap-3">
          <img
            src={appLogo}
            alt="Xingularity logo"
            className="size-9 shrink-0 rounded-lg border border-sidebar-border object-cover shadow-sm"
          />
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <h1 className="sidebar-brand-shimmer truncate text-base font-bold leading-none tracking-tight">
              Xingularity
            </h1>
            <p className="mt-1 truncate text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Workspace
            </p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  variant="outline"
                  className="rounded-full"
                  onClick={onOpenSearchPalette}
                  disabled={isLocked}
                  tooltip="Command palette"
                  aria-label="Open command palette"
                  data-testid="sidebar-command-palette"
                >
                  <Search aria-hidden="true" />
                  <span className="min-w-0 truncate">Command palette...</span>
                  <Shortcut
                    keys={['cmd', 'p']}
                    className="ml-auto shrink-0 group-data-[collapsible=icon]:hidden"
                  />
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {SIDEBAR_SECTIONS.filter((section) =>
          section.items.some((item) => availablePageSet.has(item.id))
        ).map((section) => {
          const isOpen = openSections[section.id]
          const activeInSection = section.items.some((item) => item.id === activePage)

          return (
            <Collapsible
              key={section.id}
              asChild
              open={isOpen}
              disabled={isLocked}
              onOpenChange={(nextIsOpen) => {
                setOpenSections((current) => ({
                  ...current,
                  [section.id]: nextIsOpen
                }))
              }}
            >
              <SidebarGroup className="group/collapsible">
                <SidebarGroupLabel
                  asChild
                  className={cn(
                    'cursor-pointer',
                    activeInSection && 'text-sidebar-accent-foreground'
                  )}
                  title={section.label}
                >
                  <CollapsibleTrigger className="w-full justify-between">
                    <span>{section.label}</span>
                    <ChevronDown
                      aria-hidden="true"
                      className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180"
                    />
                  </CollapsibleTrigger>
                </SidebarGroupLabel>
                <CollapsibleContent asChild>
                  <SidebarGroupContent className="pl-4 group-data-[collapsible=icon]:pl-0">
                    <SidebarMenu>
                      {section.items
                        .filter((item) => availablePageSet.has(item.id))
                        .map(renderItem)}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
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
      <SidebarRail />
    </Sidebar>
  )
}
