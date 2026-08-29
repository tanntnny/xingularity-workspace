import { describe, expect, it } from 'vitest'
import {
  compareTableSortValues,
  getNextTableSortState,
  isTableSortState,
  sortTableItems,
  type TableSortState
} from '../src/renderer/src/lib/tableSort'

describe('table sorting', () => {
  it('sorts values numerically and keeps missing values at the bottom', () => {
    const items = [
      { id: 'missing', value: null },
      { id: 'ten', value: 10 },
      { id: 'two', value: 2 },
      { id: 'also-missing', value: undefined }
    ]
    const columns = [{ id: 'value', sortValue: (item: (typeof items)[number]) => item.value }]

    expect(sortTableItems(items, columns, { columnId: 'value', direction: 'asc' })).toEqual([
      items[2],
      items[1],
      items[0],
      items[3]
    ])
    expect(sortTableItems(items, columns, { columnId: 'value', direction: 'desc' })).toEqual([
      items[1],
      items[2],
      items[0],
      items[3]
    ])
  })

  it('keeps equal values stable and returns a copy without an active sort', () => {
    const items = [
      { id: 'first', value: 'same' },
      { id: 'second', value: 'same' }
    ]
    const columns = [{ id: 'value', sortValue: (item: (typeof items)[number]) => item.value }]

    expect(sortTableItems(items, columns, null)).toEqual(items)
    expect(sortTableItems(items, columns, { columnId: 'value', direction: 'desc' })).toEqual(items)
    expect(sortTableItems(items, columns, { columnId: 'other', direction: 'asc' })).toEqual(items)
  })

  it('starts a new column with its configured direction and toggles the active column', () => {
    expect(getNextTableSortState(null, 'updated', 'desc')).toEqual({
      columnId: 'updated',
      direction: 'desc'
    })
    expect(getNextTableSortState({ columnId: 'updated', direction: 'desc' }, 'updated')).toEqual({
      columnId: 'updated',
      direction: 'asc'
    })
    expect(
      getNextTableSortState({ columnId: 'updated', direction: 'asc' }, 'name', 'desc')
    ).toEqual({ columnId: 'name', direction: 'desc' })
  })

  it('validates persisted sort state against the current table columns', () => {
    const validState: TableSortState = { columnId: 'name', direction: 'asc' }

    expect(isTableSortState(null, ['name'])).toBe(true)
    expect(isTableSortState(validState, ['name'])).toBe(true)
    expect(isTableSortState({ columnId: 'missing', direction: 'asc' }, ['name'])).toBe(false)
    expect(isTableSortState({ columnId: 'name', direction: 'sideways' }, ['name'])).toBe(false)
    expect(isTableSortState(undefined, ['name'])).toBe(false)
  })

  it('compares missing values after populated values', () => {
    expect(compareTableSortValues(null, 'value')).toBeGreaterThan(0)
    expect(compareTableSortValues('value', undefined)).toBeLessThan(0)
  })
})
