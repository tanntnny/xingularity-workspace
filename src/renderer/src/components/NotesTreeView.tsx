/* eslint-disable react/prop-types */
import {
  CSSProperties,
  ReactElement,
  RefObject,
  MouseEvent,
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
import { getPrimaryNoteTreeSelectionEntry, type NoteTreeSelection } from '../lib/noteTreeSelection'
import { cn } from '../lib/utils'

const TREE_ICON_CLASS = 'h-4 w-4 shrink-0'
const TREE_CHEVRON_CLASS = 'h-3.5 w-3.5 shrink-0'
const TREE_DROPDOWN_ITEM_CLASS =
  'relative flex w-full cursor-default select-none items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none transition-colors focus:bg-[var(--accent-color)] focus:text-[var(--accent-foreground)] hover:bg-[var(--accent-color)] hover:text-[var(--accent-foreground)]'
const TREE_INDENT = 18
const TREE_ROW_HEIGHT = 28
const AUTO_EXPAND_DELAY_MS = 400
const TREE_AUTO_SCROLL_EDGE_PX = 48
const TREE_AUTO_SCROLL_MAX_STEP = 18
const TREE_DROP_TARGET_ROW_CLASS =
  'bg-[color-mix(in_srgb,var(--accent-soft)_94%,var(--panel))] text-[var(--text)] shadow-[inset_3px_0_0_var(--accent),inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_18%,transparent),0_0_18px_rgba(99,102,241,0.14)]'

interface NotesTreeViewProps {
  tree: NoteTreeNode[]
  searchTerm: string
  activeNotePath: string | null
  selectedEntries: NoteTreeSelection
  collapseAllToken?: number
  pendingEditId: string | null
  onPendingEditHandled: () => void
  onSelectionChange: (entries: NoteTreeSelection) => void
  onOpenNote: (relPath: string) => void
  onCreateNote: (parentDir: string) => void
  onCreateFolder: (parentDir: string) => void
  onRenamePath: (relPath: string, nextName: string, kind: 'note' | 'folder') => void
  onDeleteEntries: (entries: NoteTreeSelection) => void
  onMoveEntries: (entries: NoteTreeSelection, targetFolderPath: string) => Promise<void>
}

export function NotesTreeView({
  tree,
  searchTerm,
  activeNotePath,
  selectedEntries,
  collapseAllToken = 0,
  pendingEditId,
  onPendingEditHandled,
  onSelectionChange,
  onOpenNote,
  onCreateNote,
  onCreateFolder,
  onRenamePath,
  onDeleteEntries,
  onMoveEntries
}: NotesTreeViewProps): ReactElement {
  const treeRef = useRef<TreeApi<NoteTreeNode> | null>(null)
  const lastSyncedSelectionKeyRef = useRef<string>('')
  const { ref: sizeContainerRef, height } = useElementSize()
  const [editingId, setEditingId] = useState<string | null>(null)
  const autoScrollFrameRef = useRef<number | null>(null)
  const dragClientYRef = useRef<number | null>(null)
  const stepAutoScrollRef = useRef<() => void>(() => {})
  const useNativeMenus = canUseNativeMenus()
  const treeHeight = height > 8 ? height - 8 : 320
  const deferredSearchTerm = useDeferredValue(searchTerm.trim().toLowerCase())
  const matchSearchTerm = useCallback(
    (node: NodeApi<NoteTreeNode>, term: string): boolean =>
      node.data.name.toLowerCase().includes(term) || node.data.relPath.toLowerCase().includes(term),
    []
  )

  const fallbackSelectionEntry: NoteTreeSelection = activeNotePath
    ? [{ kind: 'note', relPath: activeNotePath }]
    : []
  const effectiveSelectionEntries =
    selectedEntries.length > 0 ? selectedEntries : fallbackSelectionEntry
  const selectionIds = effectiveSelectionEntries.map((entry) => toTreeId(entry.kind, entry.relPath))
  const selectionKey = selectionIds.join('|')
  const primarySelectionEntry = getPrimaryNoteTreeSelectionEntry(effectiveSelectionEntries)
  const primarySelectionId = primarySelectionEntry
    ? toTreeId(primarySelectionEntry.kind, primarySelectionEntry.relPath)
    : undefined

  useEffect(() => {
    const instance = treeRef.current
    if (!instance) {
      return
    }

    if (selectionIds.length === 0) {
      if (lastSyncedSelectionKeyRef.current === '') {
        return
      }
      instance.deselectAll()
      lastSyncedSelectionKeyRef.current = ''
      return
    }

    if (lastSyncedSelectionKeyRef.current === selectionKey) {
      return
    }

    if (primarySelectionId) {
      instance.openParents(primarySelectionId)
    }

    instance.setSelection({
      ids: selectionIds,
      anchor: selectionIds[0] ?? null,
      mostRecent: primarySelectionId ?? selectionIds[selectionIds.length - 1] ?? null
    })

    if (primarySelectionId) {
      instance.scrollTo(primarySelectionId, 'smart')
    }

    lastSyncedSelectionKeyRef.current = selectionKey
  }, [primarySelectionId, selectionIds, selectionKey])

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
  }, [collapseAllToken])

  const stopAutoScroll = useCallback((): void => {
    dragClientYRef.current = null
    if (autoScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(autoScrollFrameRef.current)
      autoScrollFrameRef.current = null
    }
  }, [])

  const stepAutoScroll = useCallback((): void => {
    const listEl = treeRef.current?.listEl.current
    const clientY = dragClientYRef.current
    if (!listEl || clientY === null) {
      autoScrollFrameRef.current = null
      return
    }

    const rect = listEl.getBoundingClientRect()
    let delta = 0

    if (clientY < rect.top + TREE_AUTO_SCROLL_EDGE_PX) {
      const distance = rect.top + TREE_AUTO_SCROLL_EDGE_PX - clientY
      delta = -Math.min(TREE_AUTO_SCROLL_MAX_STEP, Math.max(4, distance * 0.35))
    } else if (clientY > rect.bottom - TREE_AUTO_SCROLL_EDGE_PX) {
      const distance = clientY - (rect.bottom - TREE_AUTO_SCROLL_EDGE_PX)
      delta = Math.min(TREE_AUTO_SCROLL_MAX_STEP, Math.max(4, distance * 0.35))
    }

    if (delta !== 0) {
      listEl.scrollTo({
        top: listEl.scrollTop + delta
      })
    }

    autoScrollFrameRef.current = window.requestAnimationFrame(() => stepAutoScrollRef.current())
  }, [])

  useEffect(() => {
    stepAutoScrollRef.current = stepAutoScroll
  }, [stepAutoScroll])

  const handleTreeDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>): void => {
      dragClientYRef.current = event.clientY
      if (autoScrollFrameRef.current === null) {
        autoScrollFrameRef.current = window.requestAnimationFrame(stepAutoScroll)
      }
    },
    [stepAutoScroll]
  )

  useEffect(() => {
    window.addEventListener('drop', stopAutoScroll)
    window.addEventListener('dragend', stopAutoScroll)

    return () => {
      window.removeEventListener('drop', stopAutoScroll)
      window.removeEventListener('dragend', stopAutoScroll)
      stopAutoScroll()
    }
  }, [stopAutoScroll])

  const renderNoteTreeDragPreview = (props: DragPreviewProps): ReactElement | null => {
    const previewEntry = props.id ? resolveNodeById(tree, props.id) : null
    if (!props.isDragging || !previewEntry) {
      return null
    }

    const position = props.offset ?? props.mouse
    if (!position) {
      return null
    }

    const label =
      previewEntry.kind === 'folder' ? previewEntry.name : stripNoteExtension(previewEntry.name)

    return createPortal(
      <div className="pointer-events-none fixed inset-0 z-[200]">
        <div
          className="absolute min-w-[180px] max-w-[280px] border border-[var(--accent-line)] bg-[var(--panel)] px-3 py-2 opacity-80 shadow-[0_14px_38px_rgba(15,23,42,0.22)]"
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

  const getDeleteShortcutEntries = (): NoteTreeSelection => {
    const selectedNodes = treeRef.current?.selectedNodes ?? []
    const selectedDeletableEntries = selectedNodes
      .filter((node) => !node.data.isProtected)
      .map((node) => ({
        kind: node.data.kind,
        relPath: node.data.relPath
      }))

    if (selectedDeletableEntries.length > 0) {
      return selectedDeletableEntries
    }

    const focusedNode = treeRef.current?.focusedNode
    if (focusedNode && !focusedNode.data.isProtected) {
      return [{ kind: focusedNode.data.kind, relPath: focusedNode.data.relPath }]
    }

    return effectiveSelectionEntries.filter((entry) => {
      const node = treeRef.current?.get(toTreeId(entry.kind, entry.relPath))
      return node ? !node.data.isProtected : true
    })
  }

  return (
    <div
      ref={sizeContainerRef}
      className="h-full min-h-0 p-2"
      data-testid="notes-tree-view"
      onKeyDownCapture={(event) => {
        if (isDeleteShortcut(event) && !isEditingTextInput(event.target)) {
          const entries = getDeleteShortcutEntries()
          if (entries.length === 0) {
            return
          }

          event.preventDefault()
          event.stopPropagation()
          onDeleteEntries(entries)
          return
        }

        if (event.key !== 'Enter' || isEditingTextInput(event.target)) {
          return
        }

        const focusedNode = treeRef.current?.focusedNode
        if (!focusedNode || focusedNode.data.kind !== 'folder' || focusedNode.data.isProtected) {
          return
        }

        event.preventDefault()
        event.stopPropagation()
        setEditingId(focusedNode.id)
      }}
      onDragOver={handleTreeDragOver}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          stopAutoScroll()
        }
      }}
      onDrop={() => {
        stopAutoScroll()
      }}
    >
      <div className="h-full min-h-0">
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
          renderDragPreview={renderNoteTreeDragPreview}
          renderCursor={EmptyCursor}
          searchTerm={deferredSearchTerm}
          searchMatch={matchSearchTerm}
          onSelect={(nodes) => {
            const nextSelection = nodes.map((node) => ({
              kind: node.data.kind,
              relPath: node.data.relPath
            }))

            if (areNoteTreeSelectionsEqual(nextSelection, selectedEntries)) {
              return
            }

            onSelectionChange(nextSelection)
          }}
          onActivate={(node) => {
            if (node.data.kind === 'note') {
              onOpenNote(node.data.relPath)
              return
            }
            node.toggle()
          }}
          disableDrop={({ parentNode, dragNodes }) => {
            if (!parentNode || parentNode.isRoot) {
              return false
            }

            if (parentNode.data.kind === 'note') {
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
            const targetFolderPath = resolveFolderPathFromId(parentId)
            const movedEntries = dragIds
              .map((dragId) => resolveNodeById(tree, dragId))
              .filter((entry): entry is NoteTreeNode => Boolean(entry))
              .map((entry) => ({
                kind: entry.kind,
                relPath: entry.relPath
              }))

            await onMoveEntries(movedEntries, targetFolderPath)
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
              onDeleteEntries={onDeleteEntries}
              useNativeMenus={useNativeMenus}
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
  onDeleteEntries,
  useNativeMenus,
  treeRef
}: NodeRendererProps<NoteTreeNode> & {
  isEditing: boolean
  onCreateNote: (parentDir: string) => void
  onCreateFolder: (parentDir: string) => void
  onCancelEditing: () => void
  onCommitRename: (value: string) => void
  onStartEditing: () => void
  onDeleteEntries: (entries: NoteTreeSelection) => void
  useNativeMenus: boolean
  treeRef: RefObject<TreeApi<NoteTreeNode> | null>
}): ReactElement {
  const parentDir = node.data.kind === 'folder' ? node.data.relPath : node.data.note.dir
  const isFolder = node.data.kind === 'folder'
  const isProtected = Boolean(node.data.isProtected)
  const canCreateChildren = !isProtected || node.data.protectionKind === 'project-folder'
  const isDropTarget = isFolder && node.willReceiveDrop
  const dropdownActionRef = useRef<string | null>(null)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const rowStyle = style as CSSProperties
  const rowIndent = rowStyle.paddingLeft
  const fullWidthRowStyle: CSSProperties = {
    ...rowStyle,
    width: '100%',
    paddingLeft: 0
  }
  const handleRowDragRef = useCallback(
    (element: HTMLDivElement | null): void => {
      if (!isProtected) {
        dragHandle?.(element)
      }
    },
    [dragHandle, isProtected]
  )

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

  const getDeleteActionEntries = (): NoteTreeSelection => {
    const selectedNodes = treeRef.current?.selectedNodes ?? []
    if (node.isSelected && selectedNodes.length > 1) {
      return selectedNodes.map((selectedNode) => ({
        kind: selectedNode.data.kind,
        relPath: selectedNode.data.relPath
      }))
    }

    return [{ kind: node.data.kind, relPath: node.data.relPath }]
  }

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
      onDeleteEntries(getDeleteActionEntries())
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

  const handleRowClick = (event: MouseEvent<HTMLDivElement>): void => {
    if (isEditing || isTreeRowControl(event.target)) {
      return
    }

    node.handleClick(event)

    if (
      isFolder &&
      event.button === 0 &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.shiftKey &&
      !event.altKey
    ) {
      node.toggle()
    }
  }

  const treeNodeRow = (
    <div
      style={fullWidthRowStyle}
      className="group h-full w-full cursor-default"
      onClick={handleRowClick}
    >
      <div
        data-testid={`note-tree-row:${node.data.relPath}`}
        className={cn(
          'relative flex h-full w-full min-w-0 items-center text-sm transition-[background-color,color,box-shadow] duration-150 ease-out',
          node.isDragging && 'opacity-30',
          isDropTarget
            ? TREE_DROP_TARGET_ROW_CLASS
            : node.isSelected
              ? 'bg-[var(--accent-soft)] text-[var(--text)]'
              : 'text-[var(--text)] hover:bg-[var(--panel-2)]'
        )}
        onContextMenu={
          useNativeMenus && !isEditing ? (event) => void handleNativeContextMenu(event) : undefined
        }
        ref={handleRowDragRef}
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
                className={cn(
                  TREE_CHEVRON_CLASS,
                  'transition-transform',
                  node.isOpen && 'rotate-90',
                  isDropTarget && 'text-[var(--accent)]'
                )}
              />
            ) : null}
          </button>
          {isFolder ? (
            node.isOpen ? (
              <FolderOpen
                className={cn(TREE_ICON_CLASS, 'text-[var(--accent)]')}
                strokeWidth={1.9}
              />
            ) : (
              <Folder className={cn(TREE_ICON_CLASS, 'text-[var(--accent)]')} strokeWidth={1.9} />
            )
          ) : (
            <FileText className={cn(TREE_ICON_CLASS, 'text-[var(--muted)]')} strokeWidth={1.9} />
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

function isEditingTextInput(target: EventTarget): boolean {
  return (
    target instanceof HTMLElement &&
    Boolean(target.closest('input,textarea,[contenteditable="true"]'))
  )
}

function isDeleteShortcut(event: { metaKey: boolean; key: string }): boolean {
  return event.metaKey && (event.key === 'Backspace' || event.key === 'Delete')
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

function toTreeId(kind: 'note' | 'folder', relPath: string): string {
  return `${kind}:${relPath}`
}

function EmptyCursor(): ReactElement | null {
  return null
}

function areNoteTreeSelectionsEqual(left: NoteTreeSelection, right: NoteTreeSelection): boolean {
  if (left.length !== right.length) {
    return false
  }

  return left.every(
    (entry, index) => entry.kind === right[index]?.kind && entry.relPath === right[index]?.relPath
  )
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
