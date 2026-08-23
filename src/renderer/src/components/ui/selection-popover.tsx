import * as React from 'react'

import { cn } from '../../lib/utils'
import { Button } from './button'
import { Check, ChevronDown, Plus } from './icons'
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from './command'
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from './popover'

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

export interface MultipleSelectionPopoverProps extends SelectionPopoverBaseProps {
  selectionMode?: 'multiple'
  value: readonly string[]
  onValueChange: (value: string[]) => void
  onCreate?: (value: string) => void | Promise<void>
  getCreateValue?: (query: string) => string | null
  createLabel?: (value: string) => React.ReactNode
  createError?: React.ReactNode
}

export interface SingleSelectionPopoverProps extends SelectionPopoverBaseProps {
  selectionMode: 'single'
  value: string
  onValueChange: (value: string) => void
}

export type SelectionPopoverProps = MultipleSelectionPopoverProps | SingleSelectionPopoverProps

function isMultipleSelection(props: SelectionPopoverProps): props is MultipleSelectionPopoverProps {
  return props.selectionMode !== 'single'
}

function getOptionSearchText(option: SelectionPopoverOption): string {
  const labelText =
    typeof option.label === 'string' || typeof option.label === 'number' ? String(option.label) : ''

  return `${option.value} ${option.searchText ?? ''} ${labelText}`.toLowerCase()
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
  const normalizedQuery = query.trim().toLowerCase()

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
      return getOptionSearchText(option).includes(normalizedQuery)
    })
  }, [normalizedQuery, options])

  const onCreate = multiple ? props.onCreate : undefined
  const getCreateValue = multiple ? props.getCreateValue : undefined
  const createLabel = multiple
    ? (props.createLabel ?? ((nextValue) => `Create tag "${nextValue}"`))
    : undefined
  const createError = multiple ? props.createError : undefined
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
  const navigableOptions = visibleOptions.filter((option) => !option.disabled)
  const [highlightedValue, setHighlightedValue] = React.useState('')
  const highlightedOptionValue =
    navigableOptions.find((option) => option.value === highlightedValue)?.value ??
    navigableOptions[0]?.value ??
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
            <span className="min-w-0 truncate text-left">{triggerLabel}</span>
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
              if (navigableOptions.length === 0) {
                return
              }

              event.preventDefault()
              const direction = event.key === 'ArrowDown' ? 1 : -1
              const currentIndex = navigableOptions.findIndex(
                (option) => option.value === highlightedOptionValue
              )
              const baseIndex = currentIndex < 0 ? (direction > 0 ? 0 : -1) : currentIndex
              const nextIndex = baseIndex + direction
              const resolvedIndex = loop
                ? (nextIndex + navigableOptions.length) % navigableOptions.length
                : Math.max(0, Math.min(nextIndex, navigableOptions.length - 1))
              const nextValue = navigableOptions[resolvedIndex]?.value
              if (nextValue) {
                setHighlightedValue(nextValue)
              }
              return
            }

            if (selectOnTab && !multiple && event.key === 'Tab') {
              if (highlightedOptionValue) {
                event.preventDefault()
                handleToggle(highlightedOptionValue)
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
                      className="min-h-7 cursor-pointer gap-2 rounded-md px-2 py-1 text-foreground transition-colors hover:bg-popover-hover hover:text-foreground focus:bg-popover-hover focus:text-foreground data-[selected=true]:bg-popover-hover data-[selected=true]:text-foreground data-[checked=true]:bg-popover-hover data-[checked=true]:text-foreground"
                    >
                      {multiple ? (
                        <span
                          aria-hidden="true"
                          className={cn(
                            'flex size-4 shrink-0 items-center justify-center rounded-sm border border-border text-primary',
                            selected && 'border-primary bg-primary text-primary-foreground'
                          )}
                        >
                          {selected ? <Check size={12} /> : null}
                        </span>
                      ) : null}
                      <span
                        className={cn(
                          'min-w-0 flex-1 text-left',
                          option.wrapLabel ? 'whitespace-normal break-words' : 'truncate'
                        )}
                      >
                        {option.label}
                      </span>
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
                      {!multiple ? (
                        <Check
                          aria-hidden="true"
                          className={cn(
                            'ml-auto size-[var(--control-icon-size)] shrink-0 text-primary',
                            selected ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                      ) : null}
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            ) : (
              <div className="p-2">
                {canCreate ? (
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={handleCreate}
                    data-testid={testId ? `${testId}-create` : undefined}
                  >
                    <Plus size={16} aria-hidden="true" />
                    <span className="min-w-0 truncate">
                      {createValue ? createLabel?.(createValue) : null}
                    </span>
                  </button>
                ) : createError && normalizedQuery ? (
                  <p role="alert" className="px-2 py-2 text-xs text-destructive">
                    {createError}
                  </p>
                ) : (
                  <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                    {normalizedQuery
                      ? multiple
                        ? 'No matching tags'
                        : `No matching ${label.toLowerCase()}`
                      : multiple
                        ? 'No tags yet'
                        : `No ${label.toLowerCase()} available`}
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
