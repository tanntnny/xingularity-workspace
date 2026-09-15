import {
  ReactElement,
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react'
import { stripNoteExtension } from '../../../shared/noteDocument'
import { NoteListItem, NoteVimKeyMapping } from '../../../shared/types'
import { Editor, type NoteEditorHandle, type NoteEditorMode } from '../components/Editor'
import {
  DocumentWorkspaceFooterStatus,
  WorkspaceHeaderSecondaryActions
} from '../components/ui/document-workspace'
import { TabToggleGroup, TabToggleGroupItem } from '../components/ui/tab-toggle-group'
import type { NoteEditorSnapshot } from '../lib/noteEditorSession'
import { InlineEditableText } from '../components/InlineEditableText'
import { TagEditor } from '../components/TagEditor'
import { WorkspaceReadingWidth } from '../components/workspace'
import type { NoteVimMode } from '../lib/noteVimMode'
import type { NotebookOpenOptions } from '../lib/notebookOpen'

interface EditorPageProps {
  editorRef?: RefObject<NoteEditorHandle | null>
  initialContent?: string | null
  initialScrollTop?: number
  notePath: string
  tags: string[]
  notes: NoteListItem[]
  onDirty: () => void
  onScrollTopChange?: (notePath: string, scrollTop: number) => void
  onSnapshotChange?: (snapshot: NoteEditorSnapshot) => void
  onDropFile: (sourcePath: string) => Promise<string | null>
  onPasteImage: (imageBlob: Blob, fileExtension: string) => Promise<string | null>
  onAddTag: (rawTag: string) => Promise<void> | void
  onRemoveTag: (tag: string) => Promise<void> | void
  onFindByTag: (tag: string) => void
  onOpenNoteLink?: (target: string, options?: NotebookOpenOptions) => void
  onRename: (newName: string) => Promise<void>
  titleEditToken?: number
  vimModeEnabled: boolean
  vimKeyMappings: NoteVimKeyMapping[]
}

const VIM_MODE_BADGE_LABELS: Record<NoteVimMode, string> = {
  insert: 'insert',
  normal: 'normal',
  visual: 'visual',
  visualLine: 'visual'
}

interface NoteTitleAreaProps {
  children: ReactNode
}

function NoteTitleArea({ children }: NoteTitleAreaProps): ReactElement {
  return (
    <header
      data-testid="note-title-area"
      data-scroll-state="visible"
      data-scroll-position="flow"
      className="shrink-0 bg-workspace"
    >
      <div data-testid="note-title-content" className="py-5">
        {children}
      </div>
    </header>
  )
}

export function EditorPage({
  editorRef,
  initialContent,
  initialScrollTop = 0,
  notePath,
  tags,
  notes,
  onDirty,
  onScrollTopChange,
  onSnapshotChange,
  onDropFile,
  onPasteImage,
  onAddTag,
  onRemoveTag,
  onFindByTag,
  onOpenNoteLink,
  onRename,
  titleEditToken = 0,
  vimModeEnabled,
  vimKeyMappings
}: EditorPageProps): ReactElement {
  const [editorMode, setEditorMode] = useState<NoteEditorMode>('preview')
  const [vimMode, setVimMode] = useState<NoteVimMode>('insert')
  const noteScrollRef = useRef<HTMLDivElement | null>(null)
  const restoreScrollFrameRef = useRef<number | null>(null)

  const restoreScrollPosition = useCallback((): void => {
    const scrollContainer = noteScrollRef.current
    if (!scrollContainer) {
      return
    }

    const maxScrollTop = Math.max(0, scrollContainer.scrollHeight - scrollContainer.clientHeight)
    scrollContainer.scrollTop = Math.min(Math.max(0, initialScrollTop), maxScrollTop)
  }, [initialScrollTop])

  const scheduleScrollRestore = useCallback((): void => {
    if (restoreScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(restoreScrollFrameRef.current)
    }

    restoreScrollFrameRef.current = window.requestAnimationFrame(() => {
      restoreScrollFrameRef.current = null
      restoreScrollPosition()
    })
  }, [restoreScrollPosition])

  useEffect(() => {
    scheduleScrollRestore()

    return () => {
      if (restoreScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(restoreScrollFrameRef.current)
        restoreScrollFrameRef.current = null
      }
    }
  }, [notePath, scheduleScrollRestore])

  const currentName = stripNoteExtension(notePath).split('/').pop() || ''
  const availableTags = useMemo(
    () =>
      Array.from(new Set(notes.flatMap((note) => note.tags))).sort((left, right) =>
        left.localeCompare(right)
      ),
    [notes]
  )

  const handleTagChange = (nextTags: string[]): void => {
    const addedTags = nextTags.filter((tag) => !tags.includes(tag))
    const removedTags = tags.filter((tag) => !nextTags.includes(tag))
    addedTags.forEach((tag) => void onAddTag(tag))
    removedTags.forEach((tag) => void onRemoveTag(tag))
  }

  return (
    <>
      <WorkspaceHeaderSecondaryActions>
        <div className="flex min-w-max items-center gap-2">
          <TabToggleGroup
            value={editorMode}
            onValueChange={(value) => {
              if (value === 'preview' || value === 'raw') {
                setEditorMode(value)
              }
            }}
            aria-label="Note editor mode"
            data-testid="note-editor-mode-tabs"
            className="max-w-none"
          >
            <TabToggleGroupItem
              value="preview"
              id="note-editor-mode-tab-preview"
              aria-controls="note-editor-mode-panel"
              data-testid="note-editor-mode-tab:preview"
            >
              Preview
            </TabToggleGroupItem>
            <TabToggleGroupItem
              value="raw"
              id="note-editor-mode-tab-raw"
              aria-controls="note-editor-mode-panel"
              data-testid="note-editor-mode-tab:raw"
            >
              Raw
            </TabToggleGroupItem>
          </TabToggleGroup>
        </div>
      </WorkspaceHeaderSecondaryActions>
      <WorkspaceReadingWidth data-testid="note-editor-page-content" className="h-full min-h-0">
        <div
          id="note-editor-mode-panel"
          role="tabpanel"
          aria-labelledby={`note-editor-mode-tab-${editorMode}`}
          className="note-editor-surface flex h-full min-h-0 flex-col overflow-hidden"
        >
          <div className="relative min-h-0 flex-1 overflow-hidden">
            <div className="h-full min-h-0 overflow-hidden">
              <div
                ref={noteScrollRef}
                data-testid="note-editor-scroll"
                onScroll={(event) => onScrollTopChange?.(notePath, event.currentTarget.scrollTop)}
                className="h-full min-h-0 min-w-0 overflow-x-hidden overflow-y-auto pr-1"
              >
                <NoteTitleArea>
                  <div className="flex flex-col gap-3">
                    <div className="flex min-w-0 items-center">
                      <InlineEditableText
                        value={currentName}
                        onCommit={onRename}
                        editToken={titleEditToken}
                        displayAs="h1"
                        displayClassName="m-0 min-w-0 origin-left cursor-text text-3xl font-bold text-foreground transition-[color,font-size,line-height,letter-spacing,transform] duration-200 ease-out hover:text-primary"
                        inputClassName="m-0 h-auto min-w-0 flex-1 origin-left text-3xl font-bold text-foreground caret-primary transition-[color,font-size,line-height,letter-spacing,transform] duration-200 ease-out focus-visible:bg-transparent focus-visible:border-transparent focus-visible:ring-0"
                        inputVariant="ghost"
                        title="Click to rename"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2 border-b border-border pb-5">
                      <TagEditor
                        value={tags}
                        availableTags={availableTags}
                        onChange={handleTagChange}
                        onFind={onFindByTag}
                        label="Note tags"
                        testId="note-tags-editor"
                        className="min-w-0"
                      />
                    </div>
                  </div>
                </NoteTitleArea>
                <div data-testid="note-editor-content" className="h-full pb-8 pt-5">
                  <Editor
                    ref={editorRef}
                    className="note-page-editor"
                    initialContent={initialContent}
                    density="compact"
                    mode={editorMode}
                    onDirty={onDirty}
                    onReady={scheduleScrollRestore}
                    onSnapshotChange={onSnapshotChange}
                    onDropFile={onDropFile}
                    onPasteImage={onPasteImage}
                    notes={notes}
                    currentNotePath={notePath}
                    onOpenNoteLink={onOpenNoteLink}
                    vimModeEnabled={vimModeEnabled}
                    vimKeyMappings={vimKeyMappings}
                    onVimModeChange={setVimMode}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        {vimModeEnabled ? (
          <DocumentWorkspaceFooterStatus>
            <span data-testid="note-vim-mode-badge">{VIM_MODE_BADGE_LABELS[vimMode]}</span>
          </DocumentWorkspaceFooterStatus>
        ) : null}
      </WorkspaceReadingWidth>
    </>
  )
}
