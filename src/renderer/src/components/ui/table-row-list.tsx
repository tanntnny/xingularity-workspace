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

export interface TableRowListGroup {
  id: string
  label: React.ReactNode
  sortValue: TableSortValue
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
  getGroup?: (item: T) => TableRowListGroup
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
  getGroup,
  hideHeader,
  headerClassName,
  bodyClassName,
  sortState,
  onSortChange,
  className,
  ...tableProps
}: TableRowListProps<T>): React.ReactElement {
  const sortedItems = sortTableItems(items, columns, sortState)

  const groupedItems = getGroup ? groupTableItems(sortedItems, getGroup) : null

  const renderTableRow = (item: T): React.ReactNode => {
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
  }

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
        {groupedItems
          ? groupedItems.flatMap((group) => [
              <TableRow
                key={`group:${group.id}`}
                data-testid={`table-row-list-group:${group.id}`}
                className="border-0 bg-transparent"
              >
                <TableCell colSpan={columns.length} className="px-4 pb-1 pt-4">
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                    <span className="min-w-0 truncate">{group.label}</span>
                    <span className="rounded-[var(--radius-control)] bg-muted px-1.5 py-0.5 text-[11px] font-medium">
                      {group.items.length}
                    </span>
                  </div>
                </TableCell>
              </TableRow>,
              ...group.items.map(renderTableRow)
            ])
          : sortedItems.map(renderTableRow)}
      </TableBody>
    </Table>
  )
}

function groupTableItems<T>(
  items: readonly T[],
  getGroup: (item: T) => TableRowListGroup
): Array<TableRowListGroup & { items: T[] }> {
  const groups = new Map<string, TableRowListGroup & { items: T[] }>()

  for (const item of items) {
    const group = getGroup(item)
    const existing = groups.get(group.id)
    if (existing) {
      existing.items.push(item)
    } else {
      groups.set(group.id, { ...group, items: [item] })
    }
  }

  return Array.from(groups.values()).sort((left, right) => {
    const leftValue = left.sortValue
    const rightValue = right.sortValue
    if (leftValue === rightValue) return 0

    if (leftValue === undefined || leftValue === null) return 1
    if (rightValue === undefined || rightValue === null) return -1
    if (typeof leftValue === 'number' && typeof rightValue === 'number') {
      return leftValue - rightValue
    }
    return String(leftValue).localeCompare(String(rightValue), undefined, {
      numeric: true,
      sensitivity: 'base'
    })
  })
}
