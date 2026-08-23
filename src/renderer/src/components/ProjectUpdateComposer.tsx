import { useEffect, useRef, useState, type ReactElement } from 'react'
import type {
  NoteListItem,
  NoteVimKeyMapping,
  ProjectUpdate,
  ProjectUpdateStatus
} from '../../../shared/types'
import { Editor, type NoteEditorHandle } from './Editor'
import { Button } from './ui/button'
import { StatusChipSelect } from './ui/status-chip-select'
import { PROJECT_UPDATE_CHIP_OPTIONS } from '../lib/statusChipMeta'
import type { NoteEditorSnapshot } from '../lib/noteEditorSession'

interface ProjectUpdateComposerProps {
  update?: ProjectUpdate | null
  notes: NoteListItem[]
  vimModeEnabled: boolean
  vimKeyMappings: NoteVimKeyMapping[]
  onOpenNoteLink: (target: string) => void
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
  const editorRef = useRef<NoteEditorHandle | null>(null)
  const [status, setStatus] = useState<ProjectUpdateStatus>(update?.status ?? 'on-track')
  const [markdown, setMarkdown] = useState(update?.markdown ?? '')
  const [isSaving, setIsSaving] = useState(false)
  const [editorVersion, setEditorVersion] = useState(0)

  useEffect(() => {
    setStatus(update?.status ?? 'on-track')
    setMarkdown(update?.markdown ?? '')
  }, [update?.id, update?.markdown, update?.status])

  const handleSnapshotChange = (snapshot: NoteEditorSnapshot): void => {
    setMarkdown(snapshot.content)
  }

  const handleSubmit = async (): Promise<void> => {
    if (isSaving) return

    const snapshot = await editorRef.current?.captureSnapshot()
    const nextMarkdown = snapshot?.content ?? markdown
    if (!nextMarkdown.trim()) return

    setIsSaving(true)
    try {
      await onSubmit({ markdown: nextMarkdown, status })
      if (!update) {
        setMarkdown('')
        setStatus('on-track')
        setEditorVersion((current) => current + 1)
      }
    } finally {
      setIsSaving(false)
    }
  }

  const isEditing = Boolean(update)

  return (
    <section
      className="rounded-lg border border-panel-border bg-panel p-4"
      aria-label="Project update composer"
      data-testid="project-update-composer"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
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
      </div>
      <div className="note-editor-surface mt-3 min-h-64 rounded-md px-3 py-2">
        <Editor
          key={`${update?.id ?? 'new'}-${editorVersion}`}
          ref={editorRef}
          initialContent={update?.markdown ?? ''}
          density="compact"
          onDirty={() => undefined}
          onSnapshotChange={handleSnapshotChange}
          onDropFile={async () => null}
          onPasteImage={async () => null}
          notes={notes}
          onOpenNoteLink={onOpenNoteLink}
          vimModeEnabled={vimModeEnabled}
          vimKeyMappings={vimKeyMappings}
        />
      </div>
      <div className="mt-3 flex justify-end gap-2">
        {isEditing ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancelEdit}
            disabled={isSaving}
            data-testid="project-update-cancel"
          >
            Cancel
          </Button>
        ) : null}
        <Button
          type="button"
          variant="accent"
          size="sm"
          shape="pill"
          className="h-7"
          onClick={() => void handleSubmit()}
          disabled={isSaving || !markdown.trim()}
          data-testid="project-update-submit"
        >
          {isEditing ? 'Save changes' : 'Post update'}
        </Button>
      </div>
    </section>
  )
}
