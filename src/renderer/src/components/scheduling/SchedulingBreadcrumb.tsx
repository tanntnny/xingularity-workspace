import type { ReactElement } from 'react'
import {
  Breadcrumb,
  BreadcrumbButton,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from '../ui'
import type { SchedulingView } from './types'

interface SchedulingBreadcrumbProps {
  value: SchedulingView
  automationName?: string | null
  onNavigate: (view: SchedulingView) => void
}

export function SchedulingBreadcrumb({
  value,
  automationName,
  onNavigate
}: SchedulingBreadcrumbProps): ReactElement {
  const currentLabel = automationName?.trim() || 'New automation'

  return (
    <Breadcrumb data-testid="scheduling-breadcrumb">
      <BreadcrumbList className="text-muted-foreground">
        <BreadcrumbItem>
          {value === 'list' ? (
            <BreadcrumbPage className="text-sm text-foreground">Scheduling</BreadcrumbPage>
          ) : (
            <BreadcrumbButton
              onClick={() => onNavigate('list')}
              className="text-sm text-muted-foreground"
              data-testid="scheduling-breadcrumb:scheduling"
            >
              Scheduling
            </BreadcrumbButton>
          )}
        </BreadcrumbItem>
        {value !== 'list' ? (
          <>
            <BreadcrumbSeparator className="text-muted-foreground" />
            <BreadcrumbItem>
              <BreadcrumbPage className="max-w-[260px] truncate text-sm font-semibold text-foreground">
                {currentLabel}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </>
        ) : null}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
