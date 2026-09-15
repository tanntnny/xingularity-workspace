import type { ReactElement } from 'react'
import type { NoteListItem, NoteVimKeyMapping, Project } from '../../../shared/types'
import { Editor } from './Editor'
import { Button } from './ui/button'
import { Plus } from './ui/icons'
import { StatusChip } from './ui/status-chip'
import { PROJECT_UPDATE_CHIP_ITEMS } from '../lib/statusChipMeta'
import { getLatestProjectUpdate } from '../lib/projectUpdates'

interface ProjectLatestUpdateProps {
  project: Project
  notes: NoteListItem[]
  vimModeEnabled: boolean
  vimKeyMappings: NoteVimKeyMapping[]
  onOpenNoteLink: (target: string, options?: { openInNewTab?: boolean }) => void
  onOpenUpdates: () => void
}

export function ProjectLatestUpdate({
  project,
  notes,
  vimModeEnabled,
  vimKeyMappings,
  onOpenNoteLink,
  onOpenUpdates
}: ProjectLatestUpdateProps): ReactElement {
  const latestUpdate = getLatestProjectUpdate(project.updates)

  return (
    <section
      aria-labelledby="project-latest-update-heading"
      className="overflow-hidden rounded-xl bg-transparent border p-2"
      data-testid="project-latest-update"
    >
      {latestUpdate ? (
        <>
          <header className="flex flex-wrap items-center gap-2 px-3 py-2">
            <h2
              id="project-latest-update-heading"
              className="text-sm font-semibold text-foreground"
            >
              Latest update
            </h2>
            <StatusChip
              item={PROJECT_UPDATE_CHIP_ITEMS[latestUpdate.status]}
              className="text-xs bg-surface-subtle"
              data-testid={`project-latest-update-status:${latestUpdate.id}`}
            />
          </header>
          <div
            className="note-editor-surface px-3 py-2"
            data-testid={`project-latest-update-content:${latestUpdate.id}`}
          >
            <Editor
              key={`${latestUpdate.id}-${latestUpdate.updatedAt}`}
              initialContent={latestUpdate.markdown}
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
        </>
      ) : (
        <div
          className="flex min-h-20 items-center justify-center"
          data-testid="project-latest-update-empty"
        >
          <h2 id="project-latest-update-heading" className="sr-only">
            Latest update
          </h2>
          <Button
            type="button"
            variant="muted"
            shape="pill"
            aria-label="Add project update"
            title="Add project update"
            data-testid="project-latest-update-add"
            onClick={onOpenUpdates}
          >
            <Plus size={16} aria-hidden="true" />
            <p className="">Add new update</p>
          </Button>
        </div>
      )}
    </section>
  )
}
