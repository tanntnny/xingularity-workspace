export type TableSortDirection = 'asc' | 'desc'

export interface TableSortState {
  columnId: string
  direction: TableSortDirection
}

export type TableSortValue = string | number | null | undefined

export interface TableSortColumn<T> {
  id: string
  sortValue?: (item: T) => TableSortValue
}

export function isMissingTableSortValue(value: TableSortValue): boolean {
  return (
    value === null ||
    value === undefined ||
    (typeof value === 'string' && value.trim() === '') ||
    (typeof value === 'number' && Number.isNaN(value))
  )
}

export function compareTableSortValues(left: TableSortValue, right: TableSortValue): number {
  const leftMissing = isMissingTableSortValue(left)
  const rightMissing = isMissingTableSortValue(right)

  if (leftMissing || rightMissing) {
    if (leftMissing && rightMissing) return 0
    return leftMissing ? 1 : -1
  }

  if (typeof left === 'number' && typeof right === 'number') {
    return left - right
  }

  return String(left).localeCompare(String(right), undefined, {
    numeric: true,
    sensitivity: 'base'
  })
}

export function sortTableItems<T>(
  items: readonly T[],
  columns: readonly TableSortColumn<T>[],
  sortState: TableSortState | null | undefined
): T[] {
  if (!sortState) return [...items]

  const sortColumn = columns.find((column) => column.id === sortState.columnId)
  if (!sortColumn?.sortValue) return [...items]

  return items
    .map((item, index) => ({ item, index, value: sortColumn.sortValue!(item) }))
    .sort((left, right) => {
      const leftMissing = isMissingTableSortValue(left.value)
      const rightMissing = isMissingTableSortValue(right.value)
      const comparison = compareTableSortValues(left.value, right.value)

      if (comparison === 0) return left.index - right.index
      if (leftMissing || rightMissing) return comparison

      return sortState.direction === 'asc' ? comparison : -comparison
    })
    .map(({ item }) => item)
}

export function getNextTableSortState(
  current: TableSortState | null | undefined,
  columnId: string,
  defaultDirection: TableSortDirection = 'asc'
): TableSortState {
  if (current?.columnId === columnId) {
    return {
      columnId,
      direction: current.direction === 'asc' ? 'desc' : 'asc'
    }
  }

  return { columnId, direction: defaultDirection }
}

export function isTableSortState(
  value: unknown,
  validColumnIds: readonly string[]
): value is TableSortState {
  if (value === null) return true
  if (typeof value !== 'object' || value === null) return false

  const candidate = value as { columnId?: unknown; direction?: unknown }
  return (
    typeof candidate.columnId === 'string' &&
    validColumnIds.includes(candidate.columnId) &&
    (candidate.direction === 'asc' || candidate.direction === 'desc')
  )
}
