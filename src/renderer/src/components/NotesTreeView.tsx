import { CSSProperties, ReactElement, useEffect, useRef, useState } from 'react'
import { useElementSize } from '@mantine/hooks'
import { ChevronRight, FileText, Folder, FolderOpen, FolderPlus, Pencil, Trash2 } from 'lucide-react'
import { Tree, TreeApi, NodeRendererProps } from 'react-arborist'
import { stripNoteExtension } from '../../../shared/noteDocument'
import type { NativeMenuItemDescriptor, NoteTreeNode } from '../../../shared/types'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuDestructiveItem,
  ContextMenuItem,
  ContextMenuTrigger
} from './ui/context-menu'
import { canUseNativeMenus, getMouseMenuPosition, showNativeMenu } from '../lib/nativeMenu'

const TREE_ICON_CLASS = 'h-4 w-4 shrink-0'
const TREE_CHEVRON_CLASS = 'h-3.5 w-3.5 shrink-0'
const TREE_INDENT = 18

type TreeSelection = {
  kind: 'note' | 'folder'
  relPath: string
} | null

interface NotesTreeViewProps {
  tree: NoteTreeNode[]
  searchTerm: string
  activeNotePath: string | null
  selectedEntry: TreeSelection
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
  const useNativeMenus = canUseNativeMenus()
  const treeHeight = height > 8 ? height - 8 : 320

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

    const instance = treeRef.current
    if (!instance) {
      return
    }

    instance.openParents(pendingEditId)
    instance.select(pendingEditId)
    instance.scrollTo(pendingEditId, 'smart')
    setEditingId(pendingEditId)
    onPendingEditHandled()
  }, [onPendingEditHandled, pendingEditId, tree])

  useEffect(() => {
    if (!editingId) {
      return
    }

    if (!resolveNodeById(tree, editingId)) {
      setEditingId(null)
    }
  }, [editingId, tree])

  if (tree.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-sm text-[var(--muted)]">
        No notes or folders yet
      </div>
    )
  }

  return (
    <div ref={containerRef} className="h-full min-h-0 p-2" data-testid="notes-tree-view">
      <Tree
        ref={treeRef}
        data={tree}
        width="100%"
        height={treeHeight}
        rowHeight={34}
        indent={TREE_INDENT}
        overscanCount={8}
        padding={4}
        openByDefault={false}
        disableMultiSelection
        selection={currentSelectionId}
        searchTerm={searchTerm.trim()}
        searchMatch={(node, term) => node.data.name.toLowerCase().includes(term.toLowerCase())}
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
            return parentPath === dragNode.data.relPath || parentPath.startsWith(`${dragNode.data.relPath}/`)
          })
        }}
        onMove={async ({ dragIds, parentId }) => {
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
          />
        )}
      </Tree>
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
  useNativeMenus
}: NodeRendererProps<NoteTreeNode> & {
  isEditing: boolean
  onCreateNote: (parentDir: string) => void
  onCreateFolder: (parentDir: string) => void
  onCancelEditing: () => void
  onCommitRename: (value: string) => void
  onStartEditing: () => void
  onDeletePath: (relPath: string, kind: 'note' | 'folder') => void
  useNativeMenus: boolean
}): ReactElement {
  const parentDir = node.data.kind === 'folder' ? node.data.relPath : node.data.note.dir
  const isFolder = node.data.kind === 'folder'
  const isProtected = Boolean(node.data.isProtected)
  const canCreateChildren = !isProtected || node.data.protectionKind === 'project-folder'
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

  const treeNodeRow = (
    <div style={style as CSSProperties} className="group">
      <div
        ref={isProtected ? undefined : dragHandle}
        data-testid={`note-tree-row:${node.data.relPath}`}
        className={`relative flex h-[30px] items-center gap-2 rounded-md px-2 text-sm ${
          node.isSelected
            ? 'bg-[var(--accent-soft)] text-[var(--text)]'
            : 'text-[var(--text)] hover:bg-[var(--panel-2)]'
        }`}
        onClick={() => {
          if (isEditing) {
            return
          }
          node.select()
          if (isFolder) {
            node.toggle()
            return
          }
          node.activate()
        }}
        onContextMenu={
          useNativeMenus && !isEditing ? (event) => void handleNativeContextMenu(event) : undefined
        }
      >
        {renderTreeConnectorGuides(node)}
        <button
          type="button"
          className={`relative z-10 flex h-4 w-4 items-center justify-center rounded-sm text-[var(--muted)] ${
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
            <FolderOpen className={`${TREE_ICON_CLASS} relative z-10 text-[var(--accent)]`} strokeWidth={1.9} />
          ) : (
            <Folder className={`${TREE_ICON_CLASS} relative z-10 text-[var(--accent)]`} strokeWidth={1.9} />
          )
        ) : (
          <FileText className={`${TREE_ICON_CLASS} relative z-10 text-[var(--muted)]`} strokeWidth={1.9} />
        )}
        {isEditing ? (
          <TreeNodeInput
            node={node}
            onCancel={onCancelEditing}
            onCommit={onCommitRename}
          />
        ) : (
          <span className="relative z-10 min-w-0 truncate">
            {isFolder ? node.data.name : stripNoteExtension(node.data.name)}
          </span>
        )}
        {!isEditing && !isProtected ? (
          <button
            type="button"
            data-testid={`note-tree-rename:${node.data.relPath}`}
            className="relative z-10 ml-auto inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-[var(--muted)] opacity-0 transition hover:bg-[var(--panel)] hover:text-[var(--text)] focus-visible:opacity-100 group-hover:opacity-100"
            onClick={(event) => {
              event.stopPropagation()
              onStartEditing()
            }}
            title={`Rename ${isFolder ? 'folder' : 'note'}`}
            aria-label={`Rename ${isFolder ? 'folder' : 'note'} ${stripNoteExtension(node.data.name)}`}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        ) : null}
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
            <ContextMenuDestructiveItem
              onSelect={() => handleMenuAction('delete')}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </ContextMenuDestructiveItem>
          </>
        ) : null}
      </ContextMenuContent>
    </ContextMenu>
  )
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
  return (
    <input
      autoFocus
      type="text"
      data-testid={`note-tree-input:${node.data.relPath}`}
      defaultValue={node.data.kind === 'folder' ? node.data.name : stripNoteExtension(node.data.name)}
      className="h-7 flex-1 rounded border border-[var(--accent-line)] bg-[var(--panel)] px-2 text-sm outline-none"
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
    items.push({ id: 'create-note', label: 'New note' }, { id: 'create-folder', label: 'New folder' })
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

function renderTreeConnectorGuides(
  node: NodeRendererProps<NoteTreeNode>['node']
): ReactElement | null {
  if (node.level <= 0) {
    return null
  }

  const ancestorColumns = getTreeConnectorColumns(node)
  const connectorLeft = node.level * TREE_INDENT - TREE_INDENT / 2
  const isLastChild = isLastTreeChild(node)

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0">
      {ancestorColumns.map((showLine, index) =>
        showLine ? (
          <span
            key={`tree-guide-${node.id}-${index}`}
            className="absolute inset-y-0 w-px bg-[var(--line)]"
            style={{ left: index * TREE_INDENT + TREE_INDENT / 2 }}
          />
        ) : null
      )}
      <span
        className="absolute w-px bg-[var(--line)]"
        style={{
          left: connectorLeft,
          top: 0,
          bottom: isLastChild ? '50%' : 0
        }}
      />
      <span
        className="absolute top-1/2 h-px -translate-y-1/2 bg-[var(--line)]"
        style={{
          left: connectorLeft,
          width: TREE_INDENT / 2
        }}
      />
    </div>
  )
}

function getTreeConnectorColumns(node: NodeRendererProps<NoteTreeNode>['node']): boolean[] {
  const columns: boolean[] = []
  let current = node.parent

  while (current && !current.isRoot) {
    columns.unshift(!isLastTreeChild(current))
    current = current.parent
  }

  return columns
}

function isLastTreeChild(node: NodeRendererProps<NoteTreeNode>['node']): boolean {
  const siblings = node.parent?.children
  if (!siblings?.length) {
    return true
  }

  return node.childIndex === siblings.length - 1
}
