import { useMemo, useRef, type ReactElement } from 'react'

import type { CalendarContentFilter, CalendarTaskTagOption } from '../lib/calendarTasks'
import {
  Badge,
  Button,
  Checkbox,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Popover,
  PopoverContent,
  PopoverTrigger,
  ToggleGroup,
  ToggleGroupItem,
  WorkspaceIconButton
} from './ui'
import { Funnel } from './ui/icons'
import { TagChip } from './TagChip'

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
  const inputRef = useRef<HTMLInputElement>(null)
  const selectedTagSet = useMemo(() => new Set(selectedTags), [selectedTags])
  const activeFilterCount = selectedTags.length + (contentFilter === 'all' ? 0 : 1)
  const hasActiveFilters = activeFilterCount > 0

  const toggleTag = (tag: string): void => {
    if (selectedTagSet.has(tag)) {
      onSelectedTagsChange(selectedTags.filter((selectedTag) => selectedTag !== tag))
      return
    }

    onSelectedTagsChange([...selectedTags, tag])
  }

  const clearFilters = (): void => {
    onSelectedTagsChange([])
    onContentFilterChange('all')
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <WorkspaceIconButton
          icon={<Funnel size={18} aria-hidden="true" />}
          label={hasActiveFilters ? `Filter (${activeFilterCount})` : 'Filter'}
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
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[min(32rem,calc(100vw-1rem))] overflow-hidden p-0"
        aria-label="Calendar task filters"
        data-testid="calendar-task-filter-popover"
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          inputRef.current?.focus()
        }}
      >
        <div className="border-b border-border px-3 py-3">
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
                  <span className="truncate">{option.label}</span>
                  <Badge variant="secondary" className="h-5 min-w-5 justify-center px-1 text-xs">
                    {option.count}
                  </Badge>
                </span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <Command>
          <CommandInput
            ref={inputRef}
            placeholder="Search tags..."
            aria-label="Search calendar task tags"
          />
          <CommandList>
            <CommandEmpty>
              {tagOptions.length > 0 ? 'No matching tags' : 'No tags on calendar tasks'}
            </CommandEmpty>
            <CommandGroup heading="Task tags">
              {tagOptions.map((option) => {
                const selected = selectedTagSet.has(option.value)

                return (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    onSelect={() => toggleTag(option.value)}
                    aria-label={`${option.value}, ${option.count} task${option.count === 1 ? '' : 's'}, ${selected ? 'selected' : 'not selected'}`}
                    data-checked={selected ? 'true' : 'false'}
                    data-testid={`calendar-task-tag-option:${option.value}`}
                    className="gap-2"
                  >
                    <Checkbox
                      checked={selected}
                      tabIndex={-1}
                      aria-hidden="true"
                      className="pointer-events-none"
                    />
                    <TagChip tag={option.value} className="max-w-[12rem]" />
                    <Badge
                      variant="secondary"
                      className="ml-auto min-w-5 justify-center px-1.5 text-xs"
                    >
                      {option.count}
                    </Badge>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
          <div className="flex items-center justify-between border-t border-border px-3 py-2">
            <span className="text-xs text-muted-foreground" aria-live="polite">
              {hasActiveFilters
                ? `${activeFilterCount} filter${activeFilterCount === 1 ? '' : 's'} active`
                : 'All tasks'}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!hasActiveFilters}
              onClick={clearFilters}
              data-testid="calendar-task-filter-clear"
            >
              Clear
            </Button>
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
