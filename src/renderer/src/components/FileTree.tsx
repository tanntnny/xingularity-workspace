import { ReactElement, ReactNode, useMemo } from 'react'
import { FileText, Folder, Tag } from './ui/icons'
import { isNotePath, stripNoteExtension } from '../../../shared/noteDocument'
import type { NoteListItem } from '../../../shared/types'
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from './ui/context-menu'
import { ActionMenuItems } from './ui/action-menu'
import { isDeleteShortcut } from '../lib/isDeleteShortcut'
import { canUseNativeMenus, getMouseMenuPosition, showNativeMenu } from '../lib/nativeMenu'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { EmptyState } from './ui/empty-state'
import { WorkspaceTextFade } from './ui/workspace-text-fade'
import { buildNoteNativeMenuItems, getNoteMenuGroups } from '../lib/noteMenu'

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
    <nav aria-label="Notes" className="flex flex-col gap-4">
      <Section title="Quick Links">
        <Button variant="secondary" className="h-8 w-full justify-between px-2" type="button">
          <span>All Notes</span>
          <Badge variant="outline">{notes.length}</Badge>
        </Button>
        <Button variant="ghost" className="h-8 w-full justify-between px-2" type="button">
          <span>Favorites</span>
          <Badge variant="outline">0</Badge>
        </Button>
        <Button variant="ghost" className="h-8 w-full justify-between px-2" type="button">
          <span>Archived</span>
          <Badge variant="outline">0</Badge>
        </Button>
        <Button variant="ghost" className="h-8 w-full justify-between px-2" type="button">
          <span>Recently Deleted</span>
          <Badge variant="outline">0</Badge>
        </Button>
      </Section>

      <Section title="Tags">
        {tags.length > 0 ? (
          tags.map((tag) => (
            <Button
              variant="ghost"
              shape="pill"
              className="h-8 w-full justify-start px-2"
              key={tag}
              type="button"
            >
              <span>#{tag}</span>
            </Button>
          ))
        ) : (
          <EmptyState
            className="border-0 bg-transparent px-2 py-3"
            icon={Tag}
            title="No tags yet"
            description="Tags will appear when you add them to notes."
          />
        )}
      </Section>

      <Section title="Folders">
        {folders.length > 0 ? (
          folders.map((folder) => (
            <Button
              variant="ghost"
              className="h-8 w-full justify-between px-2"
              key={folder.name}
              type="button"
            >
              <WorkspaceTextFade className="min-w-0 flex-1">{folder.name}</WorkspaceTextFade>
              <Badge variant="outline">{folder.count}</Badge>
            </Button>
          ))
        ) : (
          <EmptyState
            className="border-0 bg-transparent px-2 py-3"
            icon={Folder}
            title="No folders yet"
            description="Create a folder to organize your notes."
          />
        )}
      </Section>

      <Section title="Notes">
        {sorted.length === 0 ? (
          <EmptyState
            className="border-0 bg-transparent px-2 py-3"
            icon={FileText}
            title="No notes yet"
            description="Create a note to begin writing."
          />
        ) : (
          sorted.map((note) => {
            const menuGroups = getNoteMenuGroups(
              {
                onDelete: () => onDelete(note.relPath),
                onRename: () => onRename(note.relPath),
                onDuplicate: onDuplicate ? () => onDuplicate(note.relPath) : undefined,
                onMoveTo: onMoveTo ? (folder) => onMoveTo(note.relPath, folder) : undefined,
                onCopyLink: onCopyLink ? () => onCopyLink(note.relPath) : undefined
              },
              onMoveTo ? folderNames : []
            )
            const menuItems = buildNoteNativeMenuItems({
              canRename: true,
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
              <div>
                <Button
                  variant={selectedPath === note.relPath ? 'secondary' : 'ghost'}
                  className="h-auto w-full justify-start px-2 py-1.5 text-left"
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
                  <WorkspaceTextFade className="min-w-0">{note.relPath}</WorkspaceTextFade>
                </Button>
              </div>
            )

            return useNativeMenus ? (
              <div key={note.relPath}>{noteRow}</div>
            ) : (
              <ContextMenu key={note.relPath}>
                <ContextMenuTrigger asChild>{noteRow}</ContextMenuTrigger>
                <ContextMenuContent>
                  <ActionMenuItems variant="context" groups={menuGroups} />
                </ContextMenuContent>
              </ContextMenu>
            )
          })
        )}
      </Section>
    </nav>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }): ReactElement {
  return (
    <section className="flex flex-col gap-1">
      <h2 className="px-2 text-xs font-medium text-muted-foreground">{title}</h2>
      <div className="flex flex-col gap-1">{children}</div>
    </section>
  )
}
