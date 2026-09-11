import { type ReactElement } from 'react'

import type { CalendarContentFilter, CalendarTaskTagOption } from '../lib/calendarTasks'
import {
  Badge,
  Filter,
  ResponsivePicker,
  ToggleGroup,
  ToggleGroupItem,
  WorkspaceIconButton,
  WorkspaceTextFade
} from './ui'
import { TagPickerContent } from './TagPickerPopover'

export interface CalendarTaskFilterContentOption {
  value: CalendarContentFilter
  label: string
  count: number
}

export interface CalendarTaskFilterProps {
  tagOptions: readonly CalendarTaskTagOption[]
  contentFilterOptions: readonly CalendarTaskFilterContentOption[]
  contentFilter: CalendarContentFilter
  onContentFilterChange: (filter: CalendarContentFilter) => void
  selectedTags: readonly string[]
  onSelectedTagsChange: (tags: string[]) => void
}

export function CalendarTaskFilter({
  tagOptions,
  contentFilterOptions,
  contentFilter,
  onContentFilterChange,
  selectedTags,
  onSelectedTagsChange
}: CalendarTaskFilterProps): ReactElement {
  const activeFilterCount = selectedTags.length + (contentFilter === 'all' ? 0 : 1)
  const hasActiveFilters = activeFilterCount > 0

  const clearFilters = (): void => {
    onSelectedTagsChange([])
    onContentFilterChange('all')
  }

  return (
    <ResponsivePicker
      trigger={
        <WorkspaceIconButton
          icon={<Filter size={18} aria-hidden="true" />}
          label="Filter"
          counter={activeFilterCount}
          active={hasActiveFilters}
          bordered
          title="Filter calendar tasks"
          aria-label={
            hasActiveFilters
              ? `Filter calendar tasks, ${activeFilterCount} active`
              : 'Filter calendar tasks'
          }
          data-testid="calendar-task-filter-trigger"
        />
      }
      title="Filter calendar tasks"
      description="Choose a task type or narrow the calendar by tag."
      selectedCount={activeFilterCount}
      onClear={clearFilters}
      clearLabel="Clear filters"
      clearTestId="calendar-task-filter-clear"
      testId="calendar-task-filter-popover"
      ariaLabel="Calendar task filters"
      contentClassName="w-[min(32rem,calc(100vw-1rem))]"
      footer={
        <div className="flex items-center justify-between gap-3 px-3 py-2.5">
          <span className="text-xs text-muted-foreground" aria-live="polite">
            {hasActiveFilters
              ? `${activeFilterCount} filter${activeFilterCount === 1 ? '' : 's'} active`
              : 'All tasks'}
          </span>
          <span className="text-xs text-muted-foreground">Enter to select · Esc to close</span>
        </div>
      }
    >
      <div className="shrink-0 border-b border-border px-3 py-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Filter by
        </p>
        <ToggleGroup
          type="single"
          value={contentFilter}
          onValueChange={(value) => {
            if (value) {
              onContentFilterChange(value as CalendarContentFilter)
            }
          }}
          variant="outline"
          size="sm"
          className="w-full"
          aria-label="Calendar content filter"
          data-testid="calendar-content-filter"
        >
          {contentFilterOptions.map((option) => (
            <ToggleGroupItem
              key={option.value}
              value={option.value}
              className="min-w-0 flex-1 justify-center px-2"
              data-testid={`calendar-content-filter-option:${option.value}`}
            >
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <WorkspaceTextFade>{option.label}</WorkspaceTextFade>
                <Badge variant="secondary" className="h-5 min-w-5 justify-center px-1 text-xs">
                  {option.count}
                </Badge>
              </span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <TagPickerContent
        label="Task tags"
        value={selectedTags}
        options={tagOptions}
        onValueChange={onSelectedTagsChange}
        searchPlaceholder="Search tags..."
        searchAriaLabel="Search calendar task tags"
        testId="calendar-task-filter"
        optionTestIdPrefix="calendar-task-tag-option"
        emptyLabel={tagOptions.length > 0 ? 'No tags selected' : 'No tags on calendar tasks'}
        noResultsLabel="No matching tags"
        showSelected
      />
    </ResponsivePicker>
  )
}
