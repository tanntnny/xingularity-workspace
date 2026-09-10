import { useState, type ReactElement } from 'react'
import type {
  NoteListItem,
  NoteVimKeyMapping,
  ProjectMeeting,
  ProjectMeetingOutcome,
  ProjectMeetingType
} from '../../../shared/types'
import { ProjectJournalComposer } from './ProjectJournalComposer'
import { StatusChipSelect } from './ui/status-chip-select'
import {
  PROJECT_MEETING_OUTCOME_CHIP_OPTIONS,
  PROJECT_MEETING_TYPE_CHIP_OPTIONS
} from '../lib/statusChipMeta'

interface ProjectMeetingComposerProps {
  meeting?: ProjectMeeting | null
  notes: NoteListItem[]
  vimModeEnabled: boolean
  vimKeyMappings: NoteVimKeyMapping[]
  onOpenNoteLink: (target: string) => void
  onSubmit: (input: {
    markdown: string
    type: ProjectMeetingType
    outcome: ProjectMeetingOutcome
  }) => Promise<void>
  onCancelEdit: () => void
}

export function ProjectMeetingComposer({
  meeting,
  notes,
  vimModeEnabled,
  vimKeyMappings,
  onOpenNoteLink,
  onSubmit,
  onCancelEdit
}: ProjectMeetingComposerProps): ReactElement {
  const [type, setType] = useState<ProjectMeetingType>(meeting?.type ?? 'other')
  const [outcome, setOutcome] = useState<ProjectMeetingOutcome>(meeting?.outcome ?? 'informational')

  return (
    <ProjectJournalComposer
      entry={meeting}
      metadata={
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <StatusChipSelect
            label="Meeting type"
            value={type}
            options={PROJECT_MEETING_TYPE_CHIP_OPTIONS}
            onValueChange={(value) => setType(value as ProjectMeetingType)}
            surface="pill"
            data-testid="project-meeting-type-select"
          />
          <StatusChipSelect
            label="Meeting outcome"
            value={outcome}
            options={PROJECT_MEETING_OUTCOME_CHIP_OPTIONS}
            onValueChange={(value) => setOutcome(value as ProjectMeetingOutcome)}
            surface="pill"
            data-testid="project-meeting-outcome-select"
          />
        </div>
      }
      notes={notes}
      vimModeEnabled={vimModeEnabled}
      vimKeyMappings={vimKeyMappings}
      onOpenNoteLink={onOpenNoteLink}
      onSubmit={async (markdown) => {
        await onSubmit({ markdown, type, outcome })
        if (!meeting) {
          setType('other')
          setOutcome('informational')
        }
      }}
      onCancelEdit={onCancelEdit}
      ariaLabel="Project meeting composer"
      testId="project-meeting-composer"
      submitTestId="project-meeting-submit"
      cancelTestId="project-meeting-cancel"
      submitLabel="Post meeting"
      editingSubmitLabel="Save changes"
    />
  )
}
