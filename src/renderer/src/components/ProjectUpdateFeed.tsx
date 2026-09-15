import type { ReactElement } from 'react'
import type { NoteListItem, NoteVimKeyMapping, ProjectUpdate } from '../../../shared/types'
import { ProjectJournalFeed } from './ProjectJournalFeed'
import type { ActionMenuGroup } from './ui/action-menu'
import { StatusChip } from './ui/status-chip'
import { PROJECT_UPDATE_CHIP_ITEMS } from '../lib/statusChipMeta'
import { Pencil, Trash2 } from './ui/icons'

interface ProjectUpdateFeedProps {
  updates: readonly ProjectUpdate[]
  notes: NoteListItem[]
  vimModeEnabled: boolean
  vimKeyMappings: NoteVimKeyMapping[]
  onOpenNoteLink: (target: string, options?: { openInNewTab?: boolean }) => void
  onEdit: (update: ProjectUpdate) => void
  onDelete: (updateId: string) => Promise<void>
}

function getProjectUpdateMenuGroups(
  onEdit: () => void,
  onRequestDelete: () => void
): ActionMenuGroup[] {
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
          onSelect: onRequestDelete
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
  return (
    <ProjectJournalFeed
      entries={updates}
      notes={notes}
      vimModeEnabled={vimModeEnabled}
      vimKeyMappings={vimKeyMappings}
      onOpenNoteLink={onOpenNoteLink}
      onDelete={onDelete}
      renderMetadata={(update) => (
        <StatusChip item={PROJECT_UPDATE_CHIP_ITEMS[update.status]} surface="pill" />
      )}
      getMenuGroups={(update, requestDelete) =>
        getProjectUpdateMenuGroups(() => onEdit(update), requestDelete)
      }
      testIdPrefix="project-update"
      entryLabel="update"
      ariaLabel="Project update feed"
      deleteTitle="Delete this update?"
      deleteDescription="This permanently removes the update from the project history. This action cannot be undone."
      deleteActionLabel="Delete update"
    />
  )
}
