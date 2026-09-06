import { type ReactElement } from 'react'

import type {
  ResourceFilterOption,
  ResourceFilterOptions,
  ResourceFilterState
} from '../lib/resourceRows'
import { hasResourceFilters } from '../lib/resourceRows'
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

export interface ResourceFiltersPopoverProps {
  options: ResourceFilterOptions
  value: ResourceFilterState
  onChange: (value: ResourceFilterState) => void
}

interface ActiveFilter {
  id: string
  label: string
  onRemove: () => void
}

export function ResourceFiltersPopover({
  options,
  value,
  onChange
}: ResourceFiltersPopoverProps): ReactElement {
  const filtersActive = hasResourceFilters(value)
  const toggleArrayValue = (
    key: 'types' | 'providers' | 'states' | 'projectIds',
    optionValue: string,
    checked: boolean
  ): void => {
    const currentValues = (value[key] ?? []) as readonly string[]
    const nextValues = new Set(currentValues)
    if (checked) nextValues.add(optionValue)
    else nextValues.delete(optionValue)

    onChange({
      ...value,
      [key]: Array.from(nextValues)
    })
  }

  const toggleLabelValue = (key: string, optionValue: string, checked: boolean): void => {
    const nextLabelFilters = { ...(value.labelFilters ?? {}) }
    const currentValues = new Set(nextLabelFilters[key] ?? [])
    if (checked) currentValues.add(optionValue)
    else currentValues.delete(optionValue)

    if (currentValues.size === 0) delete nextLabelFilters[key]
    else nextLabelFilters[key] = Array.from(currentValues)

    onChange({ ...value, labelFilters: nextLabelFilters })
  }

  const activeFilters: ActiveFilter[] = (() => {
    const result: ActiveFilter[] = []

    const addArrayFilters = (
      key: 'types' | 'providers' | 'states' | 'projectIds',
      filterOptions: readonly ResourceFilterOption[]
    ): void => {
      const selectedValues = value[key] ?? []
      for (const selectedValue of selectedValues) {
        const option = filterOptions.find((candidate) => candidate.value === selectedValue)
        result.push({
          id: `${key}:${selectedValue}`,
          label: option?.label ?? selectedValue,
          onRemove: () => toggleArrayValue(key, selectedValue, false)
        })
      }
    }

    addArrayFilters('types', options.types)
    addArrayFilters('providers', options.providers)
    addArrayFilters('states', options.states)
    addArrayFilters('projectIds', options.projects)

    for (const [key, selectedValues] of Object.entries(value.labelFilters ?? {})) {
      for (const selectedValue of selectedValues) {
        result.push({
          id: `label:${key}:${selectedValue}`,
          label: `${key}=${selectedValue}`,
          onRemove: () => toggleLabelValue(key, selectedValue, false)
        })
      }
    }

    return result
  })()

  const hasOptions =
    options.types.length > 0 ||
    options.providers.length > 0 ||
    options.states.length > 0 ||
    options.projects.length > 0 ||
    Object.values(options.labels).some((group) => group.length > 0)

  return (
    <ResponsivePicker
      trigger={
        <WorkspaceIconButton
          label="Filter"
          counter={activeFilters.length}
          icon={<Filter aria-hidden="true" />}
          active={filtersActive}
          bordered
          aria-label={filtersActive ? 'Filter resources, active' : 'Filter resources'}
          data-testid="resource-filters-trigger"
        />
      }
      title="Filter resources"
      description="Combine facets to narrow resources. Selections apply instantly."
      selectedCount={activeFilters.length}
      onClear={() => onChange({ searchQuery: value.searchQuery })}
      clearLabel="Clear all"
      clearTestId="resource-filters-clear"
      testId="resource-filters"
      ariaLabel="Resource filters"
      align="end"
      contentClassName="w-[min(34rem,calc(100vw-1rem))]"
    >
      <div className="space-y-2 px-3 pt-3">
        {activeFilters.length > 0 ? (
          <div className="flex flex-wrap gap-1.5" aria-label="Active resource filters">
            {activeFilters.map((filter) => (
              <span
                key={filter.id}
                className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-[var(--radius-button-pill)] border border-border bg-surface-subtle px-2 py-1 text-xs text-foreground"
              >
                <span className="min-w-0 truncate">{filter.label}</span>
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
          aria-label="Search resource filters"
          data-responsive-picker-input="true"
        />
        <CommandList className="max-h-[min(26rem,calc(70vh-10rem))] overscroll-contain px-2 pb-2">
          {hasOptions ? (
            <>
              <ResourceFilterGroup
                legend="Type"
                options={options.types}
                selectedValues={value.types ?? []}
                onToggle={(optionValue, checked) => toggleArrayValue('types', optionValue, checked)}
                testIdPrefix="type"
              />
              <ResourceFilterGroup
                legend="Source"
                options={options.providers}
                selectedValues={value.providers ?? []}
                onToggle={(optionValue, checked) =>
                  toggleArrayValue('providers', optionValue, checked)
                }
                testIdPrefix="provider"
              />
              <ResourceFilterGroup
                legend="Health"
                options={options.states}
                selectedValues={value.states ?? []}
                onToggle={(optionValue, checked) =>
                  toggleArrayValue('states', optionValue, checked)
                }
                testIdPrefix="state"
              />
              <ResourceFilterGroup
                legend="Project"
                options={options.projects}
                selectedValues={value.projectIds ?? []}
                onToggle={(optionValue, checked) =>
                  toggleArrayValue('projectIds', optionValue, checked)
                }
                testIdPrefix="project"
              />
              {Object.entries(options.labels).map(([key, labelOptions]) => (
                <ResourceFilterGroup
                  key={key}
                  legend={`Label · ${key}`}
                  options={labelOptions}
                  selectedValues={value.labelFilters?.[key] ?? []}
                  onToggle={(optionValue, checked) => toggleLabelValue(key, optionValue, checked)}
                  testIdPrefix={`label-${key}`}
                />
              ))}
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

function ResourceFilterGroup({
  legend,
  options,
  selectedValues,
  onToggle,
  testIdPrefix
}: {
  legend: string
  options: readonly ResourceFilterOption[]
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
            data-testid={`resource-filter-${testIdPrefix}:${option.value}`}
            className={cn(
              'group min-h-9 cursor-pointer rounded-sm px-2 text-sm text-foreground transition-colors hover:bg-muted hover:text-foreground focus:bg-muted focus:text-foreground',
              selected && 'bg-muted'
            )}
          >
            <SelectionCheckbox checked={selected} />
            <span className="min-w-0 flex-1 truncate">{option.label}</span>
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
