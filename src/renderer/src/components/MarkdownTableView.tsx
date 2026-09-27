import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactElement
} from 'react'
import {
  IconColumnInsertLeft,
  IconColumnInsertRight,
  IconColumnRemove,
  IconCopy,
  IconCut,
  IconEraser,
  IconRowInsertBottom,
  IconRowInsertTop,
  IconRowRemove,
  IconTableOff
} from '@tabler/icons-react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger
} from './ui/context-menu'
import {
  addMarkdownTableColumnAfter,
  addMarkdownTableColumnBefore,
  addMarkdownTableRowAfter,
  addMarkdownTableRowBefore,
  clearMarkdownTableRange,
  isMarkdownTableCellInRange,
  normalizeMarkdownTableRange,
  pasteMarkdownTableTsv,
  removeMarkdownTableColumns,
  removeMarkdownTableRows,
  serializeMarkdownTableRangeAsTsv,
  type MarkdownTableCellPosition,
  type MarkdownTableModel,
  type MarkdownTableRange
} from '../lib/noteMarkdownTable'

export interface MarkdownTableViewProps {
  table: MarkdownTableModel
  onChange: (table: MarkdownTableModel) => void
  onDelete: () => void
}

type TableSelection =
  | { mode: 'cells'; range: MarkdownTableRange }
  | { mode: 'text'; cell: MarkdownTableCellPosition }
  | null

type CellElement = HTMLDivElement
type TableCellElement = HTMLTableCellElement

interface TableSelectionRectangle {
  left: number
  top: number
  width: number
  height: number
}

const EMPTY_SELECTION: TableSelection = null

function samePosition(a: MarkdownTableCellPosition, b: MarkdownTableCellPosition): boolean {
  return a.row === b.row && a.column === b.column
}

function clampPosition(
  table: MarkdownTableModel,
  position: MarkdownTableCellPosition
): MarkdownTableCellPosition {
  const row = Math.max(0, Math.min(table.rows.length - 1, position.row))
  const columnCount = Math.max(1, table.rows[row]?.length ?? table.alignments.length)
  return {
    row,
    column: Math.max(0, Math.min(columnCount - 1, position.column))
  }
}

function movePosition(
  table: MarkdownTableModel,
  position: MarkdownTableCellPosition,
  rowDelta: number,
  columnDelta: number
): MarkdownTableCellPosition {
  return clampPosition(table, {
    row: position.row + rowDelta,
    column: position.column + columnDelta
  })
}

function getCellFromPoint(x: number, y: number): Range | null {
  if (typeof document.caretRangeFromPoint === 'function') {
    return document.caretRangeFromPoint(x, y)
  }
  const position = document.caretPositionFromPoint?.(x, y)
  if (!position) return null
  const range = document.createRange()
  range.setStart(position.offsetNode, position.offset)
  range.collapse(true)
  return range
}

function placeCaretAtPoint(element: CellElement, x: number, y: number): void {
  const selection = window.getSelection()
  if (!selection) return

  const range = getCellFromPoint(x, y)
  if (range && element.contains(range.startContainer)) {
    selection.removeAllRanges()
    selection.addRange(range)
    return
  }

  const fallback = document.createRange()
  fallback.selectNodeContents(element)
  fallback.collapse(false)
  selection.removeAllRanges()
  selection.addRange(fallback)
}

function clearNativeSelection(): void {
  window.getSelection()?.removeAllRanges()
}

function writeClipboardText(value: string): void {
  const writeText = navigator.clipboard?.writeText
  if (!writeText) return
  void writeText.call(navigator.clipboard, value).catch(() => undefined)
}

function tableCellKey(position: MarkdownTableCellPosition): string {
  return `${position.row}:${position.column}`
}

export function MarkdownTableView({
  table: initialTable,
  onChange,
  onDelete
}: MarkdownTableViewProps): ReactElement {
  const [table, setTable] = useState(initialTable)
  const [selection, setSelection] = useState<TableSelection>(EMPTY_SELECTION)
  const [selectionRectangle, setSelectionRectangle] = useState<TableSelectionRectangle | null>(null)
  const [editingCell, setEditingCell] = useState<MarkdownTableCellPosition | null>(null)
  const selectionRef = useRef<TableSelection>(EMPTY_SELECTION)
  const editingCellRef = useRef<MarkdownTableCellPosition | null>(null)
  const draftRef = useRef('')
  const originalDraftRef = useRef('')
  const cellRefs = useRef(new Map<string, CellElement>())
  const tableCellRefs = useRef(new Map<string, TableCellElement>())
  const draggingRef = useRef(false)
  const tableRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setTable(initialTable)
  }, [initialTable])

  const setTableSelection = useCallback((next: TableSelection): void => {
    selectionRef.current = next
    setSelection(next)
  }, [])

  const getCell = useCallback((position: MarkdownTableCellPosition): CellElement | null => {
    return cellRefs.current.get(tableCellKey(position)) ?? null
  }, [])

  const focusCell = useCallback(
    (position: MarkdownTableCellPosition): void => {
      const next = clampPosition(table, position)
      requestAnimationFrame(() => {
        getCell(next)?.focus({ preventScroll: true })
      })
    },
    [getCell, table]
  )

  const commitTable = useCallback(
    (next: MarkdownTableModel): void => {
      setTable(next)
      onChange(next)
    },
    [onChange]
  )

  const finishEditing = useCallback(
    (save: boolean): void => {
      const currentCell = editingCellRef.current
      if (!currentCell) return
      const element = getCell(currentCell)
      const nextText = draftRef.current
      const previousText = originalDraftRef.current
      if (element) {
        element.contentEditable = 'false'
        delete element.dataset.editing
      }

      editingCellRef.current = null
      setEditingCell(null)
      if (save && nextText !== previousText) {
        commitTable({
          ...table,
          rows: table.rows.map((row, rowIndex) =>
            row.map((cell, columnIndex) =>
              rowIndex === currentCell.row && columnIndex === currentCell.column
                ? { text: nextText }
                : cell
            )
          )
        })
      } else if (!save && element) {
        element.textContent = previousText
      }
      draftRef.current = ''
      originalDraftRef.current = ''
    },
    [commitTable, getCell, table]
  )

  const startTextEditing = useCallback(
    (position: MarkdownTableCellPosition, point?: { x: number; y: number }): void => {
      const next = clampPosition(table, position)
      const text = table.rows[next.row]?.[next.column]?.text ?? ''
      const element = getCell(next)
      if (!element) return

      const nextSelection: TableSelection = { mode: 'text', cell: next }
      setTableSelection(nextSelection)
      editingCellRef.current = next
      setEditingCell(next)
      draftRef.current = text
      originalDraftRef.current = text
      element.contentEditable = 'true'
      element.dataset.editing = 'true'
      element.focus()
      if (point) placeCaretAtPoint(element, point.x, point.y)
      else {
        const nativeSelection = window.getSelection()
        const range = document.createRange()
        range.selectNodeContents(element)
        range.collapse(false)
        nativeSelection?.removeAllRanges()
        nativeSelection?.addRange(range)
      }
    },
    [getCell, setTableSelection, table]
  )

  const selectCell = useCallback(
    (position: MarkdownTableCellPosition, extend: boolean, shouldFocus = true): void => {
      if (editingCellRef.current) finishEditing(true)
      const next = clampPosition(table, position)
      const current = selectionRef.current
      const anchor = extend && current?.mode === 'cells' ? current.range.anchor : next
      clearNativeSelection()
      setTableSelection({ mode: 'cells', range: { anchor, focus: next } })
      if (shouldFocus) focusCell(next)
    },
    [finishEditing, focusCell, setTableSelection, table]
  )

  const selectCellFromContextMenu = useCallback(
    (position: MarkdownTableCellPosition): void => {
      const current = selectionRef.current
      if (
        current?.mode === 'cells' &&
        isMarkdownTableCellInRange(
          position.row,
          position.column,
          normalizeMarkdownTableRange(current.range, table)
        )
      ) {
        return
      }
      selectCell(position, false, false)
    },
    [selectCell, table]
  )

  const getCellSelection = useCallback((): MarkdownTableRange => {
    const current = selectionRef.current
    if (current?.mode === 'cells') return current.range
    if (current?.mode === 'text') return { anchor: current.cell, focus: current.cell }
    return {
      anchor: { row: Math.min(1, table.rows.length - 1), column: 0 },
      focus: { row: Math.min(1, table.rows.length - 1), column: 0 }
    }
  }, [table])

  const changeWithSelection = useCallback(
    (transform: (current: MarkdownTableModel, range: MarkdownTableRange) => MarkdownTableModel) => {
      const range = getCellSelection()
      commitTable(transform(table, range))
    },
    [commitTable, getCellSelection, table]
  )

  const handleCellKeyDown = useCallback(
    (event: KeyboardEvent<CellElement>, position: MarkdownTableCellPosition): void => {
      const isEditing = editingCellRef.current && samePosition(editingCellRef.current, position)
      if (isEditing) {
        if (event.key === 'Escape') {
          event.preventDefault()
          finishEditing(true)
        } else if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault()
          finishEditing(true)
        }
        return
      }

      const movement: Record<string, [number, number]> = {
        ArrowLeft: [0, -1],
        ArrowRight: [0, 1],
        ArrowUp: [-1, 0],
        ArrowDown: [1, 0],
        h: [0, -1],
        j: [1, 0],
        k: [-1, 0],
        l: [0, 1]
      }

      if (event.key === 'Tab') {
        event.preventDefault()
        const direction = event.shiftKey ? -1 : 1
        const columnCount = Math.max(1, table.alignments.length, table.rows[0]?.length ?? 0)
        const nextIndex = position.row * columnCount + position.column + direction
        const next = clampPosition(table, {
          row: Math.floor(nextIndex / columnCount),
          column: nextIndex % columnCount
        })
        selectCell(next, false)
        return
      }

      const delta = movement[event.key]
      if (delta) {
        event.preventDefault()
        const next = movePosition(table, position, delta[0], delta[1])
        selectCell(next, event.shiftKey)
        return
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        changeWithSelection(clearMarkdownTableRange)
        return
      }

      if (event.key === 'Enter' || event.key === 'i') {
        event.preventDefault()
        startTextEditing(position)
      }
    },
    [changeWithSelection, finishEditing, selectCell, startTextEditing, table]
  )

  const handleCellPointerDown = useCallback(
    (event: ReactPointerEvent<CellElement>, position: MarkdownTableCellPosition): void => {
      if (event.button !== 0) return
      if (editingCellRef.current && !samePosition(editingCellRef.current, position)) {
        finishEditing(true)
      }
      if (editingCellRef.current) return
      event.preventDefault()
      draggingRef.current = true
      selectCell(position, event.shiftKey)
    },
    [finishEditing, selectCell]
  )

  useEffect(() => {
    const stopDragging = (): void => {
      draggingRef.current = false
    }
    window.addEventListener('pointerup', stopDragging)
    window.addEventListener('pointercancel', stopDragging)
    return () => {
      window.removeEventListener('pointerup', stopDragging)
      window.removeEventListener('pointercancel', stopDragging)
    }
  }, [])

  const handleCellPointerEnter = useCallback(
    (position: MarkdownTableCellPosition): void => {
      if (!draggingRef.current || editingCellRef.current) return
      const current = selectionRef.current
      if (current?.mode !== 'cells') return
      clearNativeSelection()
      setTableSelection({ mode: 'cells', range: { anchor: current.range.anchor, focus: position } })
    },
    [setTableSelection]
  )

  const handleCopy = useCallback(
    (event: ClipboardEvent<HTMLDivElement>): void => {
      const current = selectionRef.current
      if (current?.mode !== 'cells' || !event.clipboardData) return
      event.preventDefault()
      event.clipboardData.setData(
        'text/plain',
        serializeMarkdownTableRangeAsTsv(table, current.range)
      )
    },
    [table]
  )

  const handleCut = useCallback(
    (event: ClipboardEvent<HTMLDivElement>): void => {
      const current = selectionRef.current
      if (current?.mode !== 'cells' || !event.clipboardData) return
      event.preventDefault()
      event.clipboardData.setData(
        'text/plain',
        serializeMarkdownTableRangeAsTsv(table, current.range)
      )
      commitTable(clearMarkdownTableRange(table, current.range))
    },
    [commitTable, table]
  )

  const handlePaste = useCallback(
    (event: ClipboardEvent<HTMLDivElement>): void => {
      const current = selectionRef.current
      if (current?.mode !== 'cells') return
      const value = event.clipboardData?.getData('text/plain')
      if (!value) return
      event.preventDefault()
      commitTable(pasteMarkdownTableTsv(table, current.range.anchor, value))
    },
    [commitTable, table]
  )

  const handleContextMenu = useCallback(
    (position: MarkdownTableCellPosition): void => {
      selectCellFromContextMenu(position)
    },
    [selectCellFromContextMenu]
  )

  const bounds = useMemo(() => {
    const current = selection
    return normalizeMarkdownTableRange(
      current?.mode === 'cells'
        ? current.range
        : current?.mode === 'text'
          ? { anchor: current.cell, focus: current.cell }
          : { anchor: { row: 1, column: 0 }, focus: { row: 1, column: 0 } },
      table
    )
  }, [selection, table])
  const columnCount = Math.max(1, table.alignments.length, table.rows[0]?.length ?? 0)
  const canDeleteRows = bounds.top > 0 && bounds.bottom > 0 && table.rows.length > 1
  const canDeleteColumns = columnCount > 1

  const updateSelectionRectangle = useCallback((): void => {
    if (selection?.mode !== 'cells') {
      setSelectionRectangle((current) => (current === null ? current : null))
      return
    }

    const surface = tableRef.current
    const firstCell = tableCellRefs.current.get(
      tableCellKey({ row: bounds.top, column: bounds.left })
    )
    const lastCell = tableCellRefs.current.get(
      tableCellKey({ row: bounds.bottom, column: bounds.right })
    )
    if (!surface || !firstCell || !lastCell) return

    const surfaceRect = surface.getBoundingClientRect()
    const firstRect = firstCell.getBoundingClientRect()
    const lastRect = lastCell.getBoundingClientRect()
    const next: TableSelectionRectangle = {
      left: firstRect.left - surfaceRect.left + surface.scrollLeft,
      top: firstRect.top - surfaceRect.top + surface.scrollTop,
      width: lastRect.right - firstRect.left,
      height: lastRect.bottom - firstRect.top
    }

    setSelectionRectangle((current) => {
      if (
        current &&
        Math.abs(current.left - next.left) < 0.25 &&
        Math.abs(current.top - next.top) < 0.25 &&
        Math.abs(current.width - next.width) < 0.25 &&
        Math.abs(current.height - next.height) < 0.25
      ) {
        return current
      }
      return next
    })
  }, [bounds, selection])

  useLayoutEffect(() => {
    updateSelectionRectangle()
    const surface = tableRef.current
    if (!surface) return

    const handleResize = (): void => updateSelectionRectangle()
    window.addEventListener('resize', handleResize)
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(handleResize) : null
    observer?.observe(surface)

    return () => {
      window.removeEventListener('resize', handleResize)
      observer?.disconnect()
    }
  }, [updateSelectionRectangle])

  const runMenuAction = useCallback(
    (action: string): void => {
      const currentRange = getCellSelection()
      switch (action) {
        case 'copy': {
          const value = serializeMarkdownTableRangeAsTsv(table, currentRange)
          writeClipboardText(value)
          return
        }
        case 'cut':
          writeClipboardText(serializeMarkdownTableRangeAsTsv(table, currentRange))
          commitTable(clearMarkdownTableRange(table, currentRange))
          return
        case 'clear':
          commitTable(clearMarkdownTableRange(table, currentRange))
          return
        case 'add-row-before':
          if (bounds.top > 0) commitTable(addMarkdownTableRowBefore(table, bounds.top))
          return
        case 'add-row-after':
          commitTable(addMarkdownTableRowAfter(table, bounds.bottom))
          return
        case 'delete-rows':
          if (canDeleteRows) commitTable(removeMarkdownTableRows(table, bounds.top, bounds.bottom))
          return
        case 'add-column-before':
          commitTable(addMarkdownTableColumnBefore(table, bounds.left))
          return
        case 'add-column-after':
          commitTable(addMarkdownTableColumnAfter(table, bounds.right))
          return
        case 'delete-columns':
          if (canDeleteColumns) {
            commitTable(removeMarkdownTableColumns(table, bounds.left, bounds.right))
          }
          return
        case 'remove-table':
          onDelete()
          return
      }
    },
    [bounds, canDeleteColumns, canDeleteRows, commitTable, getCellSelection, onDelete, table]
  )

  const renderMenuItem = (
    action: string,
    label: string,
    icon: ReactElement,
    disabled = false,
    shortcut?: string,
    destructive = false
  ): ReactElement => (
    <ContextMenuItem
      key={action}
      disabled={disabled}
      destructive={destructive}
      data-testid={`note-live-table-menu-${action}`}
      onSelect={() => runMenuAction(action)}
    >
      {icon}
      {label}
      {shortcut ? <ContextMenuShortcut>{shortcut}</ContextMenuShortcut> : null}
    </ContextMenuItem>
  )

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={tableRef}
          className="note-live-table-surface"
          data-selection-mode={selection?.mode === 'text' ? 'text' : 'cell'}
          onCopy={handleCopy}
          onCut={handleCut}
          onPaste={handlePaste}
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) clearNativeSelection()
          }}
        >
          <table aria-label="Markdown table" aria-multiselectable="true" role="grid">
            <tbody>
              {table.rows.map((row, rowIndex) => (
                <tr key={`row-${rowIndex}`} role="row">
                  {row.map((cell, columnIndex) => {
                    const position = { row: rowIndex, column: columnIndex }
                    const current = selection
                    const selected =
                      current?.mode === 'cells' &&
                      isMarkdownTableCellInRange(rowIndex, columnIndex, bounds)
                    const editing = editingCell !== null && samePosition(editingCell, position)
                    const CellTag = rowIndex === 0 ? 'th' : 'td'
                    return (
                      <CellTag
                        key={tableCellKey(position)}
                        ref={(element) => {
                          const key = tableCellKey(position)
                          if (element) tableCellRefs.current.set(key, element)
                          else tableCellRefs.current.delete(key)
                        }}
                        style={
                          table.alignments[columnIndex]
                            ? { textAlign: table.alignments[columnIndex]! }
                            : undefined
                        }
                        aria-selected={selected}
                      >
                        <div
                          ref={(element) => {
                            const key = tableCellKey(position)
                            if (element) cellRefs.current.set(key, element)
                            else cellRefs.current.delete(key)
                          }}
                          className="note-live-table-cell"
                          data-table-row={rowIndex}
                          data-table-column={columnIndex}
                          data-selected={selected ? 'true' : 'false'}
                          data-editing={editing ? 'true' : 'false'}
                          role="gridcell"
                          aria-label={`Row ${rowIndex + 1}, column ${columnIndex + 1}`}
                          tabIndex={selected || selection === null ? 0 : -1}
                          contentEditable={editing}
                          suppressContentEditableWarning
                          onFocus={() => {
                            if (!selectionRef.current && !editingCellRef.current) {
                              selectCell(position, false)
                            }
                          }}
                          onPointerDown={(event) => handleCellPointerDown(event, position)}
                          onPointerEnter={() => handleCellPointerEnter(position)}
                          onDoubleClick={(event) => {
                            event.preventDefault()
                            startTextEditing(position, { x: event.clientX, y: event.clientY })
                          }}
                          onContextMenu={() => handleContextMenu(position)}
                          onKeyDown={(event) => handleCellKeyDown(event, position)}
                          onInput={(event) => {
                            if (!editing) return
                            const value = event.currentTarget.textContent ?? ''
                            draftRef.current = value
                          }}
                          onBlur={() => {
                            if (
                              editingCellRef.current &&
                              samePosition(editingCellRef.current, position)
                            ) {
                              finishEditing(true)
                            }
                          }}
                        >
                          {cell.text}
                        </div>
                      </CellTag>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {selection?.mode === 'cells' && selectionRectangle ? (
            <div
              aria-hidden="true"
              className="note-live-table-selection-rectangle"
              data-testid="note-live-table-selection-rectangle"
              style={selectionRectangle}
            />
          ) : null}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent data-testid="note-live-table-context-menu">
        {renderMenuItem('copy', 'Copy', <IconCopy aria-hidden="true" />, false, '⌘C')}
        {renderMenuItem('cut', 'Cut', <IconCut aria-hidden="true" />, false, '⌘X')}
        {renderMenuItem('clear', 'Clear contents', <IconEraser aria-hidden="true" />, false, 'Del')}
        <ContextMenuSeparator />
        {renderMenuItem(
          'add-row-before',
          'Add row above',
          <IconRowInsertTop aria-hidden="true" />,
          bounds.top === 0
        )}
        {renderMenuItem(
          'add-row-after',
          'Add row below',
          <IconRowInsertBottom aria-hidden="true" />
        )}
        {renderMenuItem(
          'delete-rows',
          'Delete selected rows',
          <IconRowRemove aria-hidden="true" />,
          !canDeleteRows,
          undefined,
          true
        )}
        <ContextMenuSeparator />
        {renderMenuItem(
          'add-column-before',
          'Add column left',
          <IconColumnInsertLeft aria-hidden="true" />
        )}
        {renderMenuItem(
          'add-column-after',
          'Add column right',
          <IconColumnInsertRight aria-hidden="true" />
        )}
        {renderMenuItem(
          'delete-columns',
          'Delete selected columns',
          <IconColumnRemove aria-hidden="true" />,
          !canDeleteColumns,
          undefined,
          true
        )}
        <ContextMenuSeparator />
        {renderMenuItem(
          'remove-table',
          'Remove table',
          <IconTableOff aria-hidden="true" />,
          false,
          undefined,
          true
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}
