import * as React from 'react'

import { cn } from '../../lib/utils'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table'

export interface TableRowListColumn<T> {
  id: string
  header: React.ReactNode
  headerClassName?: string
  cellClassName?: string | ((item: T) => string | undefined)
  renderCell: (item: T) => React.ReactNode
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
  headerClassName?: string
  bodyClassName?: string
  'data-testid'?: string
}

const tableRowListRowClass =
  'rounded-xl border-0 bg-transparent hover:bg-muted data-[state=selected]:bg-muted'

export function TableRowList<T>({
  items,
  columns,
  getRowKey,
  getRowProps,
  headerClassName,
  bodyClassName,
  className,
  ...tableProps
}: TableRowListProps<T>): React.ReactElement {
  return (
    <Table {...tableProps} className={cn('border-separate border-spacing-y-1', className)}>
      <TableHeader className={cn('[&_tr]:border-0', headerClassName)}>
        <TableRow>
          {columns.map((column) => (
            <TableHead key={column.id} className={column.headerClassName}>
              {column.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody className={cn('[&_tr]:border-0', bodyClassName)}>
        {items.map((item) => {
          const rowProps = getRowProps?.(item)
          const { className: rowClassName, ...restRowProps } = rowProps ?? {}

          return (
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
        })}
      </TableBody>
    </Table>
  )
}
