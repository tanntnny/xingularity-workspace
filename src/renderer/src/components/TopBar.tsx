import { ReactElement } from 'react'
import { Home } from './ui/icons'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLabel,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from './ui/breadcrumb'
import { WorkspaceIconButton } from './ui/document-workspace'
import type { AppPage } from '../navigation'

interface TopBarProps {
  activePage: AppPage
  currentNoteName: string | null
  currentProjectName: string | null
  onNavigateHome: () => void
  currentMonthLabel?: string | null
}

const PAGE_LABELS: Record<AppPage, string> = {
  capture: 'Capture',
  knowledge: 'Knowledge',
  notes: 'Notebooks',
  projects: 'Projects',
  subscriptions: 'Subscriptions',
  calendar: 'Calendar',
  schedules: 'Scheduling',
  designAudit: 'Design Audit',
  settings: 'Settings'
}

const PAGE_SECTION_LABELS: Partial<Record<AppPage, string>> = {
  knowledge: 'Board',
  designAudit: 'Home',
  subscriptions: 'Finance'
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
  const sectionLabel = PAGE_SECTION_LABELS[activePage]

  return (
    <div className="app-drag-region flex h-[44px] w-full shrink-0 items-center border-b border-border bg-card">
      {/* Left spacer for traffic lights */}
      <div className="w-[80px] shrink-0" />

      {/* Center: Breadcrumb */}
      <div className="flex flex-1 items-center justify-center">
        <Breadcrumb>
          <BreadcrumbList className="app-no-drag text-muted-foreground">
            <BreadcrumbItem>
              <WorkspaceIconButton
                icon={<Home size={14} aria-hidden="true" />}
                label="Home"
                onClick={onNavigateHome}
                className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
              />
            </BreadcrumbItem>

            <BreadcrumbSeparator className="text-muted-foreground" />

            {activePage === 'calendar' ? (
              <>
                <BreadcrumbItem>
                  <BreadcrumbLabel>{PAGE_LABELS[activePage]}</BreadcrumbLabel>
                </BreadcrumbItem>

                <BreadcrumbSeparator className="text-muted-foreground" />

                <BreadcrumbItem>
                  <BreadcrumbPage className="text-foreground">
                    {/** fall back to page label if month not provided */}
                    {currentMonthLabel ?? PAGE_LABELS[activePage]}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </>
            ) : itemName ? (
              <>
                <BreadcrumbItem>
                  <BreadcrumbLabel>{PAGE_LABELS[activePage]}</BreadcrumbLabel>
                </BreadcrumbItem>

                <BreadcrumbSeparator className="text-muted-foreground" />

                <BreadcrumbItem>
                  <BreadcrumbPage className="max-w-[200px] truncate text-foreground">
                    {itemName}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </>
            ) : sectionLabel ? (
              <>
                <BreadcrumbItem>
                  <BreadcrumbLabel>{sectionLabel}</BreadcrumbLabel>
                </BreadcrumbItem>

                <BreadcrumbSeparator className="text-muted-foreground" />

                <BreadcrumbItem>
                  <BreadcrumbPage className="text-foreground">
                    {PAGE_LABELS[activePage]}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </>
            ) : (
              <BreadcrumbItem>
                <BreadcrumbPage className="text-foreground">
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
