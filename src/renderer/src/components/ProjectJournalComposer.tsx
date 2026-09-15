import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react'
import type { NoteListItem, NoteVimKeyMapping } from '../../../shared/types'
import { Editor, type NoteEditorHandle } from './Editor'
import { Button } from './ui/button'
import type { NoteEditorSnapshot } from '../lib/noteEditorSession'
import { COMMAND_ENTER_ARIA_KEYSHORTCUT, handleCommandEnterAction } from '../lib/formShortcuts'

export interface ProjectJournalEntry {
  id: string
  markdown: string
}

interface ProjectJournalComposerProps {
  entry?: ProjectJournalEntry | null
  metadata: ReactNode
  notes: NoteListItem[]
  vimModeEnabled: boolean
  vimKeyMappings: NoteVimKeyMapping[]
  onOpenNoteLink: (target: string, options?: { openInNewTab?: boolean }) => void
  onSubmit: (markdown: string) => Promise<void>
  onCancelEdit: () => void
  ariaLabel: string
  testId: string
  submitTestId?: string
  cancelTestId?: string
  submitLabel: string
  editingSubmitLabel: string
}

export function ProjectJournalComposer({
  entry,
  metadata,
  notes,
  vimModeEnabled,
  vimKeyMappings,
  onOpenNoteLink,
  onSubmit,
  onCancelEdit,
  ariaLabel,
  testId,
  submitTestId = `${testId}-submit`,
  cancelTestId = `${testId}-cancel`,
  submitLabel,
  editingSubmitLabel
}: ProjectJournalComposerProps): ReactElement {
  const editorRef = useRef<NoteEditorHandle | null>(null)
  const [markdown, setMarkdown] = useState(entry?.markdown ?? '')
  const [isSaving, setIsSaving] = useState(false)
  const [editorVersion, setEditorVersion] = useState(0)

  useEffect(() => {
    setMarkdown(entry?.markdown ?? '')
  }, [entry?.id, entry?.markdown])

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
      await onSubmit(nextMarkdown)
      if (!entry) {
        setMarkdown('')
        setEditorVersion((current) => current + 1)
      }
    } finally {
      setIsSaving(false)
    }
  }

  const isEditing = Boolean(entry)

  return (
    <section
      className="rounded-lg border border-panel-border bg-panel p-4"
      aria-label={ariaLabel}
      data-testid={testId}
      onKeyDownCapture={(event) => handleCommandEnterAction(event, handleSubmit)}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">{metadata}</div>
      <div className="note-editor-surface mt-3 min-h-64 rounded-md px-3 py-2">
        <Editor
          key={`${entry?.id ?? 'new'}-${editorVersion}`}
          ref={editorRef}
          initialContent={entry?.markdown ?? ''}
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
            data-testid={cancelTestId}
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
          aria-keyshortcuts={COMMAND_ENTER_ARIA_KEYSHORTCUT}
          disabled={isSaving || !markdown.trim()}
          data-testid={submitTestId}
        >
          {isEditing ? editingSubmitLabel : submitLabel}
        </Button>
      </div>
    </section>
  )
}
