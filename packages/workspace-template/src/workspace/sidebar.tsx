import { type ReactElement, type ReactNode, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Search, type FilledIcon } from '../ui/icons'

import { Shortcut, type ShortcutKey } from '../ui/kbd'
import { Button } from '../ui/button'
import { cn } from '../lib/utils'
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
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator
} from '../ui/sidebar'

export interface WorkspaceSidebarItem {
  id: string
  label: string
  icon?: FilledIcon
  badge?: ReactNode
  shortcut?: readonly ShortcutKey[]
  disabled?: boolean
}

export interface WorkspaceSidebarSection {
  id: string
  label: string
  icon: FilledIcon
  items: readonly WorkspaceSidebarItem[]
  defaultOpen?: boolean
}

export interface WorkspaceSidebarBrand {
  logo?: ReactNode
  name: ReactNode
  subtitle?: ReactNode
}

export interface WorkspaceSidebarContext {
  heading?: ReactNode
  detail?: ReactNode
}

export interface WorkspaceSidebarProps {
  activeItemId: string
  sections: readonly WorkspaceSidebarSection[]
  footerItems?: readonly WorkspaceSidebarItem[]
  brand: WorkspaceSidebarBrand
  context?: WorkspaceSidebarContext
  onSelect: (itemId: string) => void
  onOpenCommandPalette: () => void
  disabled?: boolean
  className?: string
  collapsible?: 'offcanvas' | 'icon' | 'none'
}

function isItemDisabled(item: WorkspaceSidebarItem, disabled: boolean): boolean {
  return disabled || item.disabled === true
}

export function WorkspaceSidebar({
  activeItemId,
  sections,
  footerItems = [],
  brand,
  context,
  onSelect,
  onOpenCommandPalette,
  disabled = false,
  className,
  collapsible = 'icon'
}: WorkspaceSidebarProps): ReactElement {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(sections.map((section) => [section.id, section.defaultOpen ?? true]))
  )
  const visibleSections = useMemo(
    () => sections.filter((section) => section.items.length > 0),
    [sections]
  )

  const renderItem = (item: WorkspaceSidebarItem): ReactElement => {
    const itemDisabled = isItemDisabled(item, disabled)
    const ItemIcon = item.icon

    return (
      <SidebarMenuItem key={item.id}>
        <SidebarMenuButton
          isActive={activeItemId === item.id}
          disabled={itemDisabled}
          tooltip={item.label}
          onClick={() => onSelect(item.id)}
          aria-label={item.label}
        >
          {ItemIcon ? <ItemIcon aria-hidden="true" /> : null}
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          {item.shortcut ? (
            <Shortcut
              keys={item.shortcut}
              className="ml-auto shrink-0 group-data-[collapsible=icon]:hidden"
            />
          ) : null}
        </SidebarMenuButton>
        {item.badge ? <SidebarMenuBadge>{item.badge}</SidebarMenuBadge> : null}
      </SidebarMenuItem>
    )
  }

  return (
    <Sidebar collapsible={collapsible} className={className}>
      <SidebarHeader className="border-b">
        <div className="flex items-center gap-2">
          {brand.logo ? <span className="shrink-0">{brand.logo}</span> : null}
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm font-semibold">{brand.name}</p>
            {brand.subtitle ? (
              <p className="truncate text-xs text-muted-foreground">{brand.subtitle}</p>
            ) : null}
          </div>
        </div>
      </SidebarHeader>

      <SidebarGroup className="border-b group-data-[collapsible=icon]:hidden">
        {context?.heading ? <p className="text-sm font-medium">{context.heading}</p> : null}
        {context?.detail ? (
          <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
            <span className="min-w-0 truncate">{context.detail}</span>
          </div>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onOpenCommandPalette}
          disabled={disabled}
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
              onClick={onOpenCommandPalette}
              disabled={disabled}
              tooltip="Command palette"
              aria-label="Open command palette"
            >
              <Search aria-hidden="true" />
              <span>Command palette</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>
      <SidebarSeparator />

      <SidebarContent>
        {visibleSections.map((section) => {
          const isOpen = openSections[section.id] ?? true
          const activeInSection = section.items.some((item) => item.id === activeItemId)
          const SectionIcon = section.icon
          const ChevronIcon = isOpen ? ChevronDown : ChevronRight

          return (
            <SidebarGroup key={section.id}>
              <details
                open={isOpen}
                onToggle={(event) => {
                  setOpenSections((current) => ({
                    ...current,
                    [section.id]: event.currentTarget.open
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
                      if (disabled) event.preventDefault()
                    }}
                    aria-disabled={disabled}
                    title={section.label}
                  >
                    <SectionIcon aria-hidden="true" />
                    <span className="group-data-[collapsible=icon]:hidden">{section.label}</span>
                    <ChevronIcon
                      aria-hidden="true"
                      className="ml-auto transition-transform group-open/section:rotate-180 group-data-[collapsible=icon]:hidden"
                    />
                  </summary>
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>{section.items.map(renderItem)}</SidebarMenu>
                </SidebarGroupContent>
              </details>
            </SidebarGroup>
          )
        })}
      </SidebarContent>

      {footerItems.length > 0 ? (
        <>
          <SidebarSeparator />
          <SidebarFooter>
            <SidebarMenu>{footerItems.map((item) => renderItem(item))}</SidebarMenu>
          </SidebarFooter>
        </>
      ) : null}
    </Sidebar>
  )
}
