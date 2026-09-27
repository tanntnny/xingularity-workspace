import { describe, expect, it } from 'vitest'
import {
  addMarkdownTableColumn,
  addMarkdownTableColumnAfter,
  addMarkdownTableColumnBefore,
  addMarkdownTableRow,
  addMarkdownTableRowAfter,
  addMarkdownTableRowBefore,
  clearMarkdownTableRange,
  findMarkdownTables,
  normalizeMarkdownTableRange,
  parseMarkdownTable,
  pasteMarkdownTableTsv,
  removeMarkdownTableColumns,
  removeMarkdownTableColumn,
  removeMarkdownTableRow,
  removeMarkdownTableRows,
  serializeMarkdownTable,
  serializeMarkdownTableRangeAsTsv,
  updateMarkdownTableCell
} from '../src/renderer/src/lib/noteMarkdownTable'

describe('source-owned Markdown tables', () => {
  const source = '| Name | Status |\n| :--- | ---: |\n| Alpha | Open |'

  it('parses and serializes a GFM table without a second document model', () => {
    const table = parseMarkdownTable(source)
    expect(table).not.toBeNull()
    expect(table?.alignments).toEqual(['left', 'right'])
    expect(serializeMarkdownTable(table!)).toBe(source)
  })

  it('exposes escaped pipes and line breaks as normal cell text', () => {
    const escaped = '| Name | Notes |\n| --- | --- |\n| Alpha | a\\|b<br>next |'
    const table = parseMarkdownTable(escaped)!
    expect(table.rows[1][1].text).toBe('a|b\nnext')
    expect(serializeMarkdownTable(table)).toBe(escaped)
  })

  it('updates cells and predictable row and column operations', () => {
    let table = parseMarkdownTable(source)!
    table = updateMarkdownTableCell(table, 1, 1, 'Done')
    table = addMarkdownTableRow(table, 1)
    table = addMarkdownTableColumn(table, 1)
    expect(table.rows).toHaveLength(3)
    expect(table.rows[0]).toHaveLength(3)
    expect(table.rows[1][1].text).toBe('Done')

    table = removeMarkdownTableRow(table, 2)
    table = removeMarkdownTableColumn(table, 2)
    expect(serializeMarkdownTable(table)).toContain('| Alpha | Done |')
  })

  it('finds table source ranges without changing surrounding whitespace', () => {
    const markdown = `Before\n\n${source}\n\nAfter`
    const [table] = findMarkdownTables(markdown)
    expect(markdown.slice(table.from, table.to)).toBe(source)
  })

  it('does not turn pipe-delimited code into a rendered table', () => {
    const markdown = '```md\n| A | B |\n| --- | --- |\n| 1 | 2 |\n```'
    expect(findMarkdownTables(markdown)).toEqual([])
  })

  it('normalizes a rectangular cell selection and copies it as TSV', () => {
    const table = parseMarkdownTable(`${source}\n| Beta | Closed |`)!
    const range = normalizeMarkdownTableRange(
      { anchor: { row: 2, column: 1 }, focus: { row: 1, column: 0 } },
      table
    )

    expect(range).toEqual({ top: 1, bottom: 2, left: 0, right: 1 })
    expect(
      serializeMarkdownTableRangeAsTsv(table, {
        anchor: { row: 2, column: 1 },
        focus: { row: 1, column: 0 }
      })
    ).toBe('Alpha\tOpen\nBeta\tClosed')
  })

  it('clears, pastes, and expands tables without changing alignments', () => {
    let table = parseMarkdownTable(source)!
    table = clearMarkdownTableRange(table, {
      anchor: { row: 1, column: 0 },
      focus: { row: 1, column: 1 }
    })
    expect(table.rows[1].map((cell) => cell.text)).toEqual(['', ''])

    table = pasteMarkdownTableTsv(table, { row: 1, column: 0 }, 'A\tB\nC\tD\nE\tF')
    expect(table.rows.map((row) => row.map((cell) => cell.text))).toEqual([
      ['Name', 'Status'],
      ['A', 'B'],
      ['C', 'D'],
      ['E', 'F']
    ])
    expect(table.alignments).toEqual(['left', 'right'])
  })

  it('keeps the header row while deleting selected body rows', () => {
    const table = parseMarkdownTable(`${source}\n| Beta | Closed |`)!
    const next = removeMarkdownTableRows(table, 1, 2)
    expect(next.rows.map((row) => row.map((cell) => cell.text))).toEqual([['Name', 'Status']])
    expect(
      removeMarkdownTableRows(table, 0, 1).rows.map((row) => row.map((cell) => cell.text))
    ).toEqual([
      ['Name', 'Status'],
      ['Beta', 'Closed']
    ])
    expect(addMarkdownTableRowBefore(table, 1).rows[1].map((cell) => cell.text)).toEqual(['', ''])
    expect(addMarkdownTableRowAfter(table, 1).rows[2].map((cell) => cell.text)).toEqual(['', ''])
  })

  it('supports directional column operations and retains one final column', () => {
    let table = parseMarkdownTable(source)!
    table = addMarkdownTableColumnBefore(table, 1)
    table = addMarkdownTableColumnAfter(table, 1)
    expect(table.rows[0]).toHaveLength(4)
    expect(table.alignments).toEqual(['left', null, null, 'right'])

    table = removeMarkdownTableColumns(table, 1, 2)
    expect(table.rows[0]).toHaveLength(2)
    table = removeMarkdownTableColumns(table, 0, 1)
    expect(table.rows[0]).toHaveLength(1)
    expect(serializeMarkdownTable(table)).toContain('| Name |')
  })
})
