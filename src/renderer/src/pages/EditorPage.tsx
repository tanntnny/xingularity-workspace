import { ReactElement, RefObject, useCallback, useEffect, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
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
  const isSubmittingTagRef = useRef(false)

  const currentName = stripNoteExtension(notePath).split('/').pop() || ''
  const outlineItems = outlineState.notePath === notePath ? outlineState.items : []

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
    <div className="workspace-clear-surface flex h-full min-h-0 flex-col">
      <div className="shrink-0 px-8 py-5">
        <div className="flex flex-col gap-3">
          <div className="flex min-w-0 items-center">
            <InlineEditableText
              value={currentName}
              onCommit={onRename}
              editToken={titleEditToken}
              displayAs="h1"
              displayClassName="m-0 min-w-0 origin-left cursor-text truncate text-4xl font-bold text-[var(--text)] transition-[color,font-size,line-height,letter-spacing,transform] duration-200 ease-out hover:text-[var(--accent)]"
              inputClassName="m-0 min-w-0 flex-1 origin-left border-0 bg-transparent text-4xl font-bold text-[var(--text)] caret-[var(--accent)] transition-[color,font-size,line-height,letter-spacing,transform] duration-200 ease-out outline-none"
              title="Click to rename"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] pb-5">
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
                  className="workspace-subtle-control w-32 rounded-md border border-[var(--accent)] px-2.5 py-1 text-sm caret-[var(--accent)]"
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  editorRef?.current?.blur()
                  setIsAddingTag(true)
                }}
                className="workspace-subtle-control inline-flex items-center justify-center rounded-md border border-dashed border-[var(--line)] p-1"
                title="Add tag"
              >
                <Plus size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="relative flex-1 min-h-0 px-8 pb-8">
        <div className="flex h-full min-h-0 gap-4 pt-5 xl:gap-6">
          <div className="min-w-0 flex-1 overflow-auto pr-1">
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
                onOutlineChange={(items) => {
                  setOutlineState({
                    notePath,
                    items
                  })
                }}
                vimModeEnabled={vimModeEnabled}
                vimKeyMappings={vimKeyMappings}
                onVimModeChange={setVimMode}
              />
            </div>
          </div>
          <NoteOutlineRail items={outlineItems} onJumpToIndex={handleJumpToOutlineIndex} />
        </div>
      </div>
      {vimModeEnabled ? (
        <DocumentWorkspaceFooterStatus>
          <span data-testid="note-vim-mode-badge">{VIM_MODE_BADGE_LABELS[vimMode]}</span>
        </DocumentWorkspaceFooterStatus>
      ) : null}
    </div>
  )
}
