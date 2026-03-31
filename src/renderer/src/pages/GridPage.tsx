import { ReactElement, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Background,
  BackgroundVariant,
  Node,
  NodeChange,
  NodeMouseHandler,
  NodeResizeControl,
  NodeProps,
  NodeTypes,
  ReactFlow,
  ReactFlowProvider,
  ResizeControlVariant,
  ResizeParams,
  applyNodeChanges,
  useNodesState,
  useReactFlow
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { FolderKanban, Sparkles, X } from 'lucide-react'
import { stripNoteExtension } from '../../../shared/noteDocument'
import {
  GridBoardItem,
  GridBoardState,
  GridTextStyle,
  NoteListItem,
  Project,
  ProjectIconStyle
} from '../../../shared/types'
import { InlineEditableText } from '../components/InlineEditableText'
import { NoteShapeIcon } from '../components/NoteShapeIcon'
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger
} from '../components/ui/context-menu'
import { cn } from '../lib/utils'

export interface GridWorkspaceActions {
  resetBoard: () => void
  fitAllCards: () => void
  addNote: (relPath: string) => void
  addProject: (projectId: string) => void
  addText: () => void
}

interface GridPageProps {
  board: GridBoardState
  notes: NoteListItem[]
  projects: Project[]
  onActionsChange?: ((actions: GridWorkspaceActions | null) => void) | null
  onBoardChange: (nextBoard: GridBoardState) => void
  onOpenNote: (relPath: string) => void
  onOpenProject: (projectId: string) => void
}

type GridNodeData = {
  itemId: string
  kind: 'note' | 'project' | 'text'
  sourceId: string
  title: string
  subtitle: string
  updatedAt?: string
  summary?: string
  progress?: number
  status?: string
  icon?: ProjectIconStyle
  textContent?: string
  textStyle?: GridTextStyle
  bodyPreview?: string
  onOpen: () => void
  onSelect: () => void
  onRemove: () => void
  onUpdateText?: (nextText: string) => void
  onUpdateTextStyle?: (nextStyle: GridTextStyle | undefined) => void
  onResizeEnd: (params: ResizeParams) => void
}

type GridNode = Node<GridNodeData, 'grid-card'>

const GRID_NODE_WIDTH = 312
const GRID_NODE_HEIGHT = 190
const GRID_TEXT_NODE_WIDTH = 296
const GRID_TEXT_NODE_HEIGHT = 84
const GRID_MIN_CARD_WIDTH = 240
const GRID_MIN_CARD_HEIGHT = 160
const GRID_MIN_TEXT_HEIGHT = 76
const GRID_MIN_TEXT_WIDTH = 160
const GRID_CARD_RADIUS = '12px'
const GRID_RESIZE_EDGE_HIT_SIZE = 12
const GRID_RESIZE_CORNER_SIZE = 22

const GRID_TEXT_STYLE_DEFAULTS: Required<GridTextStyle> = {
  fontSize: 'md',
  isBold: false,
  isItalic: false,
  isUnderline: false,
  textAlign: 'left',
  color: 'default'
}

const nodeTypes: NodeTypes = {
  'grid-card': GridCardNode
}

export function GridPage(props: GridPageProps): ReactElement {
  return (
    <ReactFlowProvider>
      <GridCanvas {...props} />
    </ReactFlowProvider>
  )
}

function GridCanvas({
  board,
  notes,
  projects,
  onActionsChange,
  onBoardChange,
  onOpenNote,
  onOpenProject
}: GridPageProps): ReactElement {
  const reactFlow = useReactFlow<GridNode>()
  const surfaceRef = useRef<HTMLDivElement | null>(null)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [nodes, setNodes] = useNodesState<GridNode>([])

  const noteLookup = useMemo(() => new Map(notes.map((note) => [note.relPath, note])), [notes])
  const projectLookup = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects]
  )

  const visibleItems = useMemo(
    () =>
      board.items.filter((item) =>
        item.kind === 'note'
          ? Boolean(item.noteRelPath && noteLookup.has(item.noteRelPath))
          : item.kind === 'project'
            ? Boolean(item.projectId && projectLookup.has(item.projectId))
            : true
      ),
    [board.items, noteLookup, projectLookup]
  )

  useEffect(() => {
    const hasSameLength = visibleItems.length === board.items.length
    if (hasSameLength) {
      return
    }

    onBoardChange({
      ...board,
      items: visibleItems
    })
  }, [board, onBoardChange, visibleItems])

  useEffect(() => {
    reactFlow.setViewport(board.viewport, { duration: 0 })
  }, [board.viewport, reactFlow])

  const focusItem = useCallback(
    (itemId: string): void => {
      const nextItem = visibleItems.find((item) => item.id === itemId)
      if (!nextItem) {
        return
      }

      setSelectedItemId(itemId)
      void reactFlow.setCenter(
        nextItem.position.x + (nextItem.size?.width ?? GRID_NODE_WIDTH) / 2,
        nextItem.position.y + 56,
        {
          duration: 320,
          zoom: Math.max(board.viewport.zoom, 0.95)
        }
      )
    },
    [board.viewport.zoom, reactFlow, visibleItems]
  )

  const updateItems = useCallback(
    (updater: (items: GridBoardItem[]) => GridBoardItem[]): void => {
      const nextItems = updater(board.items)
      onBoardChange({
        ...board,
        items: nextItems
      })
    },
    [board, onBoardChange]
  )

  const removeItem = useCallback(
    (itemId: string): void => {
      if (selectedItemId === itemId) {
        setSelectedItemId(null)
      }
      updateItems((items) => items.filter((item) => item.id !== itemId))
    },
    [selectedItemId, updateItems]
  )

  const addItemToBoard = useCallback(
    (
      item:
        | { kind: 'note'; noteRelPath: string }
        | { kind: 'project'; projectId: string }
        | { kind: 'text'; textContent?: string }
    ): void => {
      const existing =
        item.kind === 'note'
          ? visibleItems.find(
              (boardItem) => boardItem.kind === 'note' && boardItem.noteRelPath === item.noteRelPath
            )
          : item.kind === 'project'
            ? visibleItems.find(
                (boardItem) =>
                  boardItem.kind === 'project' && boardItem.projectId === item.projectId
              )
            : null

      if (existing) {
        focusItem(existing.id)
        return
      }

      const rect = surfaceRef.current?.getBoundingClientRect()
      const screenX = rect ? rect.left + rect.width / 2 : window.innerWidth / 2
      const screenY = rect ? rect.top + rect.height / 2 : window.innerHeight / 2
      const flowPosition = reactFlow.screenToFlowPosition({ x: screenX, y: screenY })
      const offsetIndex = visibleItems.length % 6
      const nextZIndex = Math.max(0, ...board.items.map((boardItem) => boardItem.zIndex)) + 1
      const nextItem: GridBoardItem =
        item.kind === 'note'
          ? {
              id: `grid-note:${item.noteRelPath}`,
              kind: 'note',
              noteRelPath: item.noteRelPath,
              position: {
                x: flowPosition.x - GRID_NODE_WIDTH / 2 + offsetIndex * 26,
                y: flowPosition.y - GRID_NODE_HEIGHT / 2 + offsetIndex * 22
              },
              size: {
                width: GRID_NODE_WIDTH,
                height: GRID_NODE_HEIGHT
              },
              zIndex: nextZIndex
            }
          : item.kind === 'project'
            ? {
                id: `grid-project:${item.projectId}`,
                kind: 'project',
                projectId: item.projectId,
                position: {
                  x: flowPosition.x - GRID_NODE_WIDTH / 2 + offsetIndex * 26,
                  y: flowPosition.y - GRID_NODE_HEIGHT / 2 + offsetIndex * 22
                },
                size: {
                  width: GRID_NODE_WIDTH,
                  height: GRID_NODE_HEIGHT
                },
                zIndex: nextZIndex
              }
            : {
                id: createGridTextId(),
                kind: 'text',
                textContent: item.textContent ?? '',
                position: {
                  x: flowPosition.x - GRID_TEXT_NODE_WIDTH / 2 + offsetIndex * 26,
                  y: flowPosition.y - GRID_TEXT_NODE_HEIGHT / 2 + offsetIndex * 22
                },
                size: {
                  width: GRID_TEXT_NODE_WIDTH,
                  height: GRID_TEXT_NODE_HEIGHT
                },
                zIndex: nextZIndex
              }

      setSelectedItemId(nextItem.id)
      updateItems((items) => [...items, nextItem])
    },
    [board.items, focusItem, reactFlow, updateItems, visibleItems]
  )

  const updateTextItem = useCallback(
    (itemId: string, nextText: string): void => {
      updateItems((items) =>
        items.map((item) =>
          item.id === itemId
            ? {
                ...item,
                textContent: nextText
              }
            : item
        )
      )
    },
    [updateItems]
  )

  const updateTextItemStyle = useCallback(
    (itemId: string, nextStyle: GridTextStyle | undefined): void => {
      updateItems((items) =>
        items.map((item) =>
          item.id === itemId
            ? {
                ...item,
                textStyle: nextStyle
              }
            : item
        )
      )
    },
    [updateItems]
  )

  const resolvedSelectedItemId = useMemo(
    () =>
      selectedItemId && visibleItems.some((item) => item.id === selectedItemId)
        ? selectedItemId
        : null,
    [selectedItemId, visibleItems]
  )

  const handleNodeResizeEnd = useCallback(
    (itemId: string, params: ResizeParams): void => {
      updateItems((items) =>
        items.map((item) =>
          item.id === itemId
            ? {
                ...item,
                position: {
                  x: params.x,
                  y: params.y
                },
                size: {
                  width: params.width,
                  height: params.height
                }
              }
            : item
        )
      )
    },
    [updateItems]
  )

  const derivedNodes = useMemo<GridNode[]>(
    () =>
      [...visibleItems]
        .sort((left, right) => left.zIndex - right.zIndex)
        .map<GridNode | null>((item) => {
          if (item.kind === 'note') {
            const note = item.noteRelPath ? noteLookup.get(item.noteRelPath) : null
            if (!note) {
              return null
            }

            return {
              id: item.id,
              type: 'grid-card',
              position: item.position,
              selected: item.id === resolvedSelectedItemId,
              draggable: true,
              data: {
                itemId: item.id,
                kind: 'note',
                sourceId: note.relPath,
                title: stripNoteExtension(note.name),
                subtitle: note.dir || 'Vault root',
                updatedAt: note.updatedAt,
                bodyPreview: note.bodyPreview,
                onOpen: () => onOpenNote(note.relPath),
                onSelect: () => setSelectedItemId(item.id),
                onRemove: () => removeItem(item.id),
                onResizeEnd: (params) => handleNodeResizeEnd(item.id, params)
              },
              style: {
                width: item.size?.width ?? GRID_NODE_WIDTH,
                height: item.size?.height ?? GRID_NODE_HEIGHT
              }
            }
          }

          if (item.kind === 'project') {
            const project = item.projectId ? projectLookup.get(item.projectId) : null
            if (!project) {
              return null
            }

            return {
              id: item.id,
              type: 'grid-card',
              position: item.position,
              selected: item.id === resolvedSelectedItemId,
              draggable: true,
              data: {
                itemId: item.id,
                kind: 'project',
                sourceId: project.id,
                title: project.name,
                subtitle: `${project.milestones.length} milestone${project.milestones.length === 1 ? '' : 's'}`,
                summary: project.summary,
                progress: project.progress,
                status: project.status,
                icon: project.icon,
                updatedAt: project.updatedAt,
                onOpen: () => onOpenProject(project.id),
                onSelect: () => setSelectedItemId(item.id),
                onRemove: () => removeItem(item.id),
                onResizeEnd: (params) => handleNodeResizeEnd(item.id, params)
              },
              style: {
                width: item.size?.width ?? GRID_NODE_WIDTH,
                height: item.size?.height ?? GRID_NODE_HEIGHT
              }
            }
          }

          return {
            id: item.id,
            type: 'grid-card',
            position: item.position,
            selected: item.id === resolvedSelectedItemId,
            draggable: true,
            data: {
              itemId: item.id,
              kind: 'text',
              sourceId: item.id,
              title: 'Text',
              subtitle: 'Canvas text block',
              textContent: item.textContent ?? '',
              textStyle: item.textStyle,
              onOpen: () => undefined,
              onSelect: () => setSelectedItemId(item.id),
              onRemove: () => removeItem(item.id),
              onUpdateText: (nextText) => updateTextItem(item.id, nextText),
              onUpdateTextStyle: (nextStyle) => updateTextItemStyle(item.id, nextStyle),
              onResizeEnd: (params) => handleNodeResizeEnd(item.id, params)
            },
            style: {
              width: item.size?.width ?? GRID_TEXT_NODE_WIDTH,
              height: item.size?.height ?? GRID_TEXT_NODE_HEIGHT
            }
          }
        })
        .filter((node): node is GridNode => node !== null),
    [
      noteLookup,
      onOpenNote,
      onOpenProject,
      projectLookup,
      removeItem,
      resolvedSelectedItemId,
      handleNodeResizeEnd,
      updateTextItem,
      updateTextItemStyle,
      visibleItems
    ]
  )

  useEffect(() => {
    setNodes((currentNodes) => {
      const currentById = new Map(currentNodes.map((node) => [node.id, node]))
      return derivedNodes.map((node) => {
        const currentNode = currentById.get(node.id)
        return currentNode
          ? {
              ...currentNode,
              position: node.position,
              selected: node.selected,
              data: node.data,
              style: node.style
            }
          : node
      })
    })
  }, [derivedNodes, setNodes])

  const handleNodeClick = useCallback<NodeMouseHandler<GridNode>>(
    (_event, node) => {
      setSelectedItemId(node.id)
      setNodes((currentNodes) => {
        const nextZIndex =
          Math.max(0, ...currentNodes.map((currentNode) => currentNode.zIndex ?? 0)) + 1
        return currentNodes.map((currentNode) =>
          currentNode.id === node.id
            ? {
                ...currentNode,
                zIndex: nextZIndex
              }
            : currentNode
        )
      })
      updateItems((items) => {
        const nextZIndex = Math.max(0, ...items.map((currentItem) => currentItem.zIndex)) + 1
        return items.map((item) =>
          item.id === node.id
            ? {
                ...item,
                zIndex: nextZIndex
              }
            : item
        )
      })
    },
    [setNodes, updateItems]
  )

  const handleNodeDragStop = useCallback<NodeMouseHandler<GridNode>>(
    (_event, node) => {
      updateItems((items) =>
        items.map((item) =>
          item.id === node.id
            ? {
                ...item,
                position: node.position
              }
            : item
        )
      )
    },
    [updateItems]
  )

  const handleNodesChange = useCallback(
    (changes: NodeChange<GridNode>[]): void => {
      setNodes((currentNodes) => applyNodeChanges(changes, currentNodes))
    },
    [setNodes]
  )

  const resetBoard = useCallback((): void => {
    setSelectedItemId(null)
    onBoardChange({
      viewport: {
        x: 0,
        y: 0,
        zoom: 1
      },
      items: []
    })
    void reactFlow.setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 250 })
  }, [onBoardChange, reactFlow])

  const fitAllCards = useCallback((): void => {
    void reactFlow.fitView({ duration: 280, padding: 0.22 })
  }, [reactFlow])

  useEffect(() => {
    onActionsChange?.({
      resetBoard,
      fitAllCards,
      addNote: (relPath: string) => addItemToBoard({ kind: 'note', noteRelPath: relPath }),
      addProject: (projectId: string) => addItemToBoard({ kind: 'project', projectId }),
      addText: () => addItemToBoard({ kind: 'text' })
    })

    return () => {
      onActionsChange?.(null)
    }
  }, [addItemToBoard, fitAllCards, onActionsChange, resetBoard])

  return (
    <div
      ref={surfaceRef}
      data-testid="grid-page"
      className="relative h-full overflow-hidden rounded-[28px] bg-[var(--panel)]"
    >
      <ReactFlow<GridNode>
        data-testid="grid-canvas"
        nodes={nodes}
        edges={[]}
        nodeTypes={nodeTypes}
        onNodesChange={handleNodesChange}
        onPaneClick={() => setSelectedItemId(null)}
        onNodeClick={handleNodeClick}
        onNodeDragStop={handleNodeDragStop}
        onMoveEnd={(_event, viewport) => {
          onBoardChange({
            ...board,
            viewport
          })
        }}
        nodesDraggable
        elementsSelectable
        nodesConnectable={false}
        zoomOnPinch
        zoomOnScroll
        panOnScroll
        proOptions={{ hideAttribution: true }}
      >
        <Background
          id="grid-background"
          color="var(--accent)"
          gap={48}
          size={1.8}
          style={{ opacity: 0.24 }}
          variant={BackgroundVariant.Dots}
        />
      </ReactFlow>

      {visibleItems.length === 0 ? (
        <div
          data-testid="grid-empty-state"
          className="pointer-events-none absolute inset-0 flex items-center justify-center p-10"
        >
          <div className="max-w-xl rounded-[32px] border border-[var(--line)] bg-[var(--panel)] px-8 py-10 text-center shadow-[0_24px_64px_rgba(15,23,42,0.12)]">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--accent)]">
              <Sparkles size={24} />
            </div>
            <h3 className="text-3xl font-semibold text-[var(--text)]">Start shaping the board</h3>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              Add notes, projects, and text blocks from the header to compose a freeform spatial
              view of your work.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function GridCardNode({ data, selected }: NodeProps<GridNode>): ReactElement {
  const isNote = data.kind === 'note'
  const isText = data.kind === 'text'
  const textStyle = resolveGridTextStyle(data.textStyle)
  const minHeight = isText ? GRID_MIN_TEXT_HEIGHT : GRID_MIN_CARD_HEIGHT
  const verticalEdgeResizeStyle = {
    opacity: 0,
    width: GRID_RESIZE_EDGE_HIT_SIZE,
    height: '100%',
    backgroundColor: 'transparent',
    border: 'none'
  } as const
  const horizontalEdgeResizeStyle = {
    opacity: 0,
    width: '100%',
    height: GRID_RESIZE_EDGE_HIT_SIZE,
    backgroundColor: 'transparent',
    border: 'none'
  } as const
  const cornerResizeStyle = {
    opacity: 0,
    width: GRID_RESIZE_CORNER_SIZE,
    height: GRID_RESIZE_CORNER_SIZE,
    borderRadius: 999,
    backgroundColor: 'transparent',
    border: 'none'
  } as const

  const updateTextStyle = (
    updater: (current: Required<GridTextStyle>) => Required<GridTextStyle>
  ): void => {
    if (!isText) {
      return
    }

    data.onUpdateTextStyle?.(sanitizeGridTextStyle(updater(textStyle)))
  }

  const card = (
    <div
      onMouseDown={() => data.onSelect()}
      onDoubleClick={() => {
        if (!isText) {
          data.onOpen()
        }
      }}
      data-testid={`grid-card:${data.kind}:${data.sourceId}`}
      className={`group h-full rounded-[12px] border border-[var(--accent)] bg-[var(--panel)] transition duration-200 ${
        selected ? 'shadow-[0_0_0_1px_var(--accent)]' : ''
      }`}
    >
      {isText ? (
        <>
          <NodeResizeControl
            position="right"
            variant={ResizeControlVariant.Line}
            minWidth={GRID_MIN_TEXT_WIDTH}
            minHeight={minHeight}
            className="transition-opacity cursor-ew-resize"
            style={verticalEdgeResizeStyle}
            onResizeEnd={(_event, params) => data.onResizeEnd(params)}
          />
          <NodeResizeControl
            position="left"
            variant={ResizeControlVariant.Line}
            minWidth={GRID_MIN_TEXT_WIDTH}
            minHeight={minHeight}
            className="transition-opacity cursor-ew-resize"
            style={verticalEdgeResizeStyle}
            onResizeEnd={(_event, params) => data.onResizeEnd(params)}
          />
        </>
      ) : (
        <>
          <NodeResizeControl
            position="top"
            variant={ResizeControlVariant.Line}
            minWidth={GRID_MIN_CARD_WIDTH}
            minHeight={minHeight}
            className="transition-opacity cursor-ns-resize"
            style={horizontalEdgeResizeStyle}
            onResizeEnd={(_event, params) => data.onResizeEnd(params)}
          />
          <NodeResizeControl
            position="right"
            variant={ResizeControlVariant.Line}
            minWidth={GRID_MIN_CARD_WIDTH}
            minHeight={minHeight}
            className="transition-opacity cursor-ew-resize"
            style={verticalEdgeResizeStyle}
            onResizeEnd={(_event, params) => data.onResizeEnd(params)}
          />
          <NodeResizeControl
            position="bottom"
            variant={ResizeControlVariant.Line}
            minWidth={GRID_MIN_CARD_WIDTH}
            minHeight={minHeight}
            className="transition-opacity cursor-ns-resize"
            style={horizontalEdgeResizeStyle}
            onResizeEnd={(_event, params) => data.onResizeEnd(params)}
          />
          <NodeResizeControl
            position="left"
            variant={ResizeControlVariant.Line}
            minWidth={GRID_MIN_CARD_WIDTH}
            minHeight={minHeight}
            className="transition-opacity cursor-ew-resize"
            style={verticalEdgeResizeStyle}
            onResizeEnd={(_event, params) => data.onResizeEnd(params)}
          />
          <NodeResizeControl
            position="top-left"
            minWidth={GRID_MIN_CARD_WIDTH}
            minHeight={minHeight}
            className="transition-opacity cursor-nwse-resize"
            style={cornerResizeStyle}
            onResizeEnd={(_event, params) => data.onResizeEnd(params)}
          />
          <NodeResizeControl
            position="top-right"
            minWidth={GRID_MIN_CARD_WIDTH}
            minHeight={minHeight}
            className="transition-opacity cursor-nesw-resize"
            style={cornerResizeStyle}
            onResizeEnd={(_event, params) => data.onResizeEnd(params)}
          />
          <NodeResizeControl
            position="bottom-left"
            minWidth={GRID_MIN_CARD_WIDTH}
            minHeight={minHeight}
            className="transition-opacity cursor-nesw-resize"
            style={cornerResizeStyle}
            onResizeEnd={(_event, params) => data.onResizeEnd(params)}
          />
          <NodeResizeControl
            position="bottom-right"
            minWidth={GRID_MIN_CARD_WIDTH}
            minHeight={minHeight}
            className="transition-opacity cursor-nwse-resize"
            style={cornerResizeStyle}
            onResizeEnd={(_event, params) => data.onResizeEnd(params)}
          />
        </>
      )}
      <div
        className="relative flex h-full flex-col overflow-hidden rounded-[12px] px-4 py-4"
        style={{ borderRadius: GRID_CARD_RADIUS }}
      >
        {isText ? (
          <>
            <button
              type="button"
              data-testid={`grid-remove:${data.kind}:${data.sourceId}`}
              aria-label={`Remove text block ${data.title} from grid`}
              onClick={(event) => {
                event.stopPropagation()
                data.onRemove()
              }}
              className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-xl border border-transparent text-[var(--muted)] transition hover:border-[var(--line)] hover:bg-[var(--panel-2)] hover:text-[var(--text)]"
            >
              <X size={15} />
            </button>
            <div className="flex min-h-0 flex-1 pr-12">
              <InlineEditableText
                value={data.textContent ?? ''}
                onCommit={(nextValue) => {
                  data.onUpdateText?.(nextValue)
                }}
                displayAs="div"
                displayClassName={cn(
                  'block w-full cursor-text whitespace-pre-wrap leading-6 [overflow-wrap:anywhere]',
                  getGridTextClassName(textStyle)
                )}
                inputClassName={cn(
                  'm-0 min-w-0 w-full border-0 bg-transparent p-0 outline-none',
                  getGridTextClassName(textStyle)
                )}
                placeholder="Write anything..."
                allowEmpty
                title="Click to edit. Right-click to style."
              />
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              {isNote ? (
                <div className="min-w-0 flex-1">
                  <div className="truncate text-lg font-semibold text-[var(--text)]">{data.title}</div>
                </div>
              ) : (
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center text-[var(--accent)]">
                    {data.icon ? (
                      <NoteShapeIcon icon={data.icon} size={18} />
                    ) : (
                      <FolderKanban size={18} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-lg font-semibold text-[var(--text)]">
                      {data.title}
                    </div>
                  </div>
                </div>
              )}
              <button
                type="button"
                data-testid={`grid-remove:${data.kind}:${data.sourceId}`}
                aria-label={`Remove ${isNote ? 'note' : 'project'} ${data.title} from grid`}
                onClick={(event) => {
                  event.stopPropagation()
                  data.onRemove()
                }}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-transparent text-[var(--muted)] transition hover:border-[var(--line)] hover:bg-[var(--panel-2)] hover:text-[var(--text)]"
              >
                <X size={15} />
              </button>
            </div>

            <div className="mb-4 mt-3 -mx-4 border-t border-[var(--line)]" />

            <div className="relative flex-1 overflow-hidden">
              {isNote ? (
                <div className="h-full overflow-hidden text-sm text-[var(--text)]">
                  <div className="h-full overflow-auto pr-1">
                    <NoteCardPreview fallbackText={data.bodyPreview} />
                  </div>
                </div>
              ) : (
                <div className="mb-3 text-sm text-[var(--muted)]">{data.subtitle}</div>
              )}
              {!isNote ? (
                <div className="space-y-3">
                  <div className="line-clamp-3 text-sm leading-6 text-[var(--muted)]">
                    {data.summary || 'No summary yet.'}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center justify-between text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                        <span>Progress</span>
                        <span>{Math.round(data.progress ?? 0)}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[var(--panel-2)]">
                        <div
                          className="h-full rounded-full bg-[var(--accent)]"
                          style={{ width: `${Math.max(6, Math.min(100, data.progress ?? 0))}%` }}
                        />
                      </div>
                    </div>
                    <span className="rounded-full border border-[rgba(125,183,255,0.24)] bg-[rgba(125,183,255,0.1)] px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-[var(--accent)]">
                      {data.status}
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  )

  if (!isText) {
    return card
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{card}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuSub>
          <ContextMenuSubTrigger>Style</ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuCheckboxItem
              checked={textStyle.isBold}
              onSelect={() => {
                data.onSelect()
                updateTextStyle((current) => ({ ...current, isBold: !current.isBold }))
              }}
            >
              Bold
            </ContextMenuCheckboxItem>
            <ContextMenuCheckboxItem
              checked={textStyle.isItalic}
              onSelect={() => {
                data.onSelect()
                updateTextStyle((current) => ({ ...current, isItalic: !current.isItalic }))
              }}
            >
              Italic
            </ContextMenuCheckboxItem>
            <ContextMenuCheckboxItem
              checked={textStyle.isUnderline}
              onSelect={() => {
                data.onSelect()
                updateTextStyle((current) => ({ ...current, isUnderline: !current.isUnderline }))
              }}
            >
              Underline
            </ContextMenuCheckboxItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSub>
          <ContextMenuSubTrigger>Align</ContextMenuSubTrigger>
          <ContextMenuSubContent>
            {(['left', 'center', 'right'] as const).map((textAlign) => (
              <ContextMenuCheckboxItem
                key={textAlign}
                checked={textStyle.textAlign === textAlign}
                onSelect={() => {
                  data.onSelect()
                  updateTextStyle((current) => ({ ...current, textAlign }))
                }}
              >
                {capitalizeLabel(textAlign)}
              </ContextMenuCheckboxItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSub>
          <ContextMenuSubTrigger>Size</ContextMenuSubTrigger>
          <ContextMenuSubContent>
            {([
              ['sm', 'Small'],
              ['md', 'Medium'],
              ['lg', 'Large']
            ] as const).map(([fontSize, label]) => (
              <ContextMenuCheckboxItem
                key={fontSize}
                checked={textStyle.fontSize === fontSize}
                onSelect={() => {
                  data.onSelect()
                  updateTextStyle((current) => ({ ...current, fontSize }))
                }}
              >
                {label}
              </ContextMenuCheckboxItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSub>
          <ContextMenuSubTrigger>Color</ContextMenuSubTrigger>
          <ContextMenuSubContent>
            {([
              ['default', 'Default'],
              ['accent', 'Accent'],
              ['muted', 'Muted']
            ] as const).map(([color, label]) => (
              <ContextMenuCheckboxItem
                key={color}
                checked={textStyle.color === color}
                onSelect={() => {
                  data.onSelect()
                  updateTextStyle((current) => ({ ...current, color }))
                }}
              >
                {label}
              </ContextMenuCheckboxItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={() => {
            data.onSelect()
            data.onUpdateTextStyle?.(undefined)
          }}
        >
          Reset formatting
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

function createGridTextId(): string {
  return `grid-text:${crypto.randomUUID()}`
}

function resolveGridTextStyle(style: GridTextStyle | undefined): Required<GridTextStyle> {
  return {
    fontSize: style?.fontSize ?? GRID_TEXT_STYLE_DEFAULTS.fontSize,
    isBold: style?.isBold ?? GRID_TEXT_STYLE_DEFAULTS.isBold,
    isItalic: style?.isItalic ?? GRID_TEXT_STYLE_DEFAULTS.isItalic,
    isUnderline: style?.isUnderline ?? GRID_TEXT_STYLE_DEFAULTS.isUnderline,
    textAlign: style?.textAlign ?? GRID_TEXT_STYLE_DEFAULTS.textAlign,
    color: style?.color ?? GRID_TEXT_STYLE_DEFAULTS.color
  }
}

function sanitizeGridTextStyle(style: Required<GridTextStyle>): GridTextStyle | undefined {
  const nextStyle: GridTextStyle = {}

  if (style.fontSize !== GRID_TEXT_STYLE_DEFAULTS.fontSize) {
    nextStyle.fontSize = style.fontSize
  }
  if (style.isBold) {
    nextStyle.isBold = true
  }
  if (style.isItalic) {
    nextStyle.isItalic = true
  }
  if (style.isUnderline) {
    nextStyle.isUnderline = true
  }
  if (style.textAlign !== GRID_TEXT_STYLE_DEFAULTS.textAlign) {
    nextStyle.textAlign = style.textAlign
  }
  if (style.color !== GRID_TEXT_STYLE_DEFAULTS.color) {
    nextStyle.color = style.color
  }

  return Object.keys(nextStyle).length > 0 ? nextStyle : undefined
}

function getGridTextClassName(style: Required<GridTextStyle>): string {
  return cn(
    style.fontSize === 'sm' ? 'text-sm' : style.fontSize === 'lg' ? 'text-xl' : 'text-lg',
    style.isBold ? 'font-semibold' : 'font-normal',
    style.isItalic ? 'italic' : 'not-italic',
    style.isUnderline ? 'underline underline-offset-4' : 'no-underline',
    style.textAlign === 'center'
      ? 'text-center'
      : style.textAlign === 'right'
        ? 'text-right'
        : 'text-left',
    style.color === 'accent'
      ? 'text-[var(--accent)]'
      : style.color === 'muted'
        ? 'text-[var(--muted)]'
        : 'text-[var(--text)]'
  )
}

function capitalizeLabel(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function NoteCardPreview({ fallbackText }: { fallbackText?: string }): ReactElement {
  return (
    <div className="whitespace-pre-wrap text-[var(--text)]">
      {fallbackText?.trim() || 'Empty note.'}
    </div>
  )
}
