export type MarkdownTableAlignment = 'left' | 'center' | 'right' | null

export interface MarkdownTableCell {
  text: string
}

export interface MarkdownTableModel {
  from: number
  to: number
  rows: MarkdownTableCell[][]
  alignments: MarkdownTableAlignment[]
}

export interface MarkdownTableCellPosition {
  row: number
  column: number
}

export interface MarkdownTableRange {
  anchor: MarkdownTableCellPosition
  focus: MarkdownTableCellPosition
}

export interface MarkdownTableRangeBounds {
  top: number
  bottom: number
  left: number
  right: number
}

function splitTableRow(line: string): string[] {
  const trimmed = line.trim()
  const body = trimmed.startsWith('|') ? trimmed.slice(1) : trimmed
  const content = body.endsWith('|') ? body.slice(0, -1) : body
  const cells: string[] = []
  let current = ''
  let escaped = false

  for (const character of content) {
    if (escaped) {
      current += character
      escaped = false
      continue
    }

    if (character === '\\') {
      current += character
      escaped = true
      continue
    }

    if (character === '|') {
      cells.push(current.trim())
      current = ''
      continue
    }

    current += character
  }

  cells.push(current.trim())
  return cells
}

function isDelimiterCell(cell: string): boolean {
  return /^:?-{3,}:?$/.test(cell.trim())
}

function parseAlignment(cell: string): MarkdownTableAlignment {
  const value = cell.trim()
  if (value.startsWith(':') && value.endsWith(':')) return 'center'
  if (value.endsWith(':')) return 'right'
  if (value.startsWith(':')) return 'left'
  return null
}

function escapeCell(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>')
}

function unescapeCell(text: string): string {
  return text.replace(/\\([\\|])/g, '$1').replace(/<br\s*\/?>/gi, '\n')
}

function tableColumnCount(table: MarkdownTableModel): number {
  return Math.max(1, table.alignments.length, ...table.rows.map((row) => row.length))
}

export function parseMarkdownTable(source: string, from = 0): MarkdownTableModel | null {
  const lines = source.split('\n')
  if (lines.length < 2) return null

  const header = splitTableRow(lines[0])
  const delimiter = splitTableRow(lines[1])
  if (
    header.length === 0 ||
    delimiter.length !== header.length ||
    !delimiter.every(isDelimiterCell)
  ) {
    return null
  }

  const columnCount = header.length
  const rows = [header, ...lines.slice(2).map(splitTableRow)].map((row) =>
    Array.from({ length: columnCount }, (_, index) => ({
      text: unescapeCell(row[index] ?? '')
    }))
  )

  return {
    from,
    to: from + source.length,
    rows,
    alignments: delimiter.map(parseAlignment)
  }
}

export function serializeMarkdownTable(table: MarkdownTableModel): string {
  const columnCount = tableColumnCount(table)
  const rows = table.rows.length > 0 ? table.rows : [[]]
  const renderRow = (cells: readonly MarkdownTableCell[]): string =>
    `| ${Array.from({ length: columnCount }, (_, index) => escapeCell(cells[index]?.text ?? '')).join(' | ')} |`
  const delimiter = Array.from({ length: columnCount }, (_, index) => {
    const alignment = table.alignments[index]
    if (alignment === 'center') return ':---:'
    if (alignment === 'right') return '---:'
    if (alignment === 'left') return ':---'
    return '---'
  })

  return [renderRow(rows[0]), `| ${delimiter.join(' | ')} |`, ...rows.slice(1).map(renderRow)].join(
    '\n'
  )
}

export function normalizeMarkdownTableRange(
  range: MarkdownTableRange,
  table: MarkdownTableModel
): MarkdownTableRangeBounds {
  const rowCount = Math.max(1, table.rows.length)
  const columnCount = tableColumnCount(table)
  const anchorRow = Math.max(0, Math.min(rowCount - 1, range.anchor.row))
  const focusRow = Math.max(0, Math.min(rowCount - 1, range.focus.row))
  const anchorColumn = Math.max(0, Math.min(columnCount - 1, range.anchor.column))
  const focusColumn = Math.max(0, Math.min(columnCount - 1, range.focus.column))

  return {
    top: Math.min(anchorRow, focusRow),
    bottom: Math.max(anchorRow, focusRow),
    left: Math.min(anchorColumn, focusColumn),
    right: Math.max(anchorColumn, focusColumn)
  }
}

export function isMarkdownTableCellInRange(
  row: number,
  column: number,
  range: MarkdownTableRangeBounds
): boolean {
  return row >= range.top && row <= range.bottom && column >= range.left && column <= range.right
}

export function serializeMarkdownTableRangeAsTsv(
  table: MarkdownTableModel,
  selection: MarkdownTableRange
): string {
  const range = normalizeMarkdownTableRange(selection, table)
  return Array.from({ length: range.bottom - range.top + 1 }, (_, rowOffset) => {
    const row = table.rows[range.top + rowOffset] ?? []
    return Array.from({ length: range.right - range.left + 1 }, (_, columnOffset) => {
      return row[range.left + columnOffset]?.text ?? ''
    }).join('\t')
  }).join('\n')
}

export function parseMarkdownTableTsv(value: string): string[][] {
  const normalized = value.replace(/\r\n?/g, '\n')
  if (normalized.length === 0) return [['']]

  const lines = normalized.split('\n')
  if (lines.length > 1 && lines.at(-1) === '') lines.pop()
  return lines.map((line) => line.split('\t'))
}

export function clearMarkdownTableRange(
  table: MarkdownTableModel,
  selection: MarkdownTableRange
): MarkdownTableModel {
  const range = normalizeMarkdownTableRange(selection, table)
  return {
    ...table,
    rows: table.rows.map((row, rowIndex) =>
      row.map((cell, columnIndex) =>
        isMarkdownTableCellInRange(rowIndex, columnIndex, range) ? { text: '' } : cell
      )
    )
  }
}

function createEmptyMarkdownTableRow(columnCount: number): MarkdownTableCell[] {
  return Array.from({ length: columnCount }, () => ({ text: '' }))
}

function ensureMarkdownTableDimensions(
  table: MarkdownTableModel,
  rowCount: number,
  columnCount: number
): MarkdownTableModel {
  const nextColumnCount = Math.max(1, columnCount)
  const nextRows = table.rows.map((row) => [
    ...row,
    ...createEmptyMarkdownTableRow(Math.max(0, nextColumnCount - row.length))
  ])
  while (nextRows.length < Math.max(1, rowCount)) {
    nextRows.push(createEmptyMarkdownTableRow(nextColumnCount))
  }

  return {
    ...table,
    rows: nextRows,
    alignments: [
      ...Array.from({ length: nextColumnCount }, (_, index) => table.alignments[index] ?? null)
    ]
  }
}

export function pasteMarkdownTableTsv(
  table: MarkdownTableModel,
  anchor: MarkdownTableCellPosition,
  value: string
): MarkdownTableModel {
  const matrix = parseMarkdownTableTsv(value)
  const matrixColumnCount = Math.max(1, ...matrix.map((row) => row.length))
  const row = Math.max(0, anchor.row)
  const column = Math.max(0, anchor.column)
  const next = ensureMarkdownTableDimensions(table, row + matrix.length, column + matrixColumnCount)

  return {
    ...next,
    rows: next.rows.map((currentRow, rowIndex) => {
      const pastedRow = matrix[rowIndex - row]
      if (!pastedRow) return currentRow
      return currentRow.map((cell, columnIndex) => {
        const pastedValue = pastedRow[columnIndex - column]
        return pastedValue === undefined ? cell : { text: pastedValue }
      })
    })
  }
}

export function updateMarkdownTableCell(
  table: MarkdownTableModel,
  rowIndex: number,
  columnIndex: number,
  text: string
): MarkdownTableModel {
  return {
    ...table,
    rows: table.rows.map((row, currentRow) =>
      row.map((cell, currentColumn) =>
        currentRow === rowIndex && currentColumn === columnIndex ? { text } : cell
      )
    )
  }
}

export function addMarkdownTableRow(
  table: MarkdownTableModel,
  afterRowIndex: number
): MarkdownTableModel {
  return addMarkdownTableRowAfter(table, afterRowIndex)
}

export function addMarkdownTableRowBefore(
  table: MarkdownTableModel,
  rowIndex: number
): MarkdownTableModel {
  const columnCount = tableColumnCount(table)
  const nextRows = [...table.rows]
  nextRows.splice(
    Math.min(nextRows.length, Math.max(1, rowIndex)),
    0,
    createEmptyMarkdownTableRow(columnCount)
  )
  return { ...table, rows: nextRows }
}

export function addMarkdownTableRowAfter(
  table: MarkdownTableModel,
  rowIndex: number
): MarkdownTableModel {
  return addMarkdownTableRowBefore(table, rowIndex + 1)
}

export function removeMarkdownTableRow(
  table: MarkdownTableModel,
  rowIndex: number
): MarkdownTableModel {
  return removeMarkdownTableRows(table, rowIndex, rowIndex)
}

export function removeMarkdownTableRows(
  table: MarkdownTableModel,
  firstRow: number,
  lastRow: number
): MarkdownTableModel {
  const start = Math.max(1, Math.min(table.rows.length, firstRow))
  const end = Math.max(start - 1, Math.min(table.rows.length - 1, lastRow))
  if (start > end) return table
  return {
    ...table,
    rows: table.rows.filter((_, index) => index < start || index > end)
  }
}

export function addMarkdownTableColumn(
  table: MarkdownTableModel,
  afterColumnIndex: number
): MarkdownTableModel {
  return addMarkdownTableColumnAfter(table, afterColumnIndex)
}

export function addMarkdownTableColumnBefore(
  table: MarkdownTableModel,
  columnIndex: number
): MarkdownTableModel {
  const normalized = ensureMarkdownTableDimensions(
    table,
    Math.max(1, table.rows.length),
    tableColumnCount(table)
  )
  const insertAt = Math.min(normalized.alignments.length, Math.max(0, columnIndex))
  return {
    ...normalized,
    alignments: normalized.alignments.toSpliced(insertAt, 0, null),
    rows: normalized.rows.map((row) => row.toSpliced(insertAt, 0, { text: '' }))
  }
}

export function addMarkdownTableColumnAfter(
  table: MarkdownTableModel,
  columnIndex: number
): MarkdownTableModel {
  return addMarkdownTableColumnBefore(table, columnIndex + 1)
}

export function removeMarkdownTableColumn(
  table: MarkdownTableModel,
  columnIndex: number
): MarkdownTableModel {
  return removeMarkdownTableColumns(table, columnIndex, columnIndex)
}

export function removeMarkdownTableColumns(
  table: MarkdownTableModel,
  firstColumn: number,
  lastColumn: number
): MarkdownTableModel {
  const normalized = ensureMarkdownTableDimensions(
    table,
    Math.max(1, table.rows.length),
    tableColumnCount(table)
  )
  const columnCount = normalized.alignments.length
  if (columnCount <= 1) return table

  const start = Math.max(0, Math.min(columnCount - 1, firstColumn))
  const end = Math.max(start, Math.min(columnCount - 1, lastColumn))
  const selectedCount = end - start + 1
  const keepLastColumn = selectedCount === columnCount
  const shouldKeep = (index: number): boolean => keepLastColumn && index === start
  const shouldRemove = (index: number): boolean =>
    index >= start && index <= end && !shouldKeep(index)

  return {
    ...normalized,
    alignments: normalized.alignments.filter((_, index) => !shouldRemove(index)),
    rows: normalized.rows.map((row) => row.filter((_, index) => !shouldRemove(index)))
  }
}

export function findMarkdownTables(markdown: string): MarkdownTableModel[] {
  const lines = markdown.split('\n')
  const starts: number[] = []
  let offset = 0
  for (const line of lines) {
    starts.push(offset)
    offset += line.length + 1
  }

  const tables: MarkdownTableModel[] = []
  let inFence = false
  for (let index = 0; index < lines.length - 1; index += 1) {
    if (/^\s*(```+|~~~+)/.test(lines[index])) {
      inFence = !inFence
      continue
    }
    if (inFence) continue

    const header = splitTableRow(lines[index])
    const delimiter = splitTableRow(lines[index + 1])
    if (
      header.length === 0 ||
      delimiter.length !== header.length ||
      !delimiter.every(isDelimiterCell)
    ) {
      continue
    }

    let endIndex = index + 2
    while (endIndex < lines.length && lines[endIndex].includes('|') && lines[endIndex].trim()) {
      endIndex += 1
    }

    const from = starts[index]
    const to = starts[endIndex - 1] + lines[endIndex - 1].length
    const table = parseMarkdownTable(markdown.slice(from, to), from)
    if (table) tables.push(table)
    index = endIndex - 1
  }

  return tables
}
