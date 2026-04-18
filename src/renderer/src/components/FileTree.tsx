import { ReactElement, ReactNode, useMemo } from 'react'
import { Copy, FolderInput, Link, Pencil, Trash2 } from 'lucide-react'
import { isNotePath, stripNoteExtension } from '../../../shared/noteDocument'
import type { NativeMenuItemDescriptor, NoteListItem } from '../../../shared/types'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuDestructiveItem,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
  isDeleteShortcut
} from './ui/context-menu'
import { canUseNativeMenus, getMouseMenuPosition, showNativeMenu } from '../lib/nativeMenu'

interface FileTreeProps {
  notes: NoteListItem[]
  selectedPath: string | null
  onSelect: (relPath: string) => void
  onDelete: (relPath: string) => void
  onRename: (relPath: string) => void
  onDuplicate?: (relPath: string) => void
  onMoveTo?: (relPath: string, targetFolder: string) => void
  onCopyLink?: (relPath: string) => void
}

interface FolderBucket {
  name: string
  count: number
}

export function FileTree({
  notes,
  selectedPath,
  onSelect,
  onDelete,
  onRename,
  onDuplicate,
  onMoveTo,
  onCopyLink
}: FileTreeProps): ReactElement {
  const useNativeMenus = canUseNativeMenus()
  const sorted = useMemo(
    () => [...notes].sort((a, b) => a.relPath.localeCompare(b.relPath)),
    [notes]
  )

  const folders = useMemo<FolderBucket[]>(() => {
    const counts = new Map<string, number>()
    for (const note of notes) {
      const firstSegment = note.relPath.split('/')[0]
      const folder = isNotePath(firstSegment) ? 'Inbox' : firstSegment
      counts.set(folder, (counts.get(folder) ?? 0) + 1)
    }
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [notes])

  const folderNames = useMemo(() => {
    return folders.map((f) => f.name).filter((name) => name !== 'Inbox')
  }, [folders])

  const tags = useMemo(() => {
    const guessed = new Set<string>()
    for (const note of notes) {
      const parts = stripNoteExtension(note.relPath.toLowerCase()).split(/[/-]/)
      for (const part of parts) {
        if (part.length > 4 && !['notes', 'inbox'].includes(part)) {
          guessed.add(part)
        }
      }
    }
    return Array.from(guessed).slice(0, 6)
  }, [notes])

  return (
    <div className="file-tree">
      <Section title="Quick Links">
        <button className="tree-pill active" type="button">
          <span>All Notes</span>
          <span className="count-pill">{notes.length}</span>
        </button>
        <button className="tree-pill" type="button">
          <span>Favorites</span>
          <span className="count-pill">0</span>
        </button>
        <button className="tree-pill" type="button">
          <span>Archived</span>
          <span className="count-pill">0</span>
        </button>
        <button className="tree-pill" type="button">
          <span>Recently Deleted</span>
          <span className="count-pill">0</span>
        </button>
      </Section>

      <Section title="Tags">
        {tags.length > 0 ? (
          tags.map((tag) => (
            <button className="tree-pill" key={tag} type="button">
              <span>#{tag}</span>
            </button>
          ))
        ) : (
          <div className="empty">No tags yet</div>
        )}
      </Section>

      <Section title="Folders">
        {folders.length > 0 ? (
          folders.map((folder) => (
            <button className="tree-pill" key={folder.name} type="button">
              <span>{folder.name}</span>
              <span className="count-pill">{folder.count}</span>
            </button>
          ))
        ) : (
          <div className="empty">No folders yet</div>
        )}
      </Section>

      <Section title="Notes">
        {sorted.length === 0 ? (
          <div className="empty">No notes yet</div>
        ) : (
          sorted.map((note) => {
            const menuItems = buildNoteMenuItems({
              canDuplicate: Boolean(onDuplicate),
              canCopyLink: Boolean(onCopyLink),
              moveFolders: onMoveTo ? folderNames : []
            })

            const handleNativeContextMenu = async (
              event: React.MouseEvent<HTMLButtonElement>
            ): Promise<void> => {
              event.preventDefault()
              const actionId = await showNativeMenu(menuItems, getMouseMenuPosition(event))

              if (!actionId) {
                return
              }
              if (actionId === 'rename') {
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

            const noteRow = (
              <div className={`note-row ${selectedPath === note.relPath ? 'selected' : ''}`}>
                <button
                  className="note-button"
                  onClick={() => onSelect(note.relPath)}
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
                  title={note.relPath}
                >
                  {note.relPath}
                </button>
              </div>
            )

            return useNativeMenus ? (
              <div key={note.relPath}>{noteRow}</div>
            ) : (
              <ContextMenu key={note.relPath}>
                <ContextMenuTrigger asChild>{noteRow}</ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem onClick={() => onRename(note.relPath)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Rename
                  </ContextMenuItem>
                  {onDuplicate && (
                    <ContextMenuItem onClick={() => onDuplicate(note.relPath)}>
                      <Copy className="mr-2 h-4 w-4" />
                      Duplicate
                    </ContextMenuItem>
                  )}
                  {onMoveTo && folderNames.length > 0 && (
                    <ContextMenuSub>
                      <ContextMenuSubTrigger>
                        <FolderInput className="mr-2 h-4 w-4" />
                        Move to...
                      </ContextMenuSubTrigger>
                      <ContextMenuSubContent>
                        {folderNames.map((folder) => (
                          <ContextMenuItem
                            key={folder}
                            onClick={() => onMoveTo(note.relPath, folder)}
                          >
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
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }): ReactElement {
  return (
    <section className="tree-section">
      <h4>{title}</h4>
      <div className="tree-section-body">{children}</div>
    </section>
  )
}

function buildNoteMenuItems(options: {
  canDuplicate: boolean
  canCopyLink: boolean
  moveFolders: string[]
}): NativeMenuItemDescriptor[] {
  return [
    { id: 'rename', label: 'Rename' },
    ...(options.canDuplicate ? [{ id: 'duplicate', label: 'Duplicate' }] : []),
    ...(options.moveFolders.length > 0
      ? [
          {
            id: 'move',
            label: 'Move to...',
            submenu: options.moveFolders.map((folder) => ({
              id: `move:${folder}`,
              label: folder
            }))
          }
        ]
      : []),
    ...(options.canCopyLink ? [{ id: 'copy-link', label: 'Copy link' }] : []),
    { type: 'separator' },
    { id: 'delete', label: 'Delete', accelerator: 'Command+Backspace' }
  ]
}
