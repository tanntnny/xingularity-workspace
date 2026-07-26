import { type ReactElement, type ReactNode, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Search, type LucideIcon } from 'lucide-react'

import { Pressable } from '../ui/pressable'
import { Shortcut, type ShortcutKey } from '../ui/kbd'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
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
  icon?: LucideIcon
  badge?: ReactNode
  shortcut?: readonly ShortcutKey[]
  disabled?: boolean
}

export interface WorkspaceSidebarSection {
  id: string
  label: string
  icon: LucideIcon
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

  const renderItem = (item: WorkspaceSidebarItem, nested = false): ReactElement => {
    const itemDisabled = isItemDisabled(item, disabled)
    const ItemIcon = item.icon

    return (
      <SidebarMenuItem key={item.id}>
        <SidebarMenuButton
          asChild
          isActive={activeItemId === item.id}
          disabled={itemDisabled}
          tooltip={item.label}
        >
          <Pressable
            className={`sidebar-menu-card ${nested ? 'sidebar-menu-card-nested' : 'px-3 py-2'}`}
            data-active={activeItemId === item.id}
            disabled={itemDisabled}
            onClick={() => onSelect(item.id)}
          >
            {ItemIcon ? <ItemIcon size={15} className="shrink-0" aria-hidden="true" /> : null}
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {item.badge ? <SidebarMenuBadge>{item.badge}</SidebarMenuBadge> : null}
            {item.shortcut ? (
              <Shortcut
                keys={item.shortcut}
                className="ml-auto shrink-0 group-data-[collapsible=icon]:hidden"
              />
            ) : null}
          </Pressable>
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  }

  return (
    <Sidebar collapsible={collapsible} className={`app-sidebar-glass ${className ?? ''}`.trim()}>
      <SidebarHeader className="mt-3 flex h-[96px] shrink-0 items-center justify-center border-b border-[var(--line)] px-3 pb-0">
        <div className="flex items-center gap-3 group-data-[collapsible=icon]:justify-center">
          {brand.logo ? <span className="shrink-0">{brand.logo}</span> : null}
          <div className="leading-tight group-data-[collapsible=icon]:hidden">
            <p className="sidebar-brand-shimmer text-sm font-semibold tracking-[0.12em] text-sidebar-foreground/70">
              {brand.name}
            </p>
            {brand.subtitle ? (
              <p className="sidebar-brand-shimmer sidebar-brand-shimmer-subtle text-[11px] uppercase tracking-[0.3em] text-sidebar-foreground/45">
                {brand.subtitle}
              </p>
            ) : null}
          </div>
        </div>
      </SidebarHeader>

      <div className="px-4 py-6 leading-tight group-data-[collapsible=icon]:hidden">
        {context?.heading ? (
          <p className="text-[1.1rem] font-semibold text-sidebar-foreground">{context.heading}</p>
        ) : null}
        {context?.detail ? (
          <div className="flex items-center gap-1.5 pt-1 text-xs tracking-[0.01em] text-sidebar-foreground/60">
            <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
            <span className="min-w-0 truncate">{context.detail}</span>
          </div>
        ) : null}
        <button
          type="button"
          onClick={onOpenCommandPalette}
          disabled={disabled}
          className="mt-4 flex w-full items-center gap-2 rounded-xl border border-[var(--accent-line)] px-2.5 py-1.5 text-left text-sidebar-foreground transition hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Open command palette"
          title="Open command palette"
        >
          <Search size={15} className="shrink-0 text-[var(--accent)] opacity-70" />
          <span className="min-w-0 flex-1 whitespace-nowrap text-sm text-sidebar-foreground/70">
            Command palette...
          </span>
          <Shortcut keys={['cmd', 'p']} className="ml-auto shrink-0" />
        </button>
      </div>
      <SidebarSeparator />

      <SidebarContent>
        {visibleSections.map((section) => {
          const isOpen = openSections[section.id] ?? true
          const activeInSection = section.items.some((item) => item.id === activeItemId)
          const SectionIcon = section.icon
          const ChevronIcon = isOpen ? ChevronDown : ChevronRight

          return (
            <SidebarGroup key={section.id} className="sidebar-section-group px-3 py-2">
              <Pressable
                className="sidebar-section-trigger flex items-center gap-2 rounded-md px-1 py-1"
                data-active={activeInSection}
                data-open={isOpen}
                disabled={disabled}
                onClick={() =>
                  setOpenSections((current) => ({ ...current, [section.id]: !isOpen }))
                }
                data-no-ripple
              >
                <span className="sidebar-section-icon">
                  <SectionIcon size={14} strokeWidth={2} />
                </span>
                <span className="sidebar-section-label">{section.label}</span>
                <ChevronIcon
                  size={13}
                  strokeWidth={2.2}
                  className="sidebar-section-chevron ml-auto shrink-0"
                />
              </Pressable>
              <SidebarGroupContent
                className="pt-0.5 group-data-[collapsible=icon]:hidden"
                hidden={!isOpen}
              >
                <div className="sidebar-section-stack">
                  <span className="sidebar-section-rail" aria-hidden="true" />
                  <SidebarMenu className="sidebar-section-items">
                    {section.items.map((item) => renderItem(item, true))}
                  </SidebarMenu>
                </div>
              </SidebarGroupContent>
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
