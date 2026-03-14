import * as React from 'react'
import { format, parseISO } from 'date-fns'
import { CalendarIcon } from 'lucide-react'

import { cn } from '../../lib/utils'
import { Button } from './button'
import { Calendar } from './calendar'
import { Popover, PopoverContent, PopoverTrigger } from './popover'

interface DatePickerProps {
  date: Date | undefined
  onDateChange: (date: Date | undefined) => void
  placeholder?: string
  className?: string
}

export function DatePicker({
  date,
  onDateChange,
  placeholder = 'Pick a date',
  className
}: DatePickerProps): React.ReactElement {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'w-full justify-start text-left font-normal',
            !date && 'text-[var(--muted-foreground)]',
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, 'PPP') : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={date} onSelect={onDateChange} initialFocus />
      </PopoverContent>
    </Popover>
  )
}

/**
 * DatePicker variant that works with ISO date strings (YYYY-MM-DD) instead of Date objects.
 * Useful for forms that store dates as strings.
 */
interface DatePickerISOProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  displayFormat?: string
  showIcon?: boolean
  'aria-label'?: string
}

export function DatePickerISO({
  value,
  onChange,
  placeholder = 'Pick a date',
  className,
  displayFormat = 'MMM d, yyyy',
  showIcon = true,
  'aria-label': ariaLabel
}: DatePickerISOProps): React.ReactElement {
  const date = value ? parseISO(value) : undefined

  const handleSelect = (selected: Date | undefined): void => {
    if (selected) {
      // Format as YYYY-MM-DD
      const isoString = format(selected, 'yyyy-MM-dd')
      onChange(isoString)
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'justify-start text-left font-normal',
            !date && 'text-[var(--muted-foreground)]',
            className
          )}
          aria-label={ariaLabel}
        >
          {showIcon ? <CalendarIcon className="mr-2 h-3.5 w-3.5" /> : null}
          {date ? format(date, displayFormat) : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={date} onSelect={handleSelect} initialFocus />
      </PopoverContent>
    </Popover>
  )
}
