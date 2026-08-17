import { createPortal } from 'react-dom'
import {
  ReactElement,
  RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode
} from 'react'
import { Plus } from '../components/ui/icons'
import { stripNoteExtension } from '../../../shared/noteDocument'
import { NoteListItem, NoteVimKeyMapping } from '../../../shared/types'
import { Editor, type NoteEditorHandle } from '../components/Editor'
import { DocumentWorkspaceFooterStatus } from '../components/ui/document-workspace'
import type { NoteEditorSnapshot } from '../lib/noteEditorSession'
import { InlineEditableText } from '../components/InlineEditableText'
import { NoteOutlineRail } from '../components/NoteOutlineRail'
import { TagChip } from '../components/TagChip'
import { cn } from '../lib/utils'
import type { NoteVimMode } from '../lib/noteVimMode'
import type { NoteOutlineItem } from '../lib/noteOutline'

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

interface OutlinePanelBounds {
  top: number
  left: number
  width: number
}

interface ScrollAwareNoteTitleAreaProps {
  children: ReactNode
  notePath: string
  scrollRef: RefObject<HTMLDivElement | null>
  titleRef: RefObject<HTMLElement | null>
  onHiddenChange: (isHidden: boolean) => void
}

function ScrollAwareNoteTitleArea({
  children,
  notePath,
  scrollRef,
  titleRef,
  onHiddenChange
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
    onHiddenChange(isTitleHidden)
  }, [isTitleHidden, onHiddenChange])

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
        'sticky top-0 z-20 bg-workspace px-8 py-5 transition-[box-shadow,opacity,transform] duration-200 ease-out motion-reduce:transition-none',
        hasScrolled && !isTitleHidden ? 'shadow-sm' : undefined,
        isTitleHidden
          ? 'pointer-events-none -translate-y-full opacity-0'
          : 'translate-y-0 opacity-100'
      )}
    >
      {children}
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
  const [isAddingTag, setIsAddingTag] = useState(false)
  const [newTagValue, setNewTagValue] = useState('')
  const [vimMode, setVimMode] = useState<NoteVimMode>('insert')
  const [outlineState, setOutlineState] = useState<{
    notePath: string
    items: NoteOutlineItem[]
  }>({
    notePath,
    items: []
  })
  const tagInputRef = useRef<HTMLInputElement | null>(null)
  const noteBodyRef = useRef<HTMLDivElement | null>(null)
  const noteScrollRef = useRef<HTMLDivElement | null>(null)
  const noteTitleRef = useRef<HTMLElement | null>(null)
  const isSubmittingTagRef = useRef(false)
  const [titleVisibility, setTitleVisibility] = useState({ notePath, isHidden: false })
  const [outlinePanelBounds, setOutlinePanelBounds] = useState<OutlinePanelBounds | null>(null)

  const currentName = stripNoteExtension(notePath).split('/').pop() || ''
  const outlineItems = outlineState.notePath === notePath ? outlineState.items : []
  const isTitleHidden = titleVisibility.notePath === notePath && titleVisibility.isHidden
  const handleTitleHiddenChange = useCallback(
    (isHidden: boolean): void => {
      setTitleVisibility((current) => {
        if (current.notePath === notePath && current.isHidden === isHidden) {
          return current
        }

        return { notePath, isHidden }
      })
    },
    [notePath]
  )

  useLayoutEffect(() => {
    if (outlineItems.length === 0 || !noteBodyRef.current) {
      return
    }

    const updateOutlinePanelBounds = (): void => {
      const rect = noteBodyRef.current?.getBoundingClientRect()
      if (!rect) return

      const nextBounds: OutlinePanelBounds = {
        top: rect.top + (isTitleHidden ? 0 : (noteTitleRef.current?.offsetHeight ?? 0)) + 20,
        left: Math.max(rect.left, rect.right - 56),
        width: 48
      }

      setOutlinePanelBounds((current) => {
        if (
          current &&
          current.top === nextBounds.top &&
          current.left === nextBounds.left &&
          current.width === nextBounds.width
        ) {
          return current
        }

        return nextBounds
      })
    }

    updateOutlinePanelBounds()
    const resizeObserver = new ResizeObserver(updateOutlinePanelBounds)
    resizeObserver.observe(noteBodyRef.current)
    window.addEventListener('resize', updateOutlinePanelBounds)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', updateOutlinePanelBounds)
    }
  }, [isTitleHidden, notePath, outlineItems.length])

  useEffect(() => {
    if (!isAddingTag) {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      editorRef?.current?.blur()
      tagInputRef.current?.focus()
      isSubmittingTagRef.current = false
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [editorRef, isAddingTag, tags.length])

  const handleJumpToOutlineIndex = useCallback(
    (index: number): void => {
      editorRef?.current?.jumpToOutlineIndex(index)
    },
    [editorRef]
  )

  const handleAddTag = (): void => {
    const nextTag = newTagValue.trim()
    if (!nextTag) return

    isSubmittingTagRef.current = true
    void onAddTag(nextTag)
    setNewTagValue('')
    setIsAddingTag(true)
  }

  return (
    <div className="note-editor-surface flex h-full min-h-0 flex-col overflow-hidden">
      <div ref={noteBodyRef} className="relative min-h-0 flex-1 overflow-hidden">
        <div className="h-full min-h-0 overflow-hidden">
          <div
            ref={noteScrollRef}
            className="h-full min-h-0 min-w-0 overflow-x-hidden overflow-y-auto pr-1"
          >
            <ScrollAwareNoteTitleArea
              key={notePath}
              notePath={notePath}
              onHiddenChange={handleTitleHiddenChange}
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
                    displayClassName="m-0 min-w-0 origin-left cursor-text truncate text-4xl font-bold text-foreground transition-[color,font-size,line-height,letter-spacing,transform] duration-200 ease-out hover:text-primary"
                    inputClassName="m-0 min-w-0 flex-1 origin-left border-0 bg-transparent text-4xl font-bold text-foreground caret-primary transition-[color,font-size,line-height,letter-spacing,transform] duration-200 ease-out outline-none"
                    title="Click to rename"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2 border-b border-border pb-5">
                  {tags.map((tag) => (
                    <TagChip
                      key={tag}
                      tag={tag}
                      onClick={onFindByTag}
                      onRemove={(nextTag) => {
                        void onRemoveTag(nextTag)
                      }}
                    />
                  ))}
                  {isAddingTag ? (
                    <div key="note-tag-input" className="inline-flex items-center gap-1.5">
                      <input
                        ref={tagInputRef}
                        type="text"
                        value={newTagValue}
                        onFocus={() => {
                          editorRef?.current?.blur()
                        }}
                        onChange={(e) => setNewTagValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            e.stopPropagation()
                            handleAddTag()
                          } else if (e.key === 'Escape') {
                            setIsAddingTag(false)
                            setNewTagValue('')
                          }
                        }}
                        onBlur={() => {
                          if (isSubmittingTagRef.current) {
                            return
                          }

                          setIsAddingTag(false)
                          setNewTagValue('')
                        }}
                        placeholder="tag name"
                        autoFocus
                        className="w-32 rounded-md border border-primary bg-card px-2.5 py-1 text-sm text-foreground caret-primary"
                      />
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        editorRef?.current?.blur()
                        setIsAddingTag(true)
                      }}
                      className="border border-input bg-card text-foreground inline-flex items-center justify-center rounded-md border border-dashed border-border p-1 transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      title="Add tag"
                    >
                      <Plus size={16} />
                    </button>
                  )}
                </div>
              </div>
            </ScrollAwareNoteTitleArea>
            <div className="h-full px-8 pb-8 pt-5">
              <Editor
                ref={editorRef}
                initialContent={initialContent}
                onDirty={onDirty}
                onSnapshotChange={onSnapshotChange}
                onDropFile={onDropFile}
                onPasteImage={onPasteImage}
                notes={notes}
                currentNotePath={notePath}
                onOpenNoteLink={onOpenNoteLink}
                onOutlineChange={(items, outlineNotePath) => {
                  setOutlineState({
                    notePath: outlineNotePath ?? notePath,
                    items
                  })
                }}
                vimModeEnabled={vimModeEnabled}
                vimKeyMappings={vimKeyMappings}
                onVimModeChange={setVimMode}
              />
            </div>
          </div>
        </div>
      </div>
      {outlineItems.length > 0 && outlinePanelBounds
        ? createPortal(
            <div
              className="pointer-events-none fixed z-50"
              style={{
                top: outlinePanelBounds.top,
                left: outlinePanelBounds.left,
                width: outlinePanelBounds.width
              }}
            >
              <div className="pointer-events-auto w-full">
                <NoteOutlineRail items={outlineItems} onJumpToIndex={handleJumpToOutlineIndex} />
              </div>
            </div>,
            document.body
          )
        : null}
      {vimModeEnabled ? (
        <DocumentWorkspaceFooterStatus>
          <span data-testid="note-vim-mode-badge">{VIM_MODE_BADGE_LABELS[vimMode]}</span>
        </DocumentWorkspaceFooterStatus>
      ) : null}
    </div>
  )
}
