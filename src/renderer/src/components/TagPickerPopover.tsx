import * as React from 'react'

import { cn } from '../lib/utils'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from './ui/command'
import { Plus, Search, TagOutline } from './ui/icons'
import { ResponsivePicker } from './ui/responsive-picker'
import { useResponsivePickerOpen } from './ui/responsive-picker-context'
import { SelectionCheckbox } from './ui/selection-checkbox'
import { StatusChip, type StatusChipSurface } from './ui/status-chip'
import { TagChip } from './TagChip'

export interface TagPickerOption {
  value: string
  count?: number
  searchText?: string
  disabled?: boolean
  label?: React.ReactNode
}

export interface TagPickerContentProps {
  value: readonly string[]
  options: readonly TagPickerOption[]
  onValueChange: (value: string[]) => void
  label?: string
  searchPlaceholder?: string
  searchAriaLabel?: string
  testId?: string
  onCreate?: (value: string) => void | Promise<void>
  getCreateValue?: (query: string) => string | null
  createLabel?: (value: string) => React.ReactNode
  createError?: React.ReactNode
  createLimitError?: React.ReactNode
  onFind?: (tag: string) => void
  showSelected?: boolean
  maxCount?: number
  optionTestIdPrefix?: string
  emptyLabel?: React.ReactNode
  noResultsLabel?: React.ReactNode
}

export interface TagPickerPopoverProps extends TagPickerContentProps {
  trigger?: React.ReactElement
  triggerId?: string
  triggerTestId?: string
  surface?: StatusChipSurface
  className?: string
  description?: React.ReactNode
  clearLabel?: string
}

function getOptionSearchText(option: TagPickerOption): string {
  return `${option.value} ${option.searchText ?? ''}`.toLowerCase()
}

function getOptionAccessibleName(option: TagPickerOption, selected: boolean): string {
  const countLabel =
    option.count === undefined ? '' : `, ${option.count} task${option.count === 1 ? '' : 's'}`
  const selectionLabel = selected
    ? ', selected'
    : option.count === undefined
      ? ''
      : ', not selected'
  return `${option.searchText ?? option.value}${countLabel}${selectionLabel}`
}

export function TagPickerContent({
  value,
  options,
  onValueChange,
  label = 'Tags',
  searchPlaceholder = 'Search or add tags',
  searchAriaLabel,
  testId,
  onCreate,
  getCreateValue,
  createLabel = (nextValue) => `Create tag "${nextValue}"`,
  createError = 'Use letters, numbers, dash, underscore, or a namespace colon.',
  createLimitError,
  onFind,
  showSelected = true,
  maxCount,
  optionTestIdPrefix,
  emptyLabel = 'No tags yet',
  noResultsLabel = 'No matching tags'
}: TagPickerContentProps): React.ReactElement {
  const open = useResponsivePickerOpen()
  const inputRef = React.useRef<HTMLInputElement>(null)
  const listRef = React.useRef<HTMLDivElement>(null)
  const createErrorId = React.useId()
  const [query, setQuery] = React.useState('')
  const [highlightedValue, setHighlightedValue] = React.useState('')
  const selectedValues = React.useMemo(() => new Set(value), [value])
  const normalizedQuery = query.trim().toLowerCase()

  const filteredOptions = React.useMemo(() => {
    if (!normalizedQuery) return options
    return options.filter((option) => getOptionSearchText(option).includes(normalizedQuery))
  }, [normalizedQuery, options])

  const createValue = React.useMemo(() => {
    if (!onCreate || !normalizedQuery) return null
    return getCreateValue ? getCreateValue(query) : query.trim()
  }, [getCreateValue, normalizedQuery, onCreate, query])

  const existingCreateOption = createValue
    ? options.find((option) => option.value === createValue)
    : undefined
  const visibleOptions =
    filteredOptions.length > 0
      ? filteredOptions
      : existingCreateOption
        ? [existingCreateOption]
        : []
  const atMaxCount = Boolean(
    createValue && maxCount !== undefined && value.length >= maxCount && !existingCreateOption
  )
  const canCreate = Boolean(createValue && !existingCreateOption && !atMaxCount)
  const showCreateError = Boolean(
    normalizedQuery && visibleOptions.length === 0 && (createError || atMaxCount)
  )
  const navigableOptions = visibleOptions.filter((option) => !option.disabled)
  const resolvedHighlightedValue =
    navigableOptions.find((option) => option.value === highlightedValue)?.value ??
    navigableOptions[0]?.value ??
    ''

  React.useEffect(() => {
    if (!open) {
      setQuery('')
      setHighlightedValue('')
      return
    }

    inputRef.current?.focus()
    if (highlightedValue !== resolvedHighlightedValue) {
      setHighlightedValue(resolvedHighlightedValue)
    }
  }, [highlightedValue, open, resolvedHighlightedValue])

  const handleToggle = (optionValue: string): void => {
    if (selectedValues.has(optionValue)) {
      onValueChange(value.filter((item) => item !== optionValue))
      return
    }

    if (maxCount !== undefined && value.length >= maxCount) return
    onValueChange([...value, optionValue])
  }

  const handleCreate = (): void => {
    if (!createValue || !canCreate) return
    void onCreate?.(createValue)
    setQuery('')
  }

  const handleKeyDown = (event: React.KeyboardEvent): void => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (navigableOptions.length === 0) return

      event.preventDefault()
      const direction = event.key === 'ArrowDown' ? 1 : -1
      const currentIndex = navigableOptions.findIndex(
        (option) => option.value === resolvedHighlightedValue
      )
      const baseIndex = currentIndex < 0 ? (direction > 0 ? 0 : -1) : currentIndex
      const nextIndex = Math.max(0, Math.min(baseIndex + direction, navigableOptions.length - 1))
      const nextValue = navigableOptions[nextIndex]?.value
      if (nextValue) setHighlightedValue(nextValue)
      return
    }

    if (
      event.key === 'Enter' &&
      !event.nativeEvent.isComposing &&
      event.nativeEvent.keyCode !== 229 &&
      canCreate
    ) {
      event.preventDefault()
      handleCreate()
    }
  }

  const renderEmptyState = (): React.ReactElement => {
    if (canCreate) {
      return (
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-[var(--radius-control)] px-3 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={handleCreate}
          data-testid={testId ? `${testId}-create` : undefined}
        >
          <Plus size={16} aria-hidden="true" />
          <span className="min-w-0 truncate">{createLabel(createValue ?? '')}</span>
        </button>
      )
    }

    if (normalizedQuery && (createError || atMaxCount)) {
      return (
        <p id={createErrorId} role="alert" className="px-3 py-3 text-xs leading-5 text-destructive">
          {atMaxCount ? (createLimitError ?? `You can add up to ${maxCount} tags.`) : createError}
        </p>
      )
    }

    return (
      <p className="px-3 py-6 text-center text-sm text-muted-foreground">
        {normalizedQuery ? noResultsLabel : emptyLabel}
      </p>
    )
  }

  return (
    <div className="flex min-h-0 flex-col">
      {showSelected ? (
        <div className="shrink-0 border-b border-border/70 px-3 py-2.5">
          <div className="flex min-h-7 flex-wrap items-center gap-1.5">
            <span className="sr-only">Selected {label.toLowerCase()}</span>
            {value.length > 0 ? (
              value.map((tag) => (
                <TagChip
                  key={tag}
                  tag={tag}
                  onRemove={() => handleToggle(tag)}
                  className="max-w-full"
                  labelOverflow="fade"
                />
              ))
            ) : (
              <span className="text-xs text-muted-foreground">No tags selected yet</span>
            )}
          </div>
        </div>
      ) : null}
      <Command
        shouldFilter={false}
        value={resolvedHighlightedValue}
        onValueChange={setHighlightedValue}
        onKeyDown={handleKeyDown}
        className="min-h-0 flex-1 rounded-none bg-transparent"
      >
        <CommandInput
          ref={inputRef}
          value={query}
          onValueChange={setQuery}
          placeholder={searchPlaceholder}
          aria-label={searchAriaLabel ?? searchPlaceholder}
          aria-describedby={showCreateError ? createErrorId : undefined}
          data-responsive-picker-input="true"
        />
        <CommandList
          ref={listRef}
          aria-label={`${label} options`}
          aria-multiselectable="true"
          className="max-h-[min(20rem,calc(70vh-9rem))] min-h-0 overflow-y-auto overscroll-contain"
        >
          {visibleOptions.length > 0 ? (
            <CommandGroup heading={value.length > 0 ? 'Available tags' : undefined}>
              {visibleOptions.map((option) => {
                const selected = selectedValues.has(option.value)
                const optionLabel = option.label ?? (
                  <TagChip tag={option.value} className="w-full max-w-full" labelOverflow="fade" />
                )

                return (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    onSelect={() => handleToggle(option.value)}
                    disabled={option.disabled}
                    aria-label={getOptionAccessibleName(option, selected)}
                    aria-checked={selected}
                    data-checked={selected ? 'true' : 'false'}
                    data-testid={
                      optionTestIdPrefix
                        ? `${optionTestIdPrefix}:${option.value}`
                        : testId
                          ? `${testId}-option:${option.value}`
                          : undefined
                    }
                    className="min-h-9 cursor-pointer gap-2 rounded-sm px-2.5 py-1.5 text-foreground transition-colors hover:bg-muted hover:text-foreground focus:bg-muted focus:text-foreground data-[checked=true]:bg-muted data-[checked=true]:text-foreground"
                  >
                    <SelectionCheckbox checked={selected} />
                    <span
                      className={cn(
                        'min-w-0 flex-1 text-left',
                        option.label ? 'whitespace-normal break-words' : 'truncate'
                      )}
                    >
                      {optionLabel}
                    </span>
                    {option.count !== undefined ? (
                      <Badge
                        variant="secondary"
                        className="ml-auto min-w-5 shrink-0 justify-center px-1.5 text-xs"
                      >
                        {option.count}
                      </Badge>
                    ) : null}
                    {onFind ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Search tag ${option.value}`}
                        className="ml-auto h-7 w-7 shrink-0 rounded-[var(--radius-control)] p-1 text-muted-foreground hover:bg-card-hover hover:text-foreground focus-visible:bg-card-hover focus-visible:text-foreground"
                        onPointerDown={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                          onFind(option.value)
                        }}
                      >
                        <Search size={14} aria-hidden="true" />
                      </Button>
                    ) : null}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          ) : (
            <CommandEmpty>{renderEmptyState()}</CommandEmpty>
          )}
        </CommandList>
      </Command>
    </div>
  )
}

export function TagPickerPopover({
  trigger,
  triggerId,
  triggerTestId,
  surface = 'pill',
  className,
  description,
  clearLabel = 'Clear all',
  label = 'Tags',
  value,
  options,
  onValueChange,
  ...contentProps
}: TagPickerPopoverProps): React.ReactElement {
  const defaultTrigger = (
    <StatusChip
      as="button"
      item={{
        label: 'Tags',
        icon: <TagOutline aria-hidden="true" />,
        iconColorToken: 'var(--muted-foreground)'
      }}
      counter={value.length}
      type="button"
      surface={surface}
      title={label}
      aria-label={`${label} selection`}
      id={triggerId}
      data-testid={
        triggerTestId ?? (contentProps.testId ? `${contentProps.testId}-trigger` : undefined)
      }
    />
  )

  return (
    <div className={cn('min-w-0', className)}>
      <ResponsivePicker
        trigger={trigger ?? defaultTrigger}
        title={label}
        description={description}
        selectedCount={value.length}
        onClear={() => onValueChange([])}
        clearLabel={clearLabel}
        testId={contentProps.testId}
        ariaLabel={`${label} options`}
      >
        <TagPickerContent
          {...contentProps}
          label={label}
          value={value}
          options={options}
          onValueChange={onValueChange}
        />
      </ResponsivePicker>
    </div>
  )
}
