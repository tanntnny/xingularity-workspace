import { useState, type ReactElement } from 'react'
import type {
  NoteListItem,
  NoteVimKeyMapping,
  Project,
  ProjectMeetingOutcome,
  ProjectMeetingType
} from '../../../shared/types'
import { ProjectMeetingComposer } from '../components/ProjectMeetingComposer'
import { ProjectMeetingFeed } from '../components/ProjectMeetingFeed'
import { WorkspaceReadingWidth } from '../components/workspace'

interface ProjectMeetingPageProps {
  project: Project
  notes: NoteListItem[]
  vimModeEnabled: boolean
  vimKeyMappings: NoteVimKeyMapping[]
  onOpenNoteLink: (target: string, options?: { openInNewTab?: boolean }) => void
  onCreateMeeting: (input: {
    markdown: string
    type: ProjectMeetingType
    outcome: ProjectMeetingOutcome
  }) => Promise<void>
  onUpdateMeeting: (
    meetingId: string,
    input: {
      markdown: string
      type: ProjectMeetingType
      outcome: ProjectMeetingOutcome
    }
  ) => Promise<void>
  onDeleteMeeting: (meetingId: string) => Promise<void>
  onCreateFollowUpTask?: () => void | Promise<void>
}

export function ProjectMeetingPage({
  project,
  notes,
  vimModeEnabled,
  vimKeyMappings,
  onOpenNoteLink,
  onCreateMeeting,
  onUpdateMeeting,
  onDeleteMeeting,
  onCreateFollowUpTask
}: ProjectMeetingPageProps): ReactElement {
  const [editingMeetingId, setEditingMeetingId] = useState<string | null>(null)
  const editingMeeting =
    project.meetings?.find((meeting) => meeting.id === editingMeetingId) ?? null

  const handleSubmit = async (input: {
    markdown: string
    type: ProjectMeetingType
    outcome: ProjectMeetingOutcome
  }): Promise<void> => {
    if (editingMeeting) {
      await onUpdateMeeting(editingMeeting.id, input)
      setEditingMeetingId(null)
      return
    }

    await onCreateMeeting(input)
  }

  const handleDeleteMeeting = async (meetingId: string): Promise<void> => {
    await onDeleteMeeting(meetingId)
    if (editingMeetingId === meetingId) setEditingMeetingId(null)
  }

  return (
    <div className="min-h-full" data-testid="project-meeting-page">
      <WorkspaceReadingWidth className="mt-3 space-y-3 p-2">
        <ProjectMeetingComposer
          key={`${project.id}-${editingMeetingId ?? 'new'}`}
          meeting={editingMeeting}
          notes={notes}
          vimModeEnabled={vimModeEnabled}
          vimKeyMappings={vimKeyMappings}
          onOpenNoteLink={onOpenNoteLink}
          onSubmit={handleSubmit}
          onCancelEdit={() => setEditingMeetingId(null)}
        />
        <ProjectMeetingFeed
          meetings={project.meetings ?? []}
          notes={notes}
          vimModeEnabled={vimModeEnabled}
          vimKeyMappings={vimKeyMappings}
          onOpenNoteLink={onOpenNoteLink}
          onEdit={(meeting) => setEditingMeetingId(meeting.id)}
          onDelete={handleDeleteMeeting}
          onCreateFollowUpTask={onCreateFollowUpTask}
        />
      </WorkspaceReadingWidth>
    </div>
  )
}
