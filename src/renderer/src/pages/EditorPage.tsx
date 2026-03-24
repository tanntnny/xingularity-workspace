import { ReactElement, useState } from 'react'
import { Plus } from 'lucide-react'
import { NoteListItem } from '../../../shared/types'
import { Editor } from '../components/Editor'
import { InlineEditableText } from '../components/InlineEditableText'
import { Preview } from '../components/Preview'
import { TagChip } from '../components/TagChip'
import type { NoteOutlineItem } from '../lib/noteOutline'

interface EditorPageProps {
  notePath: string
  content: string
  tags: string[]
  notes: NoteListItem[]
  onChange: (next: string) => void
  onDropFile: (sourcePath: string) => Promise<void>
  onPasteImage: (imageBlob: Blob, fileExtension: string) => Promise<string | null>
  onAddTag: (rawTag: string) => void
  onRemoveTag: (tag: string) => void
  onFindByTag: (tag: string) => void
  onRename: (newName: string) => Promise<void>
  onOpenMention?: (target: string) => void
  vaultRootPath?: string
  isPreviewMode?: boolean
  onOutlineChange?: (items: NoteOutlineItem[]) => void
  onJumpToHeadingChange?: (jumpToHeading: ((blockId: string) => void) | null) => void
}

export function EditorPage({
  notePath,
  content,
  tags,
  notes,
  onChange,
  onDropFile,
  onPasteImage,
  onAddTag,
  onRemoveTag,
  onFindByTag,
  onRename,
  onOpenMention,
  vaultRootPath,
  isPreviewMode = false,
  onOutlineChange,
  onJumpToHeadingChange
}: EditorPageProps): ReactElement {
  const [isAddingTag, setIsAddingTag] = useState(false)
  const [newTagValue, setNewTagValue] = useState('')

  const currentName = notePath.split('/').pop()?.replace(/\.md$/, '') || ''

  const handleAddTag = (): void => {
    if (newTagValue.trim()) {
      onAddTag(newTagValue.trim())
      setNewTagValue('')
      setIsAddingTag(false)
    }
  }

  return (
    <div className="h-full overflow-auto bg-[var(--panel)]">
      <div className="flex flex-col gap-3 px-8 py-5">
        <div className="flex min-w-0 items-center">
          <InlineEditableText
            value={currentName}
            onCommit={onRename}
            displayAs="h1"
            displayClassName="m-0 min-w-0 origin-left cursor-text truncate text-4xl font-bold text-[var(--text)] transition-[color,font-size,line-height,letter-spacing,transform] duration-200 ease-out hover:text-[var(--accent)]"
            inputClassName="m-0 min-w-0 flex-1 origin-left border-0 bg-transparent text-4xl font-bold text-[var(--text)] transition-[color,font-size,line-height,letter-spacing,transform] duration-200 ease-out outline-none"
            title="Click to rename"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] pb-5">
          {tags.map((tag) => (
            <TagChip key={tag} tag={tag} onClick={onFindByTag} onRemove={onRemoveTag} />
          ))}
          {isAddingTag ? (
            <div className="inline-flex items-center gap-1.5">
              <input
                type="text"
                value={newTagValue}
                onChange={(e) => setNewTagValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
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
                className="w-32 rounded-md border border-[var(--accent)] bg-[var(--panel)] px-2.5 py-1 text-sm"
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsAddingTag(true)}
              className="inline-flex items-center justify-center rounded-md border border-dashed border-[var(--line)] bg-[var(--panel)] p-1 hover:border-[var(--accent)]"
              title="Add tag"
            >
              <Plus size={16} />
            </button>
          )}
        </div>
      </div>
      <div className="relative px-8 pb-8">
        {isPreviewMode ? (
          <Preview markdown={content} onOpenMention={onOpenMention} />
        ) : (
          <Editor
            key={notePath}
            value={content}
            onChange={onChange}
            onDropFile={onDropFile}
            onPasteImage={onPasteImage}
            notes={notes}
            vaultRootPath={vaultRootPath}
            currentNotePath={notePath}
            onOutlineChange={onOutlineChange}
            onJumpToHeadingChange={onJumpToHeadingChange}
            onOpenMention={onOpenMention}
          />
        )}
      </div>
    </div>
  )
}
