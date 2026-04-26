import * as React from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'

import { cn } from '../../lib/utils'

const Table = React.forwardRef<HTMLTableElement, React.TableHTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <div className="table-no-ripple-scope relative w-full overflow-auto" data-no-ripple-scope>
      <table ref={ref} className={cn('w-full caption-bottom text-sm', className)} {...props} />
    </div>
  )
)
Table.displayName = 'Table'

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn(
      'bg-[color:color-mix(in_srgb,var(--panel-2)_24%,transparent)] [&_tr]:border-b [&_tr]:border-[var(--line)]',
      className
    )}
    {...props}
  />
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
    className={cn(
      'border-t border-[var(--line)] bg-[color:color-mix(in_srgb,var(--panel-2)_18%,transparent)] font-medium [&>tr]:last:border-b-0',
      className
    )}
    {...props}
  />
))
TableFooter.displayName = 'TableFooter'

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn(
        'border-b border-[var(--line)] bg-transparent transition-colors hover:bg-[color:color-mix(in_srgb,var(--panel-2)_16%,transparent)] data-[state=selected]:bg-[var(--accent-soft)]',
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
      'h-10 border-r border-[var(--line)] px-3 text-left align-middle text-xs font-semibold uppercase tracking-wide text-[var(--muted)] last:border-r-0 [&:has([role=checkbox])]:pr-0',
      className
    )}
    {...props}
  />
))
TableHead.displayName = 'TableHead'

type SortDirection = 'asc' | 'desc'

interface SortableTableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  isActive?: boolean
  sortDirection?: SortDirection
  onToggleSort: () => void
}

const SortableTableHead = React.forwardRef<HTMLTableCellElement, SortableTableHeadProps>(
  (
    { className, children, isActive = false, sortDirection = 'asc', onToggleSort, ...props },
    ref
  ) => {
    const ariaSort = isActive ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'
    const SortIcon = !isActive ? ArrowUpDown : sortDirection === 'asc' ? ArrowUp : ArrowDown

    return (
      <TableHead ref={ref} className={className} aria-sort={ariaSort} {...props}>
        <button
          type="button"
          className="flex w-full items-center gap-1.5 text-left transition-colors hover:text-[var(--text)]"
          onClick={onToggleSort}
        >
          <span className="min-w-0 flex-1">{children}</span>
          <SortIcon size={12} aria-hidden="true" className="shrink-0" />
        </button>
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
    className={cn(
      'border-r border-[var(--line)] px-3 py-2 align-middle text-[var(--text)] last:border-r-0 [&:has([role=checkbox])]:pr-0',
      className
    )}
    {...props}
  />
))
TableCell.displayName = 'TableCell'

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption ref={ref} className={cn('mt-4 text-sm text-[var(--muted)]', className)} {...props} />
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
