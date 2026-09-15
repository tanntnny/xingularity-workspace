import { useState, type ReactElement } from 'react'
import type {
  NoteListItem,
  NoteVimKeyMapping,
  ProjectUpdate,
  ProjectUpdateStatus
} from '../../../shared/types'
import { ProjectJournalComposer } from './ProjectJournalComposer'
import { StatusChipSelect } from './ui/status-chip-select'
import { PROJECT_UPDATE_CHIP_OPTIONS } from '../lib/statusChipMeta'

interface ProjectUpdateComposerProps {
  update?: ProjectUpdate | null
  notes: NoteListItem[]
  vimModeEnabled: boolean
  vimKeyMappings: NoteVimKeyMapping[]
  onOpenNoteLink: (target: string, options?: { openInNewTab?: boolean }) => void
  onSubmit: (input: { markdown: string; status: ProjectUpdateStatus }) => Promise<void>
  onCancelEdit: () => void
}

export function ProjectUpdateComposer({
  update,
  notes,
  vimModeEnabled,
  vimKeyMappings,
  onOpenNoteLink,
  onSubmit,
  onCancelEdit
}: ProjectUpdateComposerProps): ReactElement {
  const [status, setStatus] = useState<ProjectUpdateStatus>(update?.status ?? 'on-track')

  return (
    <ProjectJournalComposer
      entry={update}
      metadata={
        <div className="flex min-w-0 items-center gap-2">
          <StatusChipSelect
            label="Update status"
            value={status}
            options={PROJECT_UPDATE_CHIP_OPTIONS}
            onValueChange={(value) => setStatus(value as ProjectUpdateStatus)}
            surface="pill"
            data-testid="project-update-status-select"
          />
        </div>
      }
      notes={notes}
      vimModeEnabled={vimModeEnabled}
      vimKeyMappings={vimKeyMappings}
      onOpenNoteLink={onOpenNoteLink}
      onSubmit={async (markdown) => {
        await onSubmit({ markdown, status })
        if (!update) setStatus('on-track')
      }}
      onCancelEdit={onCancelEdit}
      ariaLabel="Project update composer"
      testId="project-update-composer"
      submitTestId="project-update-submit"
      cancelTestId="project-update-cancel"
      submitLabel="Post update"
      editingSubmitLabel="Save changes"
    />
  )
}
