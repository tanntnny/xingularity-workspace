import * as React from 'react'

import { cn } from '../../lib/utils'
import { SelectionPopover } from './selection-popover'
import {
  StatusChip,
  type StatusChipItem,
  type StatusChipSurface,
  type StatusChipVariant
} from './status-chip'

export interface StatusChipOption extends StatusChipItem {
  value: string
  searchText?: string
  mutedTrigger?: boolean
}

export interface StatusChipSelectProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'children' | 'value' | 'onChange'
> {
  label: string
  value: string
  options: readonly StatusChipOption[]
  onValueChange: (value: string) => void
  showValue?: boolean
  variant?: StatusChipVariant
  surface?: StatusChipSurface
  wrapLabel?: boolean
  mutedLabel?: boolean
}

const fallbackIconColorToken = 'var(--muted-foreground)'

export const StatusChipSelect = React.forwardRef<HTMLButtonElement, StatusChipSelectProps>(
  (
    {
      className,
      label,
      value,
      options,
      onValueChange,
      showValue = true,
      variant = 'default',
      surface = 'none',
      wrapLabel = false,
      mutedLabel,
      type = 'button',
      'aria-label': ariaLabel,
      ...props
    },
    ref
  ) => {
    const selectedOption =
      options.find((option) => option.value === value) ??
      ({
        value,
        label: value,
        icon: null,
        iconColorToken: fallbackIconColorToken
      } satisfies StatusChipOption)
    const triggerItem = showValue ? selectedOption : { ...selectedOption, label: null }
    const triggerMutedLabel = mutedLabel ?? selectedOption.mutedTrigger ?? false

    const selectionOptions = React.useMemo(
      () =>
        options.map((option) => ({
          value: option.value,
          label: (
            <StatusChip
              item={option}
              variant="bare"
              wrapLabel={wrapLabel}
              mutedLabel={option.mutedTrigger ?? false}
              className={cn(
                'pointer-events-none min-w-0 flex-1 gap-2',
                !option.mutedTrigger && 'text-foreground [&>span:last-child]:text-foreground'
              )}
            />
          ),
          wrapLabel,
          searchText:
            option.searchText ??
            (typeof option.label === 'string' || typeof option.label === 'number'
              ? String(option.label)
              : undefined)
        })),
      [options, wrapLabel]
    )

    const handleValueChange = (nextValue: string): void => {
      onValueChange(nextValue)
    }

    return (
      <SelectionPopover
        selectionMode="single"
        value={value}
        options={selectionOptions}
        onValueChange={handleValueChange}
        label={label}
        searchPlaceholder={`Search ${label.toLowerCase()}`}
        contentClassName="p-1"
      >
        <StatusChip
          {...props}
          ref={ref}
          as="button"
          type={type}
          variant={variant}
          surface={surface}
          wrapLabel={wrapLabel}
          mutedLabel={triggerMutedLabel ? true : undefined}
          item={triggerItem}
          className={className}
          aria-label={ariaLabel ?? `${label}: ${selectedOption.label}`}
        />
      </SelectionPopover>
    )
  }
)
StatusChipSelect.displayName = 'StatusChipSelect'
