import { ReactElement, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Copy, FolderInput, Link, Pencil, Trash2 } from 'lucide-react'
import { NoteListItem } from '../../../shared/types'
import { TagChip } from './TagChip'
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group'
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

type NoteFilterMode = 'all' | 'tagged' | 'untagged'
type NoteSortField = 'name' | 'created' | 'updated'
type NoteSortDirection = 'asc' | 'desc'

interface NotePreviewListProps {
  notes: NoteListItem[]
  favoritePaths: string[]
  selectedPath: string | null
  filter: string
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
  onOpen,
  onDelete,
  onRename,
  onDuplicate,
  onMoveTo,
  onCopyLink,
  folders = []
}: NotePreviewListProps): ReactElement {
  const [filterMode, setFilterMode] = useState<NoteFilterMode>('all')
  const [sortField, setSortField] = useState<NoteSortField>('created')
  const [sortDirection, setSortDirection] = useState<NoteSortDirection>('desc')

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

  const toggleSort = (field: NoteSortField): void => {
    if (sortField === field) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
      return
    }

    setSortField(field)
    setSortDirection(field === 'name' ? 'asc' : 'desc')
  }

  return (
    <div className="flex h-full flex-col gap-2.5 overflow-auto p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="px-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
          Filter
        </span>
        <ToggleGroup
          type="single"
          variant="pill"
          size="xs"
          value={filterMode}
          onValueChange={(value) => {
            if (value) setFilterMode(value as NoteFilterMode)
          }}
        >
          <ToggleGroupItem value="all">All</ToggleGroupItem>
          <ToggleGroupItem value="tagged">Tagged</ToggleGroupItem>
          <ToggleGroupItem value="untagged">Untagged</ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="px-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
          Sort
        </span>
        <ToggleGroup
          type="single"
          variant="pill"
          size="xs"
          value={sortField}
          onValueChange={(value) => {
            if (value) toggleSort(value as NoteSortField)
          }}
        >
          <ToggleGroupItem value="name">
            {sortField === 'name' && sortDirection === 'desc' ? (
              <ArrowDown size={12} aria-hidden="true" />
            ) : (
              <ArrowUp size={12} aria-hidden="true" />
            )}
            Name
          </ToggleGroupItem>
          <ToggleGroupItem value="created">
            {sortField === 'created' && sortDirection === 'asc' ? (
              <ArrowUp size={12} aria-hidden="true" />
            ) : (
              <ArrowDown size={12} aria-hidden="true" />
            )}
            Created
          </ToggleGroupItem>
          <ToggleGroupItem value="updated">
            {sortField === 'updated' && sortDirection === 'asc' ? (
              <ArrowUp size={12} aria-hidden="true" />
            ) : (
              <ArrowDown size={12} aria-hidden="true" />
            )}
            Updated
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      {filtered.length === 0 ? (
        <div className="p-2 text-sm text-[var(--muted)]">No notes found</div>
      ) : (
        <>
          <NoteSection
            title="Favorites"
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
          />
          <NoteSection
            title="All Notes"
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
          />
        </>
      )}
    </div>
  )
}

function NoteSection({
  title,
  emptyLabel,
  notes,
  selectedPath,
  onOpen,
  onDelete,
  onRename,
  onDuplicate,
  onMoveTo,
  onCopyLink,
  folders
}: {
  title: string
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
}): ReactElement {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold text-[var(--text)]">{title}</h2>
      {notes.length === 0 ? (
        <div className="p-2 text-sm text-[var(--muted)]">{emptyLabel}</div>
      ) : (
        notes.map((note) => {
          const isSelected = selectedPath === note.relPath
          const noteTags = Array.isArray(note.tags) ? note.tags : []
          const visibleTags = noteTags.slice(0, 2)
          const hiddenTagCount = Math.max(0, noteTags.length - visibleTags.length)
          const updatedLabel = `${new Date(note.updatedAt).toLocaleDateString()}`

          return (
            <ContextMenu key={note.relPath}>
              <ContextMenuTrigger asChild>
                <button
                  type="button"
                  className={`flex w-full flex-col gap-1.5 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                    isSelected
                      ? 'border-[var(--accent-line)] bg-[var(--accent-soft)]'
                      : 'border-[var(--line)] bg-[var(--panel-2)] hover:border-[var(--accent)]'
                  }`}
                  onClick={() => onOpen(note.relPath)}
                  onKeyDown={(event) => {
                    if (!isDeleteShortcut(event)) {
                      return
                    }
                    event.preventDefault()
                    onDelete(note.relPath)
                  }}
                >
                  <div className="truncate text-lg font-bold">
                    {note.name.replace(/\.md$/i, '')}
                  </div>
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
              </ContextMenuTrigger>
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
                <ContextMenuDestructiveItem
                  onClick={() => onDelete(note.relPath)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                  <ContextMenuShortcut keys={['cmd', 'backspace']} />
                </ContextMenuDestructiveItem>
              </ContextMenuContent>
            </ContextMenu>
          )
        })
      )}
    </section>
  )
}
