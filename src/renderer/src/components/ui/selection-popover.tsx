import * as React from 'react'

import { normalizeSearchQueryText, searchTextIncludes } from '../../../../shared/searchText'
import { cn } from '../../lib/utils'
import { Button } from './button'
import { ChevronDown, Plus } from './icons'
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from './command'
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from './popover'
import { SelectionCheckbox } from './selection-checkbox'
import { WorkspaceTextFade, WorkspaceTextFadeContent } from './workspace-text-fade'

export interface SelectionPopoverOption {
  value: string
  label: React.ReactNode
  searchText?: string
  disabled?: boolean
  wrapLabel?: boolean
  action?: {
    label: string
    icon: React.ReactNode
    onSelect: () => void
  }
}

interface SelectionPopoverBaseProps {
  options: readonly SelectionPopoverOption[]
  label: string
  searchPlaceholder?: string
  testId?: string
  contentClassName?: string
  placeholder?: React.ReactNode
  children?: React.ReactElement
  anchor?: React.ReactElement
  hideTrigger?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  searchValue?: string
  onSearchValueChange?: (value: string) => void
  loop?: boolean
  selectOnTab?: boolean
  onCloseAutoFocus?: (event: Event) => void
  triggerProps?: Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
    'data-testid'?: string
  }
}

interface SelectionPopoverCreateProps {
  onCreate?: (value: string) => void | Promise<void>
  getCreateValue?: (query: string) => string | null
  createLabel?: (value: string) => React.ReactNode
  createError?: React.ReactNode
}

export interface MultipleSelectionPopoverProps
  extends SelectionPopoverBaseProps, SelectionPopoverCreateProps {
  selectionMode?: 'multiple'
  value: readonly string[]
  onValueChange: (value: string[]) => void
}

export interface SingleSelectionPopoverProps
  extends SelectionPopoverBaseProps, SelectionPopoverCreateProps {
  selectionMode: 'single'
  value: string
  onValueChange: (value: string) => void
}

export type SelectionPopoverProps = MultipleSelectionPopoverProps | SingleSelectionPopoverProps

const selectionOptionClassName =
  'min-h-9 cursor-pointer gap-2 rounded-sm px-2.5 py-1.5 text-foreground transition-colors hover:!bg-surface-subtle-hover hover:!text-foreground focus:!bg-surface-subtle-hover focus:!text-foreground data-[selected=true]:!bg-surface-subtle-hover data-[selected=true]:!text-foreground data-[checked=true]:!bg-surface-subtle-hover data-[checked=true]:!text-foreground'

function isMultipleSelection(props: SelectionPopoverProps): props is MultipleSelectionPopoverProps {
  return props.selectionMode !== 'single'
}

function getOptionSearchText(option: SelectionPopoverOption): string {
  const labelText =
    typeof option.label === 'string' || typeof option.label === 'number' ? String(option.label) : ''

  return `${option.value} ${option.searchText ?? ''} ${labelText}`
}

export function SelectionPopover(props: SelectionPopoverProps): React.ReactElement {
  const {
    options,
    label,
    searchPlaceholder,
    testId,
    contentClassName,
    placeholder,
    children,
    triggerProps,
    anchor,
    hideTrigger = false,
    open: controlledOpen,
    onOpenChange,
    searchValue: controlledSearchValue,
    onSearchValueChange,
    loop = false,
    selectOnTab = false,
    onCloseAutoFocus
  } = props
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false)
  const [uncontrolledQuery, setUncontrolledQuery] = React.useState('')
  const inputRef = React.useRef<HTMLInputElement>(null)
  const listRef = React.useRef<HTMLDivElement>(null)
  const open = controlledOpen ?? uncontrolledOpen
  const query = controlledSearchValue ?? uncontrolledQuery
  const multiple = isMultipleSelection(props)
  const value = props.value
  const selectedValues = React.useMemo(() => new Set(multiple ? value : [value]), [multiple, value])
  const normalizedQuery = normalizeSearchQueryText(query)

  const usePopoverLayoutEffect =
    typeof window === 'undefined' ? React.useEffect : React.useLayoutEffect

  usePopoverLayoutEffect(() => {
    if (!open) return

    inputRef.current?.focus()
    const handleWheelCapture = (event: WheelEvent): void => {
      if (!listRef.current?.contains(event.target as Node)) return
      event.stopPropagation()
    }

    window.addEventListener('wheel', handleWheelCapture, true)
    return () => {
      window.removeEventListener('wheel', handleWheelCapture, true)
    }
  }, [open])

  const filteredOptions = React.useMemo(() => {
    if (!normalizedQuery) {
      return options
    }

    return options.filter((option) => {
      return searchTextIncludes(getOptionSearchText(option), query)
    })
  }, [normalizedQuery, options, query])

  const onCreate = props.onCreate
  const getCreateValue = props.getCreateValue
  const createLabel =
    props.createLabel ??
    ((nextValue: string) => `Create ${multiple ? 'tag' : label.toLowerCase()} "${nextValue}"`)
  const createError = props.createError
  const createValue = React.useMemo(() => {
    if (!onCreate || !normalizedQuery) {
      return null
    }

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
  const canCreate = Boolean(createValue && !existingCreateOption && visibleOptions.length === 0)
  const createOptionValue = createValue ? `__create__:${createValue}` : ''
  const navigableOptionValues = [
    ...visibleOptions.filter((option) => !option.disabled).map((option) => option.value),
    ...(canCreate ? [createOptionValue] : [])
  ]
  const [highlightedValue, setHighlightedValue] = React.useState('')
  const highlightedOptionValue =
    navigableOptionValues.find((optionValue) => optionValue === highlightedValue) ??
    navigableOptionValues[0] ??
    ''

  React.useEffect(() => {
    if (!open) {
      if (highlightedValue) {
        setHighlightedValue('')
      }
      return
    }

    if (highlightedValue !== highlightedOptionValue) {
      setHighlightedValue(highlightedOptionValue)
    }
  }, [highlightedOptionValue, highlightedValue, open])

  const handleOpenChange = (nextOpen: boolean): void => {
    if (controlledOpen === undefined) {
      setUncontrolledOpen(nextOpen)
    }
    onOpenChange?.(nextOpen)
    if (!nextOpen) {
      if (controlledSearchValue === undefined) {
        setUncontrolledQuery('')
      }
      onSearchValueChange?.('')
    }
  }

  const handleSearchValueChange = (nextValue: string): void => {
    if (controlledSearchValue === undefined) {
      setUncontrolledQuery(nextValue)
    }
    onSearchValueChange?.(nextValue)
  }

  const handleToggle = (optionValue: string): void => {
    if (isMultipleSelection(props)) {
      if (selectedValues.has(optionValue)) {
        props.onValueChange(props.value.filter((item) => item !== optionValue))
        return
      }

      props.onValueChange([...props.value, optionValue])
      return
    }

    props.onValueChange(optionValue)
    handleOpenChange(false)
  }

  const handleCreate = (): void => {
    if (!createValue) return

    void onCreate?.(createValue)
    if (!multiple) {
      handleOpenChange(false)
    }
    handleSearchValueChange('')
  }

  const selectedOption = !multiple ? options.find((option) => option.value === value) : undefined
  const trigger = hideTrigger
    ? null
    : (children ??
      (() => {
        const triggerLabel = selectedOption?.label ?? (value || placeholder || 'Select an option')

        return (
          <Button
            {...triggerProps}
            type={triggerProps?.type ?? 'button'}
            aria-label={triggerProps?.['aria-label'] ?? label}
            className={cn(
              'w-full justify-between rounded-[var(--radius-control)] border border-input bg-card px-2 text-foreground shadow-sm hover:bg-muted hover:text-foreground',
              triggerProps?.className
            )}
          >
            <WorkspaceTextFade className="min-w-0 flex-1 text-left">
              {triggerLabel}
            </WorkspaceTextFade>
            <ChevronDown className="size-[var(--control-icon-size)] shrink-0 opacity-60" />
          </Button>
        )
      })())

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      {anchor ? <PopoverAnchor asChild>{anchor}</PopoverAnchor> : null}
      {trigger ? <PopoverTrigger asChild>{trigger}</PopoverTrigger> : null}
      <PopoverContent
        align="start"
        className={cn('w-[min(20rem,calc(100vw-1rem))] overflow-hidden p-0', contentClassName)}
        aria-label={`${label} options`}
        data-testid={testId}
        onCloseAutoFocus={onCloseAutoFocus}
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          inputRef.current?.focus()
        }}
      >
        <Command
          shouldFilter={false}
          loop={loop}
          value={highlightedOptionValue}
          onValueChange={setHighlightedValue}
          className="rounded-md"
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              if (navigableOptionValues.length === 0) {
                return
              }

              event.preventDefault()
              const direction = event.key === 'ArrowDown' ? 1 : -1
              const currentIndex = navigableOptionValues.findIndex(
                (optionValue) => optionValue === highlightedOptionValue
              )
              const baseIndex = currentIndex < 0 ? (direction > 0 ? 0 : -1) : currentIndex
              const nextIndex = baseIndex + direction
              const resolvedIndex = loop
                ? (nextIndex + navigableOptionValues.length) % navigableOptionValues.length
                : Math.max(0, Math.min(nextIndex, navigableOptionValues.length - 1))
              const nextValue = navigableOptionValues[resolvedIndex]
              if (nextValue) {
                setHighlightedValue(nextValue)
              }
              return
            }

            if (selectOnTab && !multiple && event.key === 'Tab') {
              if (highlightedOptionValue) {
                event.preventDefault()
                if (canCreate && highlightedOptionValue === createOptionValue) {
                  handleCreate()
                } else {
                  handleToggle(highlightedOptionValue)
                }
                return
              }
            }

            if (
              event.key !== 'Enter' ||
              event.nativeEvent.isComposing ||
              event.nativeEvent.keyCode === 229 ||
              !canCreate
            ) {
              return
            }

            event.preventDefault()
            handleCreate()
          }}
        >
          <CommandInput
            ref={inputRef}
            value={query}
            onValueChange={handleSearchValueChange}
            placeholder={searchPlaceholder ?? (multiple ? 'Search or add tags' : `Search ${label}`)}
            aria-label={searchPlaceholder ?? (multiple ? 'Search or add tags' : `Search ${label}`)}
          />
          <CommandList
            ref={listRef}
            aria-label={`${label} options`}
            aria-multiselectable={multiple ? true : undefined}
            className="max-h-[min(20rem,calc(100vh-8rem))] overflow-y-auto overscroll-contain"
          >
            {visibleOptions.length > 0 ? (
              <CommandGroup className="[&_[cmdk-group-items]]:space-y-0.5">
                {visibleOptions.map((option) => {
                  const selected = selectedValues.has(option.value)

                  return (
                    <CommandItem
                      key={option.value}
                      value={option.value}
                      onSelect={() => handleToggle(option.value)}
                      disabled={option.disabled}
                      aria-label={`${option.searchText ?? option.value}${selected ? ', selected' : ''}`}
                      aria-selected={!multiple ? selected : undefined}
                      aria-checked={multiple ? selected : undefined}
                      data-checked={selected ? 'true' : 'false'}
                      className={selectionOptionClassName}
                    >
                      {multiple ? <SelectionCheckbox checked={selected} /> : null}
                      {option.wrapLabel ? (
                        <span className="min-w-0 flex-1 whitespace-normal break-words text-left">
                          {option.label}
                        </span>
                      ) : (
                        <WorkspaceTextFadeContent className="min-w-0 flex-1 text-left">
                          {option.label}
                        </WorkspaceTextFadeContent>
                      )}
                      {option.action ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={option.disabled}
                          aria-label={option.action.label}
                          className="ml-auto h-6 w-6 shrink-0 rounded-[var(--radius-control)] p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:text-foreground"
                          onPointerDown={(event) => event.stopPropagation()}
                          onKeyDown={(event) => event.stopPropagation()}
                          onClick={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                            option.action?.onSelect()
                          }}
                        >
                          {option.action.icon}
                        </Button>
                      ) : null}
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            ) : canCreate ? (
              <CommandGroup className="[&_[cmdk-group-items]]:space-y-0.5">
                <CommandItem
                  value={createOptionValue}
                  onSelect={handleCreate}
                  aria-selected={!multiple ? true : undefined}
                  data-testid={testId ? `${testId}-create` : undefined}
                  className={selectionOptionClassName}
                >
                  <Plus size={16} aria-hidden="true" className="text-muted-foreground" />
                  <WorkspaceTextFade className="min-w-0 flex-1 text-left">
                    {createLabel(createValue ?? '')}
                  </WorkspaceTextFade>
                </CommandItem>
              </CommandGroup>
            ) : (
              <div className="p-2">
                {createError && normalizedQuery ? (
                  <p role="alert" className="px-2 py-2 text-xs text-destructive">
                    {createError}
                  </p>
                ) : (
                  <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                    {normalizedQuery
                      ? `No matching ${label.toLowerCase()}`
                      : `No ${label.toLowerCase()} yet`}
                  </p>
                )}
              </div>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
