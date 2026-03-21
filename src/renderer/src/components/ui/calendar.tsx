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
        months: 'relative flex flex-col gap-4 sm:flex-row',
        month: 'flex w-full flex-col gap-4',
        month_caption: 'flex h-7 items-center justify-center px-8',
        caption_label: 'select-none whitespace-nowrap text-sm font-medium',
        dropdowns: 'flex h-7 items-center justify-center gap-1.5 whitespace-nowrap',
        dropdown_root:
          'relative inline-flex items-center whitespace-nowrap rounded-md border border-[var(--border)] bg-[var(--background)] shadow-sm has-[select:focus-visible]:outline-none has-[select:focus-visible]:ring-2 has-[select:focus-visible]:ring-[var(--ring)] has-[select:focus-visible]:ring-offset-2 has-[select:focus-visible]:ring-offset-[var(--background)]',
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
        weekday: 'w-8 rounded-md text-[0.8rem] font-normal text-[var(--muted-foreground)]',
        week: 'mt-2 flex w-full',
        day: 'relative h-8 w-8 p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected].outside)]:bg-[color-mix(in_srgb,var(--accent-color)_50%,transparent)] [&:has([aria-selected])]:bg-[var(--accent-color)] [&:has([aria-selected])]:rounded-md',
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
          'text-[var(--muted-foreground)] aria-selected:bg-[color-mix(in_srgb,var(--accent-color)_50%,transparent)] aria-selected:text-[var(--muted-foreground)]',
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
