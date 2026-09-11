import { type ReactElement } from 'react'

import type { TaskFilterOption, TaskFilterOptions, TaskFilterState } from '../lib/taskRows'
import { hasTaskFilters } from '../lib/taskRows'
import { cn } from '../lib/utils'
import { Badge } from './ui/badge'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from './ui/command'
import { Button } from './ui/button'
import { Filter, X } from './ui/icons'
import { ResponsivePicker } from './ui/responsive-picker'
import { SelectionCheckbox } from './ui/selection-checkbox'
import { WorkspaceIconButton } from './ui/document-workspace'
import { WorkspaceTextFade } from './ui/workspace-text-fade'

export interface TaskFiltersPopoverProps {
  options: TaskFilterOptions
  value: TaskFilterState
  onChange: (value: TaskFilterState) => void
}

type TaskArrayFilterKey =
  | 'statuses'
  | 'taskTypes'
  | 'priorities'
  | 'projectIds'
  | 'milestoneIds'
  | 'scheduleStates'
  | 'tags'

interface ActiveFilter {
  id: string
  label: string
  onRemove: () => void
}

export function TaskFiltersPopover({
  options,
  value,
  onChange
}: TaskFiltersPopoverProps): ReactElement {
  const filtersActive = hasTaskFilters(value)

  const getSelectedValues = (key: TaskArrayFilterKey): readonly string[] => {
    return (value[key] ?? []) as readonly string[]
  }

  const toggleArrayValue = (
    key: TaskArrayFilterKey,
    optionValue: string,
    checked: boolean
  ): void => {
    const nextValues = new Set(getSelectedValues(key))
    if (checked) nextValues.add(optionValue)
    else nextValues.delete(optionValue)

    onChange({
      ...value,
      [key]: Array.from(nextValues)
    } as TaskFilterState)
  }

  const addArrayFilters = (
    result: ActiveFilter[],
    key: TaskArrayFilterKey,
    filterOptions: readonly TaskFilterOption[]
  ): void => {
    for (const selectedValue of getSelectedValues(key)) {
      const option = filterOptions.find((candidate) => candidate.value === selectedValue)
      result.push({
        id: `${key}:${selectedValue}`,
        label: option?.label ?? selectedValue,
        onRemove: () => toggleArrayValue(key, selectedValue, false)
      })
    }
  }

  const activeFilters: ActiveFilter[] = []
  addArrayFilters(activeFilters, 'statuses', options.statuses)
  addArrayFilters(activeFilters, 'taskTypes', options.types)
  addArrayFilters(activeFilters, 'priorities', options.priorities)
  addArrayFilters(activeFilters, 'projectIds', options.projects)
  addArrayFilters(activeFilters, 'milestoneIds', options.milestones)
  addArrayFilters(activeFilters, 'scheduleStates', options.schedules)
  addArrayFilters(activeFilters, 'tags', options.tags)

  const hasOptions = Object.values(options).some((group) => group.length > 0)

  return (
    <ResponsivePicker
      trigger={
        <WorkspaceIconButton
          label="Filter"
          counter={activeFilters.length}
          icon={<Filter aria-hidden="true" />}
          active={filtersActive}
          bordered
          aria-label={filtersActive ? 'Filter tasks, active' : 'Filter tasks'}
          data-testid="task-filters-trigger"
        />
      }
      title="Filter tasks"
      description="Combine facets to narrow the task table. Selections apply instantly."
      selectedCount={activeFilters.length}
      onClear={() => onChange({ searchQuery: value.searchQuery })}
      clearLabel="Clear all"
      clearTestId="task-filters-clear"
      testId="task-filters"
      ariaLabel="Task filters"
      align="start"
      contentClassName="w-[min(36rem,calc(100vw-1rem))]"
    >
      <div className="space-y-2 px-3 pt-3">
        {activeFilters.length > 0 ? (
          <div className="flex flex-wrap gap-1.5" aria-label="Active task filters">
            {activeFilters.map((filter) => (
              <span
                key={filter.id}
                className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-[var(--radius-button-pill)] border border-border bg-surface-subtle px-2 py-1 text-xs text-foreground"
              >
                <WorkspaceTextFade className="min-w-0 flex-1">{filter.label}</WorkspaceTextFade>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove filter ${filter.label}`}
                  className="-mr-1 h-5 w-5 shrink-0 rounded-full p-0 text-muted-foreground hover:bg-muted hover:text-foreground"
                  onClick={filter.onRemove}
                >
                  <X size={12} aria-hidden="true" />
                </Button>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No facets selected.</p>
        )}
      </div>
      <Command className="min-h-0 rounded-none bg-transparent" shouldFilter>
        <CommandInput
          placeholder="Search filters"
          aria-label="Search task filters"
          data-responsive-picker-input="true"
        />
        <CommandList className="max-h-[min(30rem,calc(70vh-10rem))] overscroll-contain px-2 pb-2">
          {hasOptions ? (
            <>
              <TaskFilterGroup
                legend="Status"
                options={options.statuses}
                selectedValues={getSelectedValues('statuses')}
                onToggle={(optionValue, checked) =>
                  toggleArrayValue('statuses', optionValue, checked)
                }
                testIdPrefix="status"
              />
              <TaskFilterGroup
                legend="Type"
                options={options.types}
                selectedValues={getSelectedValues('taskTypes')}
                onToggle={(optionValue, checked) =>
                  toggleArrayValue('taskTypes', optionValue, checked)
                }
                testIdPrefix="type"
              />
              <TaskFilterGroup
                legend="Priority"
                options={options.priorities}
                selectedValues={getSelectedValues('priorities')}
                onToggle={(optionValue, checked) =>
                  toggleArrayValue('priorities', optionValue, checked)
                }
                testIdPrefix="priority"
              />
              <TaskFilterGroup
                legend="Project"
                options={options.projects}
                selectedValues={getSelectedValues('projectIds')}
                onToggle={(optionValue, checked) =>
                  toggleArrayValue('projectIds', optionValue, checked)
                }
                testIdPrefix="project"
              />
              <TaskFilterGroup
                legend="Milestone"
                options={options.milestones}
                selectedValues={getSelectedValues('milestoneIds')}
                onToggle={(optionValue, checked) =>
                  toggleArrayValue('milestoneIds', optionValue, checked)
                }
                testIdPrefix="milestone"
              />
              <TaskFilterGroup
                legend="Schedule"
                options={options.schedules}
                selectedValues={getSelectedValues('scheduleStates')}
                onToggle={(optionValue, checked) =>
                  toggleArrayValue('scheduleStates', optionValue, checked)
                }
                testIdPrefix="schedule"
              />
              <TaskFilterGroup
                legend="Tags"
                options={options.tags}
                selectedValues={getSelectedValues('tags')}
                onToggle={(optionValue, checked) => toggleArrayValue('tags', optionValue, checked)}
                testIdPrefix="tag"
              />
            </>
          ) : (
            <CommandEmpty>No filter options are available.</CommandEmpty>
          )}
          <CommandEmpty>No matching filters</CommandEmpty>
        </CommandList>
      </Command>
    </ResponsivePicker>
  )
}

function TaskFilterGroup({
  legend,
  options,
  selectedValues,
  onToggle,
  testIdPrefix
}: {
  legend: string
  options: readonly TaskFilterOption[]
  selectedValues: readonly string[]
  onToggle: (value: string, checked: boolean) => void
  testIdPrefix: string
}): ReactElement | null {
  if (options.length === 0) return null

  return (
    <CommandGroup heading={legend} className="px-0 py-1 [&_[cmdk-group-heading]]:px-2">
      {options.map((option) => {
        const selected = selectedValues.includes(option.value)

        return (
          <CommandItem
            key={option.value}
            value={`${option.label} ${option.value}`}
            onSelect={() => onToggle(option.value, !selected)}
            aria-label={`${legend}: ${option.label}, ${selected ? 'selected' : 'not selected'}`}
            aria-checked={selected}
            data-checked={selected ? 'true' : 'false'}
            data-testid={`task-filter-${testIdPrefix}:${option.value}`}
            className={cn(
              'min-h-9 cursor-pointer rounded-sm px-2 text-sm text-foreground transition-colors hover:bg-muted hover:text-foreground focus:bg-muted focus:text-foreground',
              selected && 'bg-muted'
            )}
          >
            <SelectionCheckbox checked={selected} />
            <WorkspaceTextFade className="min-w-0 flex-1">{option.label}</WorkspaceTextFade>
            {selected ? (
              <Badge variant="neutral" className="h-5 px-1.5 text-[11px]">
                On
              </Badge>
            ) : null}
          </CommandItem>
        )
      })}
    </CommandGroup>
  )
}
