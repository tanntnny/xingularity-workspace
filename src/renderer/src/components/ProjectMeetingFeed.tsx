import type { ReactElement } from 'react'
import type { NoteListItem, NoteVimKeyMapping, ProjectMeeting } from '../../../shared/types'
import { ProjectJournalFeed } from './ProjectJournalFeed'
import type { ActionMenuGroup } from './ui/action-menu'
import { StatusChip } from './ui/status-chip'
import {
  PROJECT_MEETING_OUTCOME_CHIP_ITEMS,
  PROJECT_MEETING_TYPE_CHIP_ITEMS
} from '../lib/statusChipMeta'
import { ListTodo, Pencil, Trash2 } from './ui/icons'

interface ProjectMeetingFeedProps {
  meetings: readonly ProjectMeeting[]
  notes: NoteListItem[]
  vimModeEnabled: boolean
  vimKeyMappings: NoteVimKeyMapping[]
  onOpenNoteLink: (target: string) => void
  onEdit: (meeting: ProjectMeeting) => void
  onDelete: (meetingId: string) => Promise<void>
  onCreateFollowUpTask?: () => void | Promise<void>
}

function getProjectMeetingMenuGroups(
  meeting: ProjectMeeting,
  onEdit: () => void,
  onRequestDelete: () => void,
  onCreateFollowUpTask?: () => void | Promise<void>
): ActionMenuGroup[] {
  const primaryItems = [
    {
      id: 'edit',
      label: 'Edit',
      icon: <Pencil size={15} aria-hidden="true" />,
      onSelect: onEdit
    }
  ]

  if (meeting.outcome === 'follow-up-needed' && onCreateFollowUpTask) {
    primaryItems.push({
      id: 'create-follow-up-task',
      label: 'Create follow-up task',
      icon: <ListTodo size={15} aria-hidden="true" />,
      onSelect: () => void onCreateFollowUpTask()
    })
  }

  return [
    { id: 'primary', items: primaryItems },
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

export function ProjectMeetingFeed({
  meetings,
  notes,
  vimModeEnabled,
  vimKeyMappings,
  onOpenNoteLink,
  onEdit,
  onDelete,
  onCreateFollowUpTask
}: ProjectMeetingFeedProps): ReactElement | null {
  return (
    <ProjectJournalFeed
      entries={meetings}
      notes={notes}
      vimModeEnabled={vimModeEnabled}
      vimKeyMappings={vimKeyMappings}
      onOpenNoteLink={onOpenNoteLink}
      onDelete={onDelete}
      renderMetadata={(meeting) => (
        <>
          <StatusChip item={PROJECT_MEETING_TYPE_CHIP_ITEMS[meeting.type]} surface="pill" />
          <StatusChip item={PROJECT_MEETING_OUTCOME_CHIP_ITEMS[meeting.outcome]} surface="pill" />
        </>
      )}
      getMenuGroups={(meeting, requestDelete) =>
        getProjectMeetingMenuGroups(
          meeting,
          () => onEdit(meeting),
          requestDelete,
          onCreateFollowUpTask
        )
      }
      testIdPrefix="project-meeting"
      entryLabel="meeting"
      ariaLabel="Project meeting feed"
      emptyState={
        <section
          className="rounded-lg border border-dashed border-panel-border bg-panel px-4"
          data-testid="project-meeting-empty"
        >
          <div className="py-8 text-center">
            <h2 className="text-sm font-semibold text-foreground">No meetings yet</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Posted meeting notes will appear here.
            </p>
          </div>
        </section>
      }
      deleteTitle="Delete this meeting?"
      deleteDescription="This permanently removes the meeting note from the project history. This action cannot be undone."
      deleteActionLabel="Delete meeting"
    />
  )
}
