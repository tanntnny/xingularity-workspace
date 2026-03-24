import { useCreateBlockNote } from '@blocknote/react'
import { filterSuggestionItems } from '@blocknote/core/extensions'
import { BlockNoteView } from '@blocknote/mantine'
import { DefaultReactSuggestionItem, SuggestionMenuController } from '@blocknote/react'
import { DragEvent, ReactElement, useCallback, useEffect, useRef, useState } from 'react'
import { NoteListItem } from '../../../shared/types'
import { mentionTokenFromRelPath, normalizeMentionTarget } from '../../../shared/noteMentions'
import { extractNoteOutline, NoteOutlineItem } from '../lib/noteOutline'
import '@blocknote/mantine/style.css'

interface EditorProps {
  value: string
  onChange: (next: string) => void
  onDropFile: (sourcePath: string) => Promise<void>
  onPasteImage: (imageBlob: Blob, fileExtension: string) => Promise<string | null>
  notes: NoteListItem[]
  vaultRootPath?: string
  currentNotePath?: string
  onOutlineChange?: (items: NoteOutlineItem[]) => void
  onJumpToHeadingChange?: (jumpToHeading: ((blockId: string) => void) | null) => void
}

function normalizeMarkdown(markdown: string): string {
  return markdown.replace(/\r\n/g, '\n')
}

function convertMarkdownImagesToFileUrls(
  markdown: string,
  vaultRootPath: string,
  currentNotePath: string
): string {
  if (!vaultRootPath || !currentNotePath) return markdown

  return markdown.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, path) => {
    if (
      path.startsWith('vault-file://') ||
      path.startsWith('http://') ||
      path.startsWith('https://')
    ) {
      return match
    }

    if (path.startsWith('../')) {
      const noteDir = currentNotePath.includes('/')
        ? currentNotePath.slice(0, currentNotePath.lastIndexOf('/'))
        : ''

      let resolvedPath = path
      let currentDir = noteDir

      while (resolvedPath.startsWith('../')) {
        resolvedPath = resolvedPath.slice(3)
        if (currentDir.includes('/')) {
          currentDir = currentDir.slice(0, currentDir.lastIndexOf('/'))
        } else {
          currentDir = ''
        }
      }

      const fullPath = currentDir ? `${currentDir}/${resolvedPath}` : resolvedPath
      const absolutePath = `${vaultRootPath}/${fullPath}`
      return `![${alt}](vault-file://${absolutePath})`
    }

    const absolutePath = `${vaultRootPath}/${path}`
    return `![${alt}](vault-file://${absolutePath})`
  })
}

function convertFileUrlsToMarkdownPaths(
  markdown: string,
  vaultRootPath: string,
  currentNotePath: string
): string {
  if (!vaultRootPath || !currentNotePath) return markdown

  return markdown.replace(/!\[([^\]]*)\]\(vault-file:\/\/([^)]+)\)/g, (match, alt, filePath) => {
    if (filePath.startsWith(vaultRootPath)) {
      const vaultRelative = filePath.slice(vaultRootPath.length + 1)
      const noteDir = currentNotePath.includes('/')
        ? currentNotePath.slice(0, currentNotePath.lastIndexOf('/'))
        : ''
      const depth = noteDir ? noteDir.split('/').length + 1 : 1
      const prefix = '../'.repeat(depth)
      return `![${alt}](${prefix}${vaultRelative})`
    }

    return match
  })
}

export function Editor({
  value,
  onChange,
  onDropFile,
  onPasteImage,
  notes,
  vaultRootPath,
  currentNotePath,
  onOutlineChange,
  onJumpToHeadingChange
}: EditorProps): ReactElement {
  const blockNoteThemeClasses =
    '[&_.bn-container]:bg-[var(--panel)] [&_.bn-container]:text-[var(--text)] [&_.bn-container]:[font-family:var(--app-font-family)] [&_.bn-editor]:bg-[var(--panel)] [&_.bn-editor]:text-[var(--text)] [&_.bn-block-content]:text-[var(--text)] [&_.bn-side-menu]:border-[var(--line)] [&_.bn-side-menu]:bg-[var(--panel-2)] [&_.bn-side-menu_button]:text-[var(--text)] [&_.bn-side-menu_button:hover]:bg-[var(--panel-3)] [&_.bn-formatting-toolbar]:border [&_.bn-formatting-toolbar]:border-[var(--line)] [&_.bn-formatting-toolbar]:bg-[var(--panel-2)] [&_.bn-formatting-toolbar]:shadow-[0_4px_12px_rgba(0,0,0,0.15)] [&_.bn-formatting-toolbar_button]:text-[var(--text)] [&_.bn-formatting-toolbar_button:hover]:bg-[var(--panel-3)] [&_.bn-formatting-toolbar_button[data-active="true"]]:bg-[var(--accent-soft)] [&_.bn-formatting-toolbar_button[data-active="true"]]:text-[var(--accent)] [&_.bn-slash-menu]:border [&_.bn-slash-menu]:border-[var(--line)] [&_.bn-slash-menu]:bg-[var(--panel-2)] [&_.bn-slash-menu]:shadow-[0_4px_12px_rgba(0,0,0,0.15)] [&_.bn-slash-menu-item]:text-[var(--text)] [&_.bn-slash-menu-item:hover]:bg-[var(--panel-3)] [&_.bn-slash-menu-item[data-active="true"]]:bg-[var(--panel-3)] [&_.bn-drag-handle]:text-[var(--muted)] [&_.bn-drag-handle:hover]:bg-[var(--panel-3)] [&_.bn-link-toolbar]:border [&_.bn-link-toolbar]:border-[var(--line)] [&_.bn-link-toolbar]:bg-[var(--panel-2)] [&_.bn-link-toolbar_input]:border-[var(--line)] [&_.bn-link-toolbar_input]:bg-[var(--panel)] [&_.bn-link-toolbar_input]:text-[var(--text)] [&_.bn-block-content[data-placeholder]::before]:text-[var(--muted)] [&_.bn-editor_h1]:text-[var(--text)] [&_.bn-editor_h2]:text-[var(--text)] [&_.bn-editor_h3]:text-[var(--text)] [&_.bn-editor_a]:text-[var(--accent)] [&_.bn-editor_code]:border [&_.bn-editor_code]:border-[var(--line)] [&_.bn-editor_code]:bg-[var(--panel-3)] [&_.bn-editor_code]:text-[var(--text)] [&_.bn-editor_pre]:border [&_.bn-editor_pre]:border-[var(--line)] [&_.bn-editor_pre]:bg-[var(--panel-3)] [&_.bn-editor_ul]:text-[var(--text)] [&_.bn-editor_ol]:text-[var(--text)] [&_.bn-editor_blockquote]:border-l-[var(--accent-line)] [&_.bn-editor_blockquote]:text-[var(--muted)]'

  const onPasteImageRef = useRef(onPasteImage)
  useEffect(() => {
    onPasteImageRef.current = onPasteImage
  }, [onPasteImage])

  const onOutlineChangeRef = useRef(onOutlineChange)
  useEffect(() => {
    onOutlineChangeRef.current = onOutlineChange
  }, [onOutlineChange])

  const editor = useCreateBlockNote(
    {
      uploadFile: async (file: File) => {
        const extension = file.name.split('.').pop() || 'png'
        const imageUrl = await onPasteImageRef.current(file, `.${extension}`)
        return imageUrl || ''
      }
    },
    []
  )

  const lastSyncedValueRef = useRef('')
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const editorContainerRef = useRef<HTMLDivElement>(null)

  const syncOutline = useCallback((): void => {
    onOutlineChangeRef.current?.(extractNoteOutline(editor.document))
  }, [editor])

  const jumpToHeading = useCallback(
    (blockId: string): void => {
      editor.focus()
      editor.setTextCursorPosition(blockId, 'start')

      requestAnimationFrame(() => {
        const selector = `[data-id="${CSS.escape(blockId)}"]`
        const target = editorContainerRef.current?.querySelector<HTMLElement>(selector)
        target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      })
    },
    [editor]
  )

  const duplicateNameCounts = notes.reduce<Record<string, number>>((acc, note) => {
    const normalizedName = normalizeMentionTarget(note.name)
    acc[normalizedName] = (acc[normalizedName] ?? 0) + 1
    return acc
  }, {})

  const getMentionItems = (query: string): DefaultReactSuggestionItem[] => {
    const mentionQuery = query.startsWith('[') ? query.slice(1) : query
    const search = normalizeMentionTarget(mentionQuery)
    const baseNotes = notes.filter((note) => note.relPath !== currentNotePath)

    const options = baseNotes
      .filter((note) => {
        if (!search) {
          return true
        }
        return (
          normalizeMentionTarget(note.relPath).includes(search) ||
          normalizeMentionTarget(note.name).includes(search)
        )
      })
      .slice(0, 12)

    const suggestionItems = options.map((note) => {
      const normalizedName = normalizeMentionTarget(note.name)
      const hasNameCollision = (duplicateNameCounts[normalizedName] ?? 0) > 1
      const mentionTarget = hasNameCollision
        ? note.relPath.replace(/\.md$/i, '')
        : note.name.replace(/\.md$/i, '')
      const token = mentionTokenFromRelPath(mentionTarget)

      return {
        title: token,
        aliases: [note.relPath, note.name, mentionTarget],
        subtext: note.relPath,
        onItemClick: () => {
          editor.insertInlineContent([token])
        }
      } satisfies DefaultReactSuggestionItem
    })

    return filterSuggestionItems(suggestionItems, search)
  }

  useEffect(() => {
    const handlePaste = async (event: Event): Promise<void> => {
      if (!(event instanceof ClipboardEvent)) return

      const items = event.clipboardData?.items
      if (!items) {
        return
      }

      for (let i = 0; i < items.length; i += 1) {
        const item = items[i]
        if (!item.type.startsWith('image/')) {
          continue
        }

        event.preventDefault()
        event.stopPropagation()

        const blob = item.getAsFile()
        if (!blob) {
          continue
        }

        let extension = '.png'
        if (item.type === 'image/jpeg' || item.type === 'image/jpg') {
          extension = '.jpg'
        } else if (item.type === 'image/gif') {
          extension = '.gif'
        } else if (item.type === 'image/webp') {
          extension = '.webp'
        } else if (item.type === 'image/svg+xml') {
          extension = '.svg'
        }

        const imageUrl = await onPasteImage(blob, extension)
        if (imageUrl) {
          try {
            const cursorPosition = editor.getTextCursorPosition()
            editor.insertBlocks(
              [
                {
                  type: 'image',
                  props: {
                    url: imageUrl,
                    caption: '',
                    previewWidth: 512
                  }
                }
              ],
              cursorPosition.block,
              'after'
            )
          } catch (error) {
            console.error('Failed to insert pasted image block:', error)
          }
        }

        break
      }
    }

    const container = editorContainerRef.current
    if (container) {
      container.addEventListener('paste', handlePaste, { capture: true })
      return () => {
        container.removeEventListener('paste', handlePaste, { capture: true })
      }
    }

    return undefined
  }, [editor, onPasteImage])

  useEffect(() => {
    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)')
    setTheme(darkModeQuery.matches ? 'dark' : 'light')

    const listener = (event: MediaQueryListEvent): void => {
      setTheme(event.matches ? 'dark' : 'light')
    }

    darkModeQuery.addEventListener('change', listener)
    return () => darkModeQuery.removeEventListener('change', listener)
  }, [])

  useEffect(() => {
    if (normalizeMarkdown(value) === normalizeMarkdown(lastSyncedValueRef.current)) {
      return
    }

    const displayValue =
      vaultRootPath && currentNotePath
        ? convertMarkdownImagesToFileUrls(value, vaultRootPath, currentNotePath)
        : value

    const currentEditorValue = editor.blocksToMarkdownLossy(editor.document)
    if (normalizeMarkdown(currentEditorValue) === normalizeMarkdown(displayValue)) {
      lastSyncedValueRef.current = value
      return
    }

    const blocks = editor.tryParseMarkdownToBlocks(displayValue)
    editor.replaceBlocks(editor.document, blocks.length > 0 ? blocks : [{ type: 'paragraph' }])
    lastSyncedValueRef.current = value
    syncOutline()
  }, [currentNotePath, editor, syncOutline, value, vaultRootPath])

  useEffect(() => {
    syncOutline()
  }, [editor, syncOutline])

  useEffect(() => {
    if (!onJumpToHeadingChange) {
      return
    }

    onJumpToHeadingChange(jumpToHeading)
    return () => onJumpToHeadingChange(null)
  }, [jumpToHeading, onJumpToHeadingChange])

  const onDrop = async (event: DragEvent<HTMLDivElement>): Promise<void> => {
    event.preventDefault()
    const file = event.dataTransfer.files?.[0] as (File & { path?: string }) | undefined
    if (file?.path) {
      await onDropFile(file.path)
    }
  }

  return (
    <div
      ref={editorContainerRef}
      className={`min-h-[60vh] bg-[var(--panel)] p-2 ${blockNoteThemeClasses}`}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        void onDrop(event)
      }}
    >
      <BlockNoteView
        editor={editor}
        theme={theme}
        onChange={() => {
          const next = editor.blocksToMarkdownLossy(editor.document)
          const savedValue =
            vaultRootPath && currentNotePath
              ? convertFileUrlsToMarkdownPaths(next, vaultRootPath, currentNotePath)
              : next

          lastSyncedValueRef.current = savedValue
          syncOutline()
          onChange(savedValue)
        }}
      >
        <SuggestionMenuController
          triggerCharacter="["
          getItems={async (query) => getMentionItems(query)}
        />
      </BlockNoteView>
    </div>
  )
}
