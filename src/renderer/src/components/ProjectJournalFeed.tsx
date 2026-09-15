import { useState, type ReactElement, type ReactNode } from 'react'
import type { NoteListItem, NoteVimKeyMapping } from '../../../shared/types'
import { Editor } from './Editor'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from './ui/alert-dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from './ui/dropdown-menu'
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from './ui/context-menu'
import { ActionMenuItems, type ActionMenuGroup } from './ui/action-menu'
import { WorkspaceIconButton } from './ui/document-workspace'
import { MoreHorizontal } from './ui/icons'
import { Card } from './ui/card'

export interface ProjectJournalEntry {
  id: string
  markdown: string
  createdAt: string
  updatedAt: string
}

interface ProjectJournalFeedProps<T extends ProjectJournalEntry> {
  entries: readonly T[]
  notes: NoteListItem[]
  vimModeEnabled: boolean
  vimKeyMappings: NoteVimKeyMapping[]
  onOpenNoteLink: (target: string, options?: { openInNewTab?: boolean }) => void
  onDelete: (entryId: string) => Promise<void>
  renderMetadata: (entry: T) => ReactNode
  getMenuGroups: (entry: T, requestDelete: () => void) => ActionMenuGroup[]
  testIdPrefix: string
  entryLabel: string
  ariaLabel: string
  emptyState?: ReactNode
  deleteTitle: string
  deleteDescription: string
  deleteActionLabel: string
}

function formatJournalDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown date'

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric'
  })
}

export function ProjectJournalFeed<T extends ProjectJournalEntry>({
  entries,
  notes,
  vimModeEnabled,
  vimKeyMappings,
  onOpenNoteLink,
  onDelete,
  renderMetadata,
  getMenuGroups,
  testIdPrefix,
  entryLabel,
  ariaLabel,
  emptyState,
  deleteTitle,
  deleteDescription,
  deleteActionLabel
}: ProjectJournalFeedProps<T>): ReactElement | null {
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const sortedEntries = entries
    .slice()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  const pendingEntry = sortedEntries.find((entry) => entry.id === pendingDeleteId) ?? null

  const handleConfirmDelete = async (): Promise<void> => {
    if (!pendingDeleteId || isDeleting) return

    setIsDeleting(true)
    try {
      await onDelete(pendingDeleteId)
      setPendingDeleteId(null)
    } catch {
      // The parent reports persistence errors and leaves the confirmation open.
    } finally {
      setIsDeleting(false)
    }
  }

  if (sortedEntries.length === 0) {
    return emptyState ? <>{emptyState}</> : null
  }

  return (
    <section className="space-y-3" aria-label={ariaLabel} data-testid={`${testIdPrefix}-feed`}>
      {sortedEntries.map((entry) => (
        <ContextMenu key={entry.id}>
          <Card
            className="overflow-hidden bg-panel"
            data-testid={`${testIdPrefix}-card:${entry.id}`}
          >
            <ContextMenuTrigger asChild>
              <div className="p-4" data-testid={`${testIdPrefix}-feed-item:${entry.id}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <time dateTime={entry.createdAt} className="text-sm font-medium text-foreground">
                    {formatJournalDate(entry.createdAt)}
                  </time>
                  {renderMetadata(entry)}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <WorkspaceIconButton
                        variant="rowAction"
                        icon={<MoreHorizontal size={16} aria-hidden="true" />}
                        aria-label={`Actions for ${entryLabel} from ${formatJournalDate(entry.createdAt)}`}
                        data-testid={`${testIdPrefix}-menu:${entry.id}`}
                        borderless
                        className="ml-auto"
                      />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <ActionMenuItems
                        variant="dropdown"
                        groups={getMenuGroups(entry, () => setPendingDeleteId(entry.id))}
                      />
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent data-testid={`${testIdPrefix}-context-menu:${entry.id}`}>
              <ActionMenuItems
                variant="context"
                groups={getMenuGroups(entry, () => setPendingDeleteId(entry.id))}
              />
            </ContextMenuContent>
            <article className="px-4 pb-4">
              <div className="note-editor-surface rounded-md px-3 py-2">
                <Editor
                  key={`${entry.id}-${entry.updatedAt}`}
                  initialContent={entry.markdown}
                  density="compact"
                  readOnly
                  onDirty={() => undefined}
                  onDropFile={async () => null}
                  onPasteImage={async () => null}
                  notes={notes}
                  onOpenNoteLink={onOpenNoteLink}
                  vimModeEnabled={vimModeEnabled}
                  vimKeyMappings={vimKeyMappings}
                />
              </div>
            </article>
          </Card>
        </ContextMenu>
      ))}

      <AlertDialog
        open={Boolean(pendingEntry)}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setPendingDeleteId(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>{deleteDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={(event) => {
                event.preventDefault()
                void handleConfirmDelete()
              }}
            >
              {deleteActionLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
