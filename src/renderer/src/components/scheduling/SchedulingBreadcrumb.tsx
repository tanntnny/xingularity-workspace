import type { ReactElement } from 'react'
import {
  Breadcrumb,
  BreadcrumbButton,
  BreadcrumbIconLabel,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from '../ui'
import { Bolt } from '../ui/icons'
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
            <BreadcrumbPage className="text-sm text-foreground">
              <BreadcrumbIconLabel icon={<Bolt size={14} aria-hidden="true" />}>
                Scheduling
              </BreadcrumbIconLabel>
            </BreadcrumbPage>
          ) : (
            <BreadcrumbButton
              onClick={() => onNavigate('list')}
              className="text-sm text-muted-foreground"
              data-testid="scheduling-breadcrumb:scheduling"
            >
              <BreadcrumbIconLabel icon={<Bolt size={14} aria-hidden="true" />}>
                Scheduling
              </BreadcrumbIconLabel>
            </BreadcrumbButton>
          )}
        </BreadcrumbItem>
        {value !== 'list' ? (
          <>
            <BreadcrumbSeparator className="text-muted-foreground" />
            <BreadcrumbItem>
              <BreadcrumbPage className="max-w-[260px] truncate text-sm font-semibold text-foreground">
                <BreadcrumbIconLabel icon={<Bolt size={14} aria-hidden="true" />}>
                  {currentLabel}
                </BreadcrumbIconLabel>
              </BreadcrumbPage>
            </BreadcrumbItem>
          </>
        ) : null}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
