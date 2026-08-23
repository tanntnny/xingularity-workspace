import type { ReactElement } from 'react'
import { Badge, TabToggleGroup, TabToggleGroupItem } from '../ui'
import type { SchedulingView } from './types'

const SCHEDULING_VIEW_OPTIONS: readonly {
  value: SchedulingView
  label: string
}[] = [
  { value: 'automation', label: 'Automation' },
  { value: 'history', label: 'History' }
]

interface SchedulingViewTabsProps {
  value: SchedulingView
  onValueChange: (value: SchedulingView) => void
  reviewCount?: number
}

export function SchedulingViewTabs({
  value,
  onValueChange,
  reviewCount = 0
}: SchedulingViewTabsProps): ReactElement {
  const reviewCountLabel = reviewCount > 99 ? '99+' : String(reviewCount)

  return (
    <TabToggleGroup
      value={value}
      onValueChange={(nextValue) => {
        if (nextValue === 'automation' || nextValue === 'history') {
          onValueChange(nextValue)
        }
      }}
      aria-label="Scheduling view"
      data-testid="scheduling-view-tabs"
      className="max-w-none"
    >
      {SCHEDULING_VIEW_OPTIONS.map((option) => {
        return (
          <TabToggleGroupItem
            key={option.value}
            value={option.value}
            id={`scheduling-view-tab-${option.value}`}
            aria-controls="scheduling-view-panel"
            aria-label={
              option.value === 'history' && reviewCount > 0
                ? `History, ${reviewCount} automation${reviewCount === 1 ? '' : 's'} need review`
                : option.label
            }
            data-testid={`scheduling-view-tab:${option.value}`}
          >
            <span>{option.label}</span>
            {option.value === 'history' && reviewCount > 0 ? (
              <Badge
                tone="warning"
                aria-hidden="true"
                data-testid="scheduling-review-count:history"
                className="h-5 min-w-5 justify-center px-1 py-0 text-xs"
              >
                {reviewCountLabel}
              </Badge>
            ) : null}
          </TabToggleGroupItem>
        )
      })}
    </TabToggleGroup>
  )
}
