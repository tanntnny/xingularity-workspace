import * as React from 'react'
import { ChevronLeft, ChevronRight } from './icons'
import { DayPicker } from 'react-day-picker'

import { cn } from '../lib/utils'
import { buttonVariants } from './button'

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps): React.ReactElement {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-3', className)}
      classNames={{
        months: 'relative flex flex-col gap-4 sm:flex-row',
        month: 'flex w-full flex-col gap-4',
        month_caption: 'flex h-7 items-center justify-center px-8',
        caption_label: 'select-none whitespace-nowrap text-sm font-medium',
        dropdowns: 'flex h-7 items-center justify-center gap-1.5 whitespace-nowrap',
        dropdown_root:
          'relative inline-flex items-center whitespace-nowrap rounded-md border border-input bg-background shadow-sm has-[select:focus-visible]:outline-none has-[select:focus-visible]:ring-2 has-[select:focus-visible]:ring-ring has-[select:focus-visible]:ring-offset-2 has-[select:focus-visible]:ring-offset-background',
        dropdown: 'absolute inset-0 opacity-0',
        nav: 'absolute inset-x-0 top-0 flex items-center justify-between',
        button_previous: cn(
          buttonVariants({ variant: 'outline' }),
          'size-7 bg-transparent p-0 opacity-80 hover:opacity-100'
        ),
        button_next: cn(
          buttonVariants({ variant: 'outline' }),
          'size-7 bg-transparent p-0 opacity-80 hover:opacity-100'
        ),
        month_grid: 'w-full border-collapse',
        weekdays: 'flex',
        weekday: 'w-8 rounded-md text-xs font-normal text-muted-foreground',
        week: 'mt-2 flex w-full',
        day: 'relative h-8 w-8 p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected].outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent [&:has([aria-selected])]:rounded-md',
        day_button: cn(
          buttonVariants({ variant: 'ghost' }),
          'h-8 w-8 p-0 font-normal aria-selected:opacity-100'
        ),
        range_start: 'day-range-start',
        range_end: 'day-range-end',
        selected:
          'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground',
        today: 'bg-accent text-accent-foreground',
        outside:
          'text-muted-foreground aria-selected:bg-accent/50 aria-selected:text-muted-foreground',
        disabled: 'text-muted-foreground opacity-50',
        range_middle: 'aria-selected:bg-accent aria-selected:text-accent-foreground',
        hidden: 'invisible',
        ...classNames
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === 'left' ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )
      }}
      {...props}
    />
  )
}
Calendar.displayName = 'Calendar'

export { Calendar }
