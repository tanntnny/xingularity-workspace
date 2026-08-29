import { ReactElement, useMemo } from 'react'
import { FileText, Pencil, Search } from './ui/icons'
import { stripNoteExtension } from '../../../shared/noteDocument'
import type { NoteListItem } from '../../../shared/types'
import { TagChip } from './TagChip'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { EmptyState } from './ui/empty-state'
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from './ui/context-menu'
import { ActionMenuItems } from './ui/action-menu'
import { WorkspacePanelSection, WorkspacePanelSectionHeader } from './ui/workspace-panel-section'
import { isDeleteShortcut } from '../lib/isDeleteShortcut'
import { buildNoteNativeMenuItems, getNoteMenuGroups } from '../lib/noteMenu'
import { canUseNativeMenus, getMouseMenuPosition, showNativeMenu } from '../lib/nativeMenu'
import { useStaggeredScrollReveal } from '../hooks/useStaggeredScrollReveal'

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
  const revealItemIds = useMemo(
    () => [
      ...favoriteNotes.map((note) => `favorite:${note.relPath}`),
      ...allNotes.map((note) => `all:${note.relPath}`)
    ],
    [allNotes, favoriteNotes]
  )
  const { containerRef, getRevealItemProps } = useStaggeredScrollReveal(revealItemIds)

  return (
    <div ref={containerRef} className="flex h-full flex-col gap-2.5 overflow-auto p-3">
      {filtered.length === 0 ? (
        <EmptyState
          className="h-full border-0 bg-transparent px-3 py-6"
          icon={Search}
          title="No notes found"
          description="Try a different filter or search term."
        />
      ) : (
        <>
          <NoteSection
            title="Favorites"
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
            getRevealItemProps={getRevealItemProps}
            revealKeyPrefix="favorite"
          />
          <NoteSection
            title="All Notes"
            description={`${allNotes.length} notes available`}
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
            getRevealItemProps={getRevealItemProps}
            revealKeyPrefix="all"
          />
        </>
      )}
    </div>
  )
}

function NoteSection({
  title,
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
  useNativeMenus,
  getRevealItemProps,
  revealKeyPrefix
}: {
  title: string
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
  getRevealItemProps: (itemId: string) => {
    ref: (node: HTMLElement | null) => void
    className: string
    style: React.CSSProperties
  }
  revealKeyPrefix: string
}): ReactElement {
  return (
    <WorkspacePanelSection>
      <WorkspacePanelSectionHeader heading={title} description={description} />
      {notes.length === 0 ? (
        <EmptyState
          className="border-0 bg-transparent px-3 py-4"
          icon={FileText}
          title={emptyLabel}
          description="Notes that match this section will appear here."
        />
      ) : (
        notes.map((note) => {
          const revealProps = getRevealItemProps(`${revealKeyPrefix}:${note.relPath}`)
          const isSelected = selectedPath === note.relPath
          const noteTags = Array.isArray(note.tags) ? note.tags : []
          const visibleTags = noteTags.slice(0, 2)
          const hiddenTagCount = Math.max(0, noteTags.length - visibleTags.length)
          const updatedLabel = `${new Date(note.updatedAt).toLocaleDateString()}`
          const menuGroups = getNoteMenuGroups(
            {
              onDelete: () => onDelete(note.relPath),
              onRename: onRename ? () => onRename(note.relPath) : undefined,
              onDuplicate: onDuplicate ? () => onDuplicate(note.relPath) : undefined,
              onMoveTo: onMoveTo ? (folder) => onMoveTo(note.relPath, folder) : undefined,
              onCopyLink: onCopyLink ? () => onCopyLink(note.relPath) : undefined
            },
            onMoveTo ? folders : []
          )
          const menuItems = buildNoteNativeMenuItems({
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
            <Button
              type="button"
              variant={isSelected ? 'secondary' : 'ghost'}
              ref={revealProps.ref}
              data-testid={`note-preview:${note.relPath}`}
              data-active={isSelected}
              className={`${revealProps.className} rounded-lg border bg-card text-card-foreground h-auto items-start justify-start gap-2 px-3 py-2 text-left`}
              style={revealProps.style}
              onClick={() => onOpen(note.relPath)}
              onContextMenu={
                useNativeMenus ? (event) => void handleNativeContextMenu(event) : undefined
              }
              onKeyDown={(event) => {
                if (!isDeleteShortcut(event)) {
                  return
                }
                event.preventDefault()
                onDelete(note.relPath)
              }}
            >
              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">
                  {stripNoteExtension(note.name)}
                </span>
                <span className="block truncate text-xs text-muted-foreground">{note.relPath}</span>
                <span className="mt-1.5 flex min-w-0 items-center gap-1 overflow-hidden text-xs text-muted-foreground">
                  <Badge variant="neutral" tone="subtle">
                    <Pencil size={12} aria-hidden="true" />
                    {updatedLabel}
                  </Badge>
                  <span className="flex min-w-0 items-center gap-1 overflow-hidden">
                    {visibleTags.map((tag) => (
                      <TagChip key={`${note.relPath}-${tag}`} tag={tag} />
                    ))}
                    {hiddenTagCount > 0 ? (
                      <Badge variant="neutral" tone="neutral">
                        +{hiddenTagCount}
                      </Badge>
                    ) : null}
                  </span>
                </span>
              </span>
            </Button>
          )

          return useNativeMenus ? (
            <div key={note.relPath}>{noteButton}</div>
          ) : (
            <ContextMenu key={note.relPath}>
              <ContextMenuTrigger asChild>{noteButton}</ContextMenuTrigger>
              <ContextMenuContent>
                <ActionMenuItems variant="context" groups={menuGroups} />
              </ContextMenuContent>
            </ContextMenu>
          )
        })
      )}
    </WorkspacePanelSection>
  )
}
