import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactElement
} from 'react'
import type { NoteVimKeyMapping } from '../../../shared/types'
import { Editor, type NoteEditorHandle } from './Editor'
import type { NoteEditorSnapshot } from '../lib/noteEditorSession'

const PROJECT_DESCRIPTION_MAX_LENGTH = 2000
const PROJECT_DESCRIPTION_AUTOSAVE_DELAY_MS = 1200
const NOOP_EDITOR_DIRTY = (): void => undefined
const NOOP_DROP_FILE = async (): Promise<string | null> => null
const NOOP_PASTE_IMAGE = async (): Promise<string | null> => null

interface ProjectDescriptionEditorProps {
  initialContent: string
  onSave: (markdown: string) => void
  testId: string
  vimModeEnabled: boolean
  vimKeyMappings: NoteVimKeyMapping[]
}

export interface ProjectDescriptionEditorHandle {
  getDraft: () => string
}

interface ProjectDescriptionEditorCanvasProps {
  initialContent: string
  onSnapshotChange: (snapshot: NoteEditorSnapshot) => void
  vimModeEnabled: boolean
  vimKeyMappings: NoteVimKeyMapping[]
}

const ProjectDescriptionEditorCanvas = memo(
  forwardRef<NoteEditorHandle, ProjectDescriptionEditorCanvasProps>(
    function ProjectDescriptionEditorCanvas(
      { initialContent, onSnapshotChange, vimModeEnabled, vimKeyMappings },
      ref
    ) {
      return (
        <Editor
          ref={ref}
          initialContent={initialContent}
          density="compact"
          onDirty={NOOP_EDITOR_DIRTY}
          onSnapshotChange={onSnapshotChange}
          onDropFile={NOOP_DROP_FILE}
          onPasteImage={NOOP_PASTE_IMAGE}
          notes={[]}
          vimModeEnabled={vimModeEnabled}
          vimKeyMappings={vimKeyMappings}
        />
      )
    }
  )
)

export const ProjectDescriptionEditor = forwardRef<
  ProjectDescriptionEditorHandle,
  ProjectDescriptionEditorProps
>(function ProjectDescriptionEditor(
  { initialContent, onSave, testId, vimModeEnabled, vimKeyMappings },
  ref
): ReactElement {
  const editorRef = useRef<NoteEditorHandle | null>(null)
  const [editorInitialContent] = useState(() => initialContent)
  const descriptionRef = useRef(initialContent)
  const pendingDescriptionRef = useRef(initialContent)
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onSaveRef = useRef(onSave)
  const persistDescriptionRef = useRef<() => void>(() => undefined)
  const flushDescriptionRef = useRef<() => Promise<void>>(async () => undefined)

  useEffect(() => {
    onSaveRef.current = onSave
  }, [onSave])

  useImperativeHandle(
    ref,
    () => ({
      getDraft: () => pendingDescriptionRef.current
    }),
    []
  )

  const persistDescription = useCallback((): void => {
    const pendingDescription = pendingDescriptionRef.current.slice(
      0,
      PROJECT_DESCRIPTION_MAX_LENGTH
    )
    // Normalize only the persisted value. Reloading Milkdown here would replace
    // the live document and reset the user's selection and undo history.
    const nextDescription = pendingDescription.trim()

    if (nextDescription === descriptionRef.current) {
      pendingDescriptionRef.current = nextDescription
      return
    }

    onSaveRef.current(nextDescription)
    descriptionRef.current = nextDescription
    pendingDescriptionRef.current = nextDescription
  }, [])

  const flushDescription = useCallback(async (): Promise<void> => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current)
      autosaveTimerRef.current = null
    }

    const snapshot = await editorRef.current?.flushPendingChanges()
    if (snapshot) {
      pendingDescriptionRef.current = snapshot.content.slice(0, PROJECT_DESCRIPTION_MAX_LENGTH)
    }

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current)
      autosaveTimerRef.current = null
    }
    persistDescriptionRef.current()
  }, [])

  useEffect(() => {
    persistDescriptionRef.current = persistDescription
    flushDescriptionRef.current = flushDescription
  }, [flushDescription, persistDescription])

  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current)
      }
      void flushDescriptionRef.current()
    }
  }, [])

  const handleDescriptionSnapshot = useCallback((snapshot: NoteEditorSnapshot): void => {
    const nextDescription = snapshot.content.slice(0, PROJECT_DESCRIPTION_MAX_LENGTH)
    pendingDescriptionRef.current = nextDescription

    if (nextDescription === descriptionRef.current) {
      return
    }

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current)
    }
    autosaveTimerRef.current = setTimeout(() => {
      autosaveTimerRef.current = null
      persistDescriptionRef.current()
    }, PROJECT_DESCRIPTION_AUTOSAVE_DELAY_MS)
  }, [])

  return (
    <div
      data-testid={testId}
      role="group"
      aria-label="Project description"
      className="note-editor-surface min-w-0"
    >
      <ProjectDescriptionEditorCanvas
        ref={editorRef}
        initialContent={editorInitialContent}
        onSnapshotChange={handleDescriptionSnapshot}
        vimModeEnabled={vimModeEnabled}
        vimKeyMappings={vimKeyMappings}
      />
    </div>
  )
})
