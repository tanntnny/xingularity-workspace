import * as React from 'react'
import { ChevronDown, ChevronUp } from './icons'

import { cn } from '../../lib/utils'
import type { TableSortDirection } from '../../lib/tableSort'
import { getButtonTooltipLabel, TooltipButton } from './tooltip'

const Table = React.forwardRef<HTMLTableElement, React.TableHTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <div className="relative w-full overflow-auto">
      <table ref={ref} className={cn('w-full caption-bottom text-sm', className)} {...props} />
    </div>
  )
)
Table.displayName = 'Table'

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn('[&_tr]:border-b', className)} {...props} />
))
TableHeader.displayName = 'TableHeader'

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn('[&_tr:last-child]:border-0', className)} {...props} />
))
TableBody.displayName = 'TableBody'

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn('border-t bg-muted/50 font-medium [&>tr]:last:border-b-0', className)}
    {...props}
  />
))
TableFooter.displayName = 'TableFooter'

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn(
        'border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted',
        className
      )}
      {...props}
    />
  )
)
TableRow.displayName = 'TableRow'

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      'h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0',
      className
    )}
    {...props}
  />
))
TableHead.displayName = 'TableHead'

interface SortableTableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  isActive?: boolean
  sortDirection?: TableSortDirection
  onToggleSort: () => void
}

interface SortIndicatorProps {
  isActive: boolean
  direction: TableSortDirection
}

function SortIndicator({ isActive, direction }: SortIndicatorProps): React.ReactElement {
  if (!isActive) {
    return (
      <span className="relative size-3 shrink-0" aria-hidden="true">
        <ChevronUp size={12} aria-hidden="true" className="absolute left-0 top-0 -translate-y-1" />
        <ChevronDown size={12} aria-hidden="true" className="absolute left-0 top-0 translate-y-1" />
      </span>
    )
  }

  const Icon = direction === 'asc' ? ChevronUp : ChevronDown
  return <Icon size={12} aria-hidden="true" className="shrink-0" />
}

const SortableTableHead = React.forwardRef<HTMLTableCellElement, SortableTableHeadProps>(
  (
    { className, children, isActive = false, sortDirection = 'asc', onToggleSort, ...props },
    ref
  ) => {
    const ariaSort = isActive ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'

    return (
      <TableHead ref={ref} className={className} aria-sort={ariaSort} {...props}>
        <TooltipButton
          label={getButtonTooltipLabel(undefined, undefined, undefined, children) ?? 'Sort column'}
        >
          <button
            type="button"
            className="flex w-full items-center gap-1.5 rounded-[var(--radius-control)] px-1 text-left transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={onToggleSort}
          >
            <span className="min-w-0 flex-1">{children}</span>
            <SortIndicator isActive={isActive} direction={sortDirection} />
          </button>
        </TooltipButton>
      </TableHead>
    )
  }
)
SortableTableHead.displayName = 'SortableTableHead'

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn('py-2 px-4 align-center [&:has([role=checkbox])]:pr-0', className)}
    {...props}
  />
))
TableCell.displayName = 'TableCell'

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption ref={ref} className={cn('mt-4 text-sm text-muted-foreground', className)} {...props} />
))
TableCaption.displayName = 'TableCaption'

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  SortableTableHead,
  TableRow,
  TableCell,
  TableCaption
}

export type { TableSortDirection } from '../../lib/tableSort'
