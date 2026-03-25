import { ReactElement, useMemo } from 'react'
import { Copy, FileText, FolderInput, Heart, Link, Pencil, Trash2 } from 'lucide-react'
import type { NativeMenuItemDescriptor, NoteListItem } from '../../../shared/types'
import { TagChip } from './TagChip'
import { Badge } from './ui/badge'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuDestructiveItem,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuShortcut,
  ContextMenuTrigger,
  isDeleteShortcut
} from './ui/context-menu'
import { WorkspacePanelSection, WorkspacePanelSectionHeader } from './ui/workspace-panel-section'
import { canUseNativeMenus, getMouseMenuPosition, showNativeMenu } from '../lib/nativeMenu'

export type NoteFilterMode = 'all' | 'tagged' | 'untagged'
export type NoteSortField = 'name' | 'created' | 'updated'
export type NoteSortDirection = 'asc' | 'desc'

interface NotePreviewListProps {
  notes: NoteListItem[]
  favoritePaths: string[]
  selectedPath: string | null
  filter: string
  filterMode: NoteFilterMode
  sortField: NoteSortField
  sortDirection: NoteSortDirection
  onOpen: (relPath: string) => void
  onDelete: (relPath: string) => void
  onRename?: (relPath: string) => void
  onDuplicate?: (relPath: string) => void
  onMoveTo?: (relPath: string, targetFolder: string) => void
  onCopyLink?: (relPath: string) => void
  folders?: string[]
}

export function NotePreviewList({
  notes,
  favoritePaths,
  selectedPath,
  filter,
  filterMode,
  sortField,
  sortDirection,
  onOpen,
  onDelete,
  onRename,
  onDuplicate,
  onMoveTo,
  onCopyLink,
  folders = []
}: NotePreviewListProps): ReactElement {
  const useNativeMenus = canUseNativeMenus()
  const filtered = useMemo(() => {
    const query = filter.trim().toLowerCase()
    const base = [...notes]
    const byTagMode =
      filterMode === 'tagged'
        ? base.filter((note) => Array.isArray(note.tags) && note.tags.length > 0)
        : filterMode === 'untagged'
          ? base.filter((note) => !Array.isArray(note.tags) || note.tags.length === 0)
          : base

    const byQuery =
      query.length > 0
        ? byTagMode.filter((note) => note.relPath.toLowerCase().includes(query))
        : byTagMode

    const sorted = [...byQuery]
    if (sortField === 'updated') {
      sorted.sort((a, b) =>
        sortDirection === 'asc'
          ? a.updatedAt.localeCompare(b.updatedAt)
          : b.updatedAt.localeCompare(a.updatedAt)
      )
      return sorted
    }

    if (sortField === 'created') {
      sorted.sort((a, b) =>
        sortDirection === 'asc'
          ? a.createdAt.localeCompare(b.createdAt)
          : b.createdAt.localeCompare(a.createdAt)
      )
      return sorted
    }

    sorted.sort((a, b) =>
      sortDirection === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
    )
    return sorted
  }, [filter, notes, filterMode, sortField, sortDirection])

  const favoritePathSet = useMemo(() => new Set(favoritePaths), [favoritePaths])
  const favoriteNotes = useMemo(
    () => filtered.filter((note) => favoritePathSet.has(note.relPath)),
    [filtered, favoritePathSet]
  )
  const allNotes = useMemo(
    () => filtered.filter((note) => !favoritePathSet.has(note.relPath)),
    [filtered, favoritePathSet]
  )

  return (
    <div className="flex h-full flex-col gap-2.5 overflow-auto p-3">
      {filtered.length === 0 ? (
        <div className="p-2 text-sm text-[var(--muted)]">No notes found</div>
      ) : (
        <>
          <NoteSection
            title="Favorites"
            icon={<Heart size={16} aria-hidden="true" />}
            description={`${favoriteNotes.length} starred notes in the current filter`}
            emptyLabel="No favorite notes yet"
            notes={favoriteNotes}
            selectedPath={selectedPath}
            onOpen={onOpen}
            onDelete={onDelete}
            onRename={onRename}
            onDuplicate={onDuplicate}
            onMoveTo={onMoveTo}
            onCopyLink={onCopyLink}
            folders={folders}
            useNativeMenus={useNativeMenus}
          />
          <NoteSection
            title="All Notes"
            icon={<FileText size={16} aria-hidden="true" />}
            description={`${allNotes.length} notes available in the current filter`}
            emptyLabel="No other notes found"
            notes={allNotes}
            selectedPath={selectedPath}
            onOpen={onOpen}
            onDelete={onDelete}
            onRename={onRename}
            onDuplicate={onDuplicate}
            onMoveTo={onMoveTo}
            onCopyLink={onCopyLink}
            folders={folders}
            useNativeMenus={useNativeMenus}
          />
        </>
      )}
    </div>
  )
}

function NoteSection({
  title,
  icon,
  description,
  emptyLabel,
  notes,
  selectedPath,
  onOpen,
  onDelete,
  onRename,
  onDuplicate,
  onMoveTo,
  onCopyLink,
  folders,
  useNativeMenus
}: {
  title: string
  icon: ReactElement
  description: string
  emptyLabel: string
  notes: NoteListItem[]
  selectedPath: string | null
  onOpen: (relPath: string) => void
  onDelete: (relPath: string) => void
  onRename?: (relPath: string) => void
  onDuplicate?: (relPath: string) => void
  onMoveTo?: (relPath: string, targetFolder: string) => void
  onCopyLink?: (relPath: string) => void
  folders: string[]
  useNativeMenus: boolean
}): ReactElement {
  return (
    <WorkspacePanelSection>
      <WorkspacePanelSectionHeader icon={icon} heading={title} description={description} />
      {notes.length === 0 ? (
        <div className="p-2 text-sm text-[var(--muted)]">{emptyLabel}</div>
      ) : (
        notes.map((note) => {
          const isSelected = selectedPath === note.relPath
          const noteTags = Array.isArray(note.tags) ? note.tags : []
          const visibleTags = noteTags.slice(0, 2)
          const hiddenTagCount = Math.max(0, noteTags.length - visibleTags.length)
          const updatedLabel = `${new Date(note.updatedAt).toLocaleDateString()}`
          const menuItems = buildNoteMenuItems({
            canRename: Boolean(onRename),
            canDuplicate: Boolean(onDuplicate),
            canCopyLink: Boolean(onCopyLink),
            moveFolders: onMoveTo ? folders : []
          })

          const handleNativeContextMenu = async (
            event: React.MouseEvent<HTMLButtonElement>
          ): Promise<void> => {
            event.preventDefault()
            const actionId = await showNativeMenu(menuItems, getMouseMenuPosition(event))

            if (!actionId) {
              return
            }
            if (actionId === 'rename' && onRename) {
              onRename(note.relPath)
              return
            }
            if (actionId === 'duplicate' && onDuplicate) {
              onDuplicate(note.relPath)
              return
            }
            if (actionId.startsWith('move:') && onMoveTo) {
              onMoveTo(note.relPath, actionId.slice('move:'.length))
              return
            }
            if (actionId === 'copy-link' && onCopyLink) {
              onCopyLink(note.relPath)
              return
            }
            if (actionId === 'delete') {
              onDelete(note.relPath)
            }
          }

          const noteButton = (
            <button
              type="button"
              data-testid={`note-preview:${note.relPath}`}
              className={`flex w-full flex-col gap-1.5 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                isSelected
                  ? 'border-[var(--accent-line)] bg-[var(--accent-soft)]'
                  : 'border-[var(--line)] bg-[var(--panel-2)] hover:border-[var(--accent)]'
              }`}
              onClick={() => onOpen(note.relPath)}
              onContextMenu={useNativeMenus ? (event) => void handleNativeContextMenu(event) : undefined}
              onKeyDown={(event) => {
                if (!isDeleteShortcut(event)) {
                  return
                }
                event.preventDefault()
                onDelete(note.relPath)
              }}
            >
              <div className="truncate text-lg font-bold">{note.name.replace(/\.md$/i, '')}</div>
              <div className="flex min-w-0 items-center gap-1 overflow-hidden text-xs text-[var(--muted)]">
                <Badge variant="neutral">
                  <Pencil size={12} aria-hidden="true" />
                  {updatedLabel}
                </Badge>
                <span className="flex min-w-0 items-center gap-1 overflow-hidden">
                  {visibleTags.map((tag) => (
                    <TagChip key={`${note.relPath}-${tag}`} tag={tag} />
                  ))}
                  {hiddenTagCount > 0 ? <Badge variant="neutral">+{hiddenTagCount}</Badge> : null}
                </span>
              </div>
            </button>
          )

          return useNativeMenus ? (
            <div key={note.relPath}>{noteButton}</div>
          ) : (
            <ContextMenu key={note.relPath}>
              <ContextMenuTrigger asChild>{noteButton}</ContextMenuTrigger>
              <ContextMenuContent>
                {onRename && (
                  <ContextMenuItem onClick={() => onRename(note.relPath)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Rename
                  </ContextMenuItem>
                )}
                {onDuplicate && (
                  <ContextMenuItem onClick={() => onDuplicate(note.relPath)}>
                    <Copy className="mr-2 h-4 w-4" />
                    Duplicate
                  </ContextMenuItem>
                )}
                {onMoveTo && folders.length > 0 && (
                  <ContextMenuSub>
                    <ContextMenuSubTrigger>
                      <FolderInput className="mr-2 h-4 w-4" />
                      Move to...
                    </ContextMenuSubTrigger>
                    <ContextMenuSubContent>
                      {folders.map((folder) => (
                        <ContextMenuItem key={folder} onClick={() => onMoveTo(note.relPath, folder)}>
                          {folder}
                        </ContextMenuItem>
                      ))}
                    </ContextMenuSubContent>
                  </ContextMenuSub>
                )}
                {onCopyLink && (
                  <ContextMenuItem onClick={() => onCopyLink(note.relPath)}>
                    <Link className="mr-2 h-4 w-4" />
                    Copy link
                  </ContextMenuItem>
                )}
                <ContextMenuSeparator />
                <ContextMenuDestructiveItem onClick={() => onDelete(note.relPath)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                  <ContextMenuShortcut keys={['cmd', 'backspace']} />
                </ContextMenuDestructiveItem>
              </ContextMenuContent>
            </ContextMenu>
          )
        })
      )}
    </WorkspacePanelSection>
  )
}

function buildNoteMenuItems(options: {
  canRename: boolean
  canDuplicate: boolean
  canCopyLink: boolean
  moveFolders: string[]
}): NativeMenuItemDescriptor[] {
  return [
    ...(options.canRename ? [{ id: 'rename', label: 'Rename' }] : []),
    ...(options.canDuplicate ? [{ id: 'duplicate', label: 'Duplicate' }] : []),
    ...(options.moveFolders.length
      ? [
          {
            type: 'submenu' as const,
            label: 'Move to...',
            submenu: options.moveFolders.map((folder) => ({
              id: `move:${folder}`,
              label: folder
            }))
          }
        ]
      : []),
    ...(options.canCopyLink ? [{ id: 'copy-link', label: 'Copy link' }] : []),
    { type: 'separator' as const },
    { id: 'delete', label: 'Delete', accelerator: 'Command+Backspace' }
  ]
}
