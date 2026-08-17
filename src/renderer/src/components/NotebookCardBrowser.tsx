import { KeyboardEvent, ReactElement, useMemo, useState } from 'react'
import { FileText, Folder, FolderOpen, MoreHorizontal, PenTool, Plus } from './ui/icons'
import type { NoteTreeNode } from '../../../shared/types'
import { stripNotebookFileExtension } from '../../../shared/excalidrawFile'
import { normalizeNoteTreeSelection, type NoteTreeSelection } from '../lib/noteTreeSelection'
import { getNotebookFolderContents } from '../lib/notebookFolderContents'
import { cn } from '../lib/utils'
import { isDeleteShortcut } from '../lib/isDeleteShortcut'
import { Card } from './ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from './ui/dropdown-menu'
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
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl text-card-foreground">
        {folderContents.children.length === 0 ? (
          <EmptyFolderState
            parentDir={folderContents.path ?? ''}
            onCreateNote={onCreateNote}
            onCreateExcalidraw={onCreateExcalidraw}
            onCreateFolder={onCreateFolder}
          />
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
          </div>
        )}
      </div>
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
  const isSelected = selectedEntries.some(
    (entry) => entry.kind === node.kind && entry.relPath === node.relPath
  )
  const canCreateChildren =
    node.kind !== 'folder' || !node.isProtected || node.protectionKind === 'project-folder'
  const isDropTarget = node.kind === 'folder' && !node.isProtected
  const displayName = getDisplayName(node)

  const selectEntry = (event: React.MouseEvent<HTMLButtonElement>): void => {
    const entry = { kind: node.kind, relPath: node.relPath }
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
    return selected.some((entry) => entry.kind === node.kind && entry.relPath === node.relPath)
      ? normalizeNoteTreeSelection(selected)
      : [{ kind: node.kind, relPath: node.relPath }]
  }

  const canDropEntries = (entries: NoteTreeSelection): boolean => {
    if (!isDropTarget) {
      return false
    }

    return entries.every(
      (entry) => entry.relPath !== node.relPath && !node.relPath.startsWith(`${entry.relPath}/`)
    )
  }

  const commitRename = (): void => {
    const nextName = draftName.trim()
    setIsEditing(false)
    if (!nextName || nextName === displayName) {
      setDraftName(displayName)
      return
    }
    onRenamePath(node.relPath, nextName, node.kind)
  }

  return (
    <DropZone
      as="div"
      variant="surface"
      active={isDragOver}
      className="min-w-0"
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
        as={Card}
        draggable={!node.isProtected}
        data-testid={`notebook-card:${node.relPath}`}
        className={cn(
          'group flex min-h-40 min-w-0 flex-col overflow-hidden transition-[background-color,border-color,box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:border-ring hover:shadow-md',
          isSelected && 'border-ring bg-accent/60 ring-2 ring-ring/40'
        )}
        onDragStart={(event) => {
          const entries = getDragEntries()
          event.dataTransfer.effectAllowed = 'move'
          event.dataTransfer.setData('application/x-xingularity-note-tree', JSON.stringify(entries))
        }}
        onDragEnd={() => setIsDragOver(false)}
      >
        <button
          type="button"
          className="flex min-h-32 flex-1 flex-col items-start gap-4 p-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          aria-label={`${node.kind === 'folder' ? 'Open folder' : 'Open'} ${displayName}`}
          onClick={selectEntry}
        >
          <span
            className={cn(
              'flex size-12 items-center justify-center rounded-xl bg-accent text-primary',
              node.kind !== 'folder' && 'text-muted-foreground'
            )}
            aria-hidden="true"
          >
            {node.kind === 'folder' ? (
              <Folder size={28} strokeWidth={1.8} />
            ) : node.kind === 'excalidraw' ? (
              <PenTool size={27} strokeWidth={1.8} />
            ) : (
              <FileText size={27} strokeWidth={1.8} />
            )}
          </span>
          <span className="min-w-0">
            {isEditing ? (
              <input
                autoFocus
                value={draftName}
                aria-label={`Rename ${displayName}`}
                className="h-8 w-full rounded-md border border-ring bg-card px-2 text-sm font-semibold text-foreground outline-none"
                onChange={(event) => setDraftName(event.target.value)}
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => {
                  event.stopPropagation()
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    commitRename()
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault()
                    setIsEditing(false)
                    setDraftName(displayName)
                  }
                }}
                onBlur={commitRename}
              />
            ) : (
              <span className="block truncate text-base font-semibold text-foreground">
                {displayName}
              </span>
            )}
            <span className="mt-1 block text-sm text-muted-foreground">
              {node.kind === 'folder'
                ? `${node.children.length} ${node.children.length === 1 ? 'item' : 'items'}`
                : node.kind === 'excalidraw'
                  ? 'Drawing'
                  : 'Notebook'}
            </span>
          </span>
        </button>
        {!node.isProtected ? (
          <NotebookCardMenu
            node={node}
            canCreateChildren={canCreateChildren}
            onCreateNote={onCreateNote}
            onCreateExcalidraw={onCreateExcalidraw}
            onCreateFolder={onCreateFolder}
            onExportFolderPdf={onExportFolderPdf}
            onExportFolderMarkdown={onExportFolderMarkdown}
            onStartRename={() => setIsEditing(true)}
            onDelete={() => onDeleteEntries([{ kind: node.kind, relPath: node.relPath }])}
          />
        ) : null}
      </DragSource>
    </DropZone>
  )
}

interface NotebookCardMenuProps {
  node: NoteTreeNode
  canCreateChildren: boolean
  onCreateNote: (parentDir: string) => void
  onCreateExcalidraw: (parentDir: string) => void
  onCreateFolder: (parentDir: string) => void
  onExportFolderPdf: (folderPath: string) => void
  onExportFolderMarkdown: (folderPath: string) => void
  onStartRename: () => void
  onDelete: () => void
}

function NotebookCardMenu({
  node,
  canCreateChildren,
  onCreateNote,
  onCreateExcalidraw,
  onCreateFolder,
  onExportFolderPdf,
  onExportFolderMarkdown,
  onStartRename,
  onDelete
}: NotebookCardMenuProps): ReactElement {
  const parentDir = node.kind === 'folder' ? node.relPath : (getParentPath(node.relPath) ?? '')
  const [open, setOpen] = useState(false)

  const stopCardInteraction = (event: React.SyntheticEvent): void => {
    event.stopPropagation()
  }

  return (
    <div className="flex items-center justify-end border-t border-panel-border px-3 py-2">
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            data-testid={`notebook-card-menu:${node.relPath}`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Open ${getKindLabel(node.kind)} menu for ${getDisplayName(node)}`}
            title={`Open ${getKindLabel(node.kind)} menu`}
            onPointerDown={stopCardInteraction}
            onClick={stopCardInteraction}
          >
            <MoreHorizontal size={18} aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={stopCardInteraction}>
          {node.kind === 'folder' && canCreateChildren ? (
            <>
              <DropdownMenuItem onSelect={() => onCreateNote(parentDir)}>
                <FileText className="mr-2 h-4 w-4" />
                New note
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onCreateExcalidraw(parentDir)}>
                <PenTool className="mr-2 h-4 w-4" />
                New drawing
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onCreateFolder(parentDir)}>
                <Folder className="mr-2 h-4 w-4" />
                New folder
              </DropdownMenuItem>
            </>
          ) : null}
          {node.kind === 'folder' ? (
            <>
              {canCreateChildren ? <DropdownMenuSeparator /> : null}
              <DropdownMenuItem onSelect={() => onExportFolderPdf(node.relPath)}>
                Export PDF
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onExportFolderMarkdown(node.relPath)}>
                Export Markdown
              </DropdownMenuItem>
            </>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onStartRename}>Rename</DropdownMenuItem>
          <DropdownMenuItem className="text-destructive" onSelect={onDelete}>
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function getDisplayName(node: NoteTreeNode): string {
  return node.kind === 'folder' ? node.name : stripNotebookFileExtension(node.name)
}

function getKindLabel(kind: NoteTreeNode['kind']): string {
  return kind === 'folder' ? 'folder' : kind === 'excalidraw' ? 'drawing' : 'notebook'
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
