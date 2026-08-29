/* eslint-disable react/prop-types */
import {
  CSSProperties,
  FocusEvent,
  ReactElement,
  RefObject,
  MouseEvent,
  useCallback,
  useDeferredValue,
  useEffect,
  useRef,
  useState
} from 'react'
import {
  ChevronRight,
  FileDown,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  Link,
  MoreHorizontal,
  PenTool,
  Pencil,
  Trash2
} from './ui/icons'
import {
  Tree,
  TreeApi,
  NodeRendererProps,
  type DragPreviewProps,
  type NodeApi,
  type RowRendererProps
} from 'react-arborist'
import { createPortal } from 'react-dom'
import { stripNotebookFileExtension } from '../../../shared/excalidrawFile'
import type { NativeMenuItemDescriptor, NoteTreeNode } from '../../../shared/types'
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from './ui/context-menu'
import { ActionMenuItems, type ActionMenuGroup } from './ui/action-menu'
import { DragSource } from './ui/drag-source'
import { DropZone } from './ui/drop-zone'
import { EmptyState } from './ui/empty-state'
import { Button, rowActionButtonClassName } from './ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from './ui/dropdown-menu'
import {
  canUseNativeMenus,
  getElementMenuPosition,
  getMouseMenuPosition,
  showNativeMenu
} from '../lib/nativeMenu'
import {
  getPrimaryNoteTreeSelectionEntry,
  normalizeNoteTreeSelection,
  type NoteTreeSelection
} from '../lib/noteTreeSelection'
import { cn } from '../lib/utils'

const TREE_ICON_CLASS = 'h-4 w-4 shrink-0'
const TREE_CHEVRON_CLASS = 'h-3.5 w-3.5 shrink-0'
const TREE_INDENT = 18
const TREE_ROW_HEIGHT = 28
const TREE_PADDING = 4
const TREE_MIN_HEIGHT = TREE_ROW_HEIGHT + TREE_PADDING * 2
const AUTO_EXPAND_DELAY_MS = 400
const TREE_AUTO_SCROLL_EDGE_PX = 48
const TREE_AUTO_SCROLL_MAX_STEP = 18

function renderTreeNodeLabel(label: string): ReactElement | string {
  const match = label.match(/^(\d+\+?)(\s+.*)$/)

  if (!match) {
    return label
  }

  const [, prefix, remainder] = match

  return (
    <>
      <span className="text-muted-foreground">{prefix}</span>
      {remainder}
    </>
  )
}

interface NotesTreeViewProps {
  tree: NoteTreeNode[]
  searchTerm: string
  activeNotePath: string | null
  selectedEntries: NoteTreeSelection
  collapseAllToken?: number
  shouldCollapseAllFolders?: boolean
  pendingEditId: string | null
  onPendingEditHandled: () => void
  onSelectionChange: (entries: NoteTreeSelection) => void
  onOpenNote: (relPath: string) => void
  onCreateNote: (parentDir: string) => void
  onCreateExcalidraw: (parentDir: string) => void
  onCreateFolder: (parentDir: string) => void
  onExportFolderPdf: (folderPath: string) => void
  onExportFolderMarkdown: (folderPath: string) => void
  onRenamePath: (relPath: string, nextName: string, kind: 'note' | 'excalidraw' | 'folder') => void
  onDeleteEntries: (entries: NoteTreeSelection) => void
  onMoveEntries: (entries: NoteTreeSelection, targetFolderPath: string) => Promise<void>
}

export function NotesTreeView({
  tree,
  searchTerm,
  activeNotePath,
  selectedEntries,
  collapseAllToken = 0,
  shouldCollapseAllFolders = false,
  pendingEditId,
  onPendingEditHandled,
  onSelectionChange,
  onOpenNote,
  onCreateNote,
  onCreateExcalidraw,
  onCreateFolder,
  onExportFolderPdf,
  onExportFolderMarkdown,
  onRenamePath,
  onDeleteEntries,
  onMoveEntries
}: NotesTreeViewProps): ReactElement {
  const treeRef = useRef<TreeApi<NoteTreeNode> | null>(null)
  const lastSyncedSelectionKeyRef = useRef<string>('')
  const [treeHeight, setTreeHeight] = useState(TREE_MIN_HEIGHT)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [nativeDropTargetId, setNativeDropTargetId] = useState<string | null>(null)
  const editingRequestFrameRef = useRef<number | null>(null)
  const treeHeightFrameRef = useRef<number | null>(null)
  const autoScrollFrameRef = useRef<number | null>(null)
  const dragClientYRef = useRef<number | null>(null)
  const stepAutoScrollRef = useRef<() => void>(() => {})
  const useNativeMenus = canUseNativeMenus()
  const deferredSearchTerm = useDeferredValue(searchTerm.trim().toLowerCase())

  const syncTreeHeight = useCallback((): void => {
    const instance = treeRef.current
    if (!instance) {
      return
    }

    const nextHeight = Math.max(
      TREE_MIN_HEIGHT,
      instance.visibleNodes.length * instance.rowHeight + TREE_PADDING * 2
    )
    setTreeHeight((current) => (current === nextHeight ? current : nextHeight))
  }, [])

  const requestTreeHeightSync = useCallback((): void => {
    if (treeHeightFrameRef.current !== null) {
      return
    }

    treeHeightFrameRef.current = window.requestAnimationFrame(() => {
      treeHeightFrameRef.current = null
      syncTreeHeight()
    })
  }, [syncTreeHeight])

  const cancelEditingRequest = useCallback((): void => {
    if (editingRequestFrameRef.current !== null) {
      window.cancelAnimationFrame(editingRequestFrameRef.current)
      editingRequestFrameRef.current = null
    }
  }, [])

  const requestEditing = useCallback((id: string): void => {
    if (editingRequestFrameRef.current !== null) {
      window.cancelAnimationFrame(editingRequestFrameRef.current)
    }

    editingRequestFrameRef.current = window.requestAnimationFrame(() => {
      editingRequestFrameRef.current = null
      setEditingId(id)
    })
  }, [])

  useEffect(() => cancelEditingRequest, [cancelEditingRequest])

  useEffect(() => {
    return () => {
      if (treeHeightFrameRef.current !== null) {
        window.cancelAnimationFrame(treeHeightFrameRef.current)
        treeHeightFrameRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    syncTreeHeight()
  }, [deferredSearchTerm, syncTreeHeight, tree])

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

    requestTreeHeightSync()

    lastSyncedSelectionKeyRef.current = selectionKey
  }, [primarySelectionId, requestTreeHeightSync, selectionIds, selectionKey])

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
    requestTreeHeightSync()
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
  }, [onPendingEditHandled, pendingEditId, requestTreeHeightSync, tree])

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

    if (shouldCollapseAllFolders) {
      treeRef.current?.closeAll()
      requestTreeHeightSync()
      return
    }

    treeRef.current?.openAll()
    requestTreeHeightSync()
  }, [collapseAllToken, requestTreeHeightSync, shouldCollapseAllFolders])

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
    const scrollport = listEl?.closest<HTMLElement>('[data-workspace-scrollport="true"]')
    if (!scrollport || clientY === null) {
      autoScrollFrameRef.current = null
      return
    }

    const rect = scrollport.getBoundingClientRect()
    let delta = 0

    if (clientY < rect.top + TREE_AUTO_SCROLL_EDGE_PX) {
      const distance = rect.top + TREE_AUTO_SCROLL_EDGE_PX - clientY
      delta = -Math.min(TREE_AUTO_SCROLL_MAX_STEP, Math.max(4, distance * 0.35))
    } else if (clientY > rect.bottom - TREE_AUTO_SCROLL_EDGE_PX) {
      const distance = clientY - (rect.bottom - TREE_AUTO_SCROLL_EDGE_PX)
      delta = Math.min(TREE_AUTO_SCROLL_MAX_STEP, Math.max(4, distance * 0.35))
    }

    if (delta !== 0) {
      scrollport.scrollTo({
        top: scrollport.scrollTop + delta
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
    const clearTreeDrag = (): void => {
      stopAutoScroll()
      setNativeDropTargetId(null)
    }

    window.addEventListener('drop', clearTreeDrag)
    window.addEventListener('dragend', clearTreeDrag)

    return () => {
      window.removeEventListener('drop', clearTreeDrag)
      window.removeEventListener('dragend', clearTreeDrag)
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
      previewEntry.kind === 'folder'
        ? previewEntry.name
        : stripNotebookFileExtension(previewEntry.name)

    return createPortal(
      <div className="pointer-events-none fixed inset-0 z-[200]">
        <DragSource
          as="div"
          visual="preview"
          preview="none"
          previewVariant="surface"
          data-testid="note-tree-drag-preview"
          aria-hidden="true"
          className="absolute min-w-[180px] max-w-[280px] rounded-[var(--radius-button)] px-3 py-2"
          style={{
            left: position.x + 14,
            top: position.y + 10
          }}
        >
          <div className="flex items-center gap-2 text-sm text-foreground">
            {previewEntry.kind === 'folder' ? (
              <Folder className="h-4 w-4 shrink-0 text-primary" strokeWidth={1.9} />
            ) : previewEntry.kind === 'excalidraw' ? (
              <PenTool className="h-4 w-4 shrink-0 text-foreground" strokeWidth={1.9} />
            ) : (
              <FileText className="h-4 w-4 shrink-0 text-foreground" strokeWidth={1.9} />
            )}
            <span className="truncate font-medium">{label}</span>
          </div>
          {props.dragIds.length > 1 ? (
            <div className="mt-1 text-xs text-muted-foreground">{props.dragIds.length} items</div>
          ) : null}
        </DragSource>
      </div>,
      document.body
    )
  }

  if (tree.length === 0) {
    return (
      <EmptyState
        data-testid="notes-tree-empty-state"
        className="h-full border-0 bg-transparent px-3 py-6"
        icon={FolderOpen}
        title="No notebooks or folders yet"
        description="Create a notebook or folder to get started."
      />
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
      className="min-w-0 p-2"
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
        requestEditing(focusedNode.id)
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
      <div className="min-w-0">
        <Tree
          ref={treeRef}
          data={tree}
          width="100%"
          height={treeHeight}
          rowHeight={TREE_ROW_HEIGHT}
          indent={TREE_INDENT}
          overscanCount={8}
          padding={TREE_PADDING}
          openByDefault={false}
          renderRow={MotionTreeRow}
          renderDragPreview={renderNoteTreeDragPreview}
          renderCursor={EmptyCursor}
          searchTerm={deferredSearchTerm}
          searchMatch={matchSearchTerm}
          onToggle={requestTreeHeightSync}
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
            if (node.data.kind !== 'folder') {
              onOpenNote(node.data.relPath)
              return
            }
            node.toggle()
          }}
          disableDrop={({ parentNode, dragNodes }) => {
            if (!parentNode || parentNode.isRoot) {
              return false
            }

            if (parentNode.data.kind !== 'folder') {
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
              onCreateExcalidraw={onCreateExcalidraw}
              onCreateFolder={onCreateFolder}
              onExportFolderPdf={onExportFolderPdf}
              onExportFolderMarkdown={onExportFolderMarkdown}
              onCancelEditing={() => {
                cancelEditingRequest()
                setEditingId(null)
              }}
              onCommitRename={(value) => {
                cancelEditingRequest()
                setEditingId(null)
                onRenamePath(props.node.data.relPath, value, props.node.data.kind)
              }}
              onStartEditing={() => requestEditing(props.node.id)}
              onDeleteEntries={onDeleteEntries}
              onMoveEntries={onMoveEntries}
              nativeDropTargetId={nativeDropTargetId}
              onNativeDropTargetChange={setNativeDropTargetId}
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
  tree,
  style,
  dragHandle,
  isEditing,
  onCreateNote,
  onCreateExcalidraw,
  onCreateFolder,
  onExportFolderPdf,
  onExportFolderMarkdown,
  onCancelEditing,
  onCommitRename,
  onStartEditing,
  onDeleteEntries,
  onMoveEntries,
  nativeDropTargetId,
  onNativeDropTargetChange,
  useNativeMenus,
  treeRef
}: NodeRendererProps<NoteTreeNode> & {
  isEditing: boolean
  onCreateNote: (parentDir: string) => void
  onCreateExcalidraw: (parentDir: string) => void
  onCreateFolder: (parentDir: string) => void
  onExportFolderPdf: (folderPath: string) => void
  onExportFolderMarkdown: (folderPath: string) => void
  onCancelEditing: () => void
  onCommitRename: (value: string) => void
  onStartEditing: () => void
  onDeleteEntries: (entries: NoteTreeSelection) => void
  onMoveEntries: (entries: NoteTreeSelection, targetFolderPath: string) => Promise<void>
  nativeDropTargetId: string | null
  onNativeDropTargetChange: (id: string | null) => void
  useNativeMenus: boolean
  treeRef: RefObject<TreeApi<NoteTreeNode> | null>
}): ReactElement {
  const parentDir =
    node.data.kind === 'folder'
      ? node.data.relPath
      : node.data.relPath.includes('/')
        ? node.data.relPath.slice(0, node.data.relPath.lastIndexOf('/'))
        : ''
  const isFolder = node.data.kind === 'folder'
  const isProtected = Boolean(node.data.isProtected)
  const canCreateChildren = !isProtected || node.data.protectionKind === 'project-folder'
  const isDropTarget = isFolder && nativeDropTargetId === node.id
  const renameFocusHandoffRef = useRef(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const rowStyle = style as CSSProperties
  const rowIndent = typeof rowStyle.paddingLeft === 'number' ? rowStyle.paddingLeft : 0
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

  useEffect(() => {
    if (isEditing) {
      renameFocusHandoffRef.current = false
    }
  }, [isEditing])

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
    renameFocusHandoffRef.current = true
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
    if (actionId === 'create-excalidraw') {
      if (!canCreateChildren) {
        return
      }
      onCreateExcalidraw(parentDir)
      return
    }
    if (actionId === 'create-folder') {
      if (!canCreateChildren) {
        return
      }
      onCreateFolder(parentDir)
      return
    }
    if (actionId === 'export-folder-pdf') {
      if (!isFolder || isProtected) {
        return
      }
      onExportFolderPdf(node.data.relPath)
      return
    }
    if (actionId === 'export-folder-markdown') {
      if (!isFolder || isProtected) {
        return
      }
      onExportFolderMarkdown(node.data.relPath)
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

  const menuGroups: ActionMenuGroup[] = [
    {
      id: 'creation',
      items: canCreateChildren
        ? [
            {
              id: 'create-note',
              label: 'New note',
              icon: <FileText aria-hidden="true" />,
              onSelect: () => handleMenuAction('create-note')
            },
            {
              id: 'create-excalidraw',
              label: 'New drawing',
              icon: <PenTool aria-hidden="true" />,
              onSelect: () => handleMenuAction('create-excalidraw')
            },
            {
              id: 'create-folder',
              label: 'New folder',
              icon: <FolderPlus aria-hidden="true" />,
              testId: `note-tree-create-folder:${node.data.relPath}`,
              onSelect: () => handleMenuAction('create-folder')
            }
          ]
        : []
    },
    {
      id: 'folder-actions',
      items:
        isFolder && !isProtected
          ? [
              {
                id: 'export-folder',
                label: 'Export nested notes',
                icon: <FileDown aria-hidden="true" />,
                contextTestId: `note-tree-export-folder-context:${node.data.relPath}`,
                dropdownTestId: `note-tree-export-folder-dropdown:${node.data.relPath}`,
                submenu: [
                  {
                    id: 'export-folder-pdf',
                    label: 'as PDF',
                    icon: <FileDown aria-hidden="true" />,
                    contextTestId: `note-tree-export-folder-pdf-context:${node.data.relPath}`,
                    dropdownTestId: `note-tree-export-folder-pdf-dropdown:${node.data.relPath}`,
                    onSelect: () => handleMenuAction('export-folder-pdf')
                  },
                  {
                    id: 'export-folder-markdown',
                    label: 'as Markdown',
                    icon: <FileText aria-hidden="true" />,
                    contextTestId: `note-tree-export-folder-markdown-context:${node.data.relPath}`,
                    dropdownTestId: `note-tree-export-folder-markdown-dropdown:${node.data.relPath}`,
                    onSelect: () => handleMenuAction('export-folder-markdown')
                  }
                ]
              }
            ]
          : []
    },
    {
      id: 'editing',
      items: !isProtected
        ? [
            {
              id: 'rename',
              label: 'Rename',
              icon: <Pencil aria-hidden="true" />,
              testId: `note-tree-rename:${node.data.relPath}`,
              onSelect: () => handleMenuAction('rename')
            }
          ]
        : []
    },
    {
      id: 'destructive',
      items: !isProtected
        ? [
            {
              id: 'delete',
              label: 'Delete',
              icon: <Trash2 aria-hidden="true" />,
              destructive: true,
              onSelect: () => handleMenuAction('delete')
            }
          ]
        : []
    }
  ]

  const handleNativeContextMenu = async (
    event: React.MouseEvent<HTMLDivElement>
  ): Promise<void> => {
    event.preventDefault()
    const actionId = await showNativeMenu(
      buildNotesTreeMenuItems(isProtected, canCreateChildren, isFolder),
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
      buildNotesTreeMenuItems(isProtected, canCreateChildren, isFolder),
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

  const handleNativeDragStart = (event: React.DragEvent<HTMLDivElement>): void => {
    const selectedNodes = node.isSelected ? tree.selectedNodes : []
    const dragEntries = normalizeNoteTreeSelection(
      (selectedNodes.length > 0 ? selectedNodes : [node]).map((dragNode) => ({
        kind: dragNode.data.kind,
        relPath: dragNode.data.relPath
      }))
    )
    const serializedEntries = JSON.stringify(dragEntries)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData(NOTE_TREE_DRAG_DATA_TYPE, serializedEntries)
    event.dataTransfer.setData('text/plain', serializedEntries)
  }

  const handleNativeDragOver = (event: React.DragEvent<HTMLDivElement>): void => {
    if (!isFolder) {
      return
    }

    const dragEntries = readDraggedEntries(event.dataTransfer)
    if (!dragEntries || !canDropEntriesIntoFolder(dragEntries, node.data.relPath)) {
      if (nativeDropTargetId === node.id) {
        onNativeDropTargetChange(null)
      }
      return
    }

    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    onNativeDropTargetChange(node.id)
  }

  const handleNativeDragLeave = (event: React.DragEvent<HTMLDivElement>): void => {
    if (
      nativeDropTargetId === node.id &&
      !event.currentTarget.contains(event.relatedTarget as Node | null)
    ) {
      onNativeDropTargetChange(null)
    }
  }

  const handleNativeDrop = (event: React.DragEvent<HTMLDivElement>): void => {
    if (nativeDropTargetId === node.id) {
      onNativeDropTargetChange(null)
    }
    if (!isFolder) {
      return
    }

    const dragEntries = readDraggedEntries(event.dataTransfer)
    if (!dragEntries || !canDropEntriesIntoFolder(dragEntries, node.data.relPath)) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    node.open()
    void onMoveEntries(dragEntries, node.data.relPath)
  }

  const treeNodeRow = (
    <DropZone
      as="div"
      active={isDropTarget}
      variant="row"
      style={fullWidthRowStyle}
      className={cn(
        'group relative flex h-full w-full min-w-0 cursor-grab items-center rounded-md text-sm transition-[background-color,color,box-shadow] duration-150 ease-out active:cursor-grabbing',
        isDropTarget
          ? 'text-foreground'
          : node.isSelected
            ? 'bg-muted text-foreground'
            : 'text-foreground hover:bg-muted'
      )}
      data-testid={`note-tree-row:${node.data.relPath}`}
      ref={handleRowDragRef}
      onClick={handleRowClick}
      onDragStart={handleNativeDragStart}
      onDragOver={handleNativeDragOver}
      onDragLeave={handleNativeDragLeave}
      onDrop={handleNativeDrop}
      onDragEnd={() => {
        if (nativeDropTargetId === node.id) {
          onNativeDropTargetChange(null)
        }
      }}
      onContextMenu={
        useNativeMenus && !isEditing ? (event) => void handleNativeContextMenu(event) : undefined
      }
    >
      {node.level > 0 ? (
        <div className="pointer-events-none absolute inset-0 z-0" aria-hidden="true">
          {Array.from({ length: node.level }, (_, guideIndex) => (
            <span
              key={guideIndex}
              data-testid={`note-tree-indent-guide:${node.data.relPath}:${guideIndex}`}
              className="absolute inset-y-0 w-[var(--border-width)] bg-border opacity-80"
              style={{
                left: rowIndent - TREE_INDENT / 2 - guideIndex * TREE_INDENT
              }}
            />
          ))}
        </div>
      ) : null}
      <div
        className="relative z-10 flex h-full w-full min-w-0 items-center gap-2 px-2"
        style={{ paddingLeft: rowIndent }}
      >
        <button
          type="button"
          className={cn(
            rowActionButtonClassName,
            'flex h-4 w-4 shrink-0 items-center justify-center rounded-[var(--radius-control)] transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            isFolder ? 'opacity-100' : 'opacity-0'
          )}
          aria-expanded={isFolder ? node.isOpen : undefined}
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
                'motion-state-chevron',
                node.isOpen && 'rotate-90',
                isDropTarget && 'text-primary'
              )}
            />
          ) : null}
        </button>
        {isFolder ? (
          node.isOpen ? (
            <FolderOpen className={cn(TREE_ICON_CLASS, 'text-primary')} strokeWidth={1.9} />
          ) : (
            <Folder className={cn(TREE_ICON_CLASS, 'text-primary')} strokeWidth={1.9} />
          )
        ) : (
          renderTreeFileIcon(node.data.kind)
        )}
        {isEditing ? (
          <TreeNodeInput node={node} onCancel={onCancelEditing} onCommit={onCommitRename} />
        ) : (
          <span className="block min-w-0 flex-1 truncate">
            {renderTreeNodeLabel(
              isFolder ? node.data.name : stripNotebookFileExtension(node.data.name)
            )}
          </span>
        )}
        {node.data.kind === 'folder' && node.data.isLinked ? (
          <span
            className="inline-flex shrink-0 text-muted-foreground"
            data-testid={`note-tree-linked-folder:${node.data.relPath}`}
            title="Linked folder"
          >
            <Link className="h-3.5 w-3.5" aria-hidden="true" strokeWidth={1.9} />
            <span className="sr-only">Linked folder</span>
          </span>
        ) : null}
        {!isEditing && !isProtected ? (
          useNativeMenus ? (
            <Button
              type="button"
              variant="rowAction"
              size="icon"
              data-testid={`note-tree-menu:${node.data.relPath}`}
              className="ml-auto h-5 w-5 shrink-0 rounded-md opacity-0 transition-opacity focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100 group-focus-within:opacity-100 motion-reduce:transition-none"
              onPointerDown={(event) => {
                event.stopPropagation()
              }}
              onClick={(event) => void handleNativeMenuButtonClick(event)}
              title={`Open ${getTreeNodeKindLabel(node.data.kind)} menu`}
              aria-label={`Open ${getTreeNodeKindLabel(node.data.kind)} menu for ${stripNotebookFileExtension(node.data.name)}`}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          ) : (
            <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="rowAction"
                  size="icon"
                  data-testid={`note-tree-menu:${node.data.relPath}`}
                  className="ml-auto h-5 w-5 shrink-0 rounded-md opacity-0 transition-opacity focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100 group-focus-within:opacity-100 motion-reduce:transition-none"
                  onPointerDown={(event) => {
                    event.stopPropagation()
                  }}
                  onClick={(event) => {
                    event.stopPropagation()
                  }}
                  title={`Open ${getTreeNodeKindLabel(node.data.kind)} menu`}
                  aria-label={`Open ${getTreeNodeKindLabel(node.data.kind)} menu for ${stripNotebookFileExtension(node.data.name)}`}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                onCloseAutoFocus={(event) => {
                  if (renameFocusHandoffRef.current) {
                    event.preventDefault()
                  }
                }}
              >
                <ActionMenuItems variant="dropdown" groups={menuGroups} />
              </DropdownMenuContent>
            </DropdownMenu>
          )
        ) : null}
      </div>
    </DropZone>
  )

  if (useNativeMenus) {
    return treeNodeRow
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{treeNodeRow}</ContextMenuTrigger>
      <ContextMenuContent
        onCloseAutoFocus={(event) => {
          if (renameFocusHandoffRef.current) {
            event.preventDefault()
          }
        }}
      >
        <ActionMenuItems variant="context" groups={menuGroups} />
      </ContextMenuContent>
    </ContextMenu>
  )
}

function MotionTreeRow<T>({ node, attrs, innerRef, children }: RowRendererProps<T>): ReactElement {
  return (
    <div
      {...attrs}
      ref={innerRef}
      className={cn(attrs.className, 'motion-tree-row')}
      onFocus={(event) => event.stopPropagation()}
      onClick={node.handleClick}
    >
      {children}
    </div>
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
  const blurFrameRef = useRef<number | null>(null)
  const hasReceivedFocusRef = useRef(false)
  const hasFinishedRef = useRef(false)

  const commit = useCallback(
    (value: string): void => {
      if (hasFinishedRef.current) {
        return
      }

      hasFinishedRef.current = true
      onCommit(value)
    },
    [onCommit]
  )

  const cancel = useCallback((): void => {
    if (hasFinishedRef.current) {
      return
    }

    hasFinishedRef.current = true
    onCancel()
  }, [onCancel])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    })

    return () => {
      window.cancelAnimationFrame(frame)
      if (blurFrameRef.current !== null) {
        window.cancelAnimationFrame(blurFrameRef.current)
      }
    }
  }, [])

  const handleBlur = useCallback(
    (event: FocusEvent<HTMLInputElement>): void => {
      if (blurFrameRef.current !== null) {
        window.cancelAnimationFrame(blurFrameRef.current)
      }

      const value = event.currentTarget.value
      blurFrameRef.current = window.requestAnimationFrame(() => {
        blurFrameRef.current = null
        const input = inputRef.current

        if (hasFinishedRef.current || (input && document.activeElement === input)) {
          return
        }

        if (!hasReceivedFocusRef.current) {
          input?.focus()
          input?.select()
          return
        }

        commit(value)
      })
    },
    [commit]
  )

  return (
    <input
      ref={inputRef}
      autoFocus
      type="text"
      data-testid={`note-tree-input:${node.data.relPath}`}
      defaultValue={
        node.data.kind === 'folder' ? node.data.name : stripNotebookFileExtension(node.data.name)
      }
      className="h-7 flex-1 border border-ring bg-card px-2 text-sm outline-none"
      onFocus={(event) => {
        hasReceivedFocusRef.current = true
        event.currentTarget.select()
      }}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.stopPropagation()}
      onBlur={handleBlur}
      onKeyDown={(event) => {
        event.stopPropagation()
        if (event.key === 'Escape') {
          event.preventDefault()
          cancel()
          return
        }

        if (event.key === 'Enter') {
          event.preventDefault()
          commit(event.currentTarget.value)
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

const NOTE_TREE_DRAG_DATA_TYPE = 'application/x-xingularity-note-tree'

function readDraggedEntries(dataTransfer: DataTransfer): NoteTreeSelection | null {
  const raw = dataTransfer.getData(NOTE_TREE_DRAG_DATA_TYPE)
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) {
      return null
    }

    const entries = parsed.filter(isNoteTreeSelectionEntry)
    return entries.length > 0 ? normalizeNoteTreeSelection(entries) : null
  } catch {
    return null
  }
}

function isNoteTreeSelectionEntry(value: unknown): value is NoteTreeSelection[number] {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as { kind?: unknown; relPath?: unknown }
  return (
    (candidate.kind === 'note' || candidate.kind === 'excalidraw' || candidate.kind === 'folder') &&
    typeof candidate.relPath === 'string'
  )
}

function canDropEntriesIntoFolder(entries: NoteTreeSelection, targetFolderPath: string): boolean {
  return entries.every(
    (entry) =>
      entry.relPath !== targetFolderPath &&
      (entry.kind !== 'folder' || !targetFolderPath.startsWith(`${entry.relPath}/`))
  )
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

function toTreeId(kind: 'note' | 'excalidraw' | 'folder', relPath: string): string {
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
  canCreateChildren: boolean,
  isFolder: boolean
): NativeMenuItemDescriptor[] {
  const items: NativeMenuItemDescriptor[] = []

  if (canCreateChildren) {
    items.push(
      { id: 'create-note', label: 'New note' },
      { id: 'create-excalidraw', label: 'New drawing' },
      { id: 'create-folder', label: 'New folder' }
    )
  }

  if (isFolder && !isProtected) {
    if (items.length > 0) {
      items.push({ type: 'separator' })
    }
    items.push({
      type: 'submenu',
      label: 'Export nested notes',
      submenu: [
        { id: 'export-folder-pdf', label: 'as PDF…' },
        { id: 'export-folder-markdown', label: 'as Markdown…' }
      ]
    })
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

function renderTreeFileIcon(kind: NoteTreeNode['kind']): ReactElement {
  if (kind === 'excalidraw') {
    return <PenTool className={cn(TREE_ICON_CLASS, 'text-foreground')} strokeWidth={1.9} />
  }

  return <FileText className={cn(TREE_ICON_CLASS, 'text-foreground')} strokeWidth={1.9} />
}

function getTreeNodeKindLabel(kind: NoteTreeNode['kind']): string {
  if (kind === 'folder') {
    return 'folder'
  }

  if (kind === 'excalidraw') {
    return 'drawing'
  }

  return 'note'
}
