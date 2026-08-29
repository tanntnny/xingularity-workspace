import type { Dispatch, SetStateAction } from 'react'

import { isTableSortState, type TableSortState } from '../lib/tableSort'
import { usePersistentState } from './usePersistentState'

export function usePersistentTableSort(
  storageKey: string,
  initialSort: TableSortState | null,
  validColumnIds: readonly string[]
): [TableSortState | null, Dispatch<SetStateAction<TableSortState | null>>] {
  return usePersistentState<TableSortState | null>(storageKey, initialSort, {
    validate: (value): value is TableSortState | null => isTableSortState(value, validColumnIds)
  })
}
