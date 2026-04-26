import {
  forwardRef,
  ReactElement,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState
} from 'react'
import { editorViewCtx, prosePluginsCtx } from '@milkdown/kit/core'
import type { Node as ProseNode } from '@milkdown/prose/model'
import { Plugin, PluginKey, TextSelection } from '@milkdown/kit/prose/state'
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view'
import { linkSchema } from '@milkdown/kit/preset/commonmark'
import { Crepe, CrepeFeature } from '@milkdown/crepe'
import { insert } from '@milkdown/kit/utils'
import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/nord.css'
import katex from 'katex'
import { Check, Link2 } from 'lucide-react'
import { getNoteDisplayName, stripNoteExtension } from '../../../shared/noteDocument'
import type { NoteListItem } from '../../../shared/types'
import {
  createNoteMentionResolver,
  normalizeNoteMentionMarkdown,
  noteMentionHref,
  parseNoteMentionHref
} from '../../../shared/noteMentions'
import type { NoteEditorSnapshot } from '../lib/noteEditorSession'
import { hasNoteCalloutBodyText, resolveNoteCallout } from '../lib/noteCallouts'
import { findLatexTextMatches, normalizeLatexEscapes } from '../lib/noteLatex'
import { extractNoteOutlineFromMarkdown, type NoteOutlineItem } from '../lib/noteOutline'
import { cn } from '../lib/utils'

interface EditorProps {
  initialContent?: string | null
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
  flushPendingChanges: () => Promise<NoteEditorSnapshot>
  focus: () => void
  hasFocusIntent: () => boolean
  blur: () => void
  insertNoteLink: (targetRelPath: string) => void
}

interface MentionPickerState {
  open: boolean
  query: string
  from: number
  to: number
  top: number
  left: number
}

function buildMentionSuggestions(
  notes: NoteListItem[],
  currentNotePath: string | undefined,
  mentionPicker: MentionPickerState | null
): NoteListItem[] {
  if (!mentionPicker?.open) {
    return []
  }

  const query = mentionPicker.query.trim().toLowerCase()
  return notes
    .filter((note) => {
      if (currentNotePath && note.relPath === currentNotePath) {
        return false
      }

      if (!query) {
        return true
      }

      const displayName = getNoteDisplayName(note.relPath).toLowerCase()
      const relPath = stripNoteExtension(note.relPath).toLowerCase()
      return displayName.includes(query) || relPath.includes(query)
    })
    .slice()
    .sort((left, right) => left.relPath.localeCompare(right.relPath))
    .slice(0, 8)
}

function createInlineLatexPreview(value: string, displayMode: boolean): HTMLElement {
  const preview = document.createElement('span')
  preview.className = cn(
    'note-latex-preview',
    displayMode ? 'note-latex-preview-display' : 'note-latex-preview-inline'
  )
  preview.dataset.latex = value
  preview.dataset.latexMode = displayMode ? 'display' : 'inline'
  preview.contentEditable = 'false'

  try {
    katex.render(value, preview, {
      displayMode,
      throwOnError: true
    })
  } catch {
    const delimiter = displayMode ? '$$' : '$'
    preview.textContent = `${delimiter}${value}${delimiter}`
  }

  return preview
}

function selectionTouchesTextblock(
  selectionFrom: number,
  selectionTo: number,
  blockStart: number,
  blockEnd: number
): boolean {
  if (selectionFrom === selectionTo) {
    return selectionFrom >= blockStart && selectionFrom <= blockEnd
  }

  return selectionFrom <= blockEnd && selectionTo >= blockStart
}

const inlineLatexPreviewPluginKey = new PluginKey('note-inline-latex-preview')
const noteCalloutPluginKey = new PluginKey('note-callout')

function inlineLatexPreviewPlugin(): Plugin {
  return new Plugin({
    key: inlineLatexPreviewPluginKey,
    state: {
      init: () => false,
      apply(transaction, isFocused: boolean) {
        const nextFocusState = transaction.getMeta(inlineLatexPreviewPluginKey)
        return typeof nextFocusState === 'boolean' ? nextFocusState : isFocused
      }
    },
    props: {
      handleDOMEvents: {
        focus(view) {
          view.dispatch(view.state.tr.setMeta(inlineLatexPreviewPluginKey, true))
          return false
        },
        blur(view) {
          view.dispatch(view.state.tr.setMeta(inlineLatexPreviewPluginKey, false))
          return false
        }
      },
      decorations(state) {
        const decorations: Decoration[] = []
        const { from: selectionFrom, to: selectionTo } = state.selection
        const isFocused = inlineLatexPreviewPluginKey.getState(state) === true

        state.doc.descendants((node, pos) => {
          if (!node.isBlock || !node.inlineContent) {
            return true
          }

          const blockStart = pos + 1
          const blockEnd = pos + node.content.size + 1
          const isActiveTextblock =
            isFocused && selectionTouchesTextblock(selectionFrom, selectionTo, blockStart, blockEnd)
          const blockText = node.textBetween(0, node.content.size, '\n', '\0')

          for (const match of findLatexTextMatches(blockText)) {
            const from = blockStart + match.from
            const to = blockStart + match.to

            if (!match.valid) {
              decorations.push(Decoration.inline(from, to, { class: 'note-inline-latex-error' }))
              continue
            }

            if (isActiveTextblock) {
              decorations.push(
                Decoration.inline(from, to, {
                  class: cn(
                    'note-inline-latex-source',
                    match.displayMode && 'note-display-latex-source'
                  )
                })
              )
              continue
            }

            decorations.push(
              Decoration.inline(from, to, {
                class: cn(
                  'note-inline-latex-source-hidden',
                  match.displayMode && 'note-display-latex-source-hidden'
                ),
                'data-latex-source': 'true'
              })
            )
            decorations.push(
              Decoration.widget(
                from,
                (view) => {
                  const preview = createInlineLatexPreview(match.value, match.displayMode)
                  preview.addEventListener('mousedown', (event) => {
                    event.preventDefault()
                    view.dispatch(
                      view.state.tr.setSelection(
                        TextSelection.create(view.state.doc, from + match.delimiter.length)
                      )
                    )
                    view.focus()
                  })
                  return preview
                },
                {
                  key: `inline-latex-${from}-${to}-${match.value}`,
                  side: -1,
                  ignoreSelection: true
                }
              )
            )
          }

          return true
        })

        return DecorationSet.create(state.doc, decorations)
      }
    }
  })
}

function noteCalloutPlugin(): Plugin {
  return new Plugin({
    key: noteCalloutPluginKey,
    props: {
      decorations(state) {
        const decorations: Decoration[] = []
        const { from: selectionFrom, to: selectionTo } = state.selection

        state.doc.descendants((node, pos) => {
          if (node.type.name !== 'blockquote') {
            return true
          }

          const firstTextblockInfo = getFirstTextblockInfo(node, pos)

          if (!firstTextblockInfo) {
            return false
          }

          const callout = resolveNoteCallout(firstTextblockInfo.text)

          decorations.push(
            Decoration.node(pos, pos + node.nodeSize, {
              class: cn('note-callout', `note-callout-${callout.variant}`)
            })
          )

          const shouldShowMarker = selectionTouchesTextblock(
            selectionFrom,
            selectionTo,
            firstTextblockInfo.contentStart,
            firstTextblockInfo.contentEnd
          )
          const shouldHideMarker =
            callout.marker &&
            hasNoteCalloutBodyText(
              node.textBetween(0, node.content.size, '\n', '\0'),
              callout.marker
            )

          if (shouldHideMarker && !shouldShowMarker) {
            decorations.push(
              Decoration.inline(
                firstTextblockInfo.contentStart,
                firstTextblockInfo.contentStart + callout.marker.length,
                { class: 'note-callout-marker-hidden' }
              )
            )
          }

          return false
        })

        return DecorationSet.create(state.doc, decorations)
      }
    }
  })
}

function getFirstTextblockInfo(
  node: ProseNode,
  pos: number
): {
  contentEnd: number
  contentStart: number
  text: string
} | null {
  let info: {
    contentEnd: number
    contentStart: number
    text: string
  } | null = null

  node.descendants((child, childPos) => {
    if (!child.isTextblock) {
      return true
    }

    const nodeStart = pos + childPos + 1
    info = {
      contentStart: nodeStart + 1,
      contentEnd: nodeStart + child.content.size + 1,
      text: child.textBetween(0, child.content.size, '\n', '\0')
    }

    return false
  })

  return info
}

export const Editor = forwardRef<NoteEditorHandle, EditorProps>(function Editor(
  {
    initialContent,
    onDirty,
    onSnapshotChange,
    onPasteImage,
    notes,
    currentNotePath,
    onOpenNoteLink,
    onOutlineChange,
    onJumpToHeadingChange
  }: EditorProps,
  ref
): ReactElement {
  const contentRef = useRef(initialContent ?? '')
  const initialContentRef = useRef(initialContent ?? '')
  const rootRef = useRef<HTMLDivElement | null>(null)
  const editorRef = useRef<Crepe | null>(null)
  const editorReadyRef = useRef(false)
  const notesRef = useRef(notes)
  const currentNotePathRef = useRef(currentNotePath)
  const [isEditorVisible, setIsEditorVisible] = useState(false)
  const [mentionPicker, setMentionPicker] = useState<MentionPickerState | null>(null)
  const [activeMentionIndex, setActiveMentionIndex] = useState(0)
  const hasFocusIntentRef = useRef(false)
  const onDirtyRef = useRef(onDirty)
  const onSnapshotChangeRef = useRef(onSnapshotChange)
  const onPasteImageRef = useRef(onPasteImage)
  const onOpenNoteLinkRef = useRef(onOpenNoteLink)
  const onOutlineChangeRef = useRef(onOutlineChange)

  const resolveNoteMentionTarget = createNoteMentionResolver(notes)
  const mentionSuggestions = buildMentionSuggestions(notes, currentNotePath, mentionPicker)
  const highlightedMentionIndex =
    mentionSuggestions.length === 0
      ? 0
      : Math.min(activeMentionIndex, mentionSuggestions.length - 1)

  useEffect(() => {
    onDirtyRef.current = onDirty
  }, [onDirty])

  useEffect(() => {
    onSnapshotChangeRef.current = onSnapshotChange
  }, [onSnapshotChange])

  useEffect(() => {
    onPasteImageRef.current = onPasteImage
  }, [onPasteImage])

  useEffect(() => {
    notesRef.current = notes
  }, [notes])

  useEffect(() => {
    currentNotePathRef.current = currentNotePath
  }, [currentNotePath])

  useEffect(() => {
    onOpenNoteLinkRef.current = onOpenNoteLink
  }, [onOpenNoteLink])

  useEffect(() => {
    onOutlineChangeRef.current = onOutlineChange
  }, [onOutlineChange])

  useEffect(() => {
    onJumpToHeadingChange?.(null)
  }, [onJumpToHeadingChange])

  const syncContent = useCallback((nextContent: string, dirty: boolean): void => {
    if (contentRef.current === nextContent) {
      return
    }

    contentRef.current = nextContent
    onSnapshotChangeRef.current?.({ content: nextContent })
    onOutlineChangeRef.current?.(extractNoteOutlineFromMarkdown(nextContent))
    if (dirty) {
      onDirtyRef.current()
    }
  }, [])

  const editorHasFocus = useCallback((): boolean => {
    const root = rootRef.current
    return Boolean(root && document.activeElement && root.contains(document.activeElement))
  }, [])

  const focus = useCallback((): void => {
    hasFocusIntentRef.current = true
    const editor = editorRef.current
    if (editor && editorReadyRef.current) {
      editor.editor.action((ctx) => {
        ctx.get(editorViewCtx).focus()
      })
      return
    }

    rootRef.current?.querySelector<HTMLElement>('[contenteditable="true"]')?.focus()
  }, [])

  const blur = useCallback((): void => {
    hasFocusIntentRef.current = false
    rootRef.current?.querySelector<HTMLElement>('[contenteditable="true"]')?.blur()
  }, [])

  const createSnapshot = useCallback((): NoteEditorSnapshot => {
    const content =
      editorRef.current && editorReadyRef.current
        ? editorRef.current.getMarkdown()
        : contentRef.current

    const normalizedContent = normalizeNoteMentionMarkdown(normalizeLatexEscapes(content))
    syncContent(normalizedContent, false)
    return { content: normalizedContent }
  }, [syncContent])

  const captureSnapshot = useCallback(
    async (): Promise<NoteEditorSnapshot> => createSnapshot(),
    [createSnapshot]
  )

  const flushPendingChanges = useCallback(
    async (): Promise<NoteEditorSnapshot> => createSnapshot(),
    [createSnapshot]
  )

  const hasFocusIntent = useCallback(
    (): boolean => editorHasFocus() || hasFocusIntentRef.current,
    [editorHasFocus]
  )

  const closeMentionPicker = useCallback((): void => {
    setMentionPicker(null)
    setActiveMentionIndex(0)
  }, [])

  const insertNoteLink = useCallback(
    (targetRelPath: string): void => {
      const editor = editorRef.current
      if (!editor || !editorReadyRef.current) {
        return
      }

      const replacementRange = mentionPicker?.open
        ? { from: mentionPicker.from, to: mentionPicker.to }
        : null
      const fallbackLabel = getNoteDisplayName(targetRelPath)
      const href = noteMentionHref(fallbackLabel)

      editor.editor.action((ctx) => {
        const view = ctx.get(editorViewCtx)
        const { state } = view
        const from = replacementRange?.from ?? state.selection.from
        const to = replacementRange?.to ?? state.selection.to
        const empty = from === to
        const label = mentionPicker?.open
          ? fallbackLabel
          : empty
            ? fallbackLabel
            : state.doc.textBetween(from, to) || fallbackLabel
        const markType = linkSchema.type(ctx)
        const linkMark = markType.create({ href })
        let tr = state.tr

        if (mentionPicker?.open) {
          tr = tr.insertText(label, from, to)
          tr = tr.addMark(from, from + label.length, linkMark)
          tr = tr.setSelection(TextSelection.create(tr.doc, from + label.length))
        } else if (empty) {
          tr = tr.insertText(label, from, to)
          tr = tr.addMark(from, from + label.length, linkMark)
          tr = tr.setSelection(TextSelection.create(tr.doc, from + label.length))
        } else {
          tr = tr.removeMark(from, to, markType)
          tr = tr.addMark(from, to, linkMark)
          tr = tr.setSelection(TextSelection.create(tr.doc, to))
        }

        view.dispatch(tr.scrollIntoView())
        view.focus()
      })
      closeMentionPicker()
    },
    [closeMentionPicker, mentionPicker]
  )

  const syncMentionPicker = useCallback((): void => {
    const editor = editorRef.current
    const root = rootRef.current
    if (!editor || !editorReadyRef.current || !root) {
      closeMentionPicker()
      return
    }

    editor.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx)
      const { state } = view
      const { from, empty } = state.selection

      if (!empty) {
        closeMentionPicker()
        return
      }

      const lookBehindStart = Math.max(0, from - 100)
      const textBefore = state.doc.textBetween(lookBehindStart, from, '\n', '\0')
      const match = textBefore.match(/\[\[([^\]\n]*)$/)
      if (!match) {
        closeMentionPicker()
        return
      }

      const query = match[1] ?? ''
      const triggerStart = from - query.length - 2
      const caretRect = view.coordsAtPos(from)
      const rootRect = root.getBoundingClientRect()

      setMentionPicker((previous) => {
        if (previous?.query !== query) {
          setActiveMentionIndex(0)
        }

        return {
          open: true,
          query,
          from: triggerStart,
          to: from,
          top: caretRect.bottom - rootRect.top + 8,
          left: Math.max(0, caretRect.left - rootRect.left)
        }
      })
    })
  }, [closeMentionPicker])

  useImperativeHandle(
    ref,
    () => ({
      captureSnapshot,
      flushPendingChanges,
      focus,
      hasFocusIntent,
      blur,
      insertNoteLink
    }),
    [blur, captureSnapshot, flushPendingChanges, focus, hasFocusIntent, insertNoteLink]
  )

  useEffect(() => {
    const root = rootRef.current
    if (!root) {
      return
    }

    let cancelled = false
    root.replaceChildren()
    const initialValue = normalizeLatexEscapes(initialContentRef.current)
    const editor = new Crepe({
      root,
      defaultValue: initialValue,
      features: {
        [CrepeFeature.BlockEdit]: false,
        [CrepeFeature.CodeMirror]: true,
        [CrepeFeature.Cursor]: false,
        [CrepeFeature.LinkTooltip]: true,
        [CrepeFeature.Latex]: false
      },
      featureConfigs: {
        [CrepeFeature.LinkTooltip]: {
          inputPlaceholder: 'Paste link or select a note link'
        }
      }
    })

    editor.editor.config((ctx) => {
      ctx.update(prosePluginsCtx, (plugins) => [
        ...plugins,
        inlineLatexPreviewPlugin(),
        noteCalloutPlugin()
      ])
    })

    editor.on((api) => {
      api.markdownUpdated((_ctx, markdown) => {
        syncContent(normalizeLatexEscapes(markdown), editorReadyRef.current)
        syncMentionPicker()
      })
    })

    editorRef.current = editor
    editorReadyRef.current = false
    contentRef.current = initialValue
    onSnapshotChangeRef.current?.({ content: initialValue })
    onOutlineChangeRef.current?.(extractNoteOutlineFromMarkdown(initialValue))

    void editor
      .create()
      .then(() => {
        if (cancelled) {
          return
        }
        editorReadyRef.current = true
        syncContent(normalizeLatexEscapes(editor.getMarkdown()), false)
        setIsEditorVisible(true)
        console.log('Editor created')
      })
      .catch((error: unknown) => {
        console.error('Failed to create Milkdown editor:', error)
      })

    return () => {
      cancelled = true
      editorReadyRef.current = false
      root.replaceChildren()
      if (editorRef.current === editor) {
        editorRef.current = null
      }
      void editor.destroy().catch((error: unknown) => {
        console.error('Failed to destroy Milkdown editor:', error)
      })
    }
  }, [syncContent, syncMentionPicker])

  useEffect(() => {
    const root = rootRef.current
    if (!root) {
      return
    }

    const handlePaste = (event: ClipboardEvent): void => {
      const clipboardItems = Array.from(event.clipboardData?.items ?? [])
      const imageItem = clipboardItems.find((item) => item.type.startsWith('image/'))
      if (!imageItem) {
        return
      }

      const imageFile = imageItem.getAsFile()
      const fileExtension = imageFile ? getImageFileExtension(imageFile) : null
      if (!imageFile || !fileExtension) {
        return
      }

      event.preventDefault()

      void (async () => {
        const imageUrl = await onPasteImageRef.current(imageFile, fileExtension)
        if (!imageUrl || !editorRef.current || !editorReadyRef.current) {
          return
        }

        editorRef.current.editor.action(insert(`\n![Pasted image](${imageUrl})\n`))
        root.querySelector<HTMLElement>('[contenteditable="true"]')?.focus()
      })()
    }

    root.addEventListener('paste', handlePaste, true)
    return () => {
      root.removeEventListener('paste', handlePaste, true)
    }
  }, [])

  useEffect(() => {
    const root = rootRef.current
    if (!root) {
      return
    }

    const handleClick = (event: MouseEvent): void => {
      const target = event.target
      if (!(target instanceof HTMLElement)) {
        return
      }

      const link = target.closest<HTMLAnchorElement>('a[href]')
      if (!link) {
        return
      }

      const noteTarget = parseNoteMentionHref(link.getAttribute('href') ?? '')
      if (!noteTarget) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      onOpenNoteLinkRef.current?.(noteTarget)
    }

    root.addEventListener('click', handleClick, true)
    return () => {
      root.removeEventListener('click', handleClick, true)
    }
  }, [])

  useEffect(() => {
    const root = rootRef.current
    if (!root) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (!mentionPicker?.open) {
        return
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        closeMentionPicker()
        return
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        const suggestions = buildMentionSuggestions(
          notesRef.current,
          currentNotePathRef.current,
          mentionPicker
        )
        setActiveMentionIndex((current) =>
          suggestions.length === 0 ? 0 : (current + 1) % suggestions.length
        )
        return
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        const suggestions = buildMentionSuggestions(
          notesRef.current,
          currentNotePathRef.current,
          mentionPicker
        )
        setActiveMentionIndex((current) =>
          suggestions.length === 0 ? 0 : (current - 1 + suggestions.length) % suggestions.length
        )
        return
      }

      if (
        (event.key === 'Enter' || event.key === 'Tab') &&
        buildMentionSuggestions(notesRef.current, currentNotePathRef.current, mentionPicker)
          .length > 0
      ) {
        event.preventDefault()
        const suggestions = buildMentionSuggestions(
          notesRef.current,
          currentNotePathRef.current,
          mentionPicker
        )
        const index =
          suggestions.length === 0 ? 0 : Math.min(activeMentionIndex, suggestions.length - 1)
        insertNoteLink(suggestions[index]?.relPath ?? suggestions[0].relPath)
      }
    }

    const handleSelectionChange = (): void => {
      syncMentionPicker()
    }

    root.addEventListener('keydown', handleKeyDown, true)
    document.addEventListener('selectionchange', handleSelectionChange)
    return () => {
      root.removeEventListener('keydown', handleKeyDown, true)
      document.removeEventListener('selectionchange', handleSelectionChange)
    }
  }, [
    activeMentionIndex,
    closeMentionPicker,
    insertNoteLink,
    mentionPicker,
    mentionPicker?.open,
    syncMentionPicker
  ])

  return (
    <div
      data-testid="note-block-editor"
      className="note-milkdown-editor relative h-full min-h-[60vh]"
      style={{ visibility: isEditorVisible ? 'visible' : 'hidden' }}
      onFocusCapture={() => {
        hasFocusIntentRef.current = true
      }}
      onPointerDownCapture={() => {
        hasFocusIntentRef.current = true
      }}
    >
      <div ref={rootRef} data-testid="note-milkdown-root" className="min-h-[60vh] h-full" />
      {mentionPicker?.open ? (
        <div
          className="absolute z-50 w-72 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--popover)] shadow-lg"
          style={{
            top: mentionPicker.top,
            left: mentionPicker.left
          }}
          data-testid="note-link-completion"
        >
          <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2 text-xs text-[var(--muted)]">
            <Link2 size={14} />
            Link note
            {mentionPicker.query ? (
              <span className="truncate">for &quot;{mentionPicker.query}&quot;</span>
            ) : null}
          </div>
          <div className="max-h-72 overflow-y-auto p-1">
            {mentionSuggestions.length > 0 ? (
              mentionSuggestions.map((note, index) => {
                const isActive = index === highlightedMentionIndex
                const alreadyLinked =
                  mentionPicker.query.trim().length > 0 &&
                  resolveNoteMentionTarget(mentionPicker.query) === note.relPath

                return (
                  <button
                    key={note.relPath}
                    type="button"
                    className={cn(
                      'flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm',
                      isActive
                        ? 'bg-[var(--accent-color)] text-[var(--accent-foreground)]'
                        : 'text-[var(--text)] hover:bg-[var(--accent-color)] hover:text-[var(--accent-foreground)]'
                    )}
                    onMouseDown={(event) => {
                      event.preventDefault()
                      insertNoteLink(note.relPath)
                    }}
                    onMouseEnter={() => setActiveMentionIndex(index)}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{getNoteDisplayName(note.relPath)}</div>
                      <div className="truncate text-xs opacity-75">
                        {stripNoteExtension(note.relPath)}
                      </div>
                    </div>
                    {alreadyLinked ? <Check size={14} /> : null}
                  </button>
                )
              })
            ) : (
              <div className="px-3 py-3 text-sm text-[var(--muted)]">No matching notes</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
})

const IMAGE_MIME_EXTENSION_MAP: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/bmp': 'bmp'
}

function getImageFileExtension(file: File): string | null {
  const mimeType = file.type.trim().toLowerCase()
  const extensionFromMime = IMAGE_MIME_EXTENSION_MAP[mimeType]
  if (extensionFromMime) {
    return extensionFromMime
  }

  const fileName = file.name.trim()
  const dotIndex = fileName.lastIndexOf('.')
  if (dotIndex < 0 || dotIndex === fileName.length - 1) {
    return null
  }

  return fileName.slice(dotIndex + 1).toLowerCase()
}
