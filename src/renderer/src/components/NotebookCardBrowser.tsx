import { KeyboardEvent, ReactElement, useEffect, useMemo, useRef, useState } from 'react'
import {
  FileDown,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  Pencil,
  PenTool,
  Plus,
  Trash2
} from './ui/icons'
import type { NoteTreeNode } from '../../../shared/types'
import { stripNotebookFileExtension } from '../../../shared/excalidrawFile'
import { normalizeNoteTreeSelection, type NoteTreeSelection } from '../lib/noteTreeSelection'
import { getNotebookFolderContents } from '../lib/notebookFolderContents'
import { cn } from '../lib/utils'
import { isDeleteShortcut } from '../lib/isDeleteShortcut'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger
} from './ui/context-menu'
import { DragSource } from './ui/drag-source'
import { DropZone } from './ui/drop-zone'
import { EmptyState } from './ui/empty-state'
import { Button } from './ui/button'

interface NotebookCardBrowserProps {
  tree: NoteTreeNode[]
  folderPath: string | null
  selectedEntries: NoteTreeSelection
  onBrowseFolder: (folderPath: string | null) => void
  onSelectionChange: (entries: NoteTreeSelection) => void
  onOpenPath: (relPath: string) => void
  onCreateNote: (parentDir: string) => void
  onCreateExcalidraw: (parentDir: string) => void
  onCreateFolder: (parentDir: string) => void
  onExportFolderPdf: (folderPath: string) => void
  onExportFolderMarkdown: (folderPath: string) => void
  onRenamePath: (relPath: string, nextName: string, kind: NoteTreeNode['kind']) => void
  onDeleteEntries: (entries: NoteTreeSelection) => void
  onMoveEntries: (entries: NoteTreeSelection, targetFolderPath: string) => Promise<void>
}

export function NotebookCardBrowser({
  tree,
  folderPath,
  selectedEntries,
  onBrowseFolder,
  onSelectionChange,
  onOpenPath,
  onCreateNote,
  onCreateExcalidraw,
  onCreateFolder,
  onExportFolderPdf,
  onExportFolderMarkdown,
  onRenamePath,
  onDeleteEntries,
  onMoveEntries
}: NotebookCardBrowserProps): ReactElement {
  const folderContents = useMemo(
    () => getNotebookFolderContents(tree, folderPath),
    [folderPath, tree]
  )
  const canCreateInCurrentFolder =
    !folderContents.folder?.isProtected || folderContents.folder.protectionKind === 'project-folder'
  const currentFolderPath = folderContents.path ?? ''

  const handleBrowseFolder = (nextPath: string | null): void => {
    onBrowseFolder(nextPath)
    onSelectionChange(nextPath ? [{ kind: 'folder', relPath: nextPath }] : [])
  }

  const handleCardKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (!isDeleteShortcut(event) || isTextInput(event.target)) {
      return
    }

    const entries = normalizeNoteTreeSelection(selectedEntries)
    if (entries.length === 0) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    onDeleteEntries(entries)
  }

  return (
    <section
      className="flex h-full min-h-0 flex-col overflow-hidden"
      data-testid="notebook-card-browser"
      onKeyDownCapture={handleCardKeyDown}
    >
      <ContextMenu>
        <ContextMenuTrigger asChild disabled={!canCreateInCurrentFolder}>
          <div
            className="flex min-h-0 flex-1 flex-col overflow-hidden text-card-foreground"
            data-testid="notebook-card-content"
          >
            <div className="min-h-0 flex-1 overflow-y-auto">
              {folderContents.children.length === 0 ? (
                <EmptyFolderState
                  parentDir={currentFolderPath}
                  onCreateNote={onCreateNote}
                  onCreateExcalidraw={onCreateExcalidraw}
                  onCreateFolder={onCreateFolder}
                />
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] justify-items-center gap-1">
                  {folderContents.children.map((node) => (
                    <NotebookCard
                      key={`${node.kind}:${node.relPath}`}
                      node={node}
                      selectedEntries={selectedEntries}
                      onBrowseFolder={handleBrowseFolder}
                      onSelectionChange={onSelectionChange}
                      onOpenPath={onOpenPath}
                      onCreateNote={onCreateNote}
                      onCreateExcalidraw={onCreateExcalidraw}
                      onCreateFolder={onCreateFolder}
                      onExportFolderPdf={onExportFolderPdf}
                      onExportFolderMarkdown={onExportFolderMarkdown}
                      onRenamePath={onRenamePath}
                      onDeleteEntries={onDeleteEntries}
                      onMoveEntries={onMoveEntries}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent data-testid="notebook-browser-context-menu">
          <NotebookCreateContextMenuItems
            parentDir={currentFolderPath}
            onCreateNote={onCreateNote}
            onCreateExcalidraw={onCreateExcalidraw}
            onCreateFolder={onCreateFolder}
          />
        </ContextMenuContent>
      </ContextMenu>
    </section>
  )
}

interface EmptyFolderStateProps {
  parentDir: string
  onCreateNote: (parentDir: string) => void
  onCreateExcalidraw: (parentDir: string) => void
  onCreateFolder: (parentDir: string) => void
}

function EmptyFolderState({
  parentDir,
  onCreateNote,
  onCreateExcalidraw,
  onCreateFolder
}: EmptyFolderStateProps): ReactElement {
  return (
    <EmptyState
      data-testid="notebook-card-empty-state"
      className="h-full border-0 bg-transparent"
      icon={FolderOpen}
      title="This folder is empty"
      description="Create a notebook, drawing, or folder to get started."
    >
      <div className="flex flex-wrap justify-center gap-2">
        <Button
          type="button"
          variant="default"
          className="gap-2"
          onClick={() => onCreateNote(parentDir)}
        >
          <Plus size={16} aria-hidden="true" />
          New note
        </Button>
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          onClick={() => onCreateExcalidraw(parentDir)}
        >
          <PenTool size={16} aria-hidden="true" />
          New drawing
        </Button>
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          onClick={() => onCreateFolder(parentDir)}
        >
          <Folder size={16} aria-hidden="true" />
          New folder
        </Button>
      </div>
    </EmptyState>
  )
}

interface NotebookCardProps {
  node: NoteTreeNode
  selectedEntries: NoteTreeSelection
  onBrowseFolder: (folderPath: string | null) => void
  onSelectionChange: (entries: NoteTreeSelection) => void
  onOpenPath: (relPath: string) => void
  onCreateNote: (parentDir: string) => void
  onCreateExcalidraw: (parentDir: string) => void
  onCreateFolder: (parentDir: string) => void
  onExportFolderPdf: (folderPath: string) => void
  onExportFolderMarkdown: (folderPath: string) => void
  onRenamePath: (relPath: string, nextName: string, kind: NoteTreeNode['kind']) => void
  onDeleteEntries: (entries: NoteTreeSelection) => void
  onMoveEntries: (entries: NoteTreeSelection, targetFolderPath: string) => Promise<void>
}

function NotebookCard({
  node,
  selectedEntries,
  onBrowseFolder,
  onSelectionChange,
  onOpenPath,
  onCreateNote,
  onCreateExcalidraw,
  onCreateFolder,
  onExportFolderPdf,
  onExportFolderMarkdown,
  onRenamePath,
  onDeleteEntries,
  onMoveEntries
}: NotebookCardProps): ReactElement {
  const [isEditing, setIsEditing] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [draftName, setDraftName] = useState(getDisplayName(node))
  const renameInputRef = useRef<HTMLInputElement | null>(null)
  const renameFocusHandoffRef = useRef(false)
  const renameFinalizedRef = useRef(false)
  const isSelected = selectedEntries.some(
    (entry) => entry.kind === node.kind && entry.relPath === node.relPath
  )
  const isFolder = node.kind === 'folder'
  const isProtected = Boolean(node.isProtected)
  const canCreateChildren = !isProtected || node.protectionKind === 'project-folder'
  const hasContextMenu = canCreateChildren || !isProtected
  const isDropTarget = isFolder && !node.isProtected
  const displayName = getDisplayName(node)
  const parentDir = isFolder ? node.relPath : (getParentPath(node.relPath) ?? '')
  const entry = { kind: node.kind, relPath: node.relPath }

  useEffect(() => {
    if (!isEditing) {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      renameInputRef.current?.focus()
    })

    return () => window.cancelAnimationFrame(frame)
  }, [isEditing])

  const selectEntry = (event: React.MouseEvent<HTMLButtonElement>): void => {
    if (event.metaKey || event.ctrlKey || event.shiftKey) {
      const alreadySelected = selectedEntries.some(
        (selectedEntry) =>
          selectedEntry.kind === entry.kind && selectedEntry.relPath === entry.relPath
      )
      onSelectionChange(
        alreadySelected
          ? selectedEntries.filter(
              (selectedEntry) =>
                selectedEntry.kind !== entry.kind || selectedEntry.relPath !== entry.relPath
            )
          : [...selectedEntries, entry]
      )
      return
    }

    onSelectionChange([entry])
    if (node.kind === 'folder') {
      onBrowseFolder(node.relPath)
    } else {
      onOpenPath(node.relPath)
    }
  }

  const getDragEntries = (): NoteTreeSelection => {
    const selected = selectedEntries
    return selected.some(
      (selectedEntry) => selectedEntry.kind === node.kind && selectedEntry.relPath === node.relPath
    )
      ? normalizeNoteTreeSelection(selected)
      : [entry]
  }

  const canDropEntries = (entries: NoteTreeSelection): boolean => {
    if (!isDropTarget) {
      return false
    }

    return entries.every(
      (draggedEntry) =>
        draggedEntry.relPath !== node.relPath &&
        !node.relPath.startsWith(`${draggedEntry.relPath}/`)
    )
  }

  const startRename = (): void => {
    renameFocusHandoffRef.current = true
    renameFinalizedRef.current = false
    setDraftName(displayName)
    setIsEditing(true)
  }

  const cancelRename = (): void => {
    if (renameFinalizedRef.current) {
      return
    }

    renameFinalizedRef.current = true
    renameFocusHandoffRef.current = false
    setIsEditing(false)
    setDraftName(displayName)
  }

  const commitRename = (): void => {
    if (renameFinalizedRef.current) {
      return
    }

    renameFinalizedRef.current = true
    const nextName = draftName.trim()
    renameFocusHandoffRef.current = false
    setIsEditing(false)
    if (!nextName || nextName === displayName) {
      setDraftName(displayName)
      return
    }
    onRenamePath(node.relPath, nextName, node.kind)
  }

  const getDeleteEntries = (): NoteTreeSelection => {
    if (isSelected && selectedEntries.length > 1) {
      return normalizeNoteTreeSelection(selectedEntries)
    }

    return [entry]
  }

  const handleCardContextMenu = (event: React.MouseEvent<HTMLElement>): void => {
    event.stopPropagation()
    if (isEditing || !hasContextMenu) {
      event.preventDefault()
      return
    }

    if (!isSelected) {
      onSelectionChange([entry])
    }
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger
        asChild
        disabled={isEditing || !hasContextMenu}
        onContextMenu={handleCardContextMenu}
      >
        <DropZone
          as="div"
          variant="content"
          active={isDragOver}
          className="w-36 max-w-full min-w-0"
          onDragEnter={(event) => {
            if (isDropTarget) {
              event.preventDefault()
              setIsDragOver(true)
            }
          }}
          onDragOver={(event) => {
            if (isDropTarget) {
              event.preventDefault()
            }
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              setIsDragOver(false)
            }
          }}
          onDrop={(event) => {
            event.preventDefault()
            setIsDragOver(false)
            const entries = readDraggedEntries(event.dataTransfer) ?? getDragEntries()
            if (canDropEntries(entries)) {
              void onMoveEntries(entries, node.relPath)
            }
          }}
        >
          <DragSource
            as="div"
            draggable={!node.isProtected}
            preview="floating"
            previewVariant="content"
            rotation={-2}
            data-testid={`notebook-card:${node.relPath}`}
            className="flex min-h-28 w-36 max-w-full min-w-0 flex-col overflow-hidden rounded-xl"
            onDragStart={(event) => {
              const entries = getDragEntries()
              event.dataTransfer.effectAllowed = 'move'
              event.dataTransfer.setData(
                'application/x-xingularity-note-tree',
                JSON.stringify(entries)
              )
            }}
            onDragEnd={() => setIsDragOver(false)}
          >
            {isEditing ? (
              <div className="flex min-h-24 flex-1 flex-col items-center gap-1.5 rounded-xl p-1.5 text-center">
                <NotebookCardIcon node={node} isSelected={isSelected} />
                <span className="min-w-0 max-w-full">
                  <input
                    ref={renameInputRef}
                    autoFocus
                    value={draftName}
                    aria-label={`Rename ${displayName}`}
                    className="h-7 w-full min-w-0 max-w-32 rounded-md border border-ring bg-card px-1.5 text-center text-sm font-semibold text-foreground outline-none"
                    onChange={(event) => setDraftName(event.target.value)}
                    onFocus={(event) => event.currentTarget.select()}
                    onMouseDown={(event) => event.stopPropagation()}
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => {
                      event.stopPropagation()
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        commitRename()
                      }
                      if (event.key === 'Escape') {
                        event.preventDefault()
                        cancelRename()
                      }
                    }}
                    onBlur={commitRename}
                  />
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {getNotebookCardSubtitle(node)}
                  </span>
                </span>
              </div>
            ) : (
              <button
                type="button"
                className="flex min-h-24 flex-1 flex-col items-center gap-1.5 rounded-xl p-1.5 text-center transition-colors duration-200 hover:bg-muted focus-visible:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset motion-reduce:transition-none"
                aria-label={`${node.kind === 'folder' ? 'Open folder' : 'Open'} ${displayName}`}
                aria-pressed={isSelected}
                onClick={selectEntry}
              >
                <NotebookCardIcon node={node} isSelected={isSelected} />
                <span className="min-w-0 max-w-full">
                  <span
                    className={cn(
                      'block truncate text-sm font-semibold',
                      isSelected ? 'text-primary' : 'text-foreground'
                    )}
                  >
                    {displayName}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {getNotebookCardSubtitle(node)}
                  </span>
                </span>
              </button>
            )}
          </DragSource>
        </DropZone>
      </ContextMenuTrigger>
      <ContextMenuContent
        data-testid={`notebook-card-context-menu:${node.relPath}`}
        onCloseAutoFocus={(event) => {
          if (renameFocusHandoffRef.current) {
            event.preventDefault()
            renameFocusHandoffRef.current = false
          }
        }}
      >
        {canCreateChildren ? (
          <NotebookCreateContextMenuItems
            parentDir={parentDir}
            onCreateNote={onCreateNote}
            onCreateExcalidraw={onCreateExcalidraw}
            onCreateFolder={onCreateFolder}
          />
        ) : null}
        {isFolder && !isProtected ? (
          <>
            {canCreateChildren ? <ContextMenuSeparator /> : null}
            <ContextMenuSub>
              <ContextMenuSubTrigger
                data-testid={`notebook-card-export-folder-context:${node.relPath}`}
              >
                <FileDown className="mr-2 h-4 w-4" />
                Export nested notes
              </ContextMenuSubTrigger>
              <ContextMenuSubContent>
                <ContextMenuItem
                  data-testid={`notebook-card-export-folder-pdf-context:${node.relPath}`}
                  onSelect={() => onExportFolderPdf(node.relPath)}
                >
                  <FileDown className="mr-2 h-4 w-4" />
                  as PDF
                </ContextMenuItem>
                <ContextMenuItem
                  data-testid={`notebook-card-export-folder-markdown-context:${node.relPath}`}
                  onSelect={() => onExportFolderMarkdown(node.relPath)}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  as Markdown
                </ContextMenuItem>
              </ContextMenuSubContent>
            </ContextMenuSub>
          </>
        ) : null}
        {!isProtected ? (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem onSelect={startRename}>
              <Pencil className="mr-2 h-4 w-4" />
              Rename
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => onDeleteEntries(getDeleteEntries())}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </ContextMenuItem>
          </>
        ) : null}
      </ContextMenuContent>
    </ContextMenu>
  )
}

interface NotebookCreateContextMenuItemsProps {
  parentDir: string
  onCreateNote: (parentDir: string) => void
  onCreateExcalidraw: (parentDir: string) => void
  onCreateFolder: (parentDir: string) => void
}

function NotebookCreateContextMenuItems({
  parentDir,
  onCreateNote,
  onCreateExcalidraw,
  onCreateFolder
}: NotebookCreateContextMenuItemsProps): ReactElement {
  return (
    <>
      <ContextMenuItem onSelect={() => onCreateNote(parentDir)}>
        <FileText className="mr-2 h-4 w-4" />
        New note
      </ContextMenuItem>
      <ContextMenuItem onSelect={() => onCreateExcalidraw(parentDir)}>
        <PenTool className="mr-2 h-4 w-4" />
        New drawing
      </ContextMenuItem>
      <ContextMenuItem onSelect={() => onCreateFolder(parentDir)}>
        <FolderPlus className="mr-2 h-4 w-4" />
        New folder
      </ContextMenuItem>
    </>
  )
}

function NotebookCardIcon({
  node,
  isSelected
}: {
  node: NoteTreeNode
  isSelected: boolean
}): ReactElement {
  return (
    <span
      className={cn(
        'flex size-14 items-center justify-center rounded-xl text-primary',
        isSelected && 'ring-2 ring-ring/60 ring-offset-2 ring-offset-workspace',
        node.kind !== 'folder' && 'text-muted-foreground'
      )}
      aria-hidden="true"
    >
      {node.kind === 'folder' ? (
        <Folder size={48} strokeWidth={1.8} />
      ) : node.kind === 'excalidraw' ? (
        <PenTool size={48} strokeWidth={1.8} />
      ) : (
        <FileText size={48} strokeWidth={1.8} />
      )}
    </span>
  )
}

function getNotebookCardSubtitle(node: NoteTreeNode): string {
  if (node.kind === 'folder') {
    return `${node.children.length} ${node.children.length === 1 ? 'item' : 'items'}`
  }

  return node.kind === 'excalidraw' ? 'Drawing' : 'Notebook'
}

function getDisplayName(node: NoteTreeNode): string {
  return node.kind === 'folder' ? node.name : stripNotebookFileExtension(node.name)
}

function getParentPath(relPath: string): string | null {
  if (!relPath.includes('/')) {
    return null
  }

  return relPath.slice(0, relPath.lastIndexOf('/')) || null
}

function readDraggedEntries(dataTransfer: DataTransfer): NoteTreeSelection | null {
  const raw = dataTransfer.getData('application/x-xingularity-note-tree')
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

function isTextInput(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
}
