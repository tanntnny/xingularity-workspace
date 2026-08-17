import * as React from 'react'
import { cva } from 'class-variance-authority'

import type { UiTone } from '../../lib/uiTone'
import { cn } from '../../lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from './popover'

const selectiveChipVariants = cva(
  'ui-control inline-flex w-fit items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background [&_svg]:pointer-events-none [&_svg]:size-[var(--control-icon-size)] [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'rounded-[var(--radius-control)] border px-[var(--control-padding-x)]',
        plain: 'gap-1 p-0'
      },
      tone: {
        subtle: 'text-secondary-foreground',
        neutral: 'text-muted-foreground hover:text-accent-foreground',
        info: 'text-info-muted-foreground',
        accent: 'text-secondary-foreground',
        attention: 'text-warning-muted-foreground',
        success: 'text-success-muted-foreground',
        warning: 'text-warning-muted-foreground',
        danger: 'text-destructive-foreground'
      }
    },
    compoundVariants: [
      {
        variant: 'default',
        tone: 'subtle',
        className: 'border-border bg-secondary hover:bg-secondary/80'
      },
      {
        variant: 'default',
        tone: 'neutral',
        className: 'border-border bg-muted hover:bg-accent'
      },
      {
        variant: 'default',
        tone: 'info',
        className: 'border-info-border bg-info-muted hover:bg-info-muted/80'
      },
      {
        variant: 'default',
        tone: 'accent',
        className: 'border-border bg-secondary hover:bg-secondary/80'
      },
      {
        variant: 'default',
        tone: 'attention',
        className: 'border-warning-border bg-warning-muted hover:bg-warning-muted/80'
      },
      {
        variant: 'default',
        tone: 'success',
        className: 'border-success-border bg-success-muted hover:bg-success-muted/80'
      },
      {
        variant: 'default',
        tone: 'warning',
        className: 'border-warning-border bg-warning-muted hover:bg-warning-muted/80'
      },
      {
        variant: 'default',
        tone: 'danger',
        className: 'border-transparent bg-destructive hover:bg-destructive/90'
      },
      {
        variant: 'plain',
        className: 'rounded-none border-0 bg-transparent hover:bg-transparent'
      }
    ],
    defaultVariants: {
      variant: 'default',
      tone: 'neutral'
    }
  }
)

export interface SelectiveChipOption {
  value: string
  label: React.ReactNode
  icon?: React.ReactNode
  tone?: UiTone
}

export interface SelectiveChipProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'children' | 'value' | 'onChange'
> {
  variant?: 'default' | 'plain'
  showValue?: boolean
  label: string
  value: string
  options: readonly SelectiveChipOption[]
  onValueChange: (value: string) => void
}

const SelectiveChip = React.forwardRef<HTMLButtonElement, SelectiveChipProps>(
  (
    {
      className,
      label,
      value,
      variant,
      showValue = true,
      options,
      onValueChange,
      type = 'button',
      'aria-label': ariaLabel,
      ...props
    },
    ref
  ) => {
    const [open, setOpen] = React.useState(false)
    const radioGroupName = React.useId()
    const selectedInputRef = React.useRef<HTMLInputElement>(null)
    const firstInputRef = React.useRef<HTMLInputElement>(null)
    const selectedOption =
      options.find((option) => option.value === value) ??
      ({ value, label: value } satisfies SelectiveChipOption)

    const handleValueChange = (nextValue: string): void => {
      onValueChange(nextValue)
      setOpen(false)
    }

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            ref={ref}
            type={type}
            className={cn(selectiveChipVariants({ variant, tone: selectedOption.tone }), className)}
            aria-label={ariaLabel ?? `${label}: ${selectedOption.label}`}
            {...props}
          >
            {selectedOption.icon}
            {showValue ? <span>{selectedOption.label}</span> : null}
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-48 p-1"
          aria-label={`${label} options`}
          onOpenAutoFocus={(event) => {
            const focusTarget = selectedInputRef.current ?? firstInputRef.current
            if (!focusTarget) return

            event.preventDefault()
            focusTarget.focus()
          }}
        >
          <fieldset className="grid gap-1">
            <legend className="sr-only">{label} options</legend>
            {options.map((option, index) => {
              const selected = option.value === value

              return (
                <label
                  key={option.value}
                  data-selected={selected}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-[var(--radius-button)] px-2 py-1.5 text-left text-sm text-foreground outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-within:ring-2 focus-within:ring-ring data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
                >
                  <input
                    ref={selected ? selectedInputRef : index === 0 ? firstInputRef : undefined}
                    type="radio"
                    name={radioGroupName}
                    value={option.value}
                    checked={selected}
                    onChange={() => handleValueChange(option.value)}
                    className="sr-only"
                  />
                  {option.icon ? (
                    <span className="shrink-0" aria-hidden="true">
                      {option.icon}
                    </span>
                  ) : null}
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                </label>
              )
            })}
          </fieldset>
        </PopoverContent>
      </Popover>
    )
  }
)
SelectiveChip.displayName = 'SelectiveChip'

export { SelectiveChip }
