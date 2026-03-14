import { useCreateBlockNote } from '@blocknote/react'
import { filterSuggestionItems } from '@blocknote/core/extensions'
import { BlockNoteView } from '@blocknote/mantine'
import { DragEvent, ReactElement, useEffect, useRef, useState } from 'react'
import { DefaultReactSuggestionItem, SuggestionMenuController } from '@blocknote/react'
import { NoteListItem } from '../../../shared/types'
import { mentionTokenFromRelPath, normalizeMentionTarget } from '../../../shared/noteMentions'
import '@blocknote/mantine/style.css'

interface EditorProps {
  value: string
  onChange: (next: string) => void
  onDropFile: (sourcePath: string) => Promise<void>
  onPasteImage: (imageBlob: Blob, fileExtension: string) => Promise<string | null>
  notes: NoteListItem[]
  vaultRootPath?: string
  currentNotePath?: string
}

function normalizeMarkdown(markdown: string): string {
  return markdown.replace(/\r\n/g, '\n')
}

// Helper to convert relative markdown paths to absolute vault-file:// URLs for display
function convertMarkdownImagesToFileUrls(
  markdown: string,
  vaultRootPath: string,
  currentNotePath: string
): string {
  if (!vaultRootPath || !currentNotePath) return markdown

  // Match markdown image syntax: ![alt](path)
  return markdown.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, path) => {
    // Skip if already a vault-file:// or http:// URL
    if (
      path.startsWith('vault-file://') ||
      path.startsWith('http://') ||
      path.startsWith('https://')
    ) {
      return match
    }

    // Handle relative paths like ../attachments/image.png
    if (path.startsWith('../')) {
      // Get the directory of the current note
      const noteDir = currentNotePath.includes('/')
        ? currentNotePath.slice(0, currentNotePath.lastIndexOf('/'))
        : ''

      // Resolve the relative path
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

    // Handle absolute vault paths
    const absolutePath = `${vaultRootPath}/${path}`
    return `![${alt}](vault-file://${absolutePath})`
  })
}

// Helper to convert vault-file:// URLs back to relative markdown paths for saving
function convertFileUrlsToMarkdownPaths(
  markdown: string,
  vaultRootPath: string,
  currentNotePath: string
): string {
  if (!vaultRootPath || !currentNotePath) return markdown

  return markdown.replace(/!\[([^\]]*)\]\(vault-file:\/\/([^)]+)\)/g, (match, alt, filePath) => {
    // Convert absolute file path back to vault-relative
    if (filePath.startsWith(vaultRootPath)) {
      const vaultRelative = filePath.slice(vaultRootPath.length + 1) // +1 for the /

      // Convert to relative path from current note
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
  currentNotePath
}: EditorProps): ReactElement {
  const blockNoteThemeClasses =
    '[&_.bn-container]:bg-[var(--panel)] [&_.bn-container]:text-[var(--text)] [&_.bn-container]:[font-family:var(--app-font-family)] [&_.bn-editor]:bg-[var(--panel)] [&_.bn-editor]:text-[var(--text)] [&_.bn-block-content]:text-[var(--text)] [&_.bn-side-menu]:border-[var(--line)] [&_.bn-side-menu]:bg-[var(--panel-2)] [&_.bn-side-menu_button]:text-[var(--text)] [&_.bn-side-menu_button:hover]:bg-[var(--panel-3)] [&_.bn-formatting-toolbar]:border [&_.bn-formatting-toolbar]:border-[var(--line)] [&_.bn-formatting-toolbar]:bg-[var(--panel-2)] [&_.bn-formatting-toolbar]:shadow-[0_4px_12px_rgba(0,0,0,0.15)] [&_.bn-formatting-toolbar_button]:text-[var(--text)] [&_.bn-formatting-toolbar_button:hover]:bg-[var(--panel-3)] [&_.bn-formatting-toolbar_button[data-active="true"]]:bg-[var(--accent-soft)] [&_.bn-formatting-toolbar_button[data-active="true"]]:text-[var(--accent)] [&_.bn-slash-menu]:border [&_.bn-slash-menu]:border-[var(--line)] [&_.bn-slash-menu]:bg-[var(--panel-2)] [&_.bn-slash-menu]:shadow-[0_4px_12px_rgba(0,0,0,0.15)] [&_.bn-slash-menu-item]:text-[var(--text)] [&_.bn-slash-menu-item:hover]:bg-[var(--panel-3)] [&_.bn-slash-menu-item[data-active="true"]]:bg-[var(--panel-3)] [&_.bn-drag-handle]:text-[var(--muted)] [&_.bn-drag-handle:hover]:bg-[var(--panel-3)] [&_.bn-link-toolbar]:border [&_.bn-link-toolbar]:border-[var(--line)] [&_.bn-link-toolbar]:bg-[var(--panel-2)] [&_.bn-link-toolbar_input]:border-[var(--line)] [&_.bn-link-toolbar_input]:bg-[var(--panel)] [&_.bn-link-toolbar_input]:text-[var(--text)] [&_.bn-block-content[data-placeholder]::before]:text-[var(--muted)] [&_.bn-editor_h1]:text-[var(--text)] [&_.bn-editor_h2]:text-[var(--text)] [&_.bn-editor_h3]:text-[var(--text)] [&_.bn-editor_a]:text-[var(--accent)] [&_.bn-editor_code]:border [&_.bn-editor_code]:border-[var(--line)] [&_.bn-editor_code]:bg-[var(--panel-3)] [&_.bn-editor_code]:text-[var(--text)] [&_.bn-editor_pre]:border [&_.bn-editor_pre]:border-[var(--line)] [&_.bn-editor_pre]:bg-[var(--panel-3)] [&_.bn-editor_ul]:text-[var(--text)] [&_.bn-editor_ol]:text-[var(--text)] [&_.bn-editor_blockquote]:border-l-[var(--accent-line)] [&_.bn-editor_blockquote]:text-[var(--muted)]'

  const onPasteImageRef = useRef(onPasteImage)
  useEffect(() => {
    onPasteImageRef.current = onPasteImage
  }, [onPasteImage])

  const editor = useCreateBlockNote(
    {
      uploadFile: async (file: File) => {
        console.log('BlockNote uploadFile called with:', file.name, file.type)
        // Convert File to Blob and determine extension
        const extension = file.name.split('.').pop() || 'png'
        const imageUrl = await onPasteImageRef.current(file, `.${extension}`)
        console.log('Image URL returned:', imageUrl)

        // Return the full file path that can be resolved by Electron
        return imageUrl || ''
      }
    },
    []
  )
  const lastSyncedValueRef = useRef('')
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const editorContainerRef = useRef<HTMLDivElement>(null)

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

  // Attach paste listener to capture image pastes
  useEffect(() => {
    const handlePaste = async (event: Event): Promise<void> => {
      if (!(event instanceof ClipboardEvent)) return

      console.log('[PASTE] Event detected, checking clipboard...')
      const items = event.clipboardData?.items
      if (!items) {
        console.log('[PASTE] No clipboard items')
        return
      }

      console.log('[PASTE] Clipboard items count:', items.length)

      // Check if there's an image in the clipboard
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        console.log('[PASTE] Item', i, 'type:', item.type)
        if (item.type.startsWith('image/')) {
          console.log('[PASTE] Image found! Preventing default...')
          event.preventDefault()
          event.stopPropagation()

          const blob = item.getAsFile()
          if (!blob) {
            console.log('[PASTE] Failed to get blob from item')
            continue
          }

          console.log('[PASTE] Got blob, size:', blob.size, 'type:', blob.type)

          // Determine file extension based on MIME type
          const mimeType = item.type
          let extension = '.png'
          if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
            extension = '.jpg'
          } else if (mimeType === 'image/png') {
            extension = '.png'
          } else if (mimeType === 'image/gif') {
            extension = '.gif'
          } else if (mimeType === 'image/webp') {
            extension = '.webp'
          } else if (mimeType === 'image/svg+xml') {
            extension = '.svg'
          }

          console.log('[PASTE] Calling onPasteImage with extension:', extension)
          // Call the handler to save the image
          const imageUrl = await onPasteImage(blob, extension)
          console.log('[PASTE] Got image URL:', imageUrl)

          if (imageUrl) {
            // Insert image block at cursor position
            try {
              const cursorPosition = editor.getTextCursorPosition()
              console.log('[PASTE] Cursor position:', cursorPosition)

              // Insert an image block
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
              console.log('[PASTE] Image block inserted successfully!')
            } catch (error) {
              console.error('[PASTE] Failed to insert image block:', error)
            }
          } else {
            console.error('[PASTE] No image URL returned from handler')
          }

          break // Only handle the first image
        }
      }
    }

    const container = editorContainerRef.current
    console.log('[EDITOR] Setting up paste listener, container:', container ? 'found' : 'not found')
    if (container) {
      // Use capture phase to intercept before BlockNote
      container.addEventListener('paste', handlePaste, { capture: true })
      return () => {
        console.log('[EDITOR] Removing paste listener')
        container.removeEventListener('paste', handlePaste, { capture: true })
      }
    }
    return undefined
  }, [editor, onPasteImage])

  // Detect system theme
  useEffect(() => {
    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)')
    setTheme(darkModeQuery.matches ? 'dark' : 'light')

    const listener = (e: MediaQueryListEvent): void => {
      setTheme(e.matches ? 'dark' : 'light')
    }

    darkModeQuery.addEventListener('change', listener)
    return () => darkModeQuery.removeEventListener('change', listener)
  }, [])

  useEffect(() => {
    if (normalizeMarkdown(value) === normalizeMarkdown(lastSyncedValueRef.current)) {
      return
    }

    // Convert relative markdown image paths to file:// URLs for display
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
  }, [editor, value, vaultRootPath, currentNotePath])

  const onDrop = async (event: DragEvent<HTMLDivElement>): Promise<void> => {
    event.preventDefault()
    const file = event.dataTransfer.files?.[0] as File & { path?: string }
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

          // Convert file:// URLs back to relative markdown paths for saving
          const savedValue =
            vaultRootPath && currentNotePath
              ? convertFileUrlsToMarkdownPaths(next, vaultRootPath, currentNotePath)
              : next

          lastSyncedValueRef.current = savedValue
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
