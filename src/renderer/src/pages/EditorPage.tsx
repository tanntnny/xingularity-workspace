import {
  ReactElement,
  RefObject,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react'
import { stripNoteExtension } from '../../../shared/noteDocument'
import { NoteListItem, NoteVimKeyMapping } from '../../../shared/types'
import { Editor, type NoteEditorHandle } from '../components/Editor'
import { DocumentWorkspaceFooterStatus } from '../components/ui/document-workspace'
import type { NoteEditorSnapshot } from '../lib/noteEditorSession'
import { InlineEditableText } from '../components/InlineEditableText'
import { TagEditor } from '../components/TagEditor'
import { WorkspaceReadingWidth } from '../components/workspace'
import { cn } from '../lib/utils'
import type { NoteVimMode } from '../lib/noteVimMode'

interface EditorPageProps {
  editorRef?: RefObject<NoteEditorHandle | null>
  initialContent?: string | null
  notePath: string
  tags: string[]
  notes: NoteListItem[]
  onDirty: () => void
  onSnapshotChange?: (snapshot: NoteEditorSnapshot) => void
  onDropFile: (sourcePath: string) => Promise<string | null>
  onPasteImage: (imageBlob: Blob, fileExtension: string) => Promise<string | null>
  onAddTag: (rawTag: string) => Promise<void> | void
  onRemoveTag: (tag: string) => Promise<void> | void
  onFindByTag: (tag: string) => void
  onOpenNoteLink?: (target: string) => void
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

const NOTE_TITLE_SCROLL_THRESHOLD_PX = 4

interface ScrollAwareNoteTitleAreaProps {
  children: ReactNode
  notePath: string
  scrollRef: RefObject<HTMLDivElement | null>
  titleRef: RefObject<HTMLElement | null>
}

function ScrollAwareNoteTitleArea({
  children,
  notePath,
  scrollRef,
  titleRef
}: ScrollAwareNoteTitleAreaProps): ReactElement {
  const [isTitleHidden, setIsTitleHidden] = useState(false)
  const [hasScrolled, setHasScrolled] = useState(false)
  const previousScrollTopRef = useRef(0)
  const scrollDirectionRef = useRef<'up' | 'down' | null>(null)
  const accumulatedScrollDeltaRef = useRef(0)
  const hasTitleFocusRef = useRef(false)

  useLayoutEffect(() => {
    const scrollContainer = scrollRef.current
    const titleArea = titleRef.current
    if (!scrollContainer || !titleArea) {
      return
    }

    const updateScrollPadding = (): void => {
      scrollContainer.style.scrollPaddingTop = isTitleHidden ? '0px' : `${titleArea.offsetHeight}px`
    }

    updateScrollPadding()
    const resizeObserver = new ResizeObserver(updateScrollPadding)
    resizeObserver.observe(titleArea)

    return () => {
      resizeObserver.disconnect()
      scrollContainer.style.removeProperty('scroll-padding-top')
    }
  }, [isTitleHidden, notePath, scrollRef, titleRef])

  useEffect(() => {
    const scrollContainer = scrollRef.current
    if (!scrollContainer) {
      return
    }

    previousScrollTopRef.current = scrollContainer.scrollTop
    scrollDirectionRef.current = null
    accumulatedScrollDeltaRef.current = 0

    const handleScroll = (): void => {
      const nextScrollTop = scrollContainer.scrollTop
      const scrollDelta = nextScrollTop - previousScrollTopRef.current
      previousScrollTopRef.current = nextScrollTop
      setHasScrolled(nextScrollTop > 0)

      if (nextScrollTop <= 0) {
        scrollDirectionRef.current = null
        accumulatedScrollDeltaRef.current = 0
        setIsTitleHidden(false)
        return
      }

      if (hasTitleFocusRef.current) {
        scrollDirectionRef.current = null
        accumulatedScrollDeltaRef.current = 0
        setIsTitleHidden(false)
        return
      }

      if (scrollDelta === 0) {
        return
      }

      const nextDirection = scrollDelta > 0 ? 'down' : 'up'
      if (scrollDirectionRef.current !== nextDirection) {
        scrollDirectionRef.current = nextDirection
        accumulatedScrollDeltaRef.current = 0
      }

      accumulatedScrollDeltaRef.current += Math.abs(scrollDelta)
      if (accumulatedScrollDeltaRef.current < NOTE_TITLE_SCROLL_THRESHOLD_PX) {
        return
      }

      accumulatedScrollDeltaRef.current = 0
      setIsTitleHidden(nextDirection === 'down')
    }

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true })
    return () => scrollContainer.removeEventListener('scroll', handleScroll)
  }, [notePath, scrollRef])

  return (
    <header
      ref={titleRef}
      data-testid="note-title-area"
      data-scroll-state={isTitleHidden ? 'hidden' : 'visible'}
      data-scroll-position={hasScrolled ? 'scrolled' : 'top'}
      onFocusCapture={() => {
        hasTitleFocusRef.current = true
        setIsTitleHidden(false)
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          hasTitleFocusRef.current = false
        }
      }}
      className={cn(
        'sticky top-0 z-20 bg-workspace transition-[box-shadow,opacity,transform] duration-200 ease-out motion-reduce:transition-none',
        hasScrolled && !isTitleHidden ? 'shadow-sm' : undefined,
        isTitleHidden
          ? 'pointer-events-none -translate-y-full opacity-0'
          : 'translate-y-0 opacity-100'
      )}
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
  notePath,
  tags,
  notes,
  onDirty,
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
  const [vimMode, setVimMode] = useState<NoteVimMode>('insert')
  const noteScrollRef = useRef<HTMLDivElement | null>(null)
  const noteTitleRef = useRef<HTMLElement | null>(null)

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
    <WorkspaceReadingWidth data-testid="note-editor-page-content" className="h-full min-h-0">
      <div className="note-editor-surface flex h-full min-h-0 flex-col overflow-hidden">
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <div className="h-full min-h-0 overflow-hidden">
            <div
              ref={noteScrollRef}
              className="h-full min-h-0 min-w-0 overflow-x-hidden overflow-y-auto pr-1"
            >
              <ScrollAwareNoteTitleArea
                key={notePath}
                notePath={notePath}
                scrollRef={noteScrollRef}
                titleRef={noteTitleRef}
              >
                <div className="flex flex-col gap-3">
                  <div className="flex min-w-0 items-center">
                    <InlineEditableText
                      value={currentName}
                      onCommit={onRename}
                      editToken={titleEditToken}
                      displayAs="h1"
                      displayClassName="m-0 min-w-0 origin-left cursor-text truncate text-3xl font-bold text-foreground transition-[color,font-size,line-height,letter-spacing,transform] duration-200 ease-out hover:text-primary"
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
              </ScrollAwareNoteTitleArea>
              <div data-testid="note-editor-content" className="h-full pb-8 pt-5">
                <Editor
                  ref={editorRef}
                  initialContent={initialContent}
                  density="compact"
                  onDirty={onDirty}
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
  )
}
