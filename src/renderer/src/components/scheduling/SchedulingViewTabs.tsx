import type { ReactElement } from 'react'
import { Badge, Bot, Clock3, ToggleGroup, ToggleGroupItem } from '../ui'
import type { SchedulingView } from './types'

const SCHEDULING_VIEW_OPTIONS: readonly {
  value: SchedulingView
  label: string
  icon: typeof Bot
}[] = [
  { value: 'automation', label: 'Automation', icon: Bot },
  { value: 'history', label: 'History', icon: Clock3 }
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
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(nextValue) => {
        if (nextValue === 'automation' || nextValue === 'history') {
          onValueChange(nextValue)
        }
      }}
      variant="outline"
      size="sm"
      className="gap-0 overflow-hidden rounded-[var(--radius-button-pill)]"
      role="tablist"
      aria-label="Scheduling view"
      data-testid="scheduling-view-tabs"
    >
      {SCHEDULING_VIEW_OPTIONS.map((option) => {
        const Icon = option.icon

        return (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            role="tab"
            aria-selected={value === option.value}
            aria-label={
              option.value === 'history' && reviewCount > 0
                ? `History, ${reviewCount} automation${reviewCount === 1 ? '' : 's'} need review`
                : option.label
            }
            className="rounded-none first:rounded-l-[var(--radius-button-pill)] last:rounded-r-[var(--radius-button-pill)]"
            data-testid={`scheduling-view-tab:${option.value}`}
          >
            <Icon
              size={15}
              className="shrink-0"
              aria-hidden="true"
              data-testid={`scheduling-view-tab-icon:${option.value}`}
            />
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
          </ToggleGroupItem>
        )
      })}
    </ToggleGroup>
  )
}
