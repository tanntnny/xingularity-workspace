import { ReactElement } from 'react'
import { Home } from 'lucide-react'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from './ui/breadcrumb'
import type { AppPage } from './AppSidebar'

interface TopBarProps {
  activePage: AppPage
  currentNoteName: string | null
  currentProjectName: string | null
  onNavigateHome: () => void
  currentMonthLabel?: string | null
}

const PAGE_LABELS: Record<AppPage, string> = {
  dashboard: 'Dashboard',
  notes: 'Notes',
  projects: 'Projects',
  grid: 'Grid',
  weeklyPlan: 'Weekly Plan',
  calendar: 'Calendar',
  settings: 'Settings',
  schedules: 'Schedules',
  agentHistory: 'Agent Chat'
}

export function TopBar({
  activePage,
  currentNoteName,
  currentProjectName,
  onNavigateHome,
  currentMonthLabel
}: TopBarProps): ReactElement {
  // Determine the third breadcrumb item (specific item name)
  const getItemName = (): string | null => {
    if (activePage === 'notes' && currentNoteName) {
      return currentNoteName
    }
    if (activePage === 'projects' && currentProjectName) {
      return currentProjectName
    }
    return null
  }

  const itemName = getItemName()

  return (
    <div className="app-drag-region flex h-[44px] w-full shrink-0 items-center border-b border-[var(--line)] bg-[var(--panel)]">
      {/* Left spacer for traffic lights */}
      <div className="w-[80px] shrink-0" />

      {/* Center: Breadcrumb */}
      <div className="flex flex-1 items-center justify-center">
        <Breadcrumb>
          <BreadcrumbList className="app-no-drag text-[var(--muted)]">
            <BreadcrumbItem>
              <BreadcrumbLink
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  onNavigateHome()
                }}
                className="flex items-center gap-1.5 text-[var(--muted)] hover:text-[var(--text)]"
              >
                <Home size={14} />
                <span>Home</span>
              </BreadcrumbLink>
            </BreadcrumbItem>

            <BreadcrumbSeparator className="text-[var(--line-strong)]" />

            {activePage === 'calendar' ? (
              <>
                <BreadcrumbItem>
                  <BreadcrumbLink
                    href="#"
                    onClick={(e) => e.preventDefault()}
                    className="text-[var(--muted)] hover:text-[var(--text)]"
                  >
                    {PAGE_LABELS[activePage]}
                  </BreadcrumbLink>
                </BreadcrumbItem>

                <BreadcrumbSeparator className="text-[var(--line-strong)]" />

                <BreadcrumbItem>
                  <BreadcrumbPage className="text-[var(--text)]">
                    {/** fall back to page label if month not provided */}
                    {currentMonthLabel ?? PAGE_LABELS[activePage]}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </>
            ) : itemName ? (
              <>
                <BreadcrumbItem>
                  <BreadcrumbLink
                    href="#"
                    onClick={(e) => e.preventDefault()}
                    className="text-[var(--muted)] hover:text-[var(--text)]"
                  >
                    {PAGE_LABELS[activePage]}
                  </BreadcrumbLink>
                </BreadcrumbItem>

                <BreadcrumbSeparator className="text-[var(--line-strong)]" />

                <BreadcrumbItem>
                  <BreadcrumbPage className="max-w-[200px] truncate text-[var(--text)]">
                    {itemName}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </>
            ) : (
              <BreadcrumbItem>
                <BreadcrumbPage className="text-[var(--text)]">
                  {PAGE_LABELS[activePage]}
                </BreadcrumbPage>
              </BreadcrumbItem>
            )}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* Right spacer for balance */}
      <div className="w-[80px] shrink-0" />
    </div>
  )
}
