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
import type { Node as ProseNode, ResolvedPos } from '@milkdown/prose/model'
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
import { getMarkdown, insert, replaceAll } from '@milkdown/kit/utils'
import '@milkdown/crepe/theme/common/style.css'
import katex from 'katex'
import { Check } from './ui/icons'
import { NoteRawEditor, type NoteRawEditorHandle } from './NoteRawEditor'
import { SelectionPopover, type SelectionPopoverOption } from './ui/selection-popover'
import { WorkspaceTextFade } from './ui/workspace-text-fade'
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
import {
  createNoteEditorSnapshotScheduler,
  type NoteEditorSnapshotScheduler
} from '../lib/noteEditorSnapshotScheduler'
import { ensureEditorViewContext, hasReadyEditorView } from '../lib/milkdownEditorViewContext'
import {
  isMiddleMouseButton,
  isModifiedNotebookOpen,
  type NotebookOpenOptions
} from '../lib/notebookOpen'
import {
  NOTE_SLASH_COMMANDS,
  findNoteSlashTrigger,
  type NoteSlashCommandId
} from '../lib/noteSlashMenu'
import { resolveArrowReplacementForTextInput } from '../lib/noteArrowInputRules'
import { registerNoteCodeBlockView } from '../lib/noteCodeBlockView'
import { createNoteCodeBlockNavigationPlugin } from '../lib/noteCodeBlockNavigation'
import { createNoteCodeBlockSyntaxPlugin } from '../lib/noteCodeBlockSyntax'
import { createNoteVimModePlugin, type NoteVimMode } from '../lib/noteVimMode'
import { cn } from '../lib/utils'

export type NoteEditorMode = 'preview' | 'raw'

const NOTE_EDITOR_SNAPSHOT_DEBOUNCE_MS = 250
const NOTE_EDITOR_SNAPSHOT_MAX_WAIT_MS = 1000

interface EditorProps {
  initialContent?: string | null
  density?: 'default' | 'compact'
  background?: 'transparent' | 'inherit'
  className?: string
  mode?: NoteEditorMode
  readOnly?: boolean
  onDirty: () => void
  onReady?: () => void
  onSnapshotChange?: (snapshot: NoteEditorSnapshot) => void
  onDropFile: (sourcePath: string) => Promise<string | null>
  onPasteImage: (imageBlob: Blob, fileExtension: string) => Promise<string | null>
  notes: NoteListItem[]
  currentNotePath?: string
  onOpenNoteLink?: (target: string, options?: NotebookOpenOptions) => void
  onRawEditorElementChange?: (element: HTMLTextAreaElement | null) => void
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

interface DecorationRange {
  from: number
  to: number
}

interface DecorationTarget {
  node: ProseNode
  range: DecorationRange
}

interface TransactionLike {
  docChanged: boolean
  mapping: {
    maps: readonly {
      forEach: (
        callback: (oldStart: number, oldEnd: number, newStart: number, newEnd: number) => void
      ) => void
      map: (position: number, assoc?: number) => number
    }[]
  }
}

function getTransactionChangedRange(transaction: TransactionLike): DecorationRange | null {
  if (!transaction.docChanged) {
    return null
  }

  let from = Number.POSITIVE_INFINITY
  let to = Number.NEGATIVE_INFINITY

  transaction.mapping.maps.forEach((map, index) => {
    if (index > 0) {
      from = map.map(from, 1)
      to = map.map(to, -1)
    }

    map.forEach((_oldStart, _oldEnd, newStart, newEnd) => {
      from = Math.min(from, newStart)
      to = Math.max(to, newEnd)
    })
  })

  return from === Number.POSITIVE_INFINITY ? null : { from, to }
}

function getDecorationTarget(
  position: ResolvedPos,
  matches: (node: ProseNode) => boolean
): DecorationTarget | null {
  for (let depth = position.depth; depth > 0; depth -= 1) {
    const node = position.node(depth)
    if (matches(node)) {
      return {
        node,
        range: {
          from: position.before(depth),
          to: position.after(depth)
        }
      }
    }
  }

  return null
}

function rangesEqual(left: DecorationRange, right: DecorationRange): boolean {
  return left.from === right.from && left.to === right.to
}

function isRangeWithin(inner: DecorationRange, outer: DecorationRange): boolean {
  return inner.from >= outer.from && inner.to <= outer.to + 1
}

function refreshDecorationTarget(
  decorationSet: DecorationSet,
  doc: ProseNode,
  target: DecorationTarget,
  createDecorations: (node: ProseNode, pos: number) => Decoration[]
): DecorationSet {
  const staleDecorations = decorationSet.find(target.range.from, target.range.to)
  return decorationSet
    .remove(staleDecorations)
    .add(doc, createDecorations(target.node, target.range.from))
}

interface PreviewMarkdownBlock {
  node: ProseNode
  pos: number
}

interface PreviewMarkdownSerialization {
  content: string
  cache: Map<ProseNode, string>
}

const PREVIEW_SERIALIZATION_CHUNK_BUDGET_MS = 4

function getPreviewMarkdownBlocks(doc: ProseNode): PreviewMarkdownBlock[] {
  const blocks: PreviewMarkdownBlock[] = []
  doc.forEach((node, pos) => {
    blocks.push({ node, pos })
  })
  return blocks
}

function joinPreviewMarkdownBlocks(blocks: readonly string[]): string {
  if (blocks.length === 0) {
    return ''
  }

  const hasTrailingLineBreak = blocks.some((block) => block.endsWith('\n'))
  const normalizedBlocks = blocks.map((block) => block.replace(/\n+$/, ''))
  return `${normalizedBlocks.join('\n\n')}${hasTrailingLineBreak ? '\n' : ''}`
}

function serializePreviewMarkdownInChunks(
  editor: Crepe,
  previousCache: ReadonlyMap<ProseNode, string>,
  isCancelled: () => boolean
): Promise<PreviewMarkdownSerialization | null> {
  let blocks: PreviewMarkdownBlock[]
  try {
    const view = editor.editor.action((ctx) => ctx.get(editorViewCtx))
    blocks = getPreviewMarkdownBlocks(view.state.doc)
  } catch {
    return Promise.resolve(null)
  }

  const cache = new Map<ProseNode, string>()
  const serializedBlocks: string[] = []
  let blockIndex = 0

  return new Promise((resolve) => {
    const serializeChunk = (): void => {
      if (isCancelled()) {
        resolve(null)
        return
      }

      const chunkStartedAt = performance.now()
      try {
        while (
          blockIndex < blocks.length &&
          performance.now() - chunkStartedAt < PREVIEW_SERIALIZATION_CHUNK_BUDGET_MS
        ) {
          const block = blocks[blockIndex]
          const cachedMarkdown = previousCache.get(block.node)
          const markdown =
            cachedMarkdown ??
            editor.editor.action(
              getMarkdown({ from: block.pos, to: block.pos + block.node.nodeSize })
            )
          cache.set(block.node, markdown)
          serializedBlocks.push(markdown)
          blockIndex += 1
        }
      } catch {
        resolve(null)
        return
      }

      if (blockIndex < blocks.length) {
        window.requestAnimationFrame(serializeChunk)
        return
      }

      resolve({ content: joinPreviewMarkdownBlocks(serializedBlocks), cache })
    }

    serializeChunk()
  })
}

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

interface InlineLatexPluginState {
  decorations: DecorationSet
  isFocused: boolean
}

function appendInlineLatexDecorations(
  decorations: Decoration[],
  node: ProseNode,
  pos: number,
  selectionFrom: number,
  selectionTo: number,
  isFocused: boolean
): void {
  if (!node.isBlock || !node.inlineContent) {
    return
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
          class: cn('note-inline-latex-source', match.displayMode && 'note-display-latex-source')
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
}

function createInlineLatexDecorations(
  node: ProseNode,
  pos: number,
  selectionFrom: number,
  selectionTo: number,
  isFocused: boolean
): Decoration[] {
  const decorations: Decoration[] = []
  appendInlineLatexDecorations(decorations, node, pos, selectionFrom, selectionTo, isFocused)
  return decorations
}

function createInlineLatexDecorationSet(
  doc: ProseNode,
  selectionFrom: number,
  selectionTo: number,
  isFocused: boolean
): DecorationSet {
  const decorations: Decoration[] = []
  doc.descendants((node, pos) => {
    appendInlineLatexDecorations(decorations, node, pos, selectionFrom, selectionTo, isFocused)
    return true
  })
  return DecorationSet.create(doc, decorations)
}

function inlineLatexPreviewPlugin(): Plugin {
  return new Plugin({
    key: inlineLatexPreviewPluginKey,
    state: {
      init: (_config, state): InlineLatexPluginState => ({
        decorations: createInlineLatexDecorationSet(
          state.doc,
          state.selection.from,
          state.selection.to,
          false
        ),
        isFocused: false
      }),
      apply(transaction, previousState, oldState, newState): InlineLatexPluginState {
        const nextFocusState = transaction.getMeta(inlineLatexPreviewPluginKey)
        const isFocused =
          typeof nextFocusState === 'boolean' ? nextFocusState : previousState.isFocused
        const previousTarget = getDecorationTarget(oldState.selection.$from, (node) =>
          Boolean(node.isBlock && node.inlineContent)
        )
        const nextTarget = getDecorationTarget(newState.selection.$from, (node) =>
          Boolean(node.isBlock && node.inlineContent)
        )
        const selectionChanged = !oldState.selection.eq(newState.selection)
        const focusChanged = isFocused !== previousState.isFocused

        if (!transaction.docChanged && !selectionChanged && !focusChanged) {
          return previousState
        }

        let decorations = previousState.decorations
        if (transaction.docChanged) {
          decorations = decorations.map(transaction.mapping, newState.doc)
          const changedRange = getTransactionChangedRange(transaction)
          if (!changedRange) {
            return {
              decorations: createInlineLatexDecorationSet(
                newState.doc,
                newState.selection.from,
                newState.selection.to,
                isFocused
              ),
              isFocused
            }
          }

          if (!nextTarget) {
            if (previousTarget) {
              return {
                decorations: createInlineLatexDecorationSet(
                  newState.doc,
                  newState.selection.from,
                  newState.selection.to,
                  isFocused
                ),
                isFocused
              }
            }

            return { decorations, isFocused }
          }

          if (!isRangeWithin(changedRange, nextTarget.range)) {
            return {
              decorations: createInlineLatexDecorationSet(
                newState.doc,
                newState.selection.from,
                newState.selection.to,
                isFocused
              ),
              isFocused
            }
          }

          decorations = refreshDecorationTarget(
            decorations,
            newState.doc,
            nextTarget,
            (node, pos) =>
              createInlineLatexDecorations(
                node,
                pos,
                newState.selection.from,
                newState.selection.to,
                isFocused
              )
          )
        } else {
          const targets: DecorationTarget[] = []
          if (selectionChanged && previousTarget) {
            targets.push(previousTarget)
          }
          if ((selectionChanged || focusChanged) && nextTarget) {
            if (!targets.some((target) => rangesEqual(target.range, nextTarget.range))) {
              targets.push(nextTarget)
            }
          }

          for (const target of targets) {
            decorations = refreshDecorationTarget(decorations, newState.doc, target, (node, pos) =>
              createInlineLatexDecorations(
                node,
                pos,
                newState.selection.from,
                newState.selection.to,
                isFocused
              )
            )
          }
        }

        return { decorations, isFocused }
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
        return inlineLatexPreviewPluginKey.getState(state)?.decorations ?? DecorationSet.empty
      }
    }
  })
}

function appendNoteCalloutDecorations(
  decorations: Decoration[],
  node: ProseNode,
  pos: number,
  selectionFrom: number,
  selectionTo: number
): void {
  if (node.type.name !== 'blockquote') {
    return
  }

  const blockquoteInfo = getBlockquoteCalloutInfo(node, pos)
  if (!blockquoteInfo) {
    return
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
}

function createNoteCalloutDecorations(
  node: ProseNode,
  pos: number,
  selectionFrom: number,
  selectionTo: number
): Decoration[] {
  const decorations: Decoration[] = []
  appendNoteCalloutDecorations(decorations, node, pos, selectionFrom, selectionTo)
  return decorations
}

function createNoteCalloutDecorationSet(
  doc: ProseNode,
  selectionFrom: number,
  selectionTo: number
): DecorationSet {
  const decorations: Decoration[] = []
  doc.descendants((node, pos) => {
    appendNoteCalloutDecorations(decorations, node, pos, selectionFrom, selectionTo)
    return node.type.name !== 'blockquote'
  })
  return DecorationSet.create(doc, decorations)
}

function noteCalloutPlugin(): Plugin {
  return new Plugin({
    key: noteCalloutPluginKey,
    state: {
      init: (_config, state) => ({
        decorations: createNoteCalloutDecorationSet(
          state.doc,
          state.selection.from,
          state.selection.to
        )
      }),
      apply(transaction, previousState, oldState, newState) {
        const previousTarget = getDecorationTarget(
          oldState.selection.$from,
          (node) => node.type.name === 'blockquote'
        )
        const nextTarget = getDecorationTarget(
          newState.selection.$from,
          (node) => node.type.name === 'blockquote'
        )
        const selectionChanged = !oldState.selection.eq(newState.selection)

        if (!transaction.docChanged && !selectionChanged) {
          return previousState
        }

        let decorations = previousState.decorations
        if (transaction.docChanged) {
          decorations = decorations.map(transaction.mapping, newState.doc)
          const changedRange = getTransactionChangedRange(transaction)
          if (!changedRange) {
            return {
              decorations: createNoteCalloutDecorationSet(
                newState.doc,
                newState.selection.from,
                newState.selection.to
              )
            }
          }

          if (!nextTarget) {
            if (previousTarget) {
              return {
                decorations: createNoteCalloutDecorationSet(
                  newState.doc,
                  newState.selection.from,
                  newState.selection.to
                )
              }
            }

            return { decorations }
          }

          if (!isRangeWithin(changedRange, nextTarget.range)) {
            return {
              decorations: createNoteCalloutDecorationSet(
                newState.doc,
                newState.selection.from,
                newState.selection.to
              )
            }
          }

          decorations = refreshDecorationTarget(
            decorations,
            newState.doc,
            nextTarget,
            (node, pos) =>
              createNoteCalloutDecorations(
                node,
                pos,
                newState.selection.from,
                newState.selection.to
              )
          )
        } else {
          const targets: DecorationTarget[] = []
          if (previousTarget) {
            targets.push(previousTarget)
          }
          if (
            nextTarget &&
            !targets.some((target) => rangesEqual(target.range, nextTarget.range))
          ) {
            targets.push(nextTarget)
          }

          for (const target of targets) {
            decorations = refreshDecorationTarget(decorations, newState.doc, target, (node, pos) =>
              createNoteCalloutDecorations(
                node,
                pos,
                newState.selection.from,
                newState.selection.to
              )
            )
          }
        }

        return { decorations }
      }
    },
    props: {
      decorations(state) {
        return noteCalloutPluginKey.getState(state)?.decorations ?? DecorationSet.empty
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
    className,
    mode = 'preview',
    readOnly = false,
    onDirty,
    onReady,
    onSnapshotChange,
    onPasteImage,
    notes,
    currentNotePath,
    onOpenNoteLink,
    onRawEditorElementChange,
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
  const rawEditorRef = useRef<NoteRawEditorHandle | null>(null)
  const editorReadyRef = useRef(false)
  const currentNotePathRef = useRef(currentNotePath)
  const modeRef = useRef(mode)
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
  const [rawContent, setRawContent] = useState(initialContent ?? '')
  const [mentionPicker, setMentionPicker] = useState<MentionPickerState | null>(null)
  const [slashPicker, setSlashPicker] = useState<SlashPickerState | null>(null)
  const [vimMode, setVimMode] = useState<NoteVimMode>('insert')
  const hasFocusIntentRef = useRef(false)
  const onDirtyRef = useRef(onDirty)
  const onReadyRef = useRef(onReady)
  const onSnapshotChangeRef = useRef(onSnapshotChange)
  const onPasteImageRef = useRef(onPasteImage)
  const onOpenNoteLinkRef = useRef(onOpenNoteLink)
  const suppressNextDirtySyncRef = useRef(false)
  const previousModeRef = useRef<NoteEditorMode>(mode)
  const snapshotSchedulerRef = useRef<NoteEditorSnapshotScheduler | null>(null)
  const previewMarkdownCacheRef = useRef<Map<ProseNode, string>>(new Map())
  const previewSerializationVersionRef = useRef(0)

  const resolveNoteMentionTarget = useMemo(() => createNoteMentionResolver(notes), [notes])
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
            <WorkspaceTextFade className="font-medium">
              {getNoteDisplayName(note.relPath)}
            </WorkspaceTextFade>
            <WorkspaceTextFade className="text-xs opacity-75">
              {stripNoteExtension(note.relPath)}
            </WorkspaceTextFade>
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
    onReadyRef.current = onReady
  }, [onReady])

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

  const publishSnapshot = useCallback((content: string): void => {
    onSnapshotChangeRef.current?.({ content })
  }, [])

  const publishScheduledSnapshot = useCallback(
    (scheduledContent: string): void => {
      if (modeRef.current === 'preview') {
        const editor = editorRef.current
        if (editor && editorReadyRef.current) {
          const serializationVersion = previewSerializationVersionRef.current
          void serializePreviewMarkdownInChunks(
            editor,
            previewMarkdownCacheRef.current,
            () =>
              serializationVersion !== previewSerializationVersionRef.current ||
              modeRef.current !== 'preview'
          ).then((serialization) => {
            if (!serialization || serializationVersion !== previewSerializationVersionRef.current) {
              return
            }

            previewMarkdownCacheRef.current = serialization.cache
            const content = normalizeLatexEscapes(serialization.content)
            contentRef.current = content
            publishSnapshot(content)
          })
          return
        }
      }

      contentRef.current = scheduledContent
      publishSnapshot(scheduledContent)
    },
    [publishSnapshot]
  )

  useEffect(() => {
    const scheduler = createNoteEditorSnapshotScheduler({
      debounceMs: NOTE_EDITOR_SNAPSHOT_DEBOUNCE_MS,
      maxWaitMs: NOTE_EDITOR_SNAPSHOT_MAX_WAIT_MS,
      onFlush: publishScheduledSnapshot
    })
    snapshotSchedulerRef.current = scheduler

    return () => {
      previewSerializationVersionRef.current += 1
      scheduler.cancel()
      scheduler.dispose()
      snapshotSchedulerRef.current = null
    }
  }, [publishScheduledSnapshot])

  const flushPublishedSnapshot = useCallback((): void => {
    previewSerializationVersionRef.current += 1

    if (modeRef.current !== 'preview') {
      snapshotSchedulerRef.current?.flush()
      return
    }

    snapshotSchedulerRef.current?.cancel()

    const editor = editorRef.current
    if (!editor || !editorReadyRef.current) {
      return
    }

    const content = normalizeLatexEscapes(editor.getMarkdown())
    contentRef.current = content
    publishSnapshot(content)
  }, [publishSnapshot])

  const publishSnapshotNow = useCallback(
    (content: string): void => {
      const scheduler = snapshotSchedulerRef.current
      if (!scheduler) {
        publishSnapshot(content)
        return
      }

      previewSerializationVersionRef.current += 1
      scheduler.cancel()
      contentRef.current = content
      publishSnapshot(content)
    },
    [publishSnapshot]
  )

  const syncContent = useCallback((nextContent: string, dirty: boolean): void => {
    if (contentRef.current === nextContent) {
      return
    }

    contentRef.current = nextContent
    snapshotSchedulerRef.current?.schedule(nextContent)
    if (dirty) {
      onDirtyRef.current()
    }
  }, [])

  const syncRawContent = useCallback((nextContent: string): void => {
    if (contentRef.current === nextContent) {
      return
    }

    contentRef.current = nextContent
    snapshotSchedulerRef.current?.schedule(nextContent)
    onDirtyRef.current()
  }, [])

  const handleRawContentChange = useCallback(
    (nextContent: string): void => {
      syncRawContent(nextContent)
    },
    [syncRawContent]
  )

  const handleRawVimModeChange = useCallback((nextMode: NoteVimMode): void => {
    setVimMode(nextMode)
    onVimModeChangeRef.current?.(nextMode)
  }, [])

  const isEditorTarget = useCallback((target: EventTarget | null): boolean => {
    const root = rootRef.current
    if (!root || !(target instanceof Node)) {
      return false
    }

    const editable = root.querySelector<HTMLElement>('[contenteditable="true"]')
    const rawEditor = root.parentElement?.querySelector<HTMLElement>(
      '[data-note-raw-editor="true"]'
    )
    return Boolean(
      (editable && editable.contains(target)) || (rawEditor && rawEditor.contains(target))
    )
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
    if (modeRef.current === 'raw') {
      rawEditorRef.current?.focus()
      return
    }

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
    rawEditorRef.current?.blur()
  }, [])

  const jumpToOutlineIndex = useCallback(
    (index: number): void => {
      const root = rootRef.current
      if (!root || index < 0) {
        return
      }

      if (modeRef.current === 'raw') {
        rawEditorRef.current?.jumpToOutlineIndex(index)
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

  const serializePreviewSnapshot = useCallback(async (): Promise<string> => {
    const editor = editorRef.current
    if (!editor || !editorReadyRef.current || modeRef.current !== 'preview') {
      return contentRef.current
    }

    snapshotSchedulerRef.current?.cancel()
    const serializationVersion = ++previewSerializationVersionRef.current

    const serialization = await serializePreviewMarkdownInChunks(
      editor,
      previewMarkdownCacheRef.current,
      () =>
        serializationVersion !== previewSerializationVersionRef.current ||
        modeRef.current !== 'preview'
    )
    if (serialization && serializationVersion === previewSerializationVersionRef.current) {
      previewMarkdownCacheRef.current = serialization.cache
      return serialization.content
    }

    try {
      return editor.getMarkdown()
    } catch {
      return contentRef.current
    }
  }, [])

  const createSnapshot = useCallback(async (): Promise<NoteEditorSnapshot> => {
    if (modeRef.current === 'raw') {
      const content = contentRef.current
      publishSnapshotNow(content)
      return { content }
    }

    const content = await serializePreviewSnapshot()

    const normalizedContent = normalizeNoteMentionMarkdown(normalizeLatexEscapes(content))
    syncContent(normalizedContent, false)
    publishSnapshotNow(normalizedContent)
    return { content: normalizedContent }
  }, [publishSnapshotNow, serializePreviewSnapshot, syncContent])

  const captureSnapshot = useCallback(
    (): Promise<NoteEditorSnapshot> => createSnapshot(),
    [createSnapshot]
  )

  const flushPendingChanges = useCallback(
    (): Promise<NoteEditorSnapshot> => createSnapshot(),
    [createSnapshot]
  )

  useEffect(() => {
    const previousMode = previousModeRef.current
    if (previousMode !== mode) {
      flushPublishedSnapshot()
      if (mode === 'raw') {
        setRawContent(contentRef.current)
      }
    }

    modeRef.current = mode
    previousModeRef.current = mode
  }, [flushPublishedSnapshot, mode])

  const capturePrintableDocument = useCallback((): {
    html: string
    images: NotePdfExportImage[]
  } | null => {
    if (modeRef.current === 'raw') {
      const editor = editorRef.current
      if (editor && editorReadyRef.current && editor.getMarkdown() !== contentRef.current) {
        suppressNextDirtySyncRef.current = true
        if (!runEditorActionSafely(replaceAll(contentRef.current))) {
          suppressNextDirtySyncRef.current = false
        }
      }
    }

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
  }, [runEditorActionSafely])

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
      flushPublishedSnapshot()
      const nextContent = normalizeLatexEscapes(content ?? '')
      const samePath = loadedNotePathRef.current === notePath
      const sameContent = contentRef.current === nextContent

      loadedNotePathRef.current = notePath
      currentNotePathRef.current = notePath
      initialContentRef.current = nextContent

      if (!editorRef.current || !editorReadyRef.current) {
        contentRef.current = nextContent
        setRawContent(nextContent)
        if (!sameContent) {
          publishSnapshotNow(nextContent)
        }
        return
      }

      if (samePath && sameContent) {
        return
      }

      suppressNextDirtySyncRef.current = true
      if (!runEditorActionSafely(replaceAll(nextContent))) {
        contentRef.current = nextContent
        setRawContent(nextContent)
        return
      }
      syncContent(nextContent, false)
      setRawContent(nextContent)
      publishSnapshotNow(nextContent)
      dismissedMentionTriggerRef.current = null
      closeMentionPicker()
      closeSlashPicker()

      if (preserveFocus) {
        focus()
      }
    },
    [
      closeMentionPicker,
      closeSlashPicker,
      focus,
      flushPublishedSnapshot,
      publishSnapshotNow,
      runEditorActionSafely,
      syncContent
    ]
  )

  useEffect(() => {
    if (mode !== 'preview') {
      return
    }

    const editor = editorRef.current
    if (!editor || !editorReadyRef.current) {
      return
    }

    const nextContent = contentRef.current
    if (editor.getMarkdown() === nextContent) {
      return
    }

    suppressNextDirtySyncRef.current = true
    if (!runEditorActionSafely(replaceAll(nextContent))) {
      suppressNextDirtySyncRef.current = false
    }
  }, [mode, runEditorActionSafely])

  const insertNoteLink = useCallback(
    (targetRelPath: string): void => {
      if (modeRef.current === 'raw') {
        rawEditorRef.current?.insertText(`[[${stripNoteExtension(targetRelPath)}]]`)
        return
      }

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
    if (modeRef.current === 'raw' || !editor || !editorReadyRef.current || !root) {
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
        const { from, empty, $from } = state.selection

        if (!empty) {
          dismissedMentionTriggerRef.current = null
          closeMentionPicker()
          return
        }

        const lookBehindStart = Math.max(0, $from.parentOffset - 100)
        const textBefore = $from.parent.textBetween(lookBehindStart, $from.parentOffset, '\n', '\0')
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
    if (modeRef.current === 'raw' || !editor || !editorReadyRef.current || !root) {
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
    root.replaceChildren()
    previewMarkdownCacheRef.current.clear()
    previewSerializationVersionRef.current += 1
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
        [CrepeFeature.ListItem]: {
          bulletIcon: '•'
        },
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
        new Plugin({
          props: {
            attributes: {
              spellcheck: 'false'
            }
          },
          view: () => ({
            update: (view, previousState) => {
              const docChanged = view.state.doc !== previousState.doc
              const selectionChanged = !view.state.selection.eq(previousState.selection)
              if (!docChanged && !selectionChanged) {
                return
              }

              if (docChanged) {
                const shouldMarkDirty = editorReadyRef.current && !suppressNextDirtySyncRef.current
                suppressNextDirtySyncRef.current = false
                previewSerializationVersionRef.current += 1
                snapshotSchedulerRef.current?.schedule('preview')
                if (shouldMarkDirty) {
                  onDirtyRef.current()
                }
              }

              syncMentionPicker()
              syncSlashPicker()
            }
          })
        }),
        inlineLatexPreviewPlugin(),
        noteCalloutPlugin(),
        createNoteCodeBlockSyntaxPlugin(),
        createNoteCodeBlockNavigationPlugin(),
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
    setRawContent(initialValue)
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
          syncContent(nextContent, false)
          setIsEditorVisible(true)
          onReadyRef.current?.()
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

    if (previousPath !== currentNotePath || previousContent !== nextContent) {
      flushPublishedSnapshot()
    }

    initialContentRef.current = nextContent
    currentNotePathRef.current = currentNotePath
    loadedNotePathRef.current = currentNotePath

    if (previousPath === currentNotePath && previousContent === nextContent) {
      return
    }

    if (!editorRef.current || !editorReadyRef.current) {
      contentRef.current = nextContent
      window.requestAnimationFrame(() => {
        if (contentRef.current === nextContent) {
          setRawContent(nextContent)
        }
      })
      return
    }

    suppressNextDirtySyncRef.current = true
    if (!runEditorActionSafely(replaceAll(nextContent))) {
      contentRef.current = nextContent
      window.requestAnimationFrame(() => {
        if (contentRef.current === nextContent) {
          setRawContent(nextContent)
        }
      })
      return
    }
    contentRef.current = nextContent
    window.requestAnimationFrame(() => {
      if (contentRef.current === nextContent) {
        setRawContent(nextContent)
      }
    })
    publishSnapshotNow(nextContent)
    if (hasFocusIntent()) {
      focus()
    }
  }, [
    currentNotePath,
    focus,
    hasFocusIntent,
    initialContent,
    flushPublishedSnapshot,
    publishSnapshotNow,
    runEditorActionSafely
  ])

  useEffect(() => {
    const root = rootRef.current
    const editorHost = root?.parentElement
    if (!root || !editorHost) {
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
        if (!imageUrl) {
          return
        }

        if (modeRef.current === 'raw') {
          rawEditorRef.current?.insertText(`\n![Pasted image](${imageUrl})\n`)
          return
        }

        if (!editorRef.current || !editorReadyRef.current) {
          return
        }

        if (!runEditorActionSafely(insert(`\n![Pasted image](${imageUrl})\n`))) {
          return
        }
        root.querySelector<HTMLElement>('[contenteditable="true"]')?.focus()
      })()
    }

    editorHost.addEventListener('paste', handlePaste, true)
    return () => {
      editorHost.removeEventListener('paste', handlePaste, true)
    }
  }, [runEditorActionSafely])

  useEffect(() => {
    const root = rootRef.current
    if (!root) {
      return
    }

    const handleNoteLinkOpen = (event: MouseEvent): void => {
      if (event.type === 'auxclick' && !isMiddleMouseButton(event)) {
        return
      }

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

      const openInNewTab = isMiddleMouseButton(event) || isModifiedNotebookOpen(event)

      event.preventDefault()
      event.stopPropagation()
      onOpenNoteLinkRef.current?.(noteTarget, { openInNewTab })
    }

    root.addEventListener('click', handleNoteLinkOpen, true)
    root.addEventListener('auxclick', handleNoteLinkOpen, true)
    return () => {
      root.removeEventListener('click', handleNoteLinkOpen, true)
      root.removeEventListener('auxclick', handleNoteLinkOpen, true)
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
      data-editor-mode={mode}
      data-editor-read-only={readOnly ? 'true' : undefined}
      data-editor-ready={isEditorVisible ? 'true' : 'false'}
      data-editor-density={density}
      data-editor-background={background}
      className={cn(
        'motion-editor-surface relative',
        mode === 'preview' ? 'h-full min-h-[10vh]' : 'h-full min-h-0',
        className
      )}
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
      <div
        ref={rootRef}
        data-testid="note-milkdown-root"
        className={cn('min-h-[10vh] h-full', mode === 'preview' ? undefined : 'hidden')}
        aria-hidden={mode !== 'preview'}
      />
      <NoteRawEditor
        ref={rawEditorRef}
        value={rawContent}
        active={mode === 'raw'}
        readOnly={readOnly}
        vimModeEnabled={vimModeEnabled}
        vimKeyMappings={vimKeyMappings}
        onChange={handleRawContentChange}
        onVimModeChange={handleRawVimModeChange}
        onEditorElementChange={onRawEditorElementChange}
      />
      <SelectionPopover
        selectionMode="single"
        value=""
        options={slashOptions}
        onValueChange={handleSlashCommandSelect}
        label="Insert block"
        searchPlaceholder="Search commands"
        testId="note-slash-completion"
        contentClassName="note-editor-popover w-72 p-1"
        open={mode === 'preview' && Boolean(slashPicker?.open)}
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
        open={mode === 'preview' && Boolean(mentionPicker?.open)}
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
