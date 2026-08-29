import { useState, type ReactElement } from 'react'
import type { NoteListItem, ProjectUpdate, NoteVimKeyMapping } from '../../../shared/types'
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
import { MoreHorizontal, Pencil, Trash2 } from './ui/icons'
import { Card } from './ui/card'
import { StatusChip } from './ui/status-chip'
import { PROJECT_UPDATE_CHIP_ITEMS } from '../lib/statusChipMeta'

interface ProjectUpdateFeedProps {
  updates: readonly ProjectUpdate[]
  notes: NoteListItem[]
  vimModeEnabled: boolean
  vimKeyMappings: NoteVimKeyMapping[]
  onOpenNoteLink: (target: string) => void
  onEdit: (update: ProjectUpdate) => void
  onDelete: (updateId: string) => Promise<void>
}

function formatUpdateDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown date'

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric'
  })
}

function getProjectUpdateMenuGroups(onEdit: () => void, onDelete: () => void): ActionMenuGroup[] {
  return [
    {
      id: 'primary',
      items: [
        {
          id: 'edit',
          label: 'Edit',
          icon: <Pencil size={15} aria-hidden="true" />,
          onSelect: onEdit
        }
      ]
    },
    {
      id: 'destructive',
      items: [
        {
          id: 'delete',
          label: 'Delete',
          icon: <Trash2 size={15} aria-hidden="true" />,
          destructive: true,
          onSelect: onDelete
        }
      ]
    }
  ]
}

export function ProjectUpdateFeed({
  updates,
  notes,
  vimModeEnabled,
  vimKeyMappings,
  onOpenNoteLink,
  onEdit,
  onDelete
}: ProjectUpdateFeedProps): ReactElement | null {
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const sortedUpdates = updates
    .slice()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  const pendingUpdate = sortedUpdates.find((update) => update.id === pendingDeleteId) ?? null

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

  if (sortedUpdates.length === 0) {
    return null
  }

  return (
    <section
      className="space-y-3"
      aria-label="Project update feed"
      data-testid="project-update-feed"
    >
      {sortedUpdates.map((update) => (
        <ContextMenu key={update.id}>
          <Card
            className="overflow-hidden bg-panel"
            data-testid={`project-update-card:${update.id}`}
          >
            <ContextMenuTrigger asChild>
              <div className="p-4" data-testid={`project-update-feed-item:${update.id}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <time dateTime={update.createdAt} className="text-sm font-medium text-foreground">
                    {formatUpdateDate(update.createdAt)}
                  </time>
                  <StatusChip item={PROJECT_UPDATE_CHIP_ITEMS[update.status]} surface="pill" />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <WorkspaceIconButton
                        variant="rowAction"
                        icon={<MoreHorizontal size={16} aria-hidden="true" />}
                        aria-label={`Actions for update from ${formatUpdateDate(update.createdAt)}`}
                        data-testid={`project-update-menu:${update.id}`}
                        borderless
                        className="ml-auto"
                      />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <ActionMenuItems
                        variant="dropdown"
                        groups={getProjectUpdateMenuGroups(
                          () => onEdit(update),
                          () => setPendingDeleteId(update.id)
                        )}
                      />
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent data-testid={`project-update-context-menu:${update.id}`}>
              <ActionMenuItems
                variant="context"
                groups={getProjectUpdateMenuGroups(
                  () => onEdit(update),
                  () => setPendingDeleteId(update.id)
                )}
              />
            </ContextMenuContent>
            <article className="px-4 pb-4">
              <div className="note-editor-surface rounded-md px-3 py-2">
                <Editor
                  key={`${update.id}-${update.updatedAt}`}
                  initialContent={update.markdown}
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
        open={Boolean(pendingUpdate)}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setPendingDeleteId(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this update?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the update from the project history. This action cannot be
              undone.
            </AlertDialogDescription>
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
              Delete update
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
