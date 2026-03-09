import * as React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { DayPicker } from 'react-day-picker'

import { cn } from '../../lib/utils'
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
        months: 'flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0',
        month: 'space-y-4',
        month_caption: 'flex justify-center pt-1 relative items-center',
        caption_label: 'text-sm font-medium',
        nav: 'space-x-1 flex items-center',
        button_previous: cn(
          buttonVariants({ variant: 'outline' }),
          'h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 absolute left-1'
        ),
        button_next: cn(
          buttonVariants({ variant: 'outline' }),
          'h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 absolute right-1'
        ),
        month_grid: 'w-full border-collapse space-y-1',
        weekdays: 'flex',
        weekday: 'text-[var(--muted-foreground)] rounded-md w-8 font-normal text-[0.8rem]',
        week: 'flex w-full mt-2',
        day: 'relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-[var(--accent-color)] [&:has([aria-selected].outside)]:bg-[var(--accent-color)]/50 [&:has([aria-selected])]:rounded-md',
        day_button: cn(
          buttonVariants({ variant: 'ghost' }),
          'h-8 w-8 p-0 font-normal aria-selected:opacity-100'
        ),
        range_start: 'day-range-start',
        range_end: 'day-range-end',
        selected:
          'bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary)] hover:text-[var(--primary-foreground)] focus:bg-[var(--primary)] focus:text-[var(--primary-foreground)]',
        today: 'bg-[var(--accent-color)] text-[var(--accent-foreground)]',
        outside:
          'text-[var(--muted-foreground)] aria-selected:bg-[var(--accent-color)]/50 aria-selected:text-[var(--muted-foreground)]',
        disabled: 'text-[var(--muted-foreground)] opacity-50',
        range_middle:
          'aria-selected:bg-[var(--accent-color)] aria-selected:text-[var(--accent-foreground)]',
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
