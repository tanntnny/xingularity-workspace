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
  MouseEvent as ReactMouseEvent,
  ReactElement,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from 'react'
import { noteBlocksToText, stripNoteExtension } from '../../../shared/noteDocument'
import { NoteListItem } from '../../../shared/types'
import {
  mentionTokenFromRelPath,
  normalizeMentionTarget,
  noteMentionHref,
  parseNoteMentionHref
} from '../../../shared/noteMentions'
import {
  cloneNoteEditorBlocks,
  type NoteEditorBlock,
  type NoteEditorSnapshot
} from '../lib/noteEditorSession'
import { extractNoteOutline, NoteOutlineItem } from '../lib/noteOutline'

interface EditorProps {
  initialBlocks?: NoteEditorBlock[] | null
  onDirty: () => void
  onSnapshotChange?: (snapshot: NoteEditorSnapshot) => void
  onDropFile: (sourcePath: string) => Promise<string | null>
  onPasteImage: (imageBlob: Blob, fileExtension: string) => Promise<string | null>
  notes: NoteListItem[]
  currentNotePath?: string
  onOpenNoteLink?: (target: string) => void
  onOutlineChange?: (items: NoteOutlineItem[]) => void
  onJumpToHeadingChange?: (jumpToHeading: ((blockId: string) => void) | null) => void
}

export interface NoteEditorHandle {
  captureSnapshot: () => Promise<NoteEditorSnapshot>
}

export const Editor = forwardRef<NoteEditorHandle, EditorProps>(function Editor(
  {
    initialBlocks,
    onDirty,
    onSnapshotChange,
    onDropFile,
    onPasteImage,
    notes,
    currentNotePath,
    onOpenNoteLink,
    onOutlineChange,
    onJumpToHeadingChange
  }: EditorProps,
  ref
): ReactElement {
  const blockNoteThemeClasses =
    '[&_.bn-container]:bg-[var(--panel)] [&_.bn-container]:text-[var(--text)] [&_.bn-container]:[font-family:var(--app-font-family)] [&_.bn-editor]:bg-[var(--panel)] [&_.bn-editor]:text-[var(--text)] [&_.bn-block-content]:text-[var(--text)] [&_.bn-side-menu]:border-[var(--line)] [&_.bn-side-menu]:bg-[var(--panel-2)] [&_.bn-side-menu_button]:text-[var(--text)] [&_.bn-side-menu_button:hover]:bg-[var(--panel-3)] [&_.bn-formatting-toolbar]:border [&_.bn-formatting-toolbar]:border-[var(--line)] [&_.bn-formatting-toolbar]:bg-[var(--panel-2)] [&_.bn-formatting-toolbar]:shadow-[0_4px_12px_rgba(0,0,0,0.15)] [&_.bn-formatting-toolbar_button]:text-[var(--text)] [&_.bn-formatting-toolbar_button:hover]:bg-[var(--panel-3)] [&_.bn-formatting-toolbar_button[data-active="true"]]:bg-[var(--accent-soft)] [&_.bn-formatting-toolbar_button[data-active="true"]]:text-[var(--accent)] [&_.bn-slash-menu]:border [&_.bn-slash-menu]:border-[var(--line)] [&_.bn-slash-menu]:bg-[var(--panel-2)] [&_.bn-slash-menu]:shadow-[0_4px_12px_rgba(0,0,0,0.15)] [&_.bn-slash-menu-item]:text-[var(--text)] [&_.bn-slash-menu-item:hover]:bg-[var(--panel-3)] [&_.bn-slash-menu-item[data-active="true"]]:bg-[var(--panel-3)] [&_.bn-drag-handle]:text-[var(--muted)] [&_.bn-drag-handle:hover]:bg-[var(--panel-3)] [&_.bn-link-toolbar]:border [&_.bn-link-toolbar]:border-[var(--line)] [&_.bn-link-toolbar]:bg-[var(--panel-2)] [&_.bn-link-toolbar_input]:border-[var(--line)] [&_.bn-link-toolbar_input]:bg-[var(--panel)] [&_.bn-link-toolbar_input]:text-[var(--text)] [&_.bn-block-content[data-placeholder]::before]:text-[var(--muted)] [&_.bn-editor_h1]:text-[var(--text)] [&_.bn-editor_h2]:text-[var(--text)] [&_.bn-editor_h3]:text-[var(--text)] [&_.bn-editor_a]:text-[var(--accent)] [&_.bn-editor_code]:border [&_.bn-editor_code]:border-[var(--line)] [&_.bn-editor_code]:bg-[var(--panel-3)] [&_.bn-editor_code]:text-[var(--text)] [&_.bn-editor_pre]:border [&_.bn-editor_pre]:border-[var(--line)] [&_.bn-editor_pre]:bg-[var(--panel-3)] [&_.bn-editor_ul]:text-[var(--text)] [&_.bn-editor_ol]:text-[var(--text)] [&_.bn-editor_blockquote]:border-l-[var(--accent-line)] [&_.bn-editor_blockquote]:text-[var(--muted)]'

  const editorContainerRef = useRef<HTMLDivElement | null>(null)
  const onDirtyRef = useRef(onDirty)
  const onPasteImageRef = useRef(onPasteImage)
  const onDropFileRef = useRef(onDropFile)
  const onSnapshotChangeRef = useRef(onSnapshotChange)
  const onOpenNoteLinkRef = useRef(onOpenNoteLink)
  const onOutlineChangeRef = useRef(onOutlineChange)
  const lastOutlineRef = useRef<NoteOutlineItem[]>([])
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
  )

  useEffect(() => {
    onDirtyRef.current = onDirty
  }, [onDirty])

  useEffect(() => {
    onPasteImageRef.current = onPasteImage
  }, [onPasteImage])

  useEffect(() => {
    onDropFileRef.current = onDropFile
  }, [onDropFile])

  useEffect(() => {
    onSnapshotChangeRef.current = onSnapshotChange
  }, [onSnapshotChange])

  useEffect(() => {
    onOpenNoteLinkRef.current = onOpenNoteLink
  }, [onOpenNoteLink])

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
        return (await onPasteImageRef.current(file, extension)) || ''
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

  const createSnapshot = useCallback((): NoteEditorSnapshot => {
    const blocks = cloneNoteEditorBlocks(editor.document as NoteEditorBlock[])
    return {
      blocks,
      content: noteBlocksToText(blocks)
    }
  }, [editor])

  const captureSnapshot = useCallback(
    async (): Promise<NoteEditorSnapshot> => createSnapshot(),
    [createSnapshot]
  )

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
          ? stripNoteExtension(note.relPath)
          : stripNoteExtension(note.name)
        const token = mentionTokenFromRelPath(mentionTarget)

        return {
          title: token,
          aliases: [note.relPath, note.name, mentionTarget],
          subtext: note.relPath,
          onItemClick: () => {
            requestAnimationFrame(() => {
              editor.insertInlineContent([
                {
                  type: 'link',
                  href: noteMentionHref(mentionTarget),
                  content: token
                }
              ])
            })
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

    const listener = (event: MediaQueryListEvent): void => {
      setTheme(event.matches ? 'dark' : 'light')
    }

    darkModeQuery.addEventListener('change', listener)
    return () => darkModeQuery.removeEventListener('change', listener)
  }, [])

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
    if (!file?.path) {
      return
    }

    const imageUrl = await onDropFileRef.current(file.path)
    if (!imageUrl) {
      return
    }

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

  const handleClick = (event: ReactMouseEvent<HTMLDivElement>): void => {
    const target = event.target
    if (!(target instanceof HTMLElement)) {
      return
    }

    const anchor = target.closest<HTMLAnchorElement>('a[href]')
    if (!anchor) {
      return
    }

    const mentionTarget = parseNoteMentionHref(anchor.href)
    if (!mentionTarget) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    onOpenNoteLinkRef.current?.(mentionTarget)
  }

  return (
    <div
      ref={editorContainerRef}
      data-testid="note-block-editor"
      className={blockNoteThemeClasses}
      onClick={handleClick}
      onDrop={(event) => {
        void handleDrop(event)
      }}
      onDragOver={(event) => event.preventDefault()}
    >
      <BlockNoteView
        editor={editor}
        theme={theme}
        formattingToolbar
        slashMenu
        sideMenu
        onChange={() => {
          onSnapshotChangeRef.current?.(createSnapshot())
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
