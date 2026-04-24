import { ReactElement, RefObject, useState } from 'react'
import { Plus } from 'lucide-react'
import { stripNoteExtension } from '../../../shared/noteDocument'
import { NoteListItem } from '../../../shared/types'
import { Editor, type NoteEditorHandle } from '../components/Editor'
import type { NoteEditorSnapshot } from '../lib/noteEditorSession'
import { InlineEditableText } from '../components/InlineEditableText'
import { TagChip } from '../components/TagChip'
import type { NoteOutlineItem } from '../lib/noteOutline'

interface EditorPageProps {
  editorRef?: RefObject<NoteEditorHandle | null>
  editorSessionKey: number
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
}

export function EditorPage({
  editorRef,
  editorSessionKey,
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
  onJumpToHeadingChange
}: EditorPageProps): ReactElement {
  const [isAddingTag, setIsAddingTag] = useState(false)
  const [newTagValue, setNewTagValue] = useState('')

  const currentName = stripNoteExtension(notePath).split('/').pop() || ''

  const handleAddTag = (): void => {
    const nextTag = newTagValue.trim()
    if (!nextTag) return

    void onAddTag(nextTag)
    setNewTagValue('')
    setIsAddingTag(true)
  }

  return (
    <div className="workspace-clear-surface h-full overflow-auto">
      <div className="flex flex-col gap-3 px-8 py-5">
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
            <div className="inline-flex items-center gap-1.5">
              <input
                type="text"
                value={newTagValue}
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
                  if (newTagValue.trim()) {
                    handleAddTag()
                  } else {
                    setIsAddingTag(false)
                    setNewTagValue('')
                  }
                }}
                placeholder="tag name"
                autoFocus
                className="workspace-subtle-control w-32 rounded-md border border-[var(--accent)] px-2.5 py-1 text-sm caret-[var(--accent)]"
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsAddingTag(true)}
              className="workspace-subtle-control inline-flex items-center justify-center rounded-md border border-dashed border-[var(--line)] p-1"
              title="Add tag"
            >
              <Plus size={16} />
            </button>
          )}
        </div>
      </div>
      <div className="relative px-8 pb-8 h-full">
        <Editor
          ref={editorRef}
          key={`${notePath}:${editorSessionKey}`}
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
        />
      </div>
    </div>
  )
}
