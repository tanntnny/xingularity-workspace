import { ReactElement, RefObject, useEffect, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { stripNoteExtension } from '../../../shared/noteDocument'
import { NoteListItem, NoteVimKeyMapping } from '../../../shared/types'
import vimLogo from '../assets/vim-logo.svg'
import { Editor, type NoteEditorHandle } from '../components/Editor'
import type { NoteEditorSnapshot } from '../lib/noteEditorSession'
import { InlineEditableText } from '../components/InlineEditableText'
import { TagChip } from '../components/TagChip'
import type { NoteVimMode } from '../lib/noteVimMode'
import type { NoteOutlineItem } from '../lib/noteOutline'
import { cn } from '../lib/utils'

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
  onOutlineChange?: (items: NoteOutlineItem[]) => void
  onJumpToHeadingChange?: (jumpToHeading: ((blockId: string) => void) | null) => void
  vimModeEnabled: boolean
  vimKeyMappings: NoteVimKeyMapping[]
}

const VIM_MODE_BADGE_CLASSES: Record<NoteVimMode, string> = {
  insert:
    'border-orange-500/35 bg-[color:color-mix(in_srgb,var(--panel)_58%,rgb(249_115_22/0.32))] text-orange-950 shadow-[0_10px_28px_rgba(249,115,22,0.18)] dark:text-orange-100',
  normal:
    'border-sky-500/35 bg-[color:color-mix(in_srgb,var(--panel)_58%,rgb(14_165_233/0.3))] text-sky-950 shadow-[0_10px_28px_rgba(14,165,233,0.18)] dark:text-sky-100',
  visual:
    'border-emerald-500/30 bg-[color:color-mix(in_srgb,var(--panel)_58%,rgb(16_185_129/0.28))] text-emerald-950 shadow-[0_10px_28px_rgba(16,185,129,0.18)] dark:text-emerald-100',
  visualLine:
    'border-teal-500/30 bg-[color:color-mix(in_srgb,var(--panel)_58%,rgb(20_184_166/0.28))] text-teal-950 shadow-[0_10px_28px_rgba(20,184,166,0.18)] dark:text-teal-100'
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
  onOutlineChange,
  onJumpToHeadingChange,
  vimModeEnabled,
  vimKeyMappings
}: EditorPageProps): ReactElement {
  const [isAddingTag, setIsAddingTag] = useState(false)
  const [newTagValue, setNewTagValue] = useState('')
  const [vimMode, setVimMode] = useState<NoteVimMode>('insert')
  const tagInputRef = useRef<HTMLInputElement | null>(null)
  const isSubmittingTagRef = useRef(false)

  const currentName = stripNoteExtension(notePath).split('/').pop() || ''

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
      <div className="relative flex-1 min-h-0 overflow-auto px-8 pb-8">
        <div className="h-full pt-5">
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
            onOutlineChange={onOutlineChange}
            onJumpToHeadingChange={onJumpToHeadingChange}
            vimModeEnabled={vimModeEnabled}
            vimKeyMappings={vimKeyMappings}
            onVimModeChange={setVimMode}
          />
        </div>
      </div>
      <div className="flex shrink-0 items-center justify-end px-8 py-3">
        {vimModeEnabled ? (
          <div className="pointer-events-none flex justify-end">
            <div
              className={cn(
                'inline-flex min-w-[5.5rem] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border px-3 py-2.5 text-xs font-semibold leading-none backdrop-blur-md backdrop-saturate-150',
                'ring-1 ring-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]',
                VIM_MODE_BADGE_CLASSES[vimMode]
              )}
              data-testid="note-vim-mode-badge"
            >
              <img
                src={vimLogo}
                alt=""
                aria-hidden="true"
                data-testid="note-vim-mode-badge-icon"
                className="h-3.5 w-3.5 shrink-0"
              />
              <span>{VIM_MODE_BADGE_LABELS[vimMode]}</span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
