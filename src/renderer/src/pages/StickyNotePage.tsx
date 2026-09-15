import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import {
  applyNodeChanges,
  Background,
  BackgroundVariant,
  NodeResizer,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useReactFlow,
  type Node,
  type NodeChange,
  type NodeProps,
  type NodeTypes,
  type ResizeParams,
  type Viewport
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Maximize, Palette, Plus, RefreshCw, Trash2 } from '../components/ui/icons'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  WorkspaceIconButton
} from '../components/ui'
import {
  STICKY_NOTE_COLORS,
  STICKY_NOTE_FONT_SIZE,
  STICKY_NOTE_FONT_WEIGHT,
  STICKY_NOTE_MAX_SIZE,
  STICKY_NOTE_MIN_HEIGHT,
  STICKY_NOTE_MIN_WIDTH
} from '../../../shared/stickyNotes'
import type { StickyNoteBoardState, StickyNoteColor, StickyNoteItem } from '../../../shared/types'

interface StickyNotePageProps {
  board: StickyNoteBoardState
  onBoardChange: (nextBoard: StickyNoteBoardState) => void
  onRegisterTextFlush?: (flush: () => void) => () => void
}

type StickyNoteNodeData = {
  note: StickyNoteItem
  onSelect: (noteId: string) => void
  onTextDraftChange: (noteId: string, text: string) => void
  onTextDraftFlush: (noteId: string, text: string) => void
  onResizeEnd: (noteId: string, params: ResizeParams) => void
}

type StickyNoteNode = Node<StickyNoteNodeData, 'sticky-note'>

const DEFAULT_NOTE_SIZE = {
  width: 260,
  height: 220
}

const STICKY_NOTE_TEXT_DEBOUNCE_MS = 500

const STICKY_NOTE_SURFACES: Record<
  StickyNoteColor,
  { background: string; border: string; foreground: string }
> = {
  yellow: { background: '#fef3c7', border: '#f59e0b', foreground: '#713f12' },
  pink: { background: '#fce7f3', border: '#ec4899', foreground: '#831843' },
  blue: { background: '#dbeafe', border: '#3b82f6', foreground: '#1e3a8a' },
  green: { background: '#dcfce7', border: '#22c55e', foreground: '#14532d' },
  orange: { background: '#ffedd5', border: '#f97316', foreground: '#7c2d12' },
  purple: { background: '#f3e8ff', border: '#a855f7', foreground: '#581c87' }
}

const STICKY_NOTE_COLOR_LABELS: Record<StickyNoteColor, string> = {
  yellow: 'Yellow',
  pink: 'Pink',
  blue: 'Blue',
  green: 'Green',
  orange: 'Orange',
  purple: 'Purple'
}

function createStickyNoteId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `sticky-note:${crypto.randomUUID()}`
  }

  return `sticky-note:${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function toViewport(viewport: Viewport): StickyNoteBoardState['viewport'] {
  return {
    x: viewport.x,
    y: viewport.y,
    zoom: viewport.zoom
  }
}

function areStickyNoteItemsEqual(left: StickyNoteItem, right: StickyNoteItem): boolean {
  return (
    left.id === right.id &&
    left.text === right.text &&
    left.color === right.color &&
    left.position.x === right.position.x &&
    left.position.y === right.position.y &&
    left.size.width === right.size.width &&
    left.size.height === right.size.height &&
    left.zIndex === right.zIndex
  )
}

const StickyNoteCard = memo(function StickyNoteCard(
  props: NodeProps<StickyNoteNode>
): ReactElement {
  return <StickyNoteCardContent key={`${props.data.note.id}:${props.data.note.text}`} {...props} />
})

function StickyNoteCardContent({ data, selected }: NodeProps<StickyNoteNode>): ReactElement {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const [draftText, setDraftText] = useState(data.note.text)
  const draftTextRef = useRef(data.note.text)
  const noteId = data.note.id
  const onTextDraftFlush = data.onTextDraftFlush
  const surface = STICKY_NOTE_SURFACES[data.note.color]

  useEffect(() => {
    if (selected && !draftText && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [draftText, selected])

  useEffect(() => {
    return () => {
      onTextDraftFlush(noteId, draftTextRef.current)
    }
  }, [noteId, onTextDraftFlush])

  const handleTextChange = (text: string): void => {
    draftTextRef.current = text
    setDraftText(text)
    data.onTextDraftChange(noteId, text)
  }

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={STICKY_NOTE_MIN_WIDTH}
        minHeight={STICKY_NOTE_MIN_HEIGHT}
        maxWidth={STICKY_NOTE_MAX_SIZE}
        maxHeight={STICKY_NOTE_MAX_SIZE}
        color={surface.border}
        handleStyle={{ width: 10, height: 10 }}
        lineStyle={{ borderWidth: 1 }}
        onResizeEnd={(_event, params) => data.onResizeEnd(data.note.id, params)}
      />
      <div
        data-testid={`sticky-note:${data.note.id}`}
        data-color={data.note.color}
        className={`sticky-note-card relative flex h-full w-full flex-col overflow-hidden rounded-none border-0 shadow-sm transition-shadow ${selected ? 'shadow-[0_0_0_2px_var(--ring)]' : ''}`}
        style={{
          backgroundColor: surface.background,
          color: surface.foreground
        }}
        onClick={() => data.onSelect(data.note.id)}
      >
        <div
          data-testid={`sticky-note-drag-handle:${data.note.id}`}
          aria-label="Move sticky note"
          className="sticky-note-drag-handle h-6 shrink-0 cursor-grab"
        />
        <textarea
          ref={textareaRef}
          value={draftText}
          aria-label="Sticky note text"
          placeholder="Type a note…"
          className="nodrag nopan block min-h-0 flex-1 resize-none border-0 bg-transparent px-5 pb-4 pt-1 outline-none placeholder:opacity-60"
          style={{
            fontSize: STICKY_NOTE_FONT_SIZE,
            fontWeight: STICKY_NOTE_FONT_WEIGHT,
            lineHeight: 1.22
          }}
          onChange={(event) => handleTextChange(event.target.value)}
          onBlur={() => onTextDraftFlush(noteId, draftTextRef.current)}
          onClick={(event) => {
            event.stopPropagation()
            data.onSelect(data.note.id)
          }}
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        />
      </div>
    </>
  )
}

const nodeTypes: NodeTypes = {
  'sticky-note': StickyNoteCard
}

export function StickyNotePage(props: StickyNotePageProps): ReactElement {
  return (
    <ReactFlowProvider>
      <StickyNoteCanvas {...props} />
    </ReactFlowProvider>
  )
}

function StickyNoteCanvas({
  board,
  onBoardChange,
  onRegisterTextFlush
}: StickyNotePageProps): ReactElement {
  const reactFlow = useReactFlow<StickyNoteNode>()
  const surfaceRef = useRef<HTMLDivElement | null>(null)
  const boardRef = useRef(board)
  const selectedNoteIdRef = useRef<string | null>(null)
  const pendingTextDraftsRef = useRef(new Map<string, string>())
  const textDraftTimersRef = useRef(new Map<string, number>())
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)
  const [nextColor, setNextColor] = useState<StickyNoteColor>(STICKY_NOTE_COLORS[0])
  const [nodes, setNodes] = useNodesState<StickyNoteNode>([])

  useEffect(() => {
    boardRef.current = board
  }, [board])

  const updateBoard = useCallback(
    (updater: (current: StickyNoteBoardState) => StickyNoteBoardState): void => {
      const currentBoard = boardRef.current
      const nextBoard = updater(currentBoard)
      if (nextBoard === currentBoard) {
        return
      }

      boardRef.current = nextBoard
      onBoardChange(nextBoard)
    },
    [onBoardChange]
  )

  const updateNote = useCallback(
    (noteId: string, updater: (note: StickyNoteItem) => StickyNoteItem): void => {
      updateBoard((current) => {
        const currentNote = current.notes.find((note) => note.id === noteId)
        if (!currentNote) {
          return current
        }

        const nextNote = updater(currentNote)
        if (nextNote === currentNote) {
          return current
        }

        return {
          ...current,
          notes: current.notes.map((note) => (note.id === noteId ? nextNote : note))
        }
      })
    },
    [updateBoard]
  )

  const selectNote = useCallback(
    (noteId: string): void => {
      selectedNoteIdRef.current = noteId
      setSelectedNoteId(noteId)
      updateBoard((current) => {
        const highestZIndex = Math.max(0, ...current.notes.map((note) => note.zIndex))
        const selectedNote = current.notes.find((note) => note.id === noteId)
        if (!selectedNote || selectedNote.zIndex >= highestZIndex) {
          return current
        }

        return {
          ...current,
          notes: current.notes.map((note) =>
            note.id === noteId ? { ...note, zIndex: highestZIndex + 1 } : note
          )
        }
      })
    },
    [updateBoard]
  )

  const clearTextDraftTimer = useCallback((noteId: string): void => {
    const timer = textDraftTimersRef.current.get(noteId)
    if (timer === undefined) {
      return
    }

    window.clearTimeout(timer)
    textDraftTimersRef.current.delete(noteId)
  }, [])

  const flushTextDraft = useCallback(
    (noteId: string, text: string): void => {
      clearTextDraftTimer(noteId)
      pendingTextDraftsRef.current.delete(noteId)

      const currentNote = boardRef.current.notes.find((note) => note.id === noteId)
      if (!currentNote || currentNote.text === text) {
        return
      }

      updateNote(noteId, (note) => (note.text === text ? note : { ...note, text }))
    },
    [clearTextDraftTimer, updateNote]
  )

  const scheduleTextDraft = useCallback(
    (noteId: string, text: string): void => {
      const currentNote = boardRef.current.notes.find((note) => note.id === noteId)
      if (!currentNote || currentNote.text === text) {
        clearTextDraftTimer(noteId)
        pendingTextDraftsRef.current.delete(noteId)
        return
      }

      pendingTextDraftsRef.current.set(noteId, text)
      clearTextDraftTimer(noteId)
      const timer = window.setTimeout(() => {
        const pendingText = pendingTextDraftsRef.current.get(noteId)
        if (pendingText !== undefined) {
          flushTextDraft(noteId, pendingText)
        }
      }, STICKY_NOTE_TEXT_DEBOUNCE_MS)
      textDraftTimersRef.current.set(noteId, timer)
    },
    [clearTextDraftTimer, flushTextDraft]
  )

  const flushPendingTextDrafts = useCallback((): void => {
    for (const noteId of textDraftTimersRef.current.keys()) {
      clearTextDraftTimer(noteId)
    }

    const pendingTextDrafts = new Map(pendingTextDraftsRef.current)
    pendingTextDraftsRef.current.clear()
    if (pendingTextDrafts.size === 0) {
      return
    }

    updateBoard((current) => {
      let changed = false
      const notes = current.notes.map((note) => {
        if (!pendingTextDrafts.has(note.id)) {
          return note
        }

        const text = pendingTextDrafts.get(note.id) ?? note.text
        if (text === note.text) {
          return note
        }

        changed = true
        return { ...note, text }
      })

      return changed ? { ...current, notes } : current
    })
  }, [clearTextDraftTimer, updateBoard])

  const handleResizeEnd = useCallback(
    (noteId: string, params: ResizeParams): void => {
      updateNote(noteId, (current) => ({
        ...current,
        position: { x: params.x, y: params.y },
        size: { width: params.width, height: params.height }
      }))
    },
    [updateNote]
  )

  const createNodeFromNote = useCallback(
    (note: StickyNoteItem): StickyNoteNode => ({
      id: note.id,
      type: 'sticky-note',
      position: note.position,
      zIndex: note.zIndex,
      draggable: true,
      dragHandle: '.sticky-note-drag-handle',
      selected: note.id === selectedNoteId,
      data: {
        note,
        onSelect: selectNote,
        onTextDraftChange: scheduleTextDraft,
        onTextDraftFlush: flushTextDraft,
        onResizeEnd: handleResizeEnd
      },
      style: {
        width: note.size.width,
        height: note.size.height,
        zIndex: note.zIndex
      }
    }),
    [flushTextDraft, handleResizeEnd, scheduleTextDraft, selectNote, selectedNoteId]
  )

  const syncNodesFromNotes = useCallback(
    (notes: StickyNoteItem[]): void => {
      setNodes((currentNodes) => {
        const currentNodesById = new Map(currentNodes.map((node) => [node.id, node]))

        return notes.map((note) => {
          const currentNode = currentNodesById.get(note.id)
          if (!currentNode) {
            return createNodeFromNote(note)
          }

          const selected = note.id === selectedNoteId
          if (
            currentNode.selected === selected &&
            areStickyNoteItemsEqual(currentNode.data.note, note)
          ) {
            return currentNode
          }

          const noteUnchanged = areStickyNoteItemsEqual(currentNode.data.note, note)
          return {
            ...currentNode,
            position: note.position,
            zIndex: note.zIndex,
            selected,
            data: noteUnchanged ? currentNode.data : { ...currentNode.data, note },
            style: noteUnchanged
              ? currentNode.style
              : {
                  ...currentNode.style,
                  width: note.size.width,
                  height: note.size.height,
                  zIndex: note.zIndex
                }
          }
        })
      })
    },
    [createNodeFromNote, selectedNoteId, setNodes]
  )

  useEffect(() => {
    syncNodesFromNotes(board.notes)
  }, [board.notes, syncNodesFromNotes])

  useEffect(() => {
    const unregister = onRegisterTextFlush?.(flushPendingTextDrafts)

    return () => {
      flushPendingTextDrafts()
      unregister?.()
    }
  }, [flushPendingTextDrafts, onRegisterTextFlush])

  const handleNodesChange = useCallback(
    (changes: NodeChange<StickyNoteNode>[]): void => {
      setNodes((current) => applyNodeChanges(changes, current))
    },
    [setNodes]
  )

  const handleNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: StickyNoteNode): void => {
      updateNote(node.id, (note) => ({
        ...note,
        position: { x: node.position.x, y: node.position.y }
      }))
    },
    [updateNote]
  )

  const handleNodesDelete = useCallback(
    (deletedNodes: StickyNoteNode[]): void => {
      const deletedIds = new Set(deletedNodes.map((node) => node.id))
      for (const noteId of deletedIds) {
        clearTextDraftTimer(noteId)
        pendingTextDraftsRef.current.delete(noteId)
      }

      if (selectedNoteId && deletedIds.has(selectedNoteId)) {
        selectedNoteIdRef.current = null
        setSelectedNoteId(null)
      }
      updateBoard((current) => ({
        ...current,
        notes: current.notes.filter((note) => !deletedIds.has(note.id))
      }))
    },
    [clearTextDraftTimer, selectedNoteId, updateBoard]
  )

  const handleMoveEnd = useCallback(
    (_event: MouseEvent | TouchEvent | null, viewport: Viewport): void => {
      updateBoard((current) => ({ ...current, viewport: toViewport(viewport) }))
    },
    [updateBoard]
  )

  const handleAddNote = useCallback((): void => {
    const current = boardRef.current
    const bounds = surfaceRef.current?.getBoundingClientRect()
    const center = bounds
      ? { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 }
      : { x: window.innerWidth / 2, y: window.innerHeight / 2 }
    const flowPosition = reactFlow.screenToFlowPosition(center)
    const offset = (current.notes.length % 6) * 28
    const zIndex = Math.max(0, ...current.notes.map((note) => note.zIndex)) + 1
    const note: StickyNoteItem = {
      id: createStickyNoteId(),
      text: '',
      color: nextColor,
      position: {
        x: flowPosition.x - DEFAULT_NOTE_SIZE.width / 2 + offset,
        y: flowPosition.y - DEFAULT_NOTE_SIZE.height / 2 + offset
      },
      size: { ...DEFAULT_NOTE_SIZE },
      zIndex
    }

    selectedNoteIdRef.current = note.id
    setSelectedNoteId(note.id)
    setNextColor(
      STICKY_NOTE_COLORS[(STICKY_NOTE_COLORS.indexOf(nextColor) + 1) % STICKY_NOTE_COLORS.length]
    )
    updateBoard((latest) => ({ ...latest, notes: [...latest.notes, note] }))
  }, [nextColor, reactFlow, updateBoard])

  const handleChooseColor = useCallback(
    (color: StickyNoteColor): void => {
      const activeNoteId =
        selectedNoteIdRef.current ??
        (boardRef.current.notes.length === 1 ? (boardRef.current.notes[0]?.id ?? null) : null)
      if (activeNoteId) {
        updateNote(activeNoteId, (note) => ({ ...note, color }))
        return
      }

      setNextColor(color)
    },
    [updateNote]
  )

  const handleDeleteSelected = useCallback((): void => {
    if (!selectedNoteId) {
      return
    }

    const noteId = selectedNoteId
    clearTextDraftTimer(noteId)
    pendingTextDraftsRef.current.delete(noteId)
    selectedNoteIdRef.current = null
    setSelectedNoteId(null)
    updateBoard((current) => ({
      ...current,
      notes: current.notes.filter((note) => note.id !== noteId)
    }))
  }, [clearTextDraftTimer, selectedNoteId, updateBoard])

  const handleFitView = useCallback((): void => {
    void reactFlow.fitView({ duration: 180, padding: 0.2 }).then(() => {
      updateBoard((current) => ({ ...current, viewport: toViewport(reactFlow.getViewport()) }))
    })
  }, [reactFlow, updateBoard])

  const handleResetView = useCallback((): void => {
    const viewport = { x: 0, y: 0, zoom: 1 }
    void reactFlow.setViewport(viewport, { duration: 180 }).then(() => {
      updateBoard((current) => ({ ...current, viewport }))
    })
  }, [reactFlow, updateBoard])

  const colorItems = useMemo(
    () =>
      STICKY_NOTE_COLORS.map((color) => ({
        color,
        label: STICKY_NOTE_COLOR_LABELS[color],
        surface: STICKY_NOTE_SURFACES[color]
      })),
    []
  )

  return (
    <main data-testid="sticky-note-page" className="h-full min-h-0 w-full p-2">
      <div
        ref={surfaceRef}
        data-testid="sticky-note-board"
        className="sticky-note-board relative h-full min-h-0 w-full overflow-hidden rounded-[var(--radius-surface)] border border-border bg-workspace"
      >
        <div
          className="absolute left-4 top-4 z-20 flex items-center gap-1 rounded-[var(--radius-button-pill)] border border-border bg-card/95 p-1 shadow-sm"
          aria-label="Sticky note tools"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <WorkspaceIconButton
            data-testid="sticky-note-add"
            icon={<Plus aria-hidden="true" />}
            label="New note"
            onClick={handleAddNote}
            variant="accent"
          />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <WorkspaceIconButton
                data-testid="sticky-note-color-menu"
                icon={<Palette aria-hidden="true" />}
                aria-label="Choose note color"
                title="Choose note color"
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-40">
              {colorItems.map(({ color, label, surface }) => (
                <DropdownMenuItem
                  key={color}
                  data-testid={`sticky-note-color-${color}`}
                  onSelect={() => handleChooseColor(color)}
                  className="gap-2"
                >
                  <span
                    className="size-3 rounded-full border"
                    style={{ backgroundColor: surface.background, borderColor: surface.border }}
                    aria-hidden="true"
                  />
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <WorkspaceIconButton
            data-testid="sticky-note-fit"
            icon={<Maximize aria-hidden="true" />}
            aria-label="Fit notes"
            title="Fit notes"
            onClick={handleFitView}
          />
          <WorkspaceIconButton
            data-testid="sticky-note-reset"
            icon={<RefreshCw aria-hidden="true" />}
            aria-label="Reset view"
            title="Reset view"
            onClick={handleResetView}
          />
          <WorkspaceIconButton
            data-testid="sticky-note-delete"
            icon={<Trash2 aria-hidden="true" />}
            aria-label="Delete selected note"
            title="Delete selected note"
            onClick={handleDeleteSelected}
            disabled={!selectedNoteId}
          />
        </div>

        <ReactFlow
          nodes={nodes}
          edges={[]}
          nodeTypes={nodeTypes}
          onlyRenderVisibleElements
          defaultViewport={board.viewport}
          minZoom={0.2}
          maxZoom={4}
          onNodesChange={handleNodesChange}
          onNodeClick={(_event, node) => selectNote(node.id)}
          onPaneClick={() => {
            selectedNoteIdRef.current = null
            setSelectedNoteId(null)
          }}
          onNodeDragStop={handleNodeDragStop}
          onNodesDelete={handleNodesDelete}
          onMoveEnd={handleMoveEnd}
          nodesConnectable={false}
          elementsSelectable
          nodesDraggable
          zoomOnScroll
          zoomOnPinch
          panOnScroll
          deleteKeyCode={['Backspace', 'Delete']}
          proOptions={{ hideAttribution: true }}
          className="sticky-note-flow"
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="var(--border)" />
        </ReactFlow>

        {board.notes.length === 0 ? (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <div className="max-w-sm text-center">
              <p className="text-sm font-medium text-foreground">Your sticky note board is empty</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Add a note, then drag or resize it anywhere on the canvas.
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  )
}
