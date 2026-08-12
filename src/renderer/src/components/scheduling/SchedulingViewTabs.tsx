import type { ReactElement } from 'react'
import { ToggleGroup, ToggleGroupItem } from '../ui'
import type { SchedulingView } from './types'

const SCHEDULING_VIEW_OPTIONS: readonly { value: SchedulingView; label: string }[] = [
  { value: 'automation', label: 'Automation' },
  { value: 'history', label: 'History' }
]

interface SchedulingViewTabsProps {
  value: SchedulingView
  onValueChange: (value: SchedulingView) => void
}

export function SchedulingViewTabs({
  value,
  onValueChange
}: SchedulingViewTabsProps): ReactElement {
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
      role="tablist"
      aria-label="Scheduling view"
      data-testid="scheduling-view-tabs"
    >
      {SCHEDULING_VIEW_OPTIONS.map((option) => (
        <ToggleGroupItem
          key={option.value}
          value={option.value}
          role="tab"
          aria-selected={value === option.value}
          data-testid={`scheduling-view-tab:${option.value}`}
        >
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
