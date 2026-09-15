import { useState, type ReactElement } from 'react'
import type {
  NoteListItem,
  NoteVimKeyMapping,
  Project,
  ProjectUpdateStatus
} from '../../../shared/types'
import { ProjectUpdateComposer } from '../components/ProjectUpdateComposer'
import { ProjectUpdateFeed } from '../components/ProjectUpdateFeed'
import { WorkspaceReadingWidth } from '../components/workspace'

interface ProjectPulsePageProps {
  project: Project
  notes: NoteListItem[]
  vimModeEnabled: boolean
  vimKeyMappings: NoteVimKeyMapping[]
  onOpenNoteLink: (target: string, options?: { openInNewTab?: boolean }) => void
  onCreateUpdate: (input: { markdown: string; status: ProjectUpdateStatus }) => Promise<void>
  onUpdateUpdate: (
    updateId: string,
    input: { markdown: string; status: ProjectUpdateStatus }
  ) => Promise<void>
  onDeleteUpdate: (updateId: string) => Promise<void>
}

export function ProjectPulsePage({
  project,
  notes,
  vimModeEnabled,
  vimKeyMappings,
  onOpenNoteLink,
  onCreateUpdate,
  onUpdateUpdate,
  onDeleteUpdate
}: ProjectPulsePageProps): ReactElement {
  const [editingUpdateId, setEditingUpdateId] = useState<string | null>(null)
  const editingUpdate = project.updates?.find((update) => update.id === editingUpdateId) ?? null

  const handleSubmit = async (input: {
    markdown: string
    status: ProjectUpdateStatus
  }): Promise<void> => {
    if (editingUpdate) {
      await onUpdateUpdate(editingUpdate.id, input)
      setEditingUpdateId(null)
      return
    }

    await onCreateUpdate(input)
  }

  const handleDeleteUpdate = async (updateId: string): Promise<void> => {
    await onDeleteUpdate(updateId)
    if (editingUpdateId === updateId) setEditingUpdateId(null)
  }

  return (
    <div className="min-h-full" data-testid="project-pulse-page">
      <WorkspaceReadingWidth className="mt-3 space-y-3 p-2">
        <ProjectUpdateComposer
          key={`${project.id}-${editingUpdateId ?? 'new'}`}
          update={editingUpdate}
          notes={notes}
          vimModeEnabled={vimModeEnabled}
          vimKeyMappings={vimKeyMappings}
          onOpenNoteLink={onOpenNoteLink}
          onSubmit={handleSubmit}
          onCancelEdit={() => setEditingUpdateId(null)}
        />
        <ProjectUpdateFeed
          updates={project.updates ?? []}
          notes={notes}
          vimModeEnabled={vimModeEnabled}
          vimKeyMappings={vimKeyMappings}
          onOpenNoteLink={onOpenNoteLink}
          onEdit={(update) => setEditingUpdateId(update.id)}
          onDelete={handleDeleteUpdate}
        />
      </WorkspaceReadingWidth>
    </div>
  )
}
