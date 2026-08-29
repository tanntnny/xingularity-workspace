import { useMemo, useState, type ReactElement } from 'react'
import { ChevronDown, Search, ChevronRight, type FilledIcon } from './ui/icons'

import { ALL_APP_PAGES, type AppPage } from '../navigation'
import { cn } from '../lib/utils'
import { APP_PAGE_ICONS, VaultIcon } from '../lib/pageIcons'
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
  onOpenVaultManager: () => void
  onSidebarInteract?: () => void
  vaultName?: string | null
  notesCount: number
  projectsCount: number
  calendarUndoneCount: number
  schedulingReviewCount?: number
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
  id: 'inbox' | 'view' | 'automation' | 'finance'
  label: string
  items: readonly SidebarPageItem[]
}

const SIDEBAR_SECTIONS: readonly SidebarSection[] = [
  {
    id: 'inbox',
    label: 'Inbox',
    items: [{ id: 'capture', label: 'Capture', icon: APP_PAGE_ICONS.capture }]
  },
  {
    id: 'view',
    label: 'View',
    items: [
      { id: 'notes', label: 'Notebooks', icon: APP_PAGE_ICONS.notes },
      { id: 'projects', label: 'Projects', icon: APP_PAGE_ICONS.projects },
      { id: 'calendar', label: 'Calendar', icon: APP_PAGE_ICONS.calendar },
      { id: 'resources', label: 'Resources', icon: APP_PAGE_ICONS.resources },
      { id: 'knowledge', label: 'Knowledge', icon: APP_PAGE_ICONS.knowledge }
    ]
  },
  {
    id: 'automation',
    label: 'Automation',
    items: [{ id: 'schedules', label: 'Scheduling', icon: APP_PAGE_ICONS.schedules }]
  },
  {
    id: 'finance',
    label: 'Finance',
    items: [{ id: 'subscriptions', label: 'Subscriptions', icon: APP_PAGE_ICONS.subscriptions }]
  }
]

const FOOTER_PAGES: readonly SidebarPageItem[] = [
  { id: 'settings', label: 'Settings', icon: APP_PAGE_ICONS.settings, shortcut: ['cmd', ','] }
]

const SIDEBAR_SECTION_DEFAULTS: Record<SidebarSection['id'], boolean> = {
  inbox: true,
  view: true,
  automation: true,
  finance: true
}

export function AppSidebar({
  activePage,
  onChange,
  onOpenSearchPalette,
  onOpenVaultManager,
  onSidebarInteract,
  vaultName = null,
  notesCount,
  projectsCount,
  calendarUndoneCount,
  schedulingReviewCount = 0,
  isLocked = false,
  availablePages = ALL_APP_PAGES,
  className,
  collapsible = 'min',
  macosTrafficLightInset = false
}: AppSidebarProps): ReactElement {
  const availablePageSet = useMemo(() => new Set(availablePages), [availablePages])
  const [openSections, setOpenSections] =
    useState<Record<SidebarSection['id'], boolean>>(SIDEBAR_SECTION_DEFAULTS)
  const isPageDisabled = (): boolean => isLocked
  const toBadgeLabel = (count: number): string => (count > 99 ? '99+' : String(count))

  const renderBadge = (pageId: AppPage): ReactElement | null => {
    const count =
      pageId === 'notes'
        ? notesCount
        : pageId === 'projects'
          ? projectsCount
          : pageId === 'calendar'
            ? calendarUndoneCount
            : pageId === 'schedules'
              ? schedulingReviewCount
              : 0

    return count > 0 ? (
      <SidebarMenuBadge
        data-testid={pageId === 'schedules' ? 'sidebar-badge:schedules' : undefined}
        aria-label={
          pageId === 'schedules'
            ? `${count} automation${count === 1 ? '' : 's'} need review`
            : undefined
        }
      >
        {toBadgeLabel(count)}
      </SidebarMenuBadge>
    ) : null
  }

  const renderItem = (page: SidebarPageItem): ReactElement => {
    const PageIcon = page.icon
    const disabled = isPageDisabled()

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
        <SidebarGroup className="mt-2">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={onOpenVaultManager}
                  tooltip="Manage vaults"
                  aria-label="Open vault manager"
                  data-testid="sidebar-vault-manager"
                >
                  <VaultIcon aria-hidden="true" />
                  <span className="min-w-0 truncate">{vaultName ?? 'Select a vault'}</span>
                  <ChevronRight
                    aria-hidden="true"
                    className="!size-3 ml-auto group-data-[collapsible=icon]:hidden"
                  />
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="mx-1" />

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
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
                <SidebarGroupLabel asChild className="cursor-pointer" title={section.label}>
                  <CollapsibleTrigger className="w-full justify-between">
                    <span>{section.label}</span>
                    <ChevronDown
                      aria-hidden="true"
                      className="!size-3 motion-state-chevron ml-auto group-data-[state=open]/collapsible:rotate-180"
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
