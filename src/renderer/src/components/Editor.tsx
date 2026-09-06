import {
  forwardRef,
  ReactElement,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from 'react'
import {
  commandsCtx,
  EditorStatus,
  editorViewCtx,
  parserCtx,
  prosePluginsCtx,
  schemaCtx,
  serializerCtx
} from '@milkdown/kit/core'
import type { Node as ProseNode } from '@milkdown/prose/model'
import { Plugin, PluginKey, TextSelection } from '@milkdown/kit/prose/state'
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view'
import {
  addBlockTypeCommand,
  blockquoteSchema,
  bulletListSchema,
  clearTextInCurrentBlockCommand,
  codeBlockSchema,
  headingSchema,
  hrSchema,
  linkSchema,
  listItemSchema,
  orderedListSchema,
  paragraphSchema,
  selectTextNearPosCommand,
  setBlockTypeCommand,
  wrapInBlockTypeCommand
} from '@milkdown/kit/preset/commonmark'
import { Crepe, CrepeFeature } from '@milkdown/crepe'
import { createTable } from '@milkdown/kit/preset/gfm'
import { insert, replaceAll } from '@milkdown/kit/utils'
import '@milkdown/crepe/theme/common/style.css'
import katex from 'katex'
import { Check } from './ui/icons'
import { SelectionPopover, type SelectionPopoverOption } from './ui/selection-popover'
import { getNoteDisplayName, stripNoteExtension } from '../../../shared/noteDocument'
import {
  NOTE_PDF_IMAGE_URI_PREFIX,
  type NoteListItem,
  type NotePdfExportImage,
  type NoteVimKeyMapping
} from '../../../shared/types'
import {
  createNoteMentionResolver,
  normalizeNoteMentionMarkdown,
  noteMentionHref,
  parseNoteMentionHref
} from '../../../shared/noteMentions'
import type { NoteEditorSnapshot } from '../lib/noteEditorSession'
import {
  getNoteCalloutTitleRange,
  hasNoteCalloutBodyText,
  joinNoteCalloutTextblocks,
  resolveNoteCallout
} from '../lib/noteCallouts'
import { findLatexTextMatches, normalizeLatexEscapes } from '../lib/noteLatex'
import { ensureEditorViewContext, hasReadyEditorView } from '../lib/milkdownEditorViewContext'
import {
  NOTE_SLASH_COMMANDS,
  findNoteSlashTrigger,
  type NoteSlashCommandId
} from '../lib/noteSlashMenu'
import { resolveArrowReplacementForTextInput } from '../lib/noteArrowInputRules'
import { registerNoteCodeBlockView } from '../lib/noteCodeBlockView'
import { createNoteCodeBlockSyntaxPlugin } from '../lib/noteCodeBlockSyntax'
import { createNoteVimModePlugin, type NoteVimMode } from '../lib/noteVimMode'
import { cn } from '../lib/utils'

interface EditorProps {
  initialContent?: string | null
  density?: 'default' | 'compact'
  background?: 'transparent' | 'inherit'
  readOnly?: boolean
  onDirty: () => void
  onSnapshotChange?: (snapshot: NoteEditorSnapshot) => void
  onDropFile: (sourcePath: string) => Promise<string | null>
  onPasteImage: (imageBlob: Blob, fileExtension: string) => Promise<string | null>
  notes: NoteListItem[]
  currentNotePath?: string
  onOpenNoteLink?: (target: string) => void
  vimModeEnabled: boolean
  vimKeyMappings: NoteVimKeyMapping[]
  onVimModeChange?: (mode: NoteVimMode) => void
}

export interface NoteEditorHandle {
  captureSnapshot: () => Promise<NoteEditorSnapshot>
  flushPendingChanges: () => Promise<NoteEditorSnapshot>
  capturePrintableDocument: () => { html: string; images: NotePdfExportImage[] } | null
  focus: () => void
  hasFocusIntent: () => boolean
  blur: () => void
  jumpToOutlineIndex: (index: number) => void
  insertNoteLink: (targetRelPath: string) => void
  loadDocument: (input: {
    content?: string | null
    notePath?: string
    preserveFocus?: boolean
  }) => void
}

interface MentionPickerState {
  open: boolean
  query: string
  from: number
  to: number
  top: number
  left: number
}

interface SlashPickerState {
  open: boolean
  query: string
  from: number
  to: number
  top: number
  left: number
}

const PRINT_STYLE_PROPERTIES = [
  'align-items',
  'background-color',
  'border-bottom',
  'border-collapse',
  'border-left',
  'border-radius',
  'border-right',
  'border-spacing',
  'border-top',
  'box-sizing',
  'color',
  'column-gap',
  'display',
  'flex',
  'flex-direction',
  'flex-grow',
  'flex-shrink',
  'flex-wrap',
  'font-family',
  'font-size',
  'font-style',
  'font-weight',
  'gap',
  'height',
  'justify-content',
  'letter-spacing',
  'line-height',
  'list-style-position',
  'list-style-type',
  'margin-bottom',
  'margin-left',
  'margin-right',
  'margin-top',
  'max-width',
  'min-width',
  'overflow-wrap',
  'padding-bottom',
  'padding-left',
  'padding-right',
  'padding-top',
  'text-align',
  'text-decoration',
  'text-indent',
  'vertical-align',
  'white-space',
  'width',
  'word-break'
] as const

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

function getLogicalLineRange(text: string, from: number, to: number): { from: number; to: number } {
  const lineStart = text.lastIndexOf('\n', Math.max(0, from - 1)) + 1
  const nextLineBreak = text.indexOf('\n', to)
  const lineEnd = nextLineBreak < 0 ? text.length : nextLineBreak

  return { from: lineStart, to: lineEnd }
}

const inlineLatexPreviewPluginKey = new PluginKey('note-inline-latex-preview')
const noteCalloutPluginKey = new PluginKey('note-callout')
const noteArrowInputPluginKey = new PluginKey('note-arrow-input')

function isMissingEditorViewError(error: unknown): boolean {
  return error instanceof Error && error.message.includes('Context "editorView" not found')
}

function inlinePrintableStyles(source: HTMLElement, target: HTMLElement): void {
  const sourceElements = [source, ...Array.from(source.querySelectorAll<HTMLElement>('*'))]
  const targetElements = [target, ...Array.from(target.querySelectorAll<HTMLElement>('*'))]

  sourceElements.forEach((sourceElement, index) => {
    const targetElement = targetElements[index]
    if (!targetElement) {
      return
    }

    const styles = window.getComputedStyle(sourceElement)
    for (const property of PRINT_STYLE_PROPERTIES) {
      targetElement.style.setProperty(property, styles.getPropertyValue(property))
    }
  })
}

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
          const blockText = node.textBetween(0, node.content.size, '\n', '\0')

          for (const match of findLatexTextMatches(blockText)) {
            const from = blockStart + match.from
            const to = blockStart + match.to

            if (!match.valid) {
              decorations.push(Decoration.inline(from, to, { class: 'note-inline-latex-error' }))
              continue
            }

            const lineRange = getLogicalLineRange(blockText, match.from, match.to)
            const isActiveLine =
              isFocused &&
              selectionTouchesTextblock(
                selectionFrom,
                selectionTo,
                blockStart + lineRange.from,
                blockStart + lineRange.to
              )

            if (isActiveLine) {
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

          const blockquoteInfo = getBlockquoteCalloutInfo(node, pos)

          if (!blockquoteInfo) {
            return false
          }

          const callout = resolveNoteCallout(blockquoteInfo.text)

          decorations.push(
            Decoration.node(pos, pos + node.nodeSize, {
              class: cn('note-callout', `note-callout-${callout.variant}`)
            })
          )

          const titleRange = getNoteCalloutTitleRange(blockquoteInfo.text, callout.marker)
          if (titleRange) {
            decorations.push(
              Decoration.inline(
                blockquoteInfo.contentStart + titleRange.start,
                blockquoteInfo.contentStart + titleRange.end,
                { class: 'note-callout-title' }
              )
            )
          }

          const shouldShowMarker = selectionTouchesTextblock(
            selectionFrom,
            selectionTo,
            blockquoteInfo.contentStart,
            blockquoteInfo.contentEnd
          )
          const shouldHideMarker =
            callout.marker && hasNoteCalloutBodyText(blockquoteInfo.fullText, callout.marker)

          if (shouldHideMarker && !shouldShowMarker) {
            decorations.push(
              Decoration.inline(
                blockquoteInfo.contentStart,
                blockquoteInfo.contentStart + callout.marker.length,
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

function noteArrowInputPlugin(options?: { shouldIgnoreInput?: () => boolean }): Plugin {
  const { shouldIgnoreInput } = options ?? {}

  return new Plugin({
    key: noteArrowInputPluginKey,
    props: {
      handleTextInput(view, from, to, text) {
        if (shouldIgnoreInput?.() || text.length === 0) {
          return false
        }

        const $from = view.state.doc.resolve(from)
        const $to = view.state.doc.resolve(to)
        if (!$from.sameParent($to) || !$from.parent.isTextblock) {
          return false
        }

        const blockStart = $from.start()
        const replacementPlan = resolveArrowReplacementForTextInput({
          textBeforeCursor: $from.parent.textBetween(0, from - blockStart, '\n', '\0'),
          insertedText: text,
          isCodeText: $from.parent.type.spec.code === true
        })
        if (!replacementPlan) {
          return false
        }

        view.dispatch(
          view.state.tr.insertText(
            replacementPlan.replacement,
            Math.max(blockStart, from - replacementPlan.deletePreviousTextLength),
            to
          )
        )
        return true
      }
    }
  })
}

function getBlockquoteCalloutInfo(
  node: ProseNode,
  pos: number
): {
  contentEnd: number
  contentStart: number
  fullText: string
  text: string
} | null {
  let firstTextblockInfo: {
    contentEnd: number
    contentStart: number
    text: string
  } | null = null
  const textblocks: string[] = []

  node.descendants((child, childPos) => {
    if (!child.isTextblock) {
      return true
    }

    const text = child.textBetween(0, child.content.size, '\n', '\0')
    textblocks.push(text)

    const nodeStart = pos + childPos + 1
    if (!firstTextblockInfo) {
      firstTextblockInfo = {
        contentStart: nodeStart + 1,
        contentEnd: nodeStart + child.content.size + 1,
        text
      }
    }

    return false
  })

  if (!firstTextblockInfo) {
    return null
  }

  const firstTextblock = firstTextblockInfo as {
    contentEnd: number
    contentStart: number
    text: string
  }

  return {
    contentEnd: firstTextblock.contentEnd,
    contentStart: firstTextblock.contentStart,
    text: firstTextblock.text,
    fullText: joinNoteCalloutTextblocks(textblocks)
  }
}

export const Editor = forwardRef<NoteEditorHandle, EditorProps>(function Editor(
  {
    initialContent,
    density = 'default',
    background = 'transparent',
    readOnly = false,
    onDirty,
    onSnapshotChange,
    onPasteImage,
    notes,
    currentNotePath,
    onOpenNoteLink,
    vimModeEnabled,
    vimKeyMappings,
    onVimModeChange
  }: EditorProps,
  ref
): ReactElement {
  const contentRef = useRef(initialContent ?? '')
  const initialContentRef = useRef(initialContent ?? '')
  const loadedNotePathRef = useRef(currentNotePath)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const editorRef = useRef<Crepe | null>(null)
  const editorReadyRef = useRef(false)
  const currentNotePathRef = useRef(currentNotePath)
  const mentionPickerRef = useRef<MentionPickerState | null>(null)
  const slashPickerRef = useRef<SlashPickerState | null>(null)
  const slashCommandSelectionRef = useRef(false)
  const dismissedMentionTriggerRef = useRef<{
    from: number
    to: number
    query: string
  } | null>(null)
  const vimModeEnabledRef = useRef(vimModeEnabled)
  const vimKeyMappingsRef = useRef(vimKeyMappings)
  const readOnlyRef = useRef(readOnly)
  const onVimModeChangeRef = useRef(onVimModeChange)
  const [isEditorVisible, setIsEditorVisible] = useState(false)
  const [mentionPicker, setMentionPicker] = useState<MentionPickerState | null>(null)
  const [slashPicker, setSlashPicker] = useState<SlashPickerState | null>(null)
  const [vimMode, setVimMode] = useState<NoteVimMode>('insert')
  const hasFocusIntentRef = useRef(false)
  const onDirtyRef = useRef(onDirty)
  const onSnapshotChangeRef = useRef(onSnapshotChange)
  const onPasteImageRef = useRef(onPasteImage)
  const onOpenNoteLinkRef = useRef(onOpenNoteLink)
  const suppressNextDirtySyncRef = useRef(false)

  const resolveNoteMentionTarget = createNoteMentionResolver(notes)
  const mentionSuggestions = buildMentionSuggestions(notes, currentNotePath, mentionPicker)
  const mentionOptions: SelectionPopoverOption[] = mentionSuggestions.map((note) => {
    const alreadyLinked =
      Boolean(mentionPicker?.query.trim()) &&
      resolveNoteMentionTarget(mentionPicker?.query ?? '') === note.relPath

    return {
      value: note.relPath,
      label: (
        <span className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{getNoteDisplayName(note.relPath)}</span>
            <span className="block truncate text-xs opacity-75">
              {stripNoteExtension(note.relPath)}
            </span>
          </span>
          {alreadyLinked ? <Check aria-hidden="true" size={14} /> : null}
        </span>
      ),
      searchText: `${getNoteDisplayName(note.relPath)} ${stripNoteExtension(note.relPath)}`,
      wrapLabel: true
    }
  })
  const slashOptions = useMemo<SelectionPopoverOption[]>(
    () =>
      NOTE_SLASH_COMMANDS.map((command) => ({
        value: command.id,
        label: command.label,
        searchText: command.keywords.join(' ')
      })),
    []
  )

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
    currentNotePathRef.current = currentNotePath
  }, [currentNotePath])

  useEffect(() => {
    onOpenNoteLinkRef.current = onOpenNoteLink
  }, [onOpenNoteLink])

  useEffect(() => {
    mentionPickerRef.current = mentionPicker
  }, [mentionPicker])

  useEffect(() => {
    slashPickerRef.current = slashPicker
  }, [slashPicker])

  useEffect(() => {
    vimModeEnabledRef.current = vimModeEnabled
  }, [vimModeEnabled])

  useEffect(() => {
    vimKeyMappingsRef.current = vimKeyMappings
  }, [vimKeyMappings])

  useEffect(() => {
    readOnlyRef.current = readOnly
    editorRef.current?.setReadonly(readOnly)
  }, [readOnly])

  useEffect(() => {
    onVimModeChangeRef.current = onVimModeChange
  }, [onVimModeChange])

  const syncContent = useCallback((nextContent: string, dirty: boolean): void => {
    if (contentRef.current === nextContent) {
      return
    }

    contentRef.current = nextContent
    onSnapshotChangeRef.current?.({ content: nextContent })
    if (dirty) {
      onDirtyRef.current()
    }
  }, [])

  const isEditorTarget = useCallback((target: EventTarget | null): boolean => {
    const editable = rootRef.current?.querySelector<HTMLElement>('[contenteditable="true"]')
    return Boolean(editable && target instanceof Node && editable.contains(target))
  }, [])

  const editorHasFocus = useCallback((): boolean => {
    return isEditorTarget(document.activeElement)
  }, [isEditorTarget])

  const runEditorActionSafely = useCallback(
    (runner: Parameters<Crepe['editor']['action']>[0]): boolean => {
      const editor = editorRef.current
      if (!editor || !editorReadyRef.current) {
        return false
      }

      try {
        editor.editor.action(runner)
        return true
      } catch (error) {
        if (isMissingEditorViewError(error)) {
          editorReadyRef.current = false
          return false
        }

        throw error
      }
    },
    []
  )

  const focus = useCallback((): void => {
    hasFocusIntentRef.current = true
    if (
      runEditorActionSafely((ctx) => {
        ctx.get(editorViewCtx).focus()
      })
    ) {
      return
    }

    rootRef.current?.querySelector<HTMLElement>('[contenteditable="true"]')?.focus()
  }, [runEditorActionSafely])

  const blur = useCallback((): void => {
    hasFocusIntentRef.current = false
    rootRef.current?.querySelector<HTMLElement>('[contenteditable="true"]')?.blur()
  }, [])

  const jumpToOutlineIndex = useCallback(
    (index: number): void => {
      const root = rootRef.current
      if (!root || index < 0) {
        return
      }

      const headings = Array.from(
        root.querySelectorAll<HTMLElement>(
          '.ProseMirror h1, .ProseMirror h2, .ProseMirror h3, .ProseMirror h4, .ProseMirror h5, .ProseMirror h6'
        )
      )
      const target = headings[index]
      if (!target) {
        return
      }

      focus()
      target.scrollIntoView({
        block: 'center',
        behavior: 'auto'
      })
    },
    [focus]
  )

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

  const capturePrintableDocument = useCallback((): {
    html: string
    images: NotePdfExportImage[]
  } | null => {
    const renderedDocument = rootRef.current?.querySelector<HTMLElement>('.ProseMirror')
    if (!renderedDocument) {
      return null
    }

    const clone = renderedDocument.cloneNode(true) as HTMLElement
    inlinePrintableStyles(renderedDocument, clone)
    clone.removeAttribute('contenteditable')
    clone.querySelectorAll('script, iframe, object, embed, form, button').forEach((element) => {
      element.remove()
    })
    clone.querySelectorAll<HTMLElement>('*').forEach((element) => {
      for (const attribute of element.getAttributeNames()) {
        if (attribute.startsWith('on')) {
          element.removeAttribute(attribute)
        }
      }
      element.removeAttribute('contenteditable')
    })

    const images: NotePdfExportImage[] = []
    clone.querySelectorAll<HTMLImageElement>('img').forEach((image, index) => {
      const source = image.currentSrc || image.getAttribute('src')
      if (!source) {
        image.remove()
        return
      }

      const id = `image-${index + 1}`
      images.push({ id, src: source })
      image.setAttribute('src', `${NOTE_PDF_IMAGE_URI_PREFIX}${id}`)
      image.setAttribute('data-export-image-id', id)
    })

    clone.style.minHeight = 'auto'
    clone.style.height = 'auto'
    clone.style.paddingBottom = '0'

    return { html: clone.innerHTML, images }
  }, [])

  const hasFocusIntent = useCallback(
    (): boolean => editorHasFocus() || hasFocusIntentRef.current,
    [editorHasFocus]
  )

  const closeMentionPicker = useCallback((): void => {
    setMentionPicker(null)
  }, [])

  const closeSlashPicker = useCallback((): void => {
    setSlashPicker(null)
  }, [])

  const loadDocument = useCallback(
    ({
      content,
      notePath,
      preserveFocus = false
    }: {
      content?: string | null
      notePath?: string
      preserveFocus?: boolean
    }): void => {
      const nextContent = normalizeLatexEscapes(content ?? '')
      const samePath = loadedNotePathRef.current === notePath
      const sameContent = contentRef.current === nextContent

      loadedNotePathRef.current = notePath
      currentNotePathRef.current = notePath
      initialContentRef.current = nextContent

      if (!editorRef.current || !editorReadyRef.current) {
        contentRef.current = nextContent
        if (!sameContent) {
          onSnapshotChangeRef.current?.({ content: nextContent })
        }
        return
      }

      if (samePath && sameContent) {
        return
      }

      suppressNextDirtySyncRef.current = true
      if (!runEditorActionSafely(replaceAll(nextContent))) {
        contentRef.current = nextContent
        return
      }
      syncContent(nextContent, false)
      dismissedMentionTriggerRef.current = null
      closeMentionPicker()
      closeSlashPicker()

      if (preserveFocus) {
        focus()
      }
    },
    [closeMentionPicker, closeSlashPicker, focus, runEditorActionSafely, syncContent]
  )

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
      const href = noteMentionHref(targetRelPath)

      if (
        !runEditorActionSafely((ctx) => {
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
      ) {
        return
      }
      closeMentionPicker()
    },
    [closeMentionPicker, mentionPicker, runEditorActionSafely]
  )

  const runSlashCommand = useCallback(
    (commandId: NoteSlashCommandId): void => {
      const editor = editorRef.current
      if (!editor || !editorReadyRef.current) {
        return
      }

      const replacementRange = slashPicker?.open
        ? { from: slashPicker.from, to: slashPicker.to }
        : null

      if (
        !runEditorActionSafely((ctx) => {
          const view = ctx.get(editorViewCtx)
          const commands = ctx.get(commandsCtx)
          const from = replacementRange?.from ?? view.state.selection.from
          const to = replacementRange?.to ?? view.state.selection.to
          let tr = view.state.tr.delete(from, to)

          tr = tr.setSelection(TextSelection.create(tr.doc, from))
          view.dispatch(tr.scrollIntoView())
          commands.call(clearTextInCurrentBlockCommand.key)

          switch (commandId) {
            case 'text': {
              commands.call(setBlockTypeCommand.key, {
                nodeType: paragraphSchema.type(ctx)
              })
              break
            }
            case 'heading1':
            case 'heading2':
            case 'heading3': {
              const heading = headingSchema.type(ctx)
              const levelByCommand: Record<
                Extract<NoteSlashCommandId, 'heading1' | 'heading2' | 'heading3'>,
                number
              > = {
                heading1: 1,
                heading2: 2,
                heading3: 3
              }

              commands.call(setBlockTypeCommand.key, {
                nodeType: heading,
                attrs: {
                  level: levelByCommand[commandId]
                }
              })
              break
            }
            case 'bulletList':
              commands.call(wrapInBlockTypeCommand.key, {
                nodeType: bulletListSchema.type(ctx)
              })
              break
            case 'numberedList':
              commands.call(wrapInBlockTypeCommand.key, {
                nodeType: orderedListSchema.type(ctx)
              })
              break
            case 'taskList':
              commands.call(wrapInBlockTypeCommand.key, {
                nodeType: listItemSchema.type(ctx),
                attrs: { checked: false }
              })
              break
            case 'quote':
              commands.call(wrapInBlockTypeCommand.key, {
                nodeType: blockquoteSchema.type(ctx)
              })
              break
            case 'codeBlock':
              commands.call(setBlockTypeCommand.key, {
                nodeType: codeBlockSchema.type(ctx)
              })
              break
            case 'divider':
              commands.call(addBlockTypeCommand.key, {
                nodeType: hrSchema.type(ctx)
              })
              break
            case 'table': {
              const selectionFrom = view.state.selection.from
              commands.call(addBlockTypeCommand.key, {
                nodeType: createTable(ctx, 3, 3)
              })
              commands.call(selectTextNearPosCommand.key, { pos: selectionFrom })
              break
            }
            default:
              break
          }

          view.focus()
        })
      ) {
        return
      }

      closeSlashPicker()
    },
    [closeSlashPicker, runEditorActionSafely, slashPicker]
  )

  const clearSlashTrigger = useCallback((): void => {
    const picker = slashPickerRef.current
    if (!picker?.open) {
      closeSlashPicker()
      return
    }

    if (
      !runEditorActionSafely((ctx) => {
        const view = ctx.get(editorViewCtx)
        const { state } = view
        const { from, empty, $from } = state.selection
        if (!empty) {
          view.focus()
          return
        }

        const textBefore = $from.parent.textBetween(0, $from.parentOffset, '\n', '\0')
        const match = findNoteSlashTrigger(textBefore)
        if (!match) {
          view.focus()
          return
        }

        const triggerStart = from - match.query.length - 1
        const transaction = state.tr.delete(triggerStart, from)
        transaction.setSelection(TextSelection.create(transaction.doc, triggerStart))
        view.dispatch(transaction.scrollIntoView())
        view.focus()
      })
    ) {
      closeSlashPicker()
      return
    }

    closeSlashPicker()
  }, [closeSlashPicker, runEditorActionSafely])

  const handleSlashCommandSelect = useCallback(
    (commandId: string): void => {
      slashCommandSelectionRef.current = true
      runSlashCommand(commandId as NoteSlashCommandId)
    },
    [runSlashCommand]
  )

  const handleSlashSearchValueChange = useCallback((query: string): void => {
    setSlashPicker((previous) => (previous ? { ...previous, query } : previous))
  }, [])

  const handleSlashPopoverOpenChange = useCallback(
    (nextOpen: boolean): void => {
      if (nextOpen) {
        return
      }

      if (slashCommandSelectionRef.current) {
        slashCommandSelectionRef.current = false
        return
      }

      const picker = slashPickerRef.current
      if (picker?.open) {
        clearSlashTrigger()
        return
      }

      closeSlashPicker()
    },
    [clearSlashTrigger, closeSlashPicker]
  )

  const handleSlashPopoverCloseAutoFocus = useCallback(
    (event: Event): void => {
      event.preventDefault()
      focus()
    },
    [focus]
  )

  const handleMentionSelect = useCallback(
    (targetRelPath: string): void => {
      insertNoteLink(targetRelPath)
    },
    [insertNoteLink]
  )

  const handleMentionSearchValueChange = useCallback((query: string): void => {
    setMentionPicker((previous) => (previous ? { ...previous, query } : previous))
  }, [])

  const handleMentionPopoverOpenChange = useCallback(
    (nextOpen: boolean): void => {
      if (!nextOpen) {
        const picker = mentionPickerRef.current
        if (picker?.open) {
          dismissedMentionTriggerRef.current = {
            from: picker.from,
            to: picker.to,
            query: picker.query
          }
        }
        closeMentionPicker()
      }
    },
    [closeMentionPicker]
  )

  const handleMentionPopoverCloseAutoFocus = useCallback(
    (event: Event): void => {
      event.preventDefault()
      focus()
    },
    [focus]
  )

  const syncMentionPicker = useCallback((): void => {
    const editor = editorRef.current
    const root = rootRef.current
    if (!editor || !editorReadyRef.current || !root) {
      closeMentionPicker()
      return
    }

    if (mentionPickerRef.current?.open && !editorHasFocus()) {
      return
    }

    if (
      !runEditorActionSafely((ctx) => {
        const view = ctx.get(editorViewCtx)
        const { state } = view
        const { from, empty } = state.selection

        if (!empty) {
          dismissedMentionTriggerRef.current = null
          closeMentionPicker()
          return
        }

        const lookBehindStart = Math.max(0, from - 100)
        const textBefore = state.doc.textBetween(lookBehindStart, from, '\n', '\0')
        const match = textBefore.match(/\[\[([^\]\n]*)$/)
        if (!match) {
          dismissedMentionTriggerRef.current = null
          closeMentionPicker()
          return
        }

        const query = match[1] ?? ''
        const triggerStart = from - query.length - 2
        const dismissedTrigger = dismissedMentionTriggerRef.current
        if (
          dismissedTrigger &&
          dismissedTrigger.from === triggerStart &&
          dismissedTrigger.to === from &&
          dismissedTrigger.query === query
        ) {
          closeMentionPicker()
          return
        }

        dismissedMentionTriggerRef.current = null
        const caretRect = view.coordsAtPos(from)
        const rootRect = root.getBoundingClientRect()

        setMentionPicker({
          open: true,
          query,
          from: triggerStart,
          to: from,
          top: caretRect.bottom - rootRect.top + 8,
          left: Math.max(0, caretRect.left - rootRect.left)
        })
        closeSlashPicker()
      })
    ) {
      closeMentionPicker()
    }
  }, [closeMentionPicker, closeSlashPicker, editorHasFocus, runEditorActionSafely])

  const syncSlashPicker = useCallback((): void => {
    const editor = editorRef.current
    const root = rootRef.current
    if (!editor || !editorReadyRef.current || !root) {
      closeSlashPicker()
      return
    }

    if (
      !runEditorActionSafely((ctx) => {
        const view = ctx.get(editorViewCtx)
        const { state } = view
        const { from, empty, $from } = state.selection

        if (!empty) {
          closeSlashPicker()
          return
        }

        const parent = $from.parent
        if (!['paragraph', 'heading'].includes(parent.type.name)) {
          closeSlashPicker()
          return
        }

        const textBefore = parent.textBetween(0, $from.parentOffset, '\n', '\0')
        const match = findNoteSlashTrigger(textBefore)
        if (!match) {
          closeSlashPicker()
          return
        }

        const triggerStart = from - match.query.length - 1
        const caretRect = view.coordsAtPos(from)
        const rootRect = root.getBoundingClientRect()

        setSlashPicker((previous) => {
          return {
            open: true,
            query: previous?.open && previous.from === triggerStart ? previous.query : match.query,
            from: triggerStart,
            to: from,
            top: caretRect.bottom - rootRect.top + 8,
            left: Math.max(0, caretRect.left - rootRect.left)
          }
        })
        closeMentionPicker()
      })
    ) {
      closeSlashPicker()
    }
  }, [closeMentionPicker, closeSlashPicker, runEditorActionSafely])

  useImperativeHandle(
    ref,
    () => ({
      captureSnapshot,
      flushPendingChanges,
      capturePrintableDocument,
      focus,
      hasFocusIntent,
      blur,
      jumpToOutlineIndex,
      insertNoteLink,
      loadDocument
    }),
    [
      blur,
      captureSnapshot,
      capturePrintableDocument,
      flushPendingChanges,
      focus,
      hasFocusIntent,
      jumpToOutlineIndex,
      insertNoteLink,
      loadDocument
    ]
  )

  useEffect(() => {
    const root = rootRef.current
    if (!root) {
      return
    }

    let cancelled = false
    let readyFrameId: number | null = null
    let didRegisterMarkdownListener = false
    root.replaceChildren()
    const initialValue = normalizeLatexEscapes(initialContentRef.current)
    const editor = new Crepe({
      root,
      defaultValue: initialValue,
      features: {
        [CrepeFeature.BlockEdit]: false,
        [CrepeFeature.CodeMirror]: false,
        [CrepeFeature.Cursor]: false,
        [CrepeFeature.LinkTooltip]: true,
        [CrepeFeature.Latex]: false
      },
      featureConfigs: {
        [CrepeFeature.LinkTooltip]: {
          inputPlaceholder: 'Paste link or select a note link'
        },
        [CrepeFeature.Placeholder]: {
          text: 'Type / for commands'
        }
      }
    })
    editor.setReadonly(readOnlyRef.current)

    editor.editor.config((ctx) => {
      ensureEditorViewContext(ctx)
      registerNoteCodeBlockView(ctx)
      ctx.update(prosePluginsCtx, (plugins) => [
        ...plugins,
        inlineLatexPreviewPlugin(),
        noteCalloutPlugin(),
        createNoteCodeBlockSyntaxPlugin(),
        createNoteVimModePlugin({
          isEnabled: () => vimModeEnabledRef.current,
          getKeyMappings: () => vimKeyMappingsRef.current,
          getParser: () => ctx.get(parserCtx),
          getSchema: () => ctx.get(schemaCtx),
          getSerializer: () => ctx.get(serializerCtx),
          shouldIgnoreKeyDown: () =>
            Boolean(mentionPickerRef.current?.open || slashPickerRef.current?.open),
          onModeChange: (mode) => {
            setVimMode(mode)
            onVimModeChangeRef.current?.(mode)
          }
        }),
        noteArrowInputPlugin({
          shouldIgnoreInput: () =>
            Boolean(mentionPickerRef.current?.open || slashPickerRef.current?.open)
        })
      ])
    })

    editorRef.current = editor
    editorReadyRef.current = false
    contentRef.current = initialValue
    onSnapshotChangeRef.current?.({ content: initialValue })
    editor.editor.onStatusChange((status) => {
      if (status === EditorStatus.Destroyed) {
        ensureEditorViewContext(editor.editor.ctx)
      }
    })

    void editor
      .create()
      .then(() => {
        if (cancelled) {
          return
        }

        const markEditorReady = (): void => {
          if (cancelled) {
            return
          }

          const view = editor.editor.action((ctx) => ctx.get(editorViewCtx))
          if (!hasReadyEditorView(view)) {
            readyFrameId = window.requestAnimationFrame(markEditorReady)
            return
          }

          const nextContent = normalizeLatexEscapes(initialContentRef.current)

          editorReadyRef.current = true
          loadedNotePathRef.current = currentNotePathRef.current
          if (!didRegisterMarkdownListener) {
            didRegisterMarkdownListener = true
            editor.on((api) => {
              api.markdownUpdated((_ctx, markdown) => {
                const shouldMarkDirty = editorReadyRef.current && !suppressNextDirtySyncRef.current
                suppressNextDirtySyncRef.current = false
                syncContent(normalizeLatexEscapes(markdown), shouldMarkDirty)
                syncMentionPicker()
                syncSlashPicker()
              })
            })
          }
          syncContent(nextContent, false)
          setIsEditorVisible(true)
        }

        markEditorReady()
      })
      .catch((error: unknown) => {
        console.error('Failed to create Milkdown editor:', error)
      })

    return () => {
      cancelled = true
      if (readyFrameId !== null) {
        window.cancelAnimationFrame(readyFrameId)
      }
      editorReadyRef.current = false
      root.replaceChildren()
      if (editorRef.current === editor) {
        editorRef.current = null
      }
      void editor.destroy().catch((error: unknown) => {
        console.error('Failed to destroy Milkdown editor:', error)
      })
    }
  }, [syncContent, syncMentionPicker, syncSlashPicker])

  useEffect(() => {
    const nextContent = normalizeLatexEscapes(initialContent ?? '')
    const previousPath = loadedNotePathRef.current
    const previousContent = contentRef.current

    initialContentRef.current = nextContent
    currentNotePathRef.current = currentNotePath
    loadedNotePathRef.current = currentNotePath

    if (previousPath === currentNotePath && previousContent === nextContent) {
      return
    }

    if (!editorRef.current || !editorReadyRef.current) {
      contentRef.current = nextContent
      return
    }

    suppressNextDirtySyncRef.current = true
    if (!runEditorActionSafely(replaceAll(nextContent))) {
      contentRef.current = nextContent
      return
    }
    syncContent(nextContent, false)
    if (hasFocusIntent()) {
      focus()
    }
  }, [currentNotePath, focus, hasFocusIntent, initialContent, runEditorActionSafely, syncContent])

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

        if (!runEditorActionSafely(insert(`\n![Pasted image](${imageUrl})\n`))) {
          return
        }
        root.querySelector<HTMLElement>('[contenteditable="true"]')?.focus()
      })()
    }

    root.addEventListener('paste', handlePaste, true)
    return () => {
      root.removeEventListener('paste', handlePaste, true)
    }
  }, [runEditorActionSafely])

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

    const handleSelectionChange = (): void => {
      syncMentionPicker()
      syncSlashPicker()
    }

    document.addEventListener('selectionchange', handleSelectionChange)
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange)
    }
  }, [syncMentionPicker, syncSlashPicker])

  return (
    <div
      data-testid="note-block-editor"
      data-vim-mode={vimModeEnabled ? vimMode : undefined}
      data-editor-read-only={readOnly ? 'true' : undefined}
      data-editor-ready={isEditorVisible ? 'true' : 'false'}
      data-editor-density={density}
      data-editor-background={background}
      className="motion-editor-surface relative h-full min-h-[10vh]"
      style={{ visibility: isEditorVisible ? 'visible' : 'hidden' }}
      onFocusCapture={(event) => {
        if (isEditorTarget(event.target)) {
          hasFocusIntentRef.current = true
        }
      }}
      onPointerDownCapture={(event) => {
        if (isEditorTarget(event.target)) {
          hasFocusIntentRef.current = true
        }
      }}
      onBlurCapture={(event) => {
        if (!isEditorTarget(event.relatedTarget)) {
          hasFocusIntentRef.current = false
        }
      }}
    >
      <div ref={rootRef} data-testid="note-milkdown-root" className="min-h-[10vh] h-full" />
      <SelectionPopover
        selectionMode="single"
        value=""
        options={slashOptions}
        onValueChange={handleSlashCommandSelect}
        label="Insert block"
        searchPlaceholder="Search commands"
        testId="note-slash-completion"
        contentClassName="note-editor-popover w-72 p-1"
        open={Boolean(slashPicker?.open)}
        onOpenChange={handleSlashPopoverOpenChange}
        searchValue={slashPicker?.query ?? ''}
        onSearchValueChange={handleSlashSearchValueChange}
        onCloseAutoFocus={handleSlashPopoverCloseAutoFocus}
        loop
        hideTrigger
        anchor={
          <span
            aria-hidden="true"
            className="pointer-events-none absolute h-px w-px"
            style={{ top: slashPicker?.top ?? 0, left: slashPicker?.left ?? 0 }}
          />
        }
      />
      <SelectionPopover
        selectionMode="single"
        value=""
        options={mentionOptions}
        onValueChange={handleMentionSelect}
        label="Link note"
        searchPlaceholder="Search notes"
        testId="note-link-completion"
        contentClassName="note-editor-popover w-72 p-1"
        open={Boolean(mentionPicker?.open)}
        onOpenChange={handleMentionPopoverOpenChange}
        searchValue={mentionPicker?.query ?? ''}
        onSearchValueChange={handleMentionSearchValueChange}
        onCloseAutoFocus={handleMentionPopoverCloseAutoFocus}
        loop
        selectOnTab
        hideTrigger
        anchor={
          <span
            aria-hidden="true"
            className="pointer-events-none absolute h-px w-px"
            style={{ top: mentionPicker?.top ?? 0, left: mentionPicker?.left ?? 0 }}
          />
        }
      />
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
