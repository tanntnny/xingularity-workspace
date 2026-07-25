import { type ReactElement, useMemo } from 'react'
import { Bot, CreditCard, House, LayoutDashboard } from 'lucide-react'
import {
  WorkspaceSidebar,
  type WorkspaceSidebarItem,
  type WorkspaceSidebarSection
} from '../../../../packages/workspace-template/src/workspace/sidebar'

import appLogo from '../../../../assets/logo.png'
import { ALL_APP_PAGES, type AppPage } from '../navigation'

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

type SidebarPageItem = WorkspaceSidebarItem & { id: AppPage }

const SIDEBAR_SECTIONS: ReadonlyArray<
  Omit<WorkspaceSidebarSection, 'items'> & { items: readonly SidebarPageItem[] }
> = [
  {
    id: 'board',
    label: 'Board',
    icon: LayoutDashboard,
    items: [{ id: 'knowledge', label: 'Knowledge' }]
  },
  {
    id: 'home',
    label: 'Home',
    icon: House,
    items: [
      { id: 'notes', label: 'Notebooks' },
      { id: 'projects', label: 'Projects' },
      { id: 'calendar', label: 'Calendar' },
      { id: 'weeklyPlan', label: 'Weekly Plan' }
    ]
  },
  {
    id: 'finance',
    label: 'Finance',
    icon: CreditCard,
    items: [{ id: 'subscriptions', label: 'Subscriptions' }]
  },
  {
    id: 'automations',
    label: 'Automations',
    icon: Bot,
    items: [
      { id: 'schedules', label: 'Schedules' },
      { id: 'agentHistory', label: 'Agent Chat', shortcut: ['cmd', 'i'] }
    ]
  }
]

const FOOTER_ITEMS: readonly SidebarPageItem[] = [
  { id: 'settings', label: 'Settings', shortcut: ['cmd', ','] }
]

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
  const welcomeName = profileName.trim() || 'there'
  const sidebarVaultTitle = isLocked ? 'Select vault' : (activeVaultPath ?? 'No vault selected')
  const sidebarVaultLabel = isLocked ? 'Select vault' : getVaultDisplayName(activeVaultPath)
  const countLabel = (count: number): string => (count > 99 ? '99+' : String(count))

  const sections = useMemo<WorkspaceSidebarSection[]>(
    () =>
      SIDEBAR_SECTIONS.map((section) => ({
        ...section,
        items: section.items
          .filter((item) => availablePageSet.has(item.id))
          .map((item) => ({
            ...item,
            badge:
              item.id === 'notes' && notesCount > 0
                ? countLabel(notesCount)
                : item.id === 'projects' && projectsCount > 0
                  ? countLabel(projectsCount)
                  : item.id === 'calendar' && calendarUndoneCount > 0
                    ? countLabel(calendarUndoneCount)
                    : undefined,
            disabled: isLocked || item.id === 'weeklyPlan',
            testId: `sidebar-page:${item.id}`,
            shortcutTestId: item.shortcut ? `sidebar-shortcut:${item.id}` : undefined
          }))
      })),
    [availablePageSet, calendarUndoneCount, isLocked, notesCount, projectsCount]
  )

  const footerItems = useMemo<WorkspaceSidebarItem[]>(
    () =>
      FOOTER_ITEMS.filter((item) => availablePageSet.has(item.id)).map((item) => ({
        ...item,
        disabled: isLocked,
        testId: `sidebar-page:${item.id}`,
        shortcutTestId: item.shortcut ? `sidebar-shortcut:${item.id}` : undefined
      })),
    [availablePageSet, isLocked]
  )

  return (
    <WorkspaceSidebar
      activeItemId={activePage}
      sections={sections}
      footerItems={footerItems}
      brand={{
        logo: (
          <img
            src={appLogo}
            alt="Xingularity logo"
            className="h-11 w-11 shrink-0 rounded-lg border border-white/10 shadow-[0_12px_30px_rgba(7,5,18,0.35)]"
          />
        ),
        name: 'XINGULARITY',
        subtitle: 'Workspace'
      }}
      context={{
        heading: (
          <>
            Welcome back, <span className="text-[var(--accent)]">{welcomeName}</span>
          </>
        ),
        detail: <span title={sidebarVaultTitle}>{sidebarVaultLabel}</span>
      }}
      onSelect={(pageId) => onChange(pageId as AppPage)}
      onOpenCommandPalette={onOpenSearchPalette}
      disabled={isLocked}
      className={className}
      collapsible={collapsible}
      onPointerDownCapture={onSidebarInteract}
    />
  )
}
