import { useMemo, useState, type ReactElement } from 'react'
import {
  ChevronDown,
  ChevronRight,
  ListTodo,
  MoreHorizontal,
  Plus,
  Search,
  Table,
  Trash2,
  type FilledIcon
} from './ui/icons'

import { ALL_APP_PAGES, type AppPage } from '../navigation'
import { cn } from '../lib/utils'
import { APP_PAGE_ICONS, VaultIcon } from '../lib/pageIcons'
import type { WorkspaceView, WorkspaceViewSource } from '../../../shared/types'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator
} from './ui'
import { NoteShapeIcon } from './NoteShapeIcon'
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
  workspaceViews?: readonly WorkspaceView[]
  activeWorkspaceViewId?: string | null
  onOpenWorkspaceView?: (viewId: string) => void
  onCreateWorkspaceView?: (source: WorkspaceViewSource) => void
  onDeleteWorkspaceView?: (viewId: string) => void
  resourceViewsEnabled?: boolean
}

type SidebarPageItem = {
  id: AppPage
  label: string
  icon: FilledIcon
  shortcut?: readonly ShortcutKey[]
}

type SidebarSection = {
  id: 'inbox' | 'workspace' | 'view' | 'automation' | 'finance'
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
    id: 'workspace',
    label: 'Workspace',
    items: [
      { id: 'notes', label: 'Notebooks', icon: APP_PAGE_ICONS.notes },
      { id: 'projects', label: 'Projects', icon: APP_PAGE_ICONS.projects },
      { id: 'calendar', label: 'Calendar', icon: APP_PAGE_ICONS.calendar },
      { id: 'tasks', label: 'Tasks', icon: APP_PAGE_ICONS.resources },
      { id: 'resources', label: 'Resources', icon: APP_PAGE_ICONS.resources },
      { id: 'knowledge', label: 'Knowledge', icon: APP_PAGE_ICONS.knowledge }
    ]
  },
  {
    id: 'view',
    label: 'View',
    items: []
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
  workspace: true,
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
  macosTrafficLightInset = false,
  workspaceViews = [],
  activeWorkspaceViewId = null,
  onOpenWorkspaceView,
  onCreateWorkspaceView,
  onDeleteWorkspaceView,
  resourceViewsEnabled = true
}: AppSidebarProps): ReactElement {
  const availablePageSet = useMemo(() => new Set(availablePages), [availablePages])
  const [openSections, setOpenSections] =
    useState<Record<SidebarSection['id'], boolean>>(SIDEBAR_SECTION_DEFAULTS)
  const isPageDisabled = (): boolean => isLocked
  const toBadgeLabel = (count: number): string => (count > 99 ? '99+' : String(count))
  const activeWorkspaceViewSource =
    workspaceViews.find((view) => view.id === activeWorkspaceViewId)?.source ?? null

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
          isActive={activePage === page.id && activeWorkspaceViewSource !== page.id}
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

  const renderWorkspaceView = (view: WorkspaceView): ReactElement => {
    const disabled = isPageDisabled()

    return (
      <SidebarMenuItem key={view.id}>
        <SidebarMenuButton
          isActive={activeWorkspaceViewId === view.id}
          labelOverflow="fade"
          onClick={disabled ? undefined : () => onOpenWorkspaceView?.(view.id)}
          disabled={disabled}
          tooltip={view.name}
          aria-label={view.name}
          data-testid={`sidebar-view:${view.id}`}
        >
          <NoteShapeIcon icon={view.icon} size={18} />
          <span className="workspace-text-fade sidebar-workspace-text-fade block max-w-full min-w-0 flex-1">
            {view.name}
          </span>
        </SidebarMenuButton>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuAction
              showOnHover
              aria-label={`Manage ${view.name}`}
              title={`Manage ${view.name}`}
              data-testid={`sidebar-view-actions:${view.id}`}
            >
              <MoreHorizontal aria-hidden="true" />
            </SidebarMenuAction>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start">
            <DropdownMenuItem
              onSelect={() => onOpenWorkspaceView?.(view.id)}
              data-testid={`sidebar-view-open:${view.id}`}
            >
              {view.source === 'resources' ? (
                <Table aria-hidden="true" />
              ) : (
                <ListTodo aria-hidden="true" />
              )}
              Open view
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => onDeleteWorkspaceView?.(view.id)}
              destructive
              data-testid={`sidebar-view-delete:${view.id}`}
            >
              <Trash2 aria-hidden="true" />
              Delete view
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    )
  }

  const renderViewCreateAction = (): ReactElement => (
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton
            disabled={isPageDisabled()}
            aria-label="Create view"
            title="Create view"
            data-testid="sidebar-create-view"
          >
            <Plus aria-hidden="true" />
            <span>Create View</span>
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start">
          <DropdownMenuItem
            onSelect={() => onCreateWorkspaceView?.('tasks')}
            data-testid="sidebar-create-view-option:tasks"
          >
            <ListTodo aria-hidden="true" />
            Tasks table
          </DropdownMenuItem>
          {resourceViewsEnabled ? (
            <DropdownMenuItem
              onSelect={() => onCreateWorkspaceView?.('resources')}
              data-testid="sidebar-create-view-option:resources"
            >
              <Table aria-hidden="true" />
              Resources table
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  )

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

        {SIDEBAR_SECTIONS.filter(
          (section) =>
            section.id === 'view' || section.items.some((item) => availablePageSet.has(item.id))
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
              <SidebarGroup className={cn('group/collapsible', section.id === 'view' && 'px-0')}>
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
                  <SidebarGroupContent className={cn('pl-4', 'group-data-[collapsible=icon]:pl-0')}>
                    <SidebarMenu>
                      {section.id === 'view'
                        ? workspaceViews.map(renderWorkspaceView)
                        : section.items
                            .filter((item) => availablePageSet.has(item.id))
                            .map(renderItem)}
                      {section.id === 'view' ? renderViewCreateAction() : null}
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
