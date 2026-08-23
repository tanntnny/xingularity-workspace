import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  TableRowList,
  type TableRowListColumn
} from '../src/renderer/src/components/ui/table-row-list'

type TableItem = {
  id: string
  name: string
  state: 'active' | 'selected'
}

const columns: readonly TableRowListColumn<TableItem>[] = [
  {
    id: 'name',
    header: 'Name',
    cellClassName: 'min-w-56',
    renderCell: (item) => item.name
  },
  {
    id: 'state',
    header: 'State',
    cellClassName: (item) => (item.state === 'selected' ? 'font-semibold' : undefined),
    renderCell: (item) => item.state
  }
]

describe('TableRowList', () => {
  it('renders typed headers, cells, and shared table surfaces', () => {
    const markup = renderToStaticMarkup(
      createElement(TableRowList<TableItem>, {
        items: [{ id: 'item-1', name: 'Alpha', state: 'active' }],
        columns,
        getRowKey: (item) => item.id,
        'aria-label': 'Example items',
        'data-testid': 'example-table'
      })
    )

    expect(markup).toContain('aria-label="Example items"')
    expect(markup).toContain('data-testid="example-table"')
    expect(markup).toContain('border-separate border-spacing-y-1')
    expect(markup).toContain('[&amp;_tr]:border-0')
    expect(markup).toContain('<th')
    expect(markup).toContain('>Name</th>')
    expect(markup).toContain('>State</th>')
    expect(markup).toContain('>Alpha</td>')
    expect(markup).toContain('rounded-l-xl')
    expect(markup).toContain('rounded-r-xl')
    expect(markup).toContain('align-middle')
    expect(markup).toContain('bg-inherit')
    expect(markup).toContain('bg-transparent')
    expect(markup).toContain('hover:bg-muted')
    expect(markup).not.toContain('bg-card')
  })

  it('preserves feature row attributes and selected state', () => {
    const markup = renderToStaticMarkup(
      createElement(TableRowList<TableItem>, {
        items: [{ id: 'item-1', name: 'Alpha', state: 'selected' }],
        columns,
        getRowKey: (item) => item.id,
        getRowProps: (item) => ({
          'data-testid': `row:${item.id}`,
          'data-state': item.state === 'selected' ? 'selected' : undefined,
          onClick: () => undefined
        })
      })
    )

    expect(markup).toContain('data-testid="row:item-1"')
    expect(markup).toContain('data-state="selected"')
    expect(markup).toContain('cursor-pointer')
    expect(markup).toContain('data-[state=selected]:bg-muted')
    expect(markup).toContain('font-semibold')
  })
})
