import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
import type { CalendarTask, NoteVimKeyMapping } from '../../../shared/types'
import { Editor, type NoteEditorHandle } from '../components/Editor'
import { InlineEditableText } from '../components/InlineEditableText'
import { StatusChip } from '../components/ui/status-chip'
import { DocumentWorkspaceFooterStatus } from '../components/ui/document-workspace'
import { getTaskStatus } from '../lib/taskStatus'
import { getTaskStatusChipItem } from '../lib/statusChipMeta'
import type { NoteEditorSnapshot } from '../lib/noteEditorSession'

const TASK_DESCRIPTION_MAX_LENGTH = 2000
const TASK_DESCRIPTION_AUTOSAVE_DELAY_MS = 600

interface TaskPageProps {
  task: CalendarTask
  onUpdateTask: (taskId: string, patch: Partial<CalendarTask>) => void | Promise<void>
  onRegisterFlush?: (flush: (() => Promise<void>) | null) => void
  vimModeEnabled: boolean
  vimKeyMappings: NoteVimKeyMapping[]
}

export function TaskPage({
  task,
  onUpdateTask,
  onRegisterFlush,
  vimModeEnabled,
  vimKeyMappings
}: TaskPageProps): ReactElement {
  const editorRef = useRef<NoteEditorHandle | null>(null)
  const descriptionRef = useRef(task.description ?? '')
  const pendingDescriptionRef = useRef(task.description ?? '')
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const persistDescriptionRef = useRef<() => Promise<void>>(async () => undefined)
  const flushDescriptionRef = useRef<() => Promise<void>>(async () => undefined)
  const [isDescriptionDirty, setIsDescriptionDirty] = useState(false)
  const [descriptionLength, setDescriptionLength] = useState(
    Math.min((task.description ?? '').length, TASK_DESCRIPTION_MAX_LENGTH)
  )

  const persistDescription = useCallback(async (): Promise<void> => {
    const nextDescription = pendingDescriptionRef.current.slice(0, TASK_DESCRIPTION_MAX_LENGTH)
    if (nextDescription === descriptionRef.current) {
      setIsDescriptionDirty(false)
      return
    }

    await onUpdateTask(task.id, { description: nextDescription || undefined })
    descriptionRef.current = nextDescription
    pendingDescriptionRef.current = nextDescription
    setDescriptionLength(nextDescription.length)
    setIsDescriptionDirty(false)
  }, [onUpdateTask, task.id])

  const flushDescription = useCallback(async (): Promise<void> => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current)
      autosaveTimerRef.current = null
    }

    const snapshot = await editorRef.current?.flushPendingChanges()
    if (snapshot) {
      pendingDescriptionRef.current = snapshot.content
    }
    await persistDescription()
  }, [persistDescription])

  useEffect(() => {
    persistDescriptionRef.current = persistDescription
    flushDescriptionRef.current = flushDescription
  }, [flushDescription, persistDescription])

  useEffect(() => {
    onRegisterFlush?.(() => flushDescriptionRef.current())
    return () => {
      onRegisterFlush?.(null)
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current)
      }
      if (pendingDescriptionRef.current !== descriptionRef.current) {
        void persistDescriptionRef.current()
      }
    }
  }, [onRegisterFlush])

  const handleDescriptionSnapshot = useCallback(
    (snapshot: NoteEditorSnapshot): void => {
      pendingDescriptionRef.current = snapshot.content
      setDescriptionLength(Math.min(snapshot.content.length, TASK_DESCRIPTION_MAX_LENGTH))
      if (snapshot.content === descriptionRef.current) {
        setIsDescriptionDirty(false)
        return
      }

      setIsDescriptionDirty(true)
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current)
      }
      autosaveTimerRef.current = setTimeout(() => {
        autosaveTimerRef.current = null
        void persistDescription()
      }, TASK_DESCRIPTION_AUTOSAVE_DELAY_MS)
    },
    [persistDescription]
  )

  const handleTitleCommit = useCallback(
    async (value: string): Promise<void> => {
      const title = value.trim()
      if (!title || title === task.title) {
        return
      }
      await onUpdateTask(task.id, { title })
    },
    [onUpdateTask, task.id, task.title]
  )

  const status = getTaskStatus(task.status, task.completed)

  return (
    <article
      className="note-editor-surface flex h-full min-h-0 flex-col overflow-hidden"
      data-testid="task-page"
    >
      <header className="shrink-0 px-8 py-5">
        <div className="flex flex-col gap-3">
          <InlineEditableText
            value={task.title}
            onCommit={handleTitleCommit}
            displayAs="h1"
            displayClassName="m-0 min-w-0 origin-left cursor-text truncate text-4xl font-bold text-foreground transition-[color,font-size,line-height,letter-spacing,transform] duration-200 ease-out hover:text-primary"
            inputClassName="m-0 min-w-0 flex-1 origin-left border-0 bg-transparent text-4xl font-bold text-foreground caret-primary transition-[color,font-size,line-height,letter-spacing,transform] duration-200 ease-out outline-none"
            title="Click to rename task"
          />
          <div className="flex flex-wrap items-center gap-2 border-b border-border pb-5">
            <StatusChip item={getTaskStatusChipItem(status)} />
            <span className="text-xs text-muted-foreground">
              {isDescriptionDirty ? 'Saving description…' : 'Description saved'}
            </span>
          </div>
        </div>
      </header>
      <div className="relative min-h-0 flex-1 overflow-hidden px-8 pb-8">
        <div className="h-full min-h-0 overflow-hidden pt-5">
          <div className="h-full min-h-0 min-w-0 overflow-x-hidden overflow-y-auto pr-1">
            <div className="h-full">
              <Editor
                key={task.id}
                ref={editorRef}
                initialContent={task.description ?? ''}
                onDirty={() => undefined}
                onSnapshotChange={handleDescriptionSnapshot}
                onDropFile={async () => null}
                onPasteImage={async () => null}
                notes={[]}
                vimModeEnabled={vimModeEnabled}
                vimKeyMappings={vimKeyMappings}
              />
            </div>
          </div>
        </div>
      </div>
      <DocumentWorkspaceFooterStatus>
        <span data-testid="task-description-count">
          {descriptionLength}/{TASK_DESCRIPTION_MAX_LENGTH} characters
        </span>
      </DocumentWorkspaceFooterStatus>
    </article>
  )
}
