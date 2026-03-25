import { filterSuggestionItems } from '@blocknote/core/extensions'
import { BlockNoteView } from '@blocknote/mantine'
import '@blocknote/mantine/style.css'
import {
  DefaultReactSuggestionItem,
  SuggestionMenuController,
  useCreateBlockNote
} from '@blocknote/react'
import {
  DragEvent,
  forwardRef,
  ReactElement,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from 'react'
import { NoteListItem } from '../../../shared/types'
import { mentionTokenFromRelPath, normalizeMentionTarget } from '../../../shared/noteMentions'
import {
  cloneNoteEditorBlocks,
  type NoteEditorBlock,
  type NoteEditorSnapshot
} from '../lib/noteEditorSession'
import { extractNoteOutline, NoteOutlineItem } from '../lib/noteOutline'

interface EditorProps {
  initialBlocks?: NoteEditorBlock[] | null
  value: string
  onDirty: () => void
  onDropFile: (sourcePath: string) => Promise<void>
  onPasteImage: (imageBlob: Blob, fileExtension: string) => Promise<string | null>
  notes: NoteListItem[]
  vaultRootPath?: string
  currentNotePath?: string
  onOutlineChange?: (items: NoteOutlineItem[]) => void
  onJumpToHeadingChange?: (jumpToHeading: ((blockId: string) => void) | null) => void
}

export interface NoteEditorHandle {
  captureSnapshot: () => Promise<NoteEditorSnapshot>
}

function normalizeMarkdown(markdown: string): string {
  return markdown.replace(/\r\n/g, '\n')
}

function normalizeVaultPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+$/, '')
}

function resolveRelativeAssetPath(currentNotePath: string, relativePath: string): string {
  const noteSegments = currentNotePath.split('/').slice(0, -1)
  const targetSegments = relativePath.split('/')

  while (targetSegments[0] === '..') {
    targetSegments.shift()
    if (noteSegments.length > 0) {
      noteSegments.pop()
    }
  }

  while (targetSegments[0] === '.') {
    targetSegments.shift()
  }

  return [...noteSegments, ...targetSegments].join('/')
}

function convertMarkdownImagesToFileUrls(
  markdown: string,
  vaultRootPath: string,
  currentNotePath: string
): string {
  const normalizedVaultRoot = normalizeVaultPath(vaultRootPath)

  return markdown.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, rawPath) => {
    const assetPath = rawPath.trim()
    if (
      assetPath.startsWith('vault-file://') ||
      assetPath.startsWith('http://') ||
      assetPath.startsWith('https://') ||
      assetPath.startsWith('data:')
    ) {
      return match
    }

    const normalizedAssetPath =
      assetPath.startsWith('../') || assetPath.startsWith('./')
        ? resolveRelativeAssetPath(currentNotePath, assetPath)
        : assetPath.replace(/^\/+/, '')

    return `![${alt}](vault-file://${normalizeVaultPath(`${normalizedVaultRoot}/${normalizedAssetPath}`)})`
  })
}

function convertFileUrlsToMarkdownPaths(
  markdown: string,
  vaultRootPath: string,
  currentNotePath: string
): string {
  const normalizedVaultRoot = normalizeVaultPath(vaultRootPath)
  const noteDir = currentNotePath.includes('/')
    ? currentNotePath.slice(0, currentNotePath.lastIndexOf('/'))
    : ''

  return markdown.replace(/!\[([^\]]*)\]\(vault-file:\/\/([^)]+)\)/g, (match, alt, rawFilePath) => {
    const normalizedFilePath = normalizeVaultPath(rawFilePath)
    if (!normalizedFilePath.startsWith(normalizedVaultRoot)) {
      return match
    }

    const vaultRelative = normalizedFilePath
      .slice(normalizedVaultRoot.length)
      .replace(/^\/+/, '')
    if (!noteDir) {
      return `![${alt}](../${vaultRelative})`
    }

    const noteSegments = noteDir.split('/')
    const targetSegments = vaultRelative.split('/')
    let sharedPrefixLength = 0

    while (
      sharedPrefixLength < noteSegments.length &&
      sharedPrefixLength < targetSegments.length &&
      noteSegments[sharedPrefixLength] === targetSegments[sharedPrefixLength]
    ) {
      sharedPrefixLength += 1
    }

    const upSegments = noteSegments.slice(sharedPrefixLength).map(() => '..')
    const downSegments = targetSegments.slice(sharedPrefixLength)
    const relativePath = [...upSegments, ...downSegments].join('/')

    return `![${alt}](${relativePath || '.'})`
  })
}

export const Editor = forwardRef<NoteEditorHandle, EditorProps>(function Editor({
  initialBlocks,
  value,
  onDirty,
  onDropFile,
  onPasteImage,
  notes,
  vaultRootPath,
  currentNotePath,
  onOutlineChange,
  onJumpToHeadingChange
}: EditorProps, ref): ReactElement {
  const blockNoteThemeClasses =
    '[&_.bn-container]:bg-[var(--panel)] [&_.bn-container]:text-[var(--text)] [&_.bn-container]:[font-family:var(--app-font-family)] [&_.bn-editor]:bg-[var(--panel)] [&_.bn-editor]:text-[var(--text)] [&_.bn-block-content]:text-[var(--text)] [&_.bn-side-menu]:border-[var(--line)] [&_.bn-side-menu]:bg-[var(--panel-2)] [&_.bn-side-menu_button]:text-[var(--text)] [&_.bn-side-menu_button:hover]:bg-[var(--panel-3)] [&_.bn-formatting-toolbar]:border [&_.bn-formatting-toolbar]:border-[var(--line)] [&_.bn-formatting-toolbar]:bg-[var(--panel-2)] [&_.bn-formatting-toolbar]:shadow-[0_4px_12px_rgba(0,0,0,0.15)] [&_.bn-formatting-toolbar_button]:text-[var(--text)] [&_.bn-formatting-toolbar_button:hover]:bg-[var(--panel-3)] [&_.bn-formatting-toolbar_button[data-active="true"]]:bg-[var(--accent-soft)] [&_.bn-formatting-toolbar_button[data-active="true"]]:text-[var(--accent)] [&_.bn-slash-menu]:border [&_.bn-slash-menu]:border-[var(--line)] [&_.bn-slash-menu]:bg-[var(--panel-2)] [&_.bn-slash-menu]:shadow-[0_4px_12px_rgba(0,0,0,0.15)] [&_.bn-slash-menu-item]:text-[var(--text)] [&_.bn-slash-menu-item:hover]:bg-[var(--panel-3)] [&_.bn-slash-menu-item[data-active="true"]]:bg-[var(--panel-3)] [&_.bn-drag-handle]:text-[var(--muted)] [&_.bn-drag-handle:hover]:bg-[var(--panel-3)] [&_.bn-link-toolbar]:border [&_.bn-link-toolbar]:border-[var(--line)] [&_.bn-link-toolbar]:bg-[var(--panel-2)] [&_.bn-link-toolbar_input]:border-[var(--line)] [&_.bn-link-toolbar_input]:bg-[var(--panel)] [&_.bn-link-toolbar_input]:text-[var(--text)] [&_.bn-block-content[data-placeholder]::before]:text-[var(--muted)] [&_.bn-editor_h1]:text-[var(--text)] [&_.bn-editor_h2]:text-[var(--text)] [&_.bn-editor_h3]:text-[var(--text)] [&_.bn-editor_a]:text-[var(--accent)] [&_.bn-editor_code]:border [&_.bn-editor_code]:border-[var(--line)] [&_.bn-editor_code]:bg-[var(--panel-3)] [&_.bn-editor_code]:text-[var(--text)] [&_.bn-editor_pre]:border [&_.bn-editor_pre]:border-[var(--line)] [&_.bn-editor_pre]:bg-[var(--panel-3)] [&_.bn-editor_ul]:text-[var(--text)] [&_.bn-editor_ol]:text-[var(--text)] [&_.bn-editor_blockquote]:border-l-[var(--accent-line)] [&_.bn-editor_blockquote]:text-[var(--muted)]'

  const editorContainerRef = useRef<HTMLDivElement | null>(null)
  const onDirtyRef = useRef(onDirty)
  const onPasteImageRef = useRef(onPasteImage)
  const onOutlineChangeRef = useRef(onOutlineChange)
  const lastOutlineRef = useRef<NoteOutlineItem[]>([])
  const lastSyncedValueRef = useRef('')
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    onDirtyRef.current = onDirty
  }, [onDirty])

  useEffect(() => {
    onPasteImageRef.current = onPasteImage
  }, [onPasteImage])

  useEffect(() => {
    onOutlineChangeRef.current = onOutlineChange
  }, [onOutlineChange])

  const editor = useCreateBlockNote(
    {
      initialContent:
        initialBlocks && initialBlocks.length > 0
          ? cloneNoteEditorBlocks(initialBlocks)
          : [{ type: 'paragraph' }],
      uploadFile: async (file: File) => {
        const extension = file.name.includes('.') ? `.${file.name.split('.').pop()}` : '.png'
        const imageUrl = await onPasteImageRef.current(file, extension)
        return imageUrl || ''
      }
    },
    []
  )

  const syncOutline = useCallback((): void => {
    const nextOutline = extractNoteOutline(editor.document)
    const didChange =
      nextOutline.length !== lastOutlineRef.current.length ||
      nextOutline.some((item, index) => {
        const previous = lastOutlineRef.current[index]
        return (
          !previous ||
          previous.id !== item.id ||
          previous.label !== item.label ||
          previous.level !== item.level
        )
      })

    if (!didChange) {
      return
    }

    lastOutlineRef.current = nextOutline
    onOutlineChangeRef.current?.(nextOutline)
  }, [editor])

  const captureSnapshot = useCallback(async (): Promise<NoteEditorSnapshot> => {
    const nextValue = await editor.blocksToMarkdownLossy(editor.document)
    const body =
      vaultRootPath && currentNotePath
        ? convertFileUrlsToMarkdownPaths(nextValue, vaultRootPath, currentNotePath)
        : nextValue

    return {
      body,
      blocks: cloneNoteEditorBlocks(editor.document as NoteEditorBlock[])
    }
  }, [currentNotePath, editor, vaultRootPath])

  useImperativeHandle(
    ref,
    () => ({
      captureSnapshot
    }),
    [captureSnapshot]
  )

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

  const duplicateNameCounts = useMemo(
    () =>
      notes.reduce<Record<string, number>>((acc, note) => {
        const normalizedName = normalizeMentionTarget(note.name)
        acc[normalizedName] = (acc[normalizedName] ?? 0) + 1
        return acc
      }, {}),
    [notes]
  )

  const getMentionItems = useCallback(
    (query: string): DefaultReactSuggestionItem[] => {
      const mentionQuery = query.startsWith('[') ? query.slice(1) : query
      const search = normalizeMentionTarget(mentionQuery)
      const options = notes
        .filter((note) => note.relPath !== currentNotePath)
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
    },
    [currentNotePath, duplicateNameCounts, editor, notes]
  )

  useEffect(() => {
    const handlePaste = async (event: Event): Promise<void> => {
      if (!(event instanceof ClipboardEvent)) {
        return
      }

      const items = event.clipboardData?.items
      if (!items) {
        return
      }

      for (let index = 0; index < items.length; index += 1) {
        const item = items[index]
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

        const imageUrl = await onPasteImageRef.current(blob, extension)
        if (imageUrl) {
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
        }

        break
      }
    }

    const container = editorContainerRef.current
    if (!container) {
      return
    }

    container.addEventListener('paste', handlePaste, { capture: true })
    return () => {
      container.removeEventListener('paste', handlePaste, { capture: true })
    }
  }, [editor])

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
    const syncEditorDocument = async (): Promise<void> => {
      if (normalizeMarkdown(value) === normalizeMarkdown(lastSyncedValueRef.current)) {
        return
      }

      const displayValue =
        vaultRootPath && currentNotePath
          ? convertMarkdownImagesToFileUrls(value, vaultRootPath, currentNotePath)
          : value

      const currentEditorValue = await editor.blocksToMarkdownLossy(editor.document)
      if (normalizeMarkdown(currentEditorValue) === normalizeMarkdown(displayValue)) {
        lastSyncedValueRef.current = value
        return
      }

      const blocks = await editor.tryParseMarkdownToBlocks(displayValue)
      editor.replaceBlocks(editor.document, blocks.length > 0 ? blocks : [{ type: 'paragraph' }])
      lastSyncedValueRef.current = value
      syncOutline()
    }

    void syncEditorDocument()
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

  const handleDrop = async (event: DragEvent<HTMLDivElement>): Promise<void> => {
    event.preventDefault()
    const file = event.dataTransfer.files?.[0] as (File & { path?: string }) | undefined
    if (file?.path) {
      await onDropFile(file.path)
    }
  }

  return (
    <div
      ref={editorContainerRef}
      data-testid="note-block-editor"
      className={`min-h-[60vh] bg-[var(--panel)] p-2 ${blockNoteThemeClasses}`}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        void handleDrop(event)
      }}
    >
      <BlockNoteView
        editor={editor}
        theme={theme}
        onChange={() => {
          syncOutline()
          onDirtyRef.current()
        }}
      >
        <SuggestionMenuController
          triggerCharacter="["
          getItems={async (query) => getMentionItems(query)}
        />
      </BlockNoteView>
    </div>
  )
})
