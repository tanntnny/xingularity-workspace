/* eslint-disable react/prop-types */
import {
  CSSProperties,
  ReactElement,
  RefObject,
  useCallback,
  useDeferredValue,
  useEffect,
  useRef,
  useState
} from 'react'
import { useElementSize } from '@mantine/hooks'
import {
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  MoreHorizontal,
  Pencil,
  Trash2
} from 'lucide-react'
import {
  Tree,
  TreeApi,
  NodeRendererProps,
  type DragPreviewProps,
  type NodeApi
} from 'react-arborist'
import { createPortal } from 'react-dom'
import { stripNoteExtension } from '../../../shared/noteDocument'
import type { NativeMenuItemDescriptor, NoteTreeNode } from '../../../shared/types'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuDestructiveItem,
  ContextMenuItem,
  ContextMenuTrigger
} from './ui/context-menu'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from './ui/dropdown-menu'
import {
  canUseNativeMenus,
  getElementMenuPosition,
  getMouseMenuPosition,
  showNativeMenu
} from '../lib/nativeMenu'
import { getNoteTreeDropVisualState } from '../lib/noteTreeDrag'
import { cn } from '../lib/utils'

const TREE_ICON_CLASS = 'h-4 w-4 shrink-0'
const TREE_CHEVRON_CLASS = 'h-3.5 w-3.5 shrink-0'
const TREE_DROPDOWN_ITEM_CLASS =
  'relative flex w-full cursor-default select-none items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none transition-colors focus:bg-[var(--accent-color)] focus:text-[var(--accent-foreground)] hover:bg-[var(--accent-color)] hover:text-[var(--accent-foreground)]'
const TREE_INDENT = 18
const TREE_ROW_HEIGHT = 28
const AUTO_EXPAND_DELAY_MS = 400

type TreeSelection = {
  kind: 'note' | 'folder'
  relPath: string
} | null

interface NotesTreeViewProps {
  tree: NoteTreeNode[]
  searchTerm: string
  activeNotePath: string | null
  selectedEntry: TreeSelection
  collapseAllToken?: number
  pendingEditId: string | null
  onPendingEditHandled: () => void
  onSelectionChange: (entry: TreeSelection) => void
  onOpenNote: (relPath: string) => void
  onCreateNote: (parentDir: string) => void
  onCreateFolder: (parentDir: string) => void
  onRenamePath: (relPath: string, nextName: string, kind: 'note' | 'folder') => void
  onDeletePath: (relPath: string, kind: 'note' | 'folder') => void
  onMovePath: (fromRelPath: string, toRelPath: string) => Promise<void>
}

export function NotesTreeView({
  tree,
  searchTerm,
  activeNotePath,
  selectedEntry,
  collapseAllToken = 0,
  pendingEditId,
  onPendingEditHandled,
  onSelectionChange,
  onOpenNote,
  onCreateNote,
  onCreateFolder,
  onRenamePath,
  onDeletePath,
  onMovePath
}: NotesTreeViewProps): ReactElement {
  const treeRef = useRef<TreeApi<NoteTreeNode> | null>(null)
  const lastSyncedSelectionIdRef = useRef<string | undefined>(undefined)
  const { ref: containerRef, height } = useElementSize()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [hoveredDropFolderId, setHoveredDropFolderId] = useState<string | null>(null)
  const [isRootDropTarget, setIsRootDropTarget] = useState(false)
  const useNativeMenus = canUseNativeMenus()
  const treeHeight = height > 8 ? height - 8 : 320
  const deferredSearchTerm = useDeferredValue(searchTerm.trim().toLowerCase())
  const matchSearchTerm = useCallback(
    (node: NodeApi<NoteTreeNode>, term: string): boolean =>
      node.data.name.toLowerCase().includes(term) || node.data.relPath.toLowerCase().includes(term),
    []
  )

  const currentSelectionId = selectedEntry
    ? toTreeId(selectedEntry.kind, selectedEntry.relPath)
    : activeNotePath
      ? toTreeId('note', activeNotePath)
      : undefined

  useEffect(() => {
    const selectedId = currentSelectionId
    if (!selectedId) {
      lastSyncedSelectionIdRef.current = undefined
      return
    }

    const instance = treeRef.current
    if (!instance) {
      return
    }

    if (lastSyncedSelectionIdRef.current === selectedId) {
      return
    }

    instance.openParents(selectedId)
    instance.select(selectedId)
    instance.scrollTo(selectedId, 'smart')
    lastSyncedSelectionIdRef.current = selectedId
  }, [currentSelectionId])

  useEffect(() => {
    if (!pendingEditId) {
      return
    }

    if (!resolveNodeById(tree, pendingEditId)) {
      return
    }

    const instance = treeRef.current
    if (!instance) {
      return
    }

    instance.openParents(pendingEditId)
    instance.select(pendingEditId)
    instance.scrollTo(pendingEditId, 'smart')
    let frame = 0
    let innerFrame = 0

    frame = window.requestAnimationFrame(() => {
      innerFrame = window.requestAnimationFrame(() => {
        setEditingId(pendingEditId)
        onPendingEditHandled()
      })
    })

    return () => {
      window.cancelAnimationFrame(frame)
      window.cancelAnimationFrame(innerFrame)
    }
  }, [onPendingEditHandled, pendingEditId, tree])

  useEffect(() => {
    if (!editingId) {
      return
    }

    if (!resolveNodeById(tree, editingId)) {
      const frame = window.requestAnimationFrame(() => {
        setEditingId(null)
      })

      return () => {
        window.cancelAnimationFrame(frame)
      }
    }

    return
  }, [editingId, tree])

  useEffect(() => {
    if (collapseAllToken === 0) {
      return
    }

    treeRef.current?.closeAll()
    const frame = window.requestAnimationFrame(() => {
      setHoveredDropFolderId(null)
      setIsRootDropTarget(false)
    })

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [collapseAllToken])

  useEffect(() => {
    const clearDropState = (): void => {
      setHoveredDropFolderId(null)
      setIsRootDropTarget(false)
    }

    window.addEventListener('dragend', clearDropState)
    window.addEventListener('drop', clearDropState)

    return () => {
      window.removeEventListener('dragend', clearDropState)
      window.removeEventListener('drop', clearDropState)
    }
  }, [])

  const renderNoteTreeDragPreview = (props: DragPreviewProps): ReactElement | null => {
    const previewEntry = props.id ? resolveNodeById(tree, props.id) : null
    if (!props.isDragging || !previewEntry) {
      return null
    }

    const label =
      previewEntry.kind === 'folder' ? previewEntry.name : stripNoteExtension(previewEntry.name)

    const position = props.offset ?? props.mouse
    if (!position) {
      return null
    }

    return createPortal(
      <div className="pointer-events-none fixed inset-0 z-[200]">
        <div
          className="absolute min-w-[180px] max-w-[280px] border border-[var(--accent-line)] bg-[var(--panel)] px-3 py-2 shadow-[0_14px_38px_rgba(15,23,42,0.22)]"
          style={{
            left: position.x + 14,
            top: position.y + 10
          }}
        >
          <div className="flex items-center gap-2 text-sm text-[var(--text)]">
            {previewEntry.kind === 'folder' ? (
              <Folder className="h-4 w-4 shrink-0 text-[var(--accent)]" strokeWidth={1.9} />
            ) : (
              <FileText className="h-4 w-4 shrink-0 text-[var(--muted)]" strokeWidth={1.9} />
            )}
            <span className="truncate font-medium">{label}</span>
          </div>
          {props.dragIds.length > 1 ? (
            <div className="mt-1 text-xs text-[var(--muted)]">{props.dragIds.length} items</div>
          ) : null}
        </div>
      </div>,
      document.body
    )
  }

  if (tree.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-sm text-[var(--muted)]">
        No notes or folders yet
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'h-full min-h-0 p-2 transition-[filter] duration-150 ease-out',
        isRootDropTarget && 'drop-shadow-[0_0_0.65rem_rgba(99,102,241,0.18)]'
      )}
      data-testid="notes-tree-view"
    >
      <div
        className={cn(
          'h-full min-h-0 border border-transparent transition-colors duration-150 ease-out',
          isRootDropTarget && 'bg-[color-mix(in_srgb,var(--accent-soft)_45%,transparent)]'
        )}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setHoveredDropFolderId(null)
            setIsRootDropTarget(false)
          }
        }}
      >
        <Tree
          ref={treeRef}
          data={tree}
          width="100%"
          height={treeHeight}
          rowHeight={TREE_ROW_HEIGHT}
          indent={TREE_INDENT}
          overscanCount={8}
          padding={4}
          openByDefault={false}
          disableMultiSelection
          selection={currentSelectionId}
          renderDragPreview={renderNoteTreeDragPreview}
          renderCursor={() => null}
          searchTerm={deferredSearchTerm}
          searchMatch={matchSearchTerm}
          onSelect={(nodes) => {
            const node = nodes[0]
            if (!node) {
              onSelectionChange(null)
              return
            }
            onSelectionChange({
              kind: node.data.kind,
              relPath: node.data.relPath
            })
          }}
          onActivate={(node) => {
            if (node.data.kind === 'note') {
              onOpenNote(node.data.relPath)
              return
            }
            node.toggle()
          }}
          disableDrop={({ parentNode, dragNodes, index }) => {
            const dropVisualState = getNoteTreeDropVisualState({
              parentNode: parentNode
                ? {
                    id: parentNode.id,
                    isRoot: parentNode.isRoot,
                    data: parentNode.isRoot ? undefined : { kind: parentNode.data.kind }
                  }
                : null,
              index
            })

            if (!parentNode || parentNode.isRoot) {
              return false
            }

            if (parentNode.data.kind === 'note' || dropVisualState.isRootDropTarget) {
              return true
            }

            const parentPath = parentNode.data.relPath
            return dragNodes.some((dragNode) => {
              if (dragNode.data.kind !== 'folder') {
                return false
              }
              return (
                parentPath === dragNode.data.relPath ||
                parentPath.startsWith(`${dragNode.data.relPath}/`)
              )
            })
          }}
          onMove={async ({ dragIds, parentId }) => {
            setHoveredDropFolderId(null)
            setIsRootDropTarget(false)
            const targetFolderPath = resolveFolderPathFromId(parentId)
            for (const dragId of dragIds) {
              const entry = resolveNodeById(tree, dragId)
              if (!entry) {
                continue
              }

              const nextRelPath = joinRelPath(targetFolderPath, entry.name)
              if (nextRelPath === entry.relPath) {
                continue
              }
              await onMovePath(entry.relPath, nextRelPath)
            }
          }}
        >
          {(props) => (
            <TreeNode
              {...props}
              isEditing={editingId === props.node.id}
              onCreateNote={onCreateNote}
              onCreateFolder={onCreateFolder}
              onCancelEditing={() => setEditingId(null)}
              onCommitRename={(value) => {
                setEditingId(null)
                onRenamePath(props.node.data.relPath, value, props.node.data.kind)
              }}
              onStartEditing={() => setEditingId(props.node.id)}
              onDeletePath={onDeletePath}
              useNativeMenus={useNativeMenus}
              hoveredDropFolderId={hoveredDropFolderId}
              treeRef={treeRef}
            />
          )}
        </Tree>
      </div>
    </div>
  )
}

function TreeNode({
  node,
  style,
  dragHandle,
  isEditing,
  onCreateNote,
  onCreateFolder,
  onCancelEditing,
  onCommitRename,
  onStartEditing,
  onDeletePath,
  useNativeMenus,
  hoveredDropFolderId,
  treeRef
}: NodeRendererProps<NoteTreeNode> & {
  isEditing: boolean
  onCreateNote: (parentDir: string) => void
  onCreateFolder: (parentDir: string) => void
  onCancelEditing: () => void
  onCommitRename: (value: string) => void
  onStartEditing: () => void
  onDeletePath: (relPath: string, kind: 'note' | 'folder') => void
  useNativeMenus: boolean
  hoveredDropFolderId: string | null
  treeRef: RefObject<TreeApi<NoteTreeNode> | null>
}): ReactElement {
  const parentDir = node.data.kind === 'folder' ? node.data.relPath : node.data.note.dir
  const isFolder = node.data.kind === 'folder'
  const isProtected = Boolean(node.data.isProtected)
  const canCreateChildren = !isProtected || node.data.protectionKind === 'project-folder'
  const isDropTarget = isFolder && (node.willReceiveDrop || node.id === hoveredDropFolderId)
  const pointerDownRef = useRef<{ x: number; y: number } | null>(null)
  const dropdownActionRef = useRef<string | null>(null)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const rowStyle = style as CSSProperties
  const rowIndent = rowStyle.paddingLeft
  const fullWidthRowStyle: CSSProperties = {
    ...rowStyle,
    width: '100%',
    paddingLeft: 0
  }

  useEffect(() => {
    if (!isDropTarget || !isFolder || node.isOpen) {
      return
    }

    const timeout = window.setTimeout(() => {
      const treeApi = treeRef.current
      const latestNode = treeApi?.get(node.id)
      if (latestNode && !latestNode.isOpen) {
        latestNode.open()
      }
    }, AUTO_EXPAND_DELAY_MS)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [isDropTarget, isFolder, node.id, node.isOpen, treeRef])

  const handleRenameRequest = (): void => {
    if (isProtected) {
      return
    }
    onStartEditing()
  }

  const handleMenuAction = (actionId: string): void => {
    if (actionId === 'create-note') {
      if (!canCreateChildren) {
        return
      }
      onCreateNote(parentDir)
      return
    }
    if (actionId === 'create-folder') {
      if (!canCreateChildren) {
        return
      }
      onCreateFolder(parentDir)
      return
    }
    if (actionId === 'rename') {
      handleRenameRequest()
      return
    }
    if (actionId === 'delete') {
      if (isProtected) {
        return
      }
      onDeletePath(node.data.relPath, node.data.kind)
    }
  }

  const handleDropdownMenuAction = (
    event:
      | React.MouseEvent<HTMLButtonElement>
      | React.PointerEvent<HTMLButtonElement>
      | React.KeyboardEvent<HTMLButtonElement>,
    actionId: string
  ): void => {
    event.preventDefault()
    event.stopPropagation()
    if (dropdownActionRef.current === actionId) {
      return
    }
    dropdownActionRef.current = actionId
    window.setTimeout(() => {
      dropdownActionRef.current = null
    }, 0)
    setIsDropdownOpen(false)
    handleMenuAction(actionId)
  }

  const handleDropdownMenuKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    actionId: string
  ): void => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return
    }
    handleDropdownMenuAction(event, actionId)
  }

  const handleNativeContextMenu = async (
    event: React.MouseEvent<HTMLDivElement>
  ): Promise<void> => {
    event.preventDefault()
    const actionId = await showNativeMenu(
      buildNotesTreeMenuItems(isProtected, canCreateChildren),
      getMouseMenuPosition(event)
    )
    if (actionId) {
      handleMenuAction(actionId)
    }
  }

  const handleNativeMenuButtonClick = async (
    event: React.MouseEvent<HTMLButtonElement>
  ): Promise<void> => {
    event.preventDefault()
    event.stopPropagation()
    const actionId = await showNativeMenu(
      buildNotesTreeMenuItems(isProtected, canCreateChildren),
      getElementMenuPosition(event.currentTarget)
    )
    if (actionId) {
      handleMenuAction(actionId)
    }
  }

  const activateRow = (): void => {
    node.select()

    if (isFolder) {
      node.toggle()
      return
    }

    node.activate()
  }

  const handleRowClick = (event: React.MouseEvent<HTMLDivElement>): void => {
    if (isEditing || isTreeRowControl(event.target)) {
      return
    }

    activateRow()
  }

  const handleRowPointerDown = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (isEditing || isTreeRowControl(event.target) || event.button !== 0) {
      pointerDownRef.current = null
      return
    }

    pointerDownRef.current = { x: event.clientX, y: event.clientY }
  }

  const handleRowPointerUp = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (isEditing || isTreeRowControl(event.target) || event.button !== 0) {
      pointerDownRef.current = null
      return
    }

    const start = pointerDownRef.current
    pointerDownRef.current = null
    if (!start) {
      return
    }

    const movedX = Math.abs(event.clientX - start.x)
    const movedY = Math.abs(event.clientY - start.y)
    if (movedX > 4 || movedY > 4) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    activateRow()
  }

  const treeNodeRow = (
    <div
      style={fullWidthRowStyle}
      className="group h-full w-full cursor-default"
      onClick={handleRowClick}
      onPointerDown={handleRowPointerDown}
      onPointerUp={handleRowPointerUp}
    >
      <div
        data-testid={`note-tree-row:${node.data.relPath}`}
        className={cn(
          'relative flex h-full w-full min-w-0 items-center text-sm transition-colors duration-150 ease-out',
          node.isDragging && 'opacity-25',
          isDropTarget
            ? 'bg-[color-mix(in_srgb,var(--accent-soft)_88%,var(--panel))] text-[var(--text)]'
            : node.isSelected
              ? 'bg-[var(--accent-soft)] text-[var(--text)]'
              : 'text-[var(--text)] hover:bg-[var(--panel-2)]'
        )}
        onContextMenu={
          useNativeMenus && !isEditing ? (event) => void handleNativeContextMenu(event) : undefined
        }
        ref={(element) => {
          if (!isProtected) {
            dragHandle?.(element)
          }
        }}
      >
        <div
          className="relative z-10 flex h-full w-full min-w-0 items-center gap-2 px-2"
          style={{ paddingLeft: rowIndent }}
        >
          <button
            type="button"
            className={`flex h-4 w-4 shrink-0 items-center justify-center text-[var(--muted)] ${
              isFolder ? 'opacity-100' : 'opacity-0'
            }`}
            onClick={(event) => {
              event.stopPropagation()
              if (isFolder) {
                node.toggle()
              }
            }}
            tabIndex={-1}
          >
            {isFolder ? (
              <ChevronRight
                className={`${TREE_CHEVRON_CLASS} transition-transform ${node.isOpen ? 'rotate-90' : ''}`}
              />
            ) : null}
          </button>
          {isFolder ? (
            node.isOpen ? (
              <FolderOpen className={`${TREE_ICON_CLASS} text-[var(--accent)]`} strokeWidth={1.9} />
            ) : (
              <Folder className={`${TREE_ICON_CLASS} text-[var(--accent)]`} strokeWidth={1.9} />
            )
          ) : (
            <FileText className={`${TREE_ICON_CLASS} text-[var(--muted)]`} strokeWidth={1.9} />
          )}
          {isEditing ? (
            <TreeNodeInput node={node} onCancel={onCancelEditing} onCommit={onCommitRename} />
          ) : (
            <span className="block min-w-0 flex-1 truncate">
              {isFolder ? node.data.name : stripNoteExtension(node.data.name)}
            </span>
          )}
          {!isEditing && !isProtected ? (
            useNativeMenus ? (
              <button
                type="button"
                data-testid={`note-tree-menu:${node.data.relPath}`}
                className="ml-auto inline-flex h-5 w-5 shrink-0 items-center justify-center text-[var(--muted)] opacity-0 transition hover:bg-[var(--panel)] hover:text-[var(--text)] focus-visible:opacity-100 group-hover:opacity-100"
                onPointerDown={(event) => {
                  event.stopPropagation()
                }}
                onClick={(event) => void handleNativeMenuButtonClick(event)}
                title={`Open ${isFolder ? 'folder' : 'note'} menu`}
                aria-label={`Open ${isFolder ? 'folder' : 'note'} menu for ${stripNoteExtension(node.data.name)}`}
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            ) : (
              <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    data-testid={`note-tree-menu:${node.data.relPath}`}
                    className="ml-auto inline-flex h-5 w-5 shrink-0 items-center justify-center text-[var(--muted)] opacity-0 transition hover:bg-[var(--panel)] hover:text-[var(--text)] focus-visible:opacity-100 group-hover:opacity-100"
                    onPointerDown={(event) => {
                      event.stopPropagation()
                    }}
                    onClick={(event) => {
                      event.stopPropagation()
                    }}
                    title={`Open ${isFolder ? 'folder' : 'note'} menu`}
                    aria-label={`Open ${isFolder ? 'folder' : 'note'} menu for ${stripNoteExtension(node.data.name)}`}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  onCloseAutoFocus={(event) => {
                    event.preventDefault()
                  }}
                >
                  {canCreateChildren ? (
                    <>
                      <button
                        type="button"
                        role="menuitem"
                        className={TREE_DROPDOWN_ITEM_CLASS}
                        onPointerDownCapture={(event) =>
                          handleDropdownMenuAction(event, 'create-note')
                        }
                        onClick={(event) => handleDropdownMenuAction(event, 'create-note')}
                        onKeyDown={(event) => handleDropdownMenuKeyDown(event, 'create-note')}
                      >
                        <FileText className="mr-2 h-4 w-4" />
                        New note
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        data-testid={`note-tree-create-folder:${node.data.relPath}`}
                        className={TREE_DROPDOWN_ITEM_CLASS}
                        onPointerDownCapture={(event) =>
                          handleDropdownMenuAction(event, 'create-folder')
                        }
                        onClick={(event) => handleDropdownMenuAction(event, 'create-folder')}
                        onKeyDown={(event) => handleDropdownMenuKeyDown(event, 'create-folder')}
                      >
                        <FolderPlus className="mr-2 h-4 w-4" />
                        New folder
                      </button>
                    </>
                  ) : null}
                  <button
                    type="button"
                    role="menuitem"
                    data-testid={`note-tree-rename:${node.data.relPath}`}
                    className={TREE_DROPDOWN_ITEM_CLASS}
                    onPointerDownCapture={(event) => handleDropdownMenuAction(event, 'rename')}
                    onClick={(event) => handleDropdownMenuAction(event, 'rename')}
                    onKeyDown={(event) => handleDropdownMenuKeyDown(event, 'rename')}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Rename
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className={`${TREE_DROPDOWN_ITEM_CLASS} text-[var(--danger)] focus:bg-[rgba(220,38,38,0.14)] focus:text-[var(--danger)]`}
                    onPointerDownCapture={(event) => handleDropdownMenuAction(event, 'delete')}
                    onClick={(event) => handleDropdownMenuAction(event, 'delete')}
                    onKeyDown={(event) => handleDropdownMenuKeyDown(event, 'delete')}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </button>
                </DropdownMenuContent>
              </DropdownMenu>
            )
          ) : null}
        </div>
      </div>
    </div>
  )

  if (useNativeMenus) {
    return treeNodeRow
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{treeNodeRow}</ContextMenuTrigger>
      <ContextMenuContent>
        {canCreateChildren ? (
          <>
            <ContextMenuItem onSelect={() => handleMenuAction('create-note')}>
              <FileText className="mr-2 h-4 w-4" />
              New note
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => handleMenuAction('create-folder')}>
              <FolderPlus className="mr-2 h-4 w-4" />
              New folder
            </ContextMenuItem>
          </>
        ) : null}
        {!isProtected ? (
          <>
            <ContextMenuItem
              onClick={handleRenameRequest}
              onSelect={() => handleMenuAction('rename')}
            >
              <Pencil className="mr-2 h-4 w-4" />
              Rename
            </ContextMenuItem>
            <ContextMenuDestructiveItem onSelect={() => handleMenuAction('delete')}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </ContextMenuDestructiveItem>
          </>
        ) : null}
      </ContextMenuContent>
    </ContextMenu>
  )
}

function isTreeRowControl(target: EventTarget): boolean {
  return target instanceof HTMLElement && Boolean(target.closest('button,input,textarea,select'))
}

function TreeNodeInput({
  node,
  onCancel,
  onCommit
}: {
  node: NodeRendererProps<NoteTreeNode>['node']
  onCancel: () => void
  onCommit: (value: string) => void
}): ReactElement {
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    })

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <input
      ref={inputRef}
      autoFocus
      type="text"
      data-testid={`note-tree-input:${node.data.relPath}`}
      defaultValue={
        node.data.kind === 'folder' ? node.data.name : stripNoteExtension(node.data.name)
      }
      className="h-7 flex-1 border border-[var(--accent-line)] bg-[var(--panel)] px-2 text-sm outline-none"
      onFocus={(event) => event.currentTarget.select()}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.stopPropagation()}
      onBlur={(event) => onCommit(event.currentTarget.value)}
      onKeyDown={(event) => {
        event.stopPropagation()
        if (event.key === 'Escape') {
          event.preventDefault()
          onCancel()
          return
        }

        if (event.key === 'Enter') {
          event.preventDefault()
          onCommit(event.currentTarget.value)
        }
      }}
    />
  )
}

function resolveFolderPathFromId(id: string | null): string {
  if (!id) {
    return ''
  }
  return id.startsWith('folder:') ? id.slice('folder:'.length) : ''
}

function resolveNodeById(nodes: NoteTreeNode[], id: string): NoteTreeNode | null {
  for (const node of nodes) {
    if (node.id === id) {
      return node
    }
    if (node.kind === 'folder') {
      const match = resolveNodeById(node.children, id)
      if (match) {
        return match
      }
    }
  }
  return null
}

function joinRelPath(parentDir: string, name: string): string {
  return parentDir ? `${parentDir}/${name}` : name
}

function toTreeId(kind: 'note' | 'folder', relPath: string): string {
  return `${kind}:${relPath}`
}

function buildNotesTreeMenuItems(
  isProtected: boolean,
  canCreateChildren: boolean
): NativeMenuItemDescriptor[] {
  const items: NativeMenuItemDescriptor[] = []

  if (canCreateChildren) {
    items.push(
      { id: 'create-note', label: 'New note' },
      { id: 'create-folder', label: 'New folder' }
    )
  }

  if (!isProtected) {
    if (items.length > 0) {
      items.push({ type: 'separator' })
    }
    items.push(
      { id: 'rename', label: 'Rename' },
      { type: 'separator' },
      { id: 'delete', label: 'Delete', accelerator: 'Command+Backspace' }
    )
  }

  return items
}
