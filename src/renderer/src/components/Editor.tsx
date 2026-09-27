import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactElement
} from 'react'
import { autocompletion, type Completion, type CompletionContext } from '@codemirror/autocomplete'
import {
  defaultKeymap,
  deleteCharBackward,
  deleteCharForward,
  history,
  historyKeymap,
  indentWithTab
} from '@codemirror/commands'
import { bracketMatching, indentOnInput, syntaxHighlighting } from '@codemirror/language'
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search'
import { Compartment, EditorSelection, EditorState, Prec, type Extension } from '@codemirror/state'
import {
  crosshairCursor,
  drawSelection,
  dropCursor,
  EditorView,
  highlightActiveLine,
  keymap,
  placeholder,
  rectangularSelection
} from '@codemirror/view'
import { getCM, vim, Vim } from '@replit/codemirror-vim'
import { getNoteDisplayName, stripNoteExtension } from '../../../shared/noteDocument'
import type { NoteListItem, NoteVimKeyMapping } from '../../../shared/types'
import {
  createNoteMentionResolver,
  noteMentionHref,
  parseNoteMentionHref
} from '../../../shared/noteMentions'
import type { NoteEditorSnapshot } from '../lib/noteEditorSession'
import {
  createNoteEditorSnapshotScheduler,
  type NoteEditorSnapshotScheduler
} from '../lib/noteEditorSnapshotScheduler'
import {
  isMiddleMouseButton,
  isModifiedNotebookOpen,
  type NotebookOpenOptions
} from '../lib/notebookOpen'
import { noteEditorTabWidth, sharedEditorIndentation } from '../lib/editorIndentation'
import {
  migrateMarkdownIndentationToTabs,
  type MarkdownIndentationMigrationResult
} from '../lib/noteIndentationMigration'
import { noteMarkdownHighlightStyle } from '../lib/noteMarkdownHighlightStyle'
import { noteMarkdownLanguage } from '../lib/noteMarkdownLanguage'
import { getMarkdownLineBreakText } from '../lib/noteMarkdownLineBreak'
import {
  expandMarkdownCodeBlockDeletion,
  findMarkdownCodeBlockAt,
  findMarkdownCodeBlocks,
  getMarkdownCodeFencePairCompletion,
  getMarkdownCodeFenceCompletion,
  isMarkdownCodeBlockEmpty
} from '../lib/noteMarkdownCodeBlock'
import { noteLivePreview } from '../lib/noteLivePreview'
import { NOTE_SLASH_COMMANDS, type NoteSlashCommandId } from '../lib/noteSlashMenu'
import { cn } from '../lib/utils'

export type NoteEditorMode = 'live' | 'source'
export type NoteVimMode = 'insert' | 'normal' | 'visual' | 'visualLine'

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
  vimModeEnabled: boolean
  vimKeyMappings: NoteVimKeyMapping[]
  onVimModeChange?: (mode: NoteVimMode) => void
}

export interface NoteEditorHandle {
  captureSnapshot: () => Promise<NoteEditorSnapshot>
  flushPendingChanges: () => Promise<NoteEditorSnapshot>
  migrateIndentationToTabs: () => MarkdownIndentationMigrationResult
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

const VIM_ACTION_KEYS: Record<NoteVimKeyMapping['action'], string> = {
  enterNormalMode: '<Esc>',
  enterInsertMode: 'i',
  appendAfterCursor: 'a',
  appendLineEnd: 'A',
  openLineBelow: 'o',
  openLineAbove: 'O',
  pasteAfterCursor: 'p',
  pasteBeforeCursor: 'P',
  deleteSelection: 'd',
  yankSelection: 'y'
}

const installedVimMappings = new Map<
  string,
  { sequence: string; mode: string; action: NoteVimKeyMapping['action'] }
>()

function installVimMappings(mappings: readonly NoteVimKeyMapping[]): void {
  const requestedMappings = new Map<
    string,
    { sequence: string; mode: string; action: NoteVimKeyMapping['action'] }
  >()
  for (const mapping of mappings) {
    const mode = mapping.mode === 'visualLine' ? 'visual' : mapping.mode
    requestedMappings.set(`${mode}:${mapping.sequence}`, {
      sequence: mapping.sequence,
      mode,
      action: mapping.action
    })
  }

  for (const [key, installed] of installedVimMappings) {
    const requested = requestedMappings.get(key)
    if (requested?.action === installed.action) continue
    Vim.unmap(installed.sequence, installed.mode)
    installedVimMappings.delete(key)
  }

  for (const [key, requested] of requestedMappings) {
    if (installedVimMappings.has(key)) continue
    Vim.map(requested.sequence, VIM_ACTION_KEYS[requested.action], requested.mode)
    installedVimMappings.set(key, requested)
  }
}

function getImageFileExtension(file: File): string | null {
  const byMime: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'image/bmp': 'bmp'
  }
  const fromMime = byMime[file.type.trim().toLowerCase()]
  if (fromMime) return fromMime
  const extension = file.name.split('.').pop()?.trim().toLowerCase()
  return extension && extension !== file.name ? extension : null
}

function insertHardBreak(view: EditorView): boolean {
  const changes = view.state.changeByRange((range) => {
    const insert = getMarkdownLineBreakText(view.state, range.from)
    return {
      changes: { from: range.from, to: range.to, insert },
      range: EditorSelection.cursor(range.from + insert.length)
    }
  })
  view.dispatch(changes)
  return true
}

function insertMarkdownCodeFenceOnEnter(view: EditorView): boolean {
  if (view.state.readOnly) return false
  let inserted = false
  const changes = view.state.changeByRange((range) => {
    const completion = getMarkdownCodeFenceCompletion(view.state.doc, range.from)
    if (range.from !== range.to || !completion) return { range }
    inserted = true
    return {
      changes: {
        from: completion.from,
        to: completion.to,
        insert: completion.insert
      },
      range: EditorSelection.cursor(completion.cursor)
    }
  })
  if (!inserted) return false
  view.dispatch(changes)
  return true
}

function insertTypedMarkdownCodeFencePair(view: EditorView): void {
  if (view.state.readOnly) return
  const range = view.state.selection.main
  if (!range.empty) return

  const completion = getMarkdownCodeFencePairCompletion(view.state.doc, range.head)
  if (!completion) return

  view.dispatch({
    changes: {
      from: completion.from,
      to: completion.to,
      insert: completion.insert
    },
    selection: { anchor: completion.cursor },
    userEvent: 'input.code-fence',
    scrollIntoView: true
  })
}

function enterAdjacentMarkdownCodeBlock(
  view: EditorView,
  direction: 'up' | 'down' | 'left' | 'right'
): boolean {
  const { state } = view
  const selection = state.selection.main
  if (!selection.empty || state.selection.ranges.length !== 1) return false

  const line = state.doc.lineAt(selection.head)
  const blocks = findMarkdownCodeBlocks(state.doc)

  for (const block of blocks) {
    const blockIsAlreadyRevealed = state.selection.ranges.some(
      (range) => range.from <= block.to && range.to >= block.from
    )
    if (blockIsAlreadyRevealed) continue

    const openingLine = state.doc.lineAt(block.from)
    const closingLine = state.doc.lineAt(block.to)

    if (
      (direction === 'down' && openingLine.number === line.number + 1) ||
      (direction === 'right' && block.from === line.to + 1)
    ) {
      view.dispatch({ selection: { anchor: block.bodyFrom }, scrollIntoView: true })
      return true
    }

    if (
      (direction === 'up' && closingLine.number === line.number - 1) ||
      (direction === 'left' && block.to + 1 === line.from)
    ) {
      view.dispatch({ selection: { anchor: block.bodyTo }, scrollIntoView: true })
      return true
    }
  }

  return false
}

function handleVimMarkdownCodeBlockNavigation(event: KeyboardEvent, view: EditorView): boolean {
  const cm = getCM(view)
  const vimState = cm?.state.vim
  if (!vimState || vimState.insertMode || vimState.visualMode) return false
  if (
    event.defaultPrevented ||
    event.metaKey ||
    event.ctrlKey ||
    event.altKey ||
    event.shiftKey ||
    vimState.inputState.operator ||
    vimState.inputState.motion ||
    vimState.inputState.prefixRepeat.length > 0 ||
    vimState.inputState.motionRepeat.length > 0 ||
    vimState.inputState.keyBuffer.length > 0
  ) {
    return false
  }

  const directionByKey: Record<string, 'up' | 'down' | 'left' | 'right'> = {
    ArrowUp: 'up',
    ArrowDown: 'down',
    ArrowLeft: 'left',
    ArrowRight: 'right',
    j: 'down',
    k: 'up',
    h: 'left',
    l: 'right'
  }
  const direction = directionByKey[event.key]
  if (!direction || !enterAdjacentMarkdownCodeBlock(view, direction)) return false

  event.preventDefault()
  event.stopPropagation()
  return true
}

function deleteMarkdownCodeBlock(view: EditorView, direction: 'backward' | 'forward'): boolean {
  if (view.state.readOnly) return false
  const blocks = findMarkdownCodeBlocks(view.state.doc)
  const hasCodeBlockSelection = view.state.selection.ranges.some((range) => {
    if (range.empty) {
      const block = findMarkdownCodeBlockAt(blocks, range.from)
      return Boolean(block && isMarkdownCodeBlockEmpty(block))
    }
    return blocks.some((block) => range.from < block.to && range.to > block.from)
  })
  if (!hasCodeBlockSelection) {
    return direction === 'backward' ? deleteCharBackward(view) : deleteCharForward(view)
  }

  let handled = false
  const changes = view.state.changeByRange((range) => {
    if (!range.empty) {
      const expanded = expandMarkdownCodeBlockDeletion(blocks, range.from, range.to)
      const touchesCodeBlock = blocks.some(
        (block) => range.from < block.to && range.to > block.from
      )
      if (touchesCodeBlock) {
        handled = true
        return {
          changes: { from: expanded.from, to: expanded.to },
          range: EditorSelection.cursor(expanded.from)
        }
      }
      return {
        changes: { from: range.from, to: range.to },
        range: EditorSelection.cursor(range.from)
      }
    }

    const block = findMarkdownCodeBlockAt(blocks, range.from)
    if (block && isMarkdownCodeBlockEmpty(block)) {
      handled = true
      return {
        changes: { from: block.from, to: block.to },
        range: EditorSelection.cursor(block.from)
      }
    }
    return { range }
  })

  if (!handled) return direction === 'backward' ? deleteCharBackward(view) : deleteCharForward(view)
  view.dispatch(changes)
  return true
}

function slashCommandSource(command: NoteSlashCommandId): string {
  const snippets: Record<NoteSlashCommandId, string> = {
    text: '',
    heading1: '# ',
    heading2: '## ',
    heading3: '### ',
    bulletList: '- ',
    numberedList: '1. ',
    taskList: '- [ ] ',
    quote: '> ',
    codeBlock: '```\n\n```',
    divider: '---',
    table: '| Column 1 | Column 2 |\n| --- | --- |\n|  |  |'
  }
  return snippets[command]
}

function getVimMode(view: EditorView, enabled: boolean): NoteVimMode {
  if (!enabled) return 'insert'
  const state = getCM(view)?.state.vim
  if (!state) return 'normal'
  if (state.insertMode) return 'insert'
  if (state.visualMode && state.visualLine) return 'visualLine'
  if (state.visualMode) return 'visual'
  return 'normal'
}

const editorTheme = EditorView.theme({
  '&': {
    height: '100%',
    backgroundColor: 'transparent',
    color: 'var(--foreground)',
    fontFamily: 'var(--app-font-family)',
    fontSize: 'var(--note-editor-body-font-size)'
  },
  '.cm-scroller': {
    overflow: 'visible',
    fontFamily: 'inherit',
    lineHeight: 'var(--note-editor-body-line-height)'
  },
  '.cm-content': {
    minHeight: '10vh',
    padding: '0.25rem 0 4rem',
    caretColor: 'var(--note-editor-blinking-cursor)'
  },
  '.cm-line': {
    minHeight: 'var(--note-editor-body-row-height)',
    padding: '1px 0'
  },
  '.cm-cursor': {
    borderLeftColor: 'var(--note-editor-blinking-cursor) !important'
  },
  '.cm-dropCursor': {
    borderLeftColor: 'var(--note-editor-cursor) !important'
  },
  '.cm-fat-cursor': {
    backgroundColor: 'var(--note-editor-cursor) !important',
    color: 'var(--note-editor-cursor-foreground) !important'
  },
  '&:not(.cm-focused) .cm-fat-cursor': {
    backgroundColor: 'transparent !important',
    color: 'transparent !important',
    outline: 'solid 1px var(--note-editor-cursor) !important'
  },
  '&.cm-focused': { outline: 'none' },
  '&.cm-focused .cm-selectionBackground, ::selection': {
    backgroundColor: 'var(--note-editor-selection) !important',
    color: 'var(--note-editor-selection-foreground) !important'
  },
  '.cm-activeLine': { backgroundColor: 'transparent' },
  '.cm-panels': {
    backgroundColor: 'var(--popover)',
    color: 'var(--popover-foreground)'
  },
  '.cm-tooltip': {
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    backgroundColor: 'var(--popover)',
    color: 'var(--popover-foreground)',
    overflow: 'hidden'
  },
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
    backgroundColor: 'var(--accent)',
    color: 'var(--accent-foreground)'
  }
})

export const Editor = forwardRef<NoteEditorHandle, EditorProps>(function Editor(
  {
    initialContent,
    density = 'default',
    background = 'transparent',
    className,
    mode = 'live',
    readOnly = false,
    onDirty,
    onReady,
    onSnapshotChange,
    onDropFile,
    onPasteImage,
    notes,
    currentNotePath,
    onOpenNoteLink,
    vimModeEnabled,
    vimKeyMappings,
    onVimModeChange
  },
  ref
): ReactElement {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  const initialContentRef = useRef(initialContent ?? '')
  const initialNotePathRef = useRef(currentNotePath)
  const contentRef = useRef(initialContent ?? '')
  const loadedNotePathRef = useRef(currentNotePath)
  const hasFocusIntentRef = useRef(false)
  const suppressDirtyRef = useRef(false)
  const onDirtyRef = useRef(onDirty)
  const onReadyRef = useRef(onReady)
  const onSnapshotChangeRef = useRef(onSnapshotChange)
  const onPasteImageRef = useRef(onPasteImage)
  const onDropFileRef = useRef(onDropFile)
  const onOpenNoteLinkRef = useRef(onOpenNoteLink)
  const vimEnabledRef = useRef(vimModeEnabled)
  const vimMappingsRef = useRef(vimKeyMappings)
  const readOnlyRef = useRef(readOnly)
  const modeRef = useRef(mode)
  const onVimModeChangeRef = useRef(onVimModeChange)
  const currentVimModeRef = useRef<NoteVimMode | null>(null)
  const snapshotSchedulerRef = useRef<NoteEditorSnapshotScheduler | null>(null)
  const modeCompartmentRef = useRef(new Compartment())
  const vimCompartmentRef = useRef(new Compartment())
  const readOnlyCompartmentRef = useRef(new Compartment())
  const [ready, setReady] = useState(false)
  const [vimMode, setVimMode] = useState<NoteVimMode>(vimModeEnabled ? 'normal' : 'insert')

  const noteResolver = useMemo(() => createNoteMentionResolver(notes), [notes])
  const notesRef = useRef(notes)
  const noteResolverRef = useRef(noteResolver)

  useEffect(() => {
    onDirtyRef.current = onDirty
    onReadyRef.current = onReady
    onSnapshotChangeRef.current = onSnapshotChange
    onPasteImageRef.current = onPasteImage
    onDropFileRef.current = onDropFile
    onOpenNoteLinkRef.current = onOpenNoteLink
    onVimModeChangeRef.current = onVimModeChange
    notesRef.current = notes
    noteResolverRef.current = noteResolver
  }, [
    noteResolver,
    notes,
    onDirty,
    onDropFile,
    onOpenNoteLink,
    onPasteImage,
    onReady,
    onSnapshotChange,
    onVimModeChange
  ])

  const publishSnapshot = useCallback((content: string): void => {
    onSnapshotChangeRef.current?.({ content })
  }, [])

  useEffect(() => {
    snapshotSchedulerRef.current = createNoteEditorSnapshotScheduler({
      debounceMs: NOTE_EDITOR_SNAPSHOT_DEBOUNCE_MS,
      maxWaitMs: NOTE_EDITOR_SNAPSHOT_MAX_WAIT_MS,
      onFlush: publishSnapshot
    })
    return () => snapshotSchedulerRef.current?.dispose()
  }, [publishSnapshot])

  const completionSource = useCallback((context: CompletionContext) => {
    const mention = context.matchBefore(/\[\[[^\]\n]*/)
    if (mention) {
      const query = mention.text.slice(2).trim().toLowerCase()
      const options: Completion[] = notesRef.current
        .filter((note) => {
          const haystack =
            `${getNoteDisplayName(note.relPath)} ${stripNoteExtension(note.relPath)}`.toLowerCase()
          return !query || haystack.includes(query)
        })
        .slice(0, 100)
        .map((note) => ({
          label: getNoteDisplayName(note.relPath),
          detail: stripNoteExtension(note.relPath),
          type: 'text',
          apply: (view, _completion, from, to) => {
            const insert = `[[${note.relPath}]]`
            view.dispatch({
              changes: { from, to, insert },
              selection: { anchor: from + insert.length }
            })
          }
        }))
      return { from: mention.from, options, filter: true }
    }

    const slash = context.matchBefore(/(?:^|\s)\/[a-z0-9-]*$/i)
    if (!slash) return null
    const slashOffset = slash.text.lastIndexOf('/')
    const from = slash.from + slashOffset
    const options: Completion[] = NOTE_SLASH_COMMANDS.map((command) => ({
      label: command.label,
      detail: command.keywords.join(', '),
      type: 'keyword',
      apply: (view, _completion, applyFrom, to) => {
        const insert = slashCommandSource(command.id)
        const cursorOffset = command.id === 'codeBlock' ? 4 : insert.length
        view.dispatch({
          changes: { from: applyFrom, to, insert },
          selection: { anchor: applyFrom + cursorOffset }
        })
      }
    }))
    return { from, options, filter: true }
  }, [])

  const reportVimModeValue = useCallback((nextMode: NoteVimMode): void => {
    if (currentVimModeRef.current === nextMode) return
    currentVimModeRef.current = nextMode
    setVimMode(nextMode)
    onVimModeChangeRef.current?.(nextMode)
  }, [])

  const reportVimMode = useCallback(
    (view: EditorView): void => {
      reportVimModeValue(getVimMode(view, vimEnabledRef.current))
    },
    [reportVimModeValue]
  )

  const getLivePreviewExtensions = useCallback(
    (): Extension => (modeRef.current === 'live' ? noteLivePreview() : []),
    []
  )

  const buildExtensions = useCallback((): Extension[] => {
    return [
      vimCompartmentRef.current.of(vimEnabledRef.current ? vim({ status: false }) : []),
      Prec.highest(
        EditorView.domEventHandlers({
          keydown: handleVimMarkdownCodeBlockNavigation
        })
      ),
      history(),
      drawSelection(),
      dropCursor(),
      rectangularSelection(),
      crosshairCursor(),
      highlightActiveLine(),
      highlightSelectionMatches(),
      indentOnInput(),
      bracketMatching(),
      sharedEditorIndentation,
      noteEditorTabWidth,
      EditorState.allowMultipleSelections.of(true),
      EditorView.lineWrapping,
      noteMarkdownLanguage,
      syntaxHighlighting(noteMarkdownHighlightStyle, { fallback: true }),
      autocompletion({ override: [completionSource], activateOnTyping: true }),
      placeholder('Type / for commands'),
      keymap.of([
        { key: 'ArrowUp', run: (view) => enterAdjacentMarkdownCodeBlock(view, 'up') },
        { key: 'ArrowDown', run: (view) => enterAdjacentMarkdownCodeBlock(view, 'down') },
        { key: 'ArrowLeft', run: (view) => enterAdjacentMarkdownCodeBlock(view, 'left') },
        { key: 'ArrowRight', run: (view) => enterAdjacentMarkdownCodeBlock(view, 'right') },
        { key: 'Enter', run: insertMarkdownCodeFenceOnEnter },
        { key: 'Shift-Enter', run: insertHardBreak },
        { key: 'Backspace', run: (view) => deleteMarkdownCodeBlock(view, 'backward') },
        { key: 'Delete', run: (view) => deleteMarkdownCodeBlock(view, 'forward') },
        indentWithTab,
        ...defaultKeymap,
        ...historyKeymap,
        ...searchKeymap
      ]),
      modeCompartmentRef.current.of(getLivePreviewExtensions()),
      readOnlyCompartmentRef.current.of(EditorState.readOnly.of(readOnlyRef.current)),
      editorTheme,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          const content = update.state.doc.toString()
          contentRef.current = content
          snapshotSchedulerRef.current?.schedule(content)
          if (!suppressDirtyRef.current) onDirtyRef.current()
          suppressDirtyRef.current = false

          if (update.transactions.some((transaction) => transaction.isUserEvent('input.type'))) {
            queueMicrotask(() => {
              if (viewRef.current === update.view) insertTypedMarkdownCodeFencePair(update.view)
            })
          }
        }
        reportVimMode(update.view)
      }),
      EditorView.domEventHandlers({
        paste: (event, view) => {
          const imageItem = Array.from(event.clipboardData?.items ?? []).find((item) =>
            item.type.startsWith('image/')
          )
          const file = imageItem?.getAsFile()
          const extension = file ? getImageFileExtension(file) : null
          if (!file || !extension) return false
          event.preventDefault()
          void onPasteImageRef.current(file, extension).then((imageUrl) => {
            if (!imageUrl) return
            const position = view.state.selection.main.head
            const insert = `\n![Pasted image](${imageUrl})\n`
            view.dispatch({
              changes: { from: position, insert },
              selection: { anchor: position + insert.length }
            })
          })
          return true
        },
        drop: (event, view) => {
          const file = event.dataTransfer?.files.item(0) as (File & { path?: string }) | null
          if (!file?.path) return false
          event.preventDefault()
          void onDropFileRef.current(file.path).then((markdownText) => {
            if (!markdownText) return
            const position = view.posAtCoords({ x: event.clientX, y: event.clientY })
            const from = position ?? view.state.selection.main.head
            view.dispatch({
              changes: { from, insert: markdownText },
              selection: { anchor: from + markdownText.length }
            })
          })
          return true
        }
      })
    ]
  }, [completionSource, getLivePreviewExtensions, reportVimMode])

  const replaceDocument = useCallback(
    (content: string, preserveFocus = false): void => {
      const view = viewRef.current
      if (!view) {
        contentRef.current = content
        return
      }
      const focused = preserveFocus && view.hasFocus
      suppressDirtyRef.current = true
      view.setState(EditorState.create({ doc: content, extensions: buildExtensions() }))
      contentRef.current = content
      snapshotSchedulerRef.current?.cancel()
      publishSnapshot(content)
      if (focused) view.focus()
    },
    [buildExtensions, publishSnapshot]
  )

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    installVimMappings(vimMappingsRef.current)
    const view = new EditorView({
      state: EditorState.create({ doc: initialContentRef.current, extensions: buildExtensions() }),
      parent: host
    })
    viewRef.current = view
    contentRef.current = view.state.doc.toString()
    loadedNotePathRef.current = initialNotePathRef.current
    publishSnapshot(contentRef.current)
    reportVimMode(view)
    const frame = window.requestAnimationFrame(() => {
      setReady(true)
      onReadyRef.current?.()
    })

    return () => {
      window.cancelAnimationFrame(frame)
      snapshotSchedulerRef.current?.flush()
      view.destroy()
      viewRef.current = null
    }
  }, [buildExtensions, publishSnapshot, reportVimMode])

  useEffect(() => {
    vimMappingsRef.current = vimKeyMappings
    installVimMappings(vimKeyMappings)
  }, [vimKeyMappings])

  useEffect(() => {
    const view = viewRef.current
    modeRef.current = mode
    if (!view) return
    view.dispatch({
      effects: modeCompartmentRef.current.reconfigure(getLivePreviewExtensions())
    })
  }, [getLivePreviewExtensions, mode])

  useEffect(() => {
    const view = viewRef.current
    vimEnabledRef.current = vimModeEnabled
    if (!view) return
    view.dispatch({
      effects: [
        vimCompartmentRef.current.reconfigure(vimModeEnabled ? vim({ status: false }) : []),
        modeCompartmentRef.current.reconfigure(getLivePreviewExtensions())
      ]
    })
    reportVimMode(view)
  }, [getLivePreviewExtensions, reportVimMode, vimModeEnabled])

  useEffect(() => {
    const view = viewRef.current
    readOnlyRef.current = readOnly
    if (!view) return
    view.dispatch({
      effects: [
        readOnlyCompartmentRef.current.reconfigure(EditorState.readOnly.of(readOnly)),
        modeCompartmentRef.current.reconfigure(getLivePreviewExtensions())
      ]
    })
  }, [getLivePreviewExtensions, readOnly])

  useEffect(() => {
    const nextContent = initialContent ?? ''
    if (loadedNotePathRef.current === currentNotePath && contentRef.current === nextContent) return
    snapshotSchedulerRef.current?.flush()
    loadedNotePathRef.current = currentNotePath
    replaceDocument(nextContent, hasFocusIntentRef.current)
  }, [currentNotePath, initialContent, replaceDocument])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const handleLinkOpen = (event: MouseEvent): void => {
      if (event.type === 'auxclick' && !isMiddleMouseButton(event)) return
      const element =
        event.target instanceof HTMLElement
          ? event.target.closest<HTMLElement>('[data-note-target], [data-note-href]')
          : null
      if (!element) return
      const explicitTarget = element.dataset.noteTarget
      const hrefTarget = parseNoteMentionHref(element.dataset.noteHref ?? '')
      const target = explicitTarget
        ? (noteResolverRef.current(explicitTarget) ?? explicitTarget)
        : hrefTarget
      if (!target) return
      event.preventDefault()
      event.stopPropagation()
      onOpenNoteLinkRef.current?.(target, {
        openInNewTab: isMiddleMouseButton(event) || isModifiedNotebookOpen(event)
      })
    }
    host.addEventListener('click', handleLinkOpen, true)
    host.addEventListener('auxclick', handleLinkOpen, true)
    return () => {
      host.removeEventListener('click', handleLinkOpen, true)
      host.removeEventListener('auxclick', handleLinkOpen, true)
    }
  }, [])

  const captureSnapshot = useCallback(async (): Promise<NoteEditorSnapshot> => {
    return { content: viewRef.current?.state.doc.toString() ?? contentRef.current }
  }, [])

  const flushPendingChanges = useCallback(async (): Promise<NoteEditorSnapshot> => {
    snapshotSchedulerRef.current?.flush()
    const content = viewRef.current?.state.doc.toString() ?? contentRef.current
    publishSnapshot(content)
    return { content }
  }, [publishSnapshot])

  const migrateIndentationToTabs = useCallback((): MarkdownIndentationMigrationResult => {
    const view = viewRef.current
    const source = view?.state.doc.toString() ?? contentRef.current
    const result = migrateMarkdownIndentationToTabs(source)

    if (!view || view.state.readOnly || result.changes.length === 0) return result

    const changes = view.state.changes(result.changes)
    view.dispatch({
      changes,
      selection: view.state.selection.map(changes),
      userEvent: 'input.indent'
    })
    return result
  }, [])

  const focus = useCallback((): void => {
    hasFocusIntentRef.current = true
    viewRef.current?.focus()
  }, [])

  const blur = useCallback((): void => {
    hasFocusIntentRef.current = false
    const active = document.activeElement
    if (active instanceof HTMLElement && hostRef.current?.contains(active)) active.blur()
  }, [])

  const hasFocusIntent = useCallback((): boolean => hasFocusIntentRef.current, [])

  const jumpToOutlineIndex = useCallback((index: number): void => {
    const view = viewRef.current
    if (!view) return
    const headings: number[] = []
    for (let lineNumber = 1; lineNumber <= view.state.doc.lines; lineNumber += 1) {
      const line = view.state.doc.line(lineNumber)
      if (/^#{1,6}\s+/.test(line.text)) headings.push(line.from)
    }
    const position = headings[index]
    if (position === undefined) return
    view.dispatch({
      selection: { anchor: position },
      effects: EditorView.scrollIntoView(position, { y: 'center' })
    })
    view.focus()
  }, [])

  const insertNoteLink = useCallback((targetRelPath: string): void => {
    const view = viewRef.current
    if (!view || view.state.readOnly) return
    const selection = view.state.selection.main
    const selectedText = view.state.sliceDoc(selection.from, selection.to)
    const label = selectedText || getNoteDisplayName(targetRelPath)
    const insert = `[${label}](${noteMentionHref(targetRelPath)})`
    view.dispatch({
      changes: { from: selection.from, to: selection.to, insert },
      selection: { anchor: selection.from + insert.length }
    })
    view.focus()
  }, [])

  const loadDocument = useCallback(
    ({
      content = '',
      notePath,
      preserveFocus = false
    }: Parameters<NoteEditorHandle['loadDocument']>[0]) => {
      snapshotSchedulerRef.current?.flush()
      if (notePath !== undefined) loadedNotePathRef.current = notePath
      replaceDocument(content ?? '', preserveFocus)
    },
    [replaceDocument]
  )

  useImperativeHandle(
    ref,
    () => ({
      captureSnapshot,
      flushPendingChanges,
      migrateIndentationToTabs,
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
      flushPendingChanges,
      focus,
      hasFocusIntent,
      insertNoteLink,
      jumpToOutlineIndex,
      loadDocument,
      migrateIndentationToTabs
    ]
  )

  return (
    <div
      data-testid="note-block-editor"
      data-vim-mode={vimModeEnabled ? vimMode : undefined}
      data-editor-mode={mode}
      data-editor-read-only={readOnly ? 'true' : undefined}
      data-editor-ready={ready ? 'true' : 'false'}
      data-editor-density={density}
      data-editor-background={background}
      className={cn(
        'motion-editor-surface note-codemirror-editor relative h-full min-h-[10vh]',
        className
      )}
      onFocusCapture={() => {
        hasFocusIntentRef.current = true
      }}
      onPointerDownCapture={() => {
        hasFocusIntentRef.current = true
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) hasFocusIntentRef.current = false
      }}
    >
      <div
        ref={hostRef}
        data-testid="note-codemirror-root"
        data-note-source-editor="true"
        data-mode={mode}
        className="h-full min-h-[10vh]"
      />
    </div>
  )
})
