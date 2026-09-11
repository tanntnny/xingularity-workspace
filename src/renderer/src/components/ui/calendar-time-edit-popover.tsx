import * as React from 'react'

import {
  CALENDAR_TIME_GRID_STEP_MINUTES,
  formatCalendarTimeValue,
  parseCalendarTimeInput
} from '../../lib/calendarDateTimeInput'
import { cn } from '../../lib/utils'
import { Button } from './button'
import { ClockCheck, ClockOff } from './icons'
import { Input } from './input'
import { Popover, PopoverContent, PopoverTrigger } from './popover'
import { WorkspaceTextFade } from './workspace-text-fade'

export interface CalendarTimeEditPopoverProps extends Omit<
  React.ComponentProps<typeof Button>,
  'asChild' | 'children' | 'onChange' | 'value'
> {
  'data-testid'?: string
  label: string
  value?: string
  onValueChange: (value: string | undefined) => void
  placeholder?: string
  showIcon?: boolean
}

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, '0'))
const MINUTE_OPTIONS = Array.from({ length: 60 / CALENDAR_TIME_GRID_STEP_MINUTES }, (_, index) =>
  String(index * CALENDAR_TIME_GRID_STEP_MINUTES).padStart(2, '0')
)
const TIME_OPTION_BASE_CLASS_NAME =
  'flex w-full cursor-pointer rounded-md text-center text-xs font-semibold text-foreground outline-none transition-colors focus-within:ring-2 focus-within:ring-ring'
const TIME_OPTION_HOVER_CLASS_NAME =
  'hover:bg-card-hover hover:text-foreground focus-within:bg-card-hover focus-within:text-foreground'
const TIME_OPTION_SELECTED_CLASS_NAME =
  'bg-card-hover text-foreground hover:bg-card-hover hover:text-foreground focus-within:bg-card-hover focus-within:text-foreground'

export const CalendarTimeEditPopover = React.forwardRef<
  HTMLButtonElement,
  CalendarTimeEditPopoverProps
>(
  (
    {
      label,
      value,
      onValueChange,
      placeholder = 'Set time',
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
    const hourRadioGroupName = React.useId()
    const minuteRadioGroupName = React.useId()
    const errorId = React.useId()

    const selectedTime = React.useMemo(() => {
      const result = parseCalendarTimeInput(draft)
      return result.status === 'valid' ? result.value : undefined
    }, [draft])
    const selectedHour = selectedTime?.slice(0, 2) ?? ''
    const selectedMinute = selectedTime?.slice(3, 5) ?? ''

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
      const result = parseCalendarTimeInput(draft)
      if (result.status === 'invalid') {
        setError(result.message)
        return
      }

      onValueChange(result.status === 'empty' ? undefined : result.value)
      setError(undefined)
      setOpen(false)
    }

    const handleTimePartSelect = (part: 'hour' | 'minute', nextValue: string): void => {
      const nextTime =
        part === 'hour'
          ? `${nextValue}:${selectedMinute || '00'}`
          : `${selectedHour || '00'}:${nextValue}`
      setDraft(nextTime)
      setError(undefined)
      onValueChange(nextTime)
    }

    const handleTimeColumnWheel = (event: React.WheelEvent<HTMLDivElement>): void => {
      if (event.deltaY === 0) {
        return
      }

      const column = event.currentTarget
      const deltaY =
        event.deltaMode === 1
          ? event.deltaY * 16
          : event.deltaMode === 2
            ? event.deltaY * column.clientHeight
            : event.deltaY
      const maxScrollTop = Math.max(0, column.scrollHeight - column.clientHeight)
      const nextScrollTop = Math.max(0, Math.min(maxScrollTop, column.scrollTop + deltaY))

      event.preventDefault()
      event.stopPropagation()
      column.scrollTop = nextScrollTop
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
                <ClockCheck aria-hidden="true" />
              ) : (
                <ClockOff aria-hidden="true" />
              )
            ) : null}
            <WorkspaceTextFade className="min-w-0 flex-1">
              {value ? formatCalendarTimeValue(value) : placeholder}
            </WorkspaceTextFade>
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
          <div className="w-full border-b border-border px-3 py-2">
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
              placeholder="17, 1700, 0110, 11am, or 23:30"
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
          <div
            data-time-columns="true"
            className="grid w-full max-w-[calc(100vw-2rem)] grid-cols-2 gap-2 px-3 pb-3"
          >
            <fieldset className="w-full min-w-0" data-time-part="hour">
              <legend className="mb-1 px-1 text-center text-xs font-semibold text-muted-foreground">
                Hours
              </legend>
              <div
                className="h-80 max-h-[calc(100vh-12rem)] min-h-0 touch-pan-y overflow-y-scroll overscroll-contain pr-1"
                tabIndex={0}
                onWheel={handleTimeColumnWheel}
              >
                <div className="flex w-full flex-col gap-1">
                  {HOUR_OPTIONS.map((hour) => {
                    const selected = hour === selectedHour

                    return (
                      <label
                        key={hour}
                        data-time-option={hour}
                        data-selected={selected}
                        className={cn(
                          TIME_OPTION_BASE_CLASS_NAME,
                          selected ? TIME_OPTION_SELECTED_CLASS_NAME : TIME_OPTION_HOVER_CLASS_NAME
                        )}
                      >
                        <input
                          type="radio"
                          name={hourRadioGroupName}
                          value={hour}
                          checked={selected}
                          onChange={() => handleTimePartSelect('hour', hour)}
                          className="sr-only"
                        />
                        <span className="w-full px-2 py-1.5 text-center">{hour}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            </fieldset>
            <fieldset className="w-full min-w-0" data-time-part="minute">
              <legend className="mb-1 px-1 text-center text-xs font-semibold text-muted-foreground">
                Minutes
              </legend>
              <div
                className="h-80 max-h-[calc(100vh-12rem)] min-h-0 touch-pan-y overflow-y-scroll overscroll-contain pr-1"
                tabIndex={0}
                onWheel={handleTimeColumnWheel}
              >
                <div className="flex w-full flex-col gap-1">
                  {MINUTE_OPTIONS.map((minute) => {
                    const selected = minute === selectedMinute

                    return (
                      <label
                        key={minute}
                        data-time-option={minute}
                        data-selected={selected}
                        className={cn(
                          TIME_OPTION_BASE_CLASS_NAME,
                          selected ? TIME_OPTION_SELECTED_CLASS_NAME : TIME_OPTION_HOVER_CLASS_NAME
                        )}
                      >
                        <input
                          type="radio"
                          name={minuteRadioGroupName}
                          value={minute}
                          checked={selected}
                          onChange={() => handleTimePartSelect('minute', minute)}
                          className="sr-only"
                        />
                        <span className="w-full px-2 py-1.5 text-center">{minute}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            </fieldset>
          </div>
        </PopoverContent>
      </Popover>
    )
  }
)
CalendarTimeEditPopover.displayName = 'CalendarTimeEditPopover'
