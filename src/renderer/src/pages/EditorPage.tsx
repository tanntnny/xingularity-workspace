import { createPortal } from 'react-dom'
import {
  ReactElement,
  RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState
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

interface OutlinePanelBounds {
  top: number
  left: number
  width: number
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
  const isSubmittingTagRef = useRef(false)
  const [outlinePanelBounds, setOutlinePanelBounds] = useState<OutlinePanelBounds | null>(null)

  const currentName = stripNoteExtension(notePath).split('/').pop() || ''
  const outlineItems = outlineState.notePath === notePath ? outlineState.items : []

  useLayoutEffect(() => {
    if (outlineItems.length === 0 || !noteBodyRef.current) {
      return
    }

    const updateOutlinePanelBounds = (): void => {
      const rect = noteBodyRef.current?.getBoundingClientRect()
      if (!rect) return

      const nextBounds: OutlinePanelBounds = {
        top: rect.top + 20,
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
  }, [notePath, outlineItems.length])

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
      <div className="shrink-0 px-8 py-5">
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
      </div>
      <div ref={noteBodyRef} className="relative min-h-0 flex-1 overflow-hidden px-8 pb-8">
        <div className="h-full min-h-0 overflow-hidden pt-5">
          <div className="h-full min-h-0 min-w-0 overflow-x-hidden overflow-y-auto pr-1">
            <div className="h-full">
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
