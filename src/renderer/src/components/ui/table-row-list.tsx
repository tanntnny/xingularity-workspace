import * as React from 'react'

import { cn } from '../../lib/utils'
import {
  getNextTableSortState,
  sortTableItems,
  type TableSortDirection,
  type TableSortState,
  type TableSortValue
} from '../../lib/tableSort'
import {
  SortableTableHead,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from './table'

export interface TableRowListColumn<T> {
  id: string
  header: React.ReactNode
  headerClassName?: string
  cellClassName?: string | ((item: T) => string | undefined)
  renderCell: (item: T) => React.ReactNode
  sortValue?: (item: T) => TableSortValue
  sortDefaultDirection?: TableSortDirection
}

type TableRowListRowProps = Omit<React.HTMLAttributes<HTMLTableRowElement>, 'children'> & {
  [key: `data-${string}`]: string | undefined
}

export interface TableRowListProps<T> extends Omit<
  React.TableHTMLAttributes<HTMLTableElement>,
  'children'
> {
  items: readonly T[]
  columns: readonly TableRowListColumn<T>[]
  getRowKey: (item: T) => React.Key
  getRowProps?: (item: T) => TableRowListRowProps
  rowWrapper?: (item: T, row: React.ReactElement) => React.ReactNode
  hideHeader?: boolean
  headerClassName?: string
  bodyClassName?: string
  sortState?: TableSortState | null
  onSortChange?: (sortState: TableSortState) => void
  'data-testid'?: string
}

const tableRowListRowClass =
  'rounded-xl border-0 bg-transparent hover:bg-muted data-[state=selected]:bg-muted'

export function TableRowList<T>({
  items,
  columns,
  getRowKey,
  getRowProps,
  rowWrapper,
  hideHeader,
  headerClassName,
  bodyClassName,
  sortState,
  onSortChange,
  className,
  ...tableProps
}: TableRowListProps<T>): React.ReactElement {
  const sortedItems = sortTableItems(items, columns, sortState)

  return (
    <Table {...tableProps} className={cn('border-separate border-spacing-y-1', className)}>
      {!hideHeader ? (
        <TableHeader className={cn('[&_tr]:border-0', headerClassName)}>
          <TableRow>
            {columns.map((column) => {
              const isSortable = Boolean(column.sortValue && onSortChange)
              const isActive = sortState?.columnId === column.id

              return isSortable ? (
                <SortableTableHead
                  key={column.id}
                  className={column.headerClassName}
                  isActive={isActive}
                  sortDirection={sortState?.direction}
                  onToggleSort={() => {
                    onSortChange?.(
                      getNextTableSortState(
                        sortState,
                        column.id,
                        column.sortDefaultDirection ?? 'asc'
                      )
                    )
                  }}
                >
                  {column.header}
                </SortableTableHead>
              ) : (
                <TableHead key={column.id} className={column.headerClassName}>
                  {column.header}
                </TableHead>
              )
            })}
          </TableRow>
        </TableHeader>
      ) : null}
      <TableBody className={cn('[&_tr]:border-0', bodyClassName)}>
        {sortedItems.map((item) => {
          const rowProps = getRowProps?.(item)
          const { className: rowClassName, ...restRowProps } = rowProps ?? {}

          const row = (
            <TableRow
              key={getRowKey(item)}
              {...restRowProps}
              className={cn(
                typeof rowProps?.onClick === 'function' && 'cursor-pointer',
                tableRowListRowClass,
                rowClassName
              )}
            >
              {columns.map((column, columnIndex) => (
                <TableCell
                  key={column.id}
                  className={cn(
                    columnIndex === 0 && 'rounded-l-xl',
                    columnIndex === columns.length - 1 && 'rounded-r-xl',
                    'bg-inherit align-middle',
                    typeof column.cellClassName === 'function'
                      ? column.cellClassName(item)
                      : column.cellClassName
                  )}
                >
                  {column.renderCell(item)}
                </TableCell>
              ))}
            </TableRow>
          )

          return rowWrapper ? rowWrapper(item, row) : row
        })}
      </TableBody>
    </Table>
  )
}
