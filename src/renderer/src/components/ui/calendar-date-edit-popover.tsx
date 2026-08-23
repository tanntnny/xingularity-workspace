import * as React from 'react'
import { parseISO } from 'date-fns'

import { parseCalendarDateInput, formatCalendarDateValue } from '../../lib/calendarDateTimeInput'
import { toIsoDate } from '../../lib/calendarDate'
import { cn } from '../../lib/utils'
import { Button } from './button'
import { Calendar } from './calendar'
import { CalendarCheck, CalendarOff } from './icons'
import { Input } from './input'
import { Popover, PopoverContent, PopoverTrigger } from './popover'

export interface CalendarDateEditPopoverProps extends Omit<
  React.ComponentProps<typeof Button>,
  'asChild' | 'children' | 'onChange' | 'value'
> {
  'data-testid'?: string
  label: string
  value?: string
  onValueChange: (value: string | undefined) => void
  placeholder?: string
  displayValue?: React.ReactNode
  showIcon?: boolean
}

export const CalendarDateEditPopover = React.forwardRef<
  HTMLButtonElement,
  CalendarDateEditPopoverProps
>(
  (
    {
      label,
      value,
      onValueChange,
      placeholder = 'Set date',
      displayValue,
      showIcon = true,
      className,
      variant = 'outline',
      size = 'sm',
      'aria-label': ariaLabel,
      ...props
    },
    ref
  ) => {
    const [open, setOpen] = React.useState(false)
    const [draft, setDraft] = React.useState(value ?? '')
    const [error, setError] = React.useState<string>()
    const inputRef = React.useRef<HTMLInputElement>(null)
    const errorId = React.useId()

    const selectedDate = React.useMemo(() => {
      const result = parseCalendarDateInput(draft)
      return result.status === 'valid' ? parseISO(result.value) : undefined
    }, [draft])

    const handleOpenChange = (nextOpen: boolean): void => {
      setOpen(nextOpen)
      if (nextOpen) {
        setDraft(value ?? '')
        setError(undefined)
      } else {
        setError(undefined)
      }
    }

    const commitDraft = (): void => {
      const result = parseCalendarDateInput(draft)
      if (result.status === 'invalid') {
        setError(result.message)
        return
      }

      onValueChange(result.status === 'empty' ? undefined : result.value)
      setError(undefined)
      setOpen(false)
    }

    const handleDateSelect = (date: Date | undefined): void => {
      if (!date) {
        return
      }

      const nextValue = toIsoDate(date)
      setDraft(nextValue)
      setError(undefined)
      onValueChange(nextValue)
      setOpen(false)
    }

    return (
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            {...props}
            ref={ref}
            type="button"
            variant={variant}
            size={size}
            className={cn(
              'max-w-full justify-start text-left text-sm font-semibold',
              !value && 'text-muted-foreground',
              className
            )}
            aria-label={ariaLabel ?? label}
            aria-haspopup="dialog"
            aria-expanded={open}
          >
            {showIcon ? (
              value ? (
                <CalendarCheck aria-hidden="true" />
              ) : (
                <CalendarOff aria-hidden="true" />
              )
            ) : null}
            <span className="truncate">
              {value ? (displayValue ?? formatCalendarDateValue(value)) : placeholder}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-auto max-w-[calc(100vw-1rem)] overflow-hidden p-0"
          aria-label={`${label} editor`}
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            inputRef.current?.focus()
          }}
        >
          <div className="border-b border-border px-3 py-2">
            <Input
              ref={inputRef}
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value)
                setError(undefined)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  commitDraft()
                }
              }}
              placeholder="Tomorrow, 14 Feb, or 2026/01/31"
              aria-label={`${label} input`}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? errorId : undefined}
              autoComplete="off"
            />
            {error ? (
              <p id={errorId} role="alert" className="mt-1.5 text-xs text-destructive">
                {error}
              </p>
            ) : null}
          </div>
          <Calendar
            mode="single"
            selected={selectedDate}
            defaultMonth={selectedDate}
            onSelect={handleDateSelect}
          />
        </PopoverContent>
      </Popover>
    )
  }
)
CalendarDateEditPopover.displayName = 'CalendarDateEditPopover'
