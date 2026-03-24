import { history, historyKeymap, indentWithTab, defaultKeymap } from '@codemirror/commands'
import { autocompletion, type Completion, type CompletionContext } from '@codemirror/autocomplete'
import { EditorSelection, EditorState, type Extension, RangeSetBuilder } from '@codemirror/state'
import {
  Decoration,
  EditorView,
  WidgetType,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  keymap,
  placeholder,
  ViewPlugin
} from '@codemirror/view'
import { markdown } from '@codemirror/lang-markdown'
import {
  DragEvent,
  ReactElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef
} from 'react'
import { NoteListItem } from '../../../shared/types'
import { mentionTokenFromRelPath, normalizeMentionTarget } from '../../../shared/noteMentions'
import { extractNoteOutline, NoteOutlineItem } from '../lib/noteOutline'

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
  onOpenMention?: (target: string) => void
}

const HEADING_REGEX = /^(#{1,6})([ \t]+)(.*)$/
const MENTION_REGEX = /\[\[([^\[\]\n]+?)\]\]/g

function mimeTypeToExtension(mimeType: string): string {
  switch (mimeType) {
    case 'image/jpeg':
    case 'image/jpg':
      return '.jpg'
    case 'image/png':
      return '.png'
    case 'image/gif':
      return '.gif'
    case 'image/webp':
      return '.webp'
    case 'image/svg+xml':
      return '.svg'
    default:
      return '.png'
  }
}

function normalizeMarkdown(markdownValue: string): string {
  return markdownValue.replace(/\r\n/g, '\n')
}

function buildRelativeAttachmentPath(
  vaultRootPath: string,
  currentNotePath: string,
  absolutePath: string
): string | null {
  if (!absolutePath.startsWith(vaultRootPath)) {
    return null
  }

  const vaultRelative = absolutePath.slice(vaultRootPath.length + 1)
  const noteDir = currentNotePath.includes('/')
    ? currentNotePath.slice(0, currentNotePath.lastIndexOf('/'))
    : ''
  const prefix = noteDir.length === 0 ? '../' : `${'../'.repeat(noteDir.split('/').length + 1)}`

  return `${prefix}${vaultRelative}`
}

function insertTextAtSelection(view: EditorView, text: string): void {
  const { from, to } = view.state.selection.main
  view.dispatch({
    changes: { from, to, insert: text },
    selection: { anchor: from + text.length },
    scrollIntoView: true
  })
}

function getEditingLineNumbers(selection: EditorSelection, doc: EditorState['doc']): Set<number> {
  const editingLines = new Set<number>()

  for (const range of selection.ranges) {
    const startLine = doc.lineAt(range.from).number
    const endLine = doc.lineAt(range.to).number

    for (let lineNumber = startLine; lineNumber <= endLine; lineNumber += 1) {
      editingLines.add(lineNumber)
    }
  }

  return editingLines
}

function isLineEditable(
  lineNumber: number,
  editingLines: Set<number>,
  hasFocus: boolean
): boolean {
  if (!hasFocus) {
    return false
  }
  return editingLines.has(lineNumber)
}

class MentionWidget extends WidgetType {
  constructor(
    private readonly target: string,
    private readonly onOpenMention?: (target: string) => void
  ) {
    super()
  }

  eq(other: MentionWidget): boolean {
    return other.target === this.target && other.onOpenMention === this.onOpenMention
  }

  toDOM(): HTMLElement {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'cm-note-link-button'
    button.textContent = this.target
    button.setAttribute('aria-label', `Open note ${this.target}`)
    button.addEventListener('mousedown', (event) => event.preventDefault())
    button.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      this.onOpenMention?.(this.target)
    })
    return button
  }

  ignoreEvent(): boolean {
    return false
  }
}

function createMarkdownRenderPlugin(
  getOpenMention: () => ((target: string) => void) | undefined
): Extension {
  return ViewPlugin.fromClass(
    class {
      decorations

      constructor(view: EditorView) {
        this.decorations = this.buildDecorations(view)
      }

      update(update: { view: EditorView; docChanged: boolean; selectionSet: boolean; viewportChanged: boolean }) {
        if (update.docChanged || update.selectionSet || update.viewportChanged) {
          this.decorations = this.buildDecorations(update.view)
        }
      }

      buildDecorations(view: EditorView) {
        const builder = new RangeSetBuilder<Decoration>()
        const editingLines = getEditingLineNumbers(view.state.selection, view.state.doc)
        const hasFocus = view.hasFocus
        const onOpenMention = getOpenMention()

        for (let lineNumber = 1; lineNumber <= view.state.doc.lines; lineNumber += 1) {
          if (isLineEditable(lineNumber, editingLines, hasFocus)) {
            continue
          }

          const line = view.state.doc.line(lineNumber)
          const text = line.text
          if (!text.trim()) {
            continue
          }

          const headingMatch = HEADING_REGEX.exec(text)
          if (headingMatch) {
            const markerLength = headingMatch[1].length + headingMatch[2].length
            builder.add(
              line.from,
              line.from,
              Decoration.line({ class: `cm-md-heading-line cm-md-heading-${headingMatch[1].length}` })
            )
            builder.add(
              line.from,
              line.from + markerLength,
              Decoration.replace({ inclusive: false })
            )
            builder.add(
              line.from + markerLength,
              line.to,
              Decoration.mark({ class: 'cm-md-heading-content' })
            )
          }

          for (const match of text.matchAll(MENTION_REGEX)) {
            const fullMatch = match[0]
            const target = match[1]?.trim()
            if (!fullMatch || !target) {
              continue
            }

            const from = line.from + (match.index ?? 0)
            builder.add(
              from,
              from + fullMatch.length,
              Decoration.replace({
                widget: new MentionWidget(target, onOpenMention),
                inclusive: false
              })
            )
          }
        }

        return builder.finish()
      }
    },
    {
      decorations: (value) => value.decorations
    }
  )
}

function createEditorTheme(): Extension {
  return EditorView.theme({
    '&': {
      minHeight: '60vh',
      height: '100%',
      backgroundColor: 'var(--panel)',
      color: 'var(--text)',
      fontFamily: 'var(--app-font-family)',
      fontSize: '15px',
      border: '0',
      outline: 'none',
      boxShadow: 'none'
    },
    '&.cm-editor': {
      border: '0',
      outline: 'none',
      boxShadow: 'none'
    },
    '.cm-scroller': {
      overflow: 'auto',
      fontFamily: 'var(--app-font-family)',
      lineHeight: '1.65'
    },
    '.cm-content': {
      padding: '0.5rem 0.25rem 2rem',
      minHeight: '60vh',
      caretColor: 'var(--accent)'
    },
    '.cm-focused': {
      outline: 'none'
    },
    '.cm-line': {
      padding: '0.125rem 0'
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: 'var(--accent)'
    },
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': {
      backgroundColor: 'var(--accent-soft)'
    },
    '.cm-activeLine': {
      backgroundColor: 'transparent'
    },
    '.cm-placeholder': {
      color: 'var(--muted)'
    },
    '.cm-tooltip': {
      border: '1px solid var(--line)',
      backgroundColor: 'var(--panel-2)',
      color: 'var(--text)'
    },
    '.cm-tooltip-autocomplete ul li[aria-selected]': {
      backgroundColor: 'var(--accent-soft)',
      color: 'var(--text)'
    },
    '.cm-md-heading-line': {
      paddingTop: '0.1rem',
      paddingBottom: '0.1rem'
    },
    '.cm-md-heading-content': {
      color: 'var(--text)',
      fontWeight: '700'
    },
    '.cm-md-heading-1 .cm-md-heading-content': {
      fontSize: '2.25rem',
      lineHeight: '1.1',
      letterSpacing: '-0.03em'
    },
    '.cm-md-heading-2 .cm-md-heading-content': {
      fontSize: '1.65rem',
      lineHeight: '1.2',
      letterSpacing: '-0.02em'
    },
    '.cm-md-heading-3 .cm-md-heading-content': {
      fontSize: '1.35rem',
      lineHeight: '1.25'
    },
    '.cm-md-heading-4 .cm-md-heading-content': {
      fontSize: '1.15rem',
      lineHeight: '1.3'
    },
    '.cm-md-heading-5 .cm-md-heading-content, .cm-md-heading-6 .cm-md-heading-content': {
      fontSize: '1rem',
      lineHeight: '1.4'
    },
    '.cm-note-link-button': {
      appearance: 'none',
      background: 'transparent',
      border: '0',
      color: 'var(--accent)',
      cursor: 'pointer',
      font: 'inherit',
      padding: '0',
      textDecoration: 'underline',
      textUnderlineOffset: '2px'
    }
  })
}

function scheduleEditorPaint(view: EditorView): () => void {
  let cancelled = false
  let frameOne = 0
  let frameTwo = 0

  const runMeasure = (): void => {
    if (cancelled) {
      return
    }
    view.requestMeasure()
  }

  runMeasure()
  frameOne = requestAnimationFrame(() => {
    runMeasure()
    frameTwo = requestAnimationFrame(() => {
      runMeasure()
    })
  })

  return () => {
    cancelled = true
    cancelAnimationFrame(frameOne)
    cancelAnimationFrame(frameTwo)
  }
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
  onJumpToHeadingChange,
  onOpenMention
}: EditorProps): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null)
  const editorViewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  const onOutlineChangeRef = useRef(onOutlineChange)
  const onPasteImageRef = useRef(onPasteImage)
  const onDropFileRef = useRef(onDropFile)
  const onOpenMentionRef = useRef(onOpenMention)
  const notesRef = useRef(notes)
  const currentNotePathRef = useRef(currentNotePath)
  const vaultRootPathRef = useRef(vaultRootPath)
  const lastSyncedValueRef = useRef('')

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    onOutlineChangeRef.current = onOutlineChange
  }, [onOutlineChange])

  useEffect(() => {
    onPasteImageRef.current = onPasteImage
  }, [onPasteImage])

  useEffect(() => {
    onDropFileRef.current = onDropFile
  }, [onDropFile])

  useEffect(() => {
    onOpenMentionRef.current = onOpenMention
  }, [onOpenMention])

  useEffect(() => {
    notesRef.current = notes
  }, [notes])

  useEffect(() => {
    currentNotePathRef.current = currentNotePath
  }, [currentNotePath])

  useEffect(() => {
    vaultRootPathRef.current = vaultRootPath
  }, [vaultRootPath])

  const syncOutline = useCallback((markdownValue: string): void => {
    onOutlineChangeRef.current?.(extractNoteOutline(markdownValue))
  }, [])

  const mentionCompletions = useMemo(
    () =>
      (context: CompletionContext) => {
        const match = context.matchBefore(/\[\[[^[\]\n]*$/)
        if (!match) {
          return null
        }

        if (match.from === match.to && !context.explicit) {
          return null
        }

        const mentionQuery = context.state.sliceDoc(match.from + 2, match.to)
        const search = normalizeMentionTarget(mentionQuery)
        const activeNotePath = currentNotePathRef.current
        const availableNotes = notesRef.current.filter((note) => note.relPath !== activeNotePath)
        const duplicateNameCounts = availableNotes.reduce<Record<string, number>>((acc, note) => {
          const normalizedName = normalizeMentionTarget(note.name)
          acc[normalizedName] = (acc[normalizedName] ?? 0) + 1
          return acc
        }, {})

        const options: Completion[] = availableNotes
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
          .map((note) => {
            const normalizedName = normalizeMentionTarget(note.name)
            const hasNameCollision = (duplicateNameCounts[normalizedName] ?? 0) > 1
            const mentionTarget = hasNameCollision
              ? note.relPath.replace(/\.md$/i, '')
              : note.name.replace(/\.md$/i, '')

            return {
              label: mentionTarget,
              displayLabel: mentionTokenFromRelPath(mentionTarget),
              detail: note.relPath,
              type: 'variable',
              apply: mentionTokenFromRelPath(mentionTarget)
            } satisfies Completion
          })

        return {
          from: match.from,
          options,
          validFor: /\[\[[^[\]\n]*$/
        }
      },
    []
  )

  const jumpToHeading = useCallback((lineId: string): void => {
    const view = editorViewRef.current
    if (!view) {
      return
    }

    const lineNumber = Number.parseInt(lineId, 10)
    if (Number.isNaN(lineNumber) || lineNumber < 1 || lineNumber > view.state.doc.lines) {
      return
    }

    const line = view.state.doc.line(lineNumber)
    view.dispatch({
      selection: { anchor: line.from },
      scrollIntoView: true
    })
    view.focus()
  }, [])

  useLayoutEffect(() => {
    if (!containerRef.current || editorViewRef.current) {
      return
    }

    const editorTheme = createEditorTheme()
    const renderPlugin = createMarkdownRenderPlugin(() => onOpenMentionRef.current)

    const state = EditorState.create({
      doc: value,
      extensions: [
        editorTheme,
        markdown(),
        history(),
        drawSelection(),
        dropCursor(),
        highlightActiveLine(),
        EditorView.lineWrapping,
        placeholder('Write markdown...'),
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        autocompletion({
          override: [mentionCompletions],
          defaultKeymap: true,
          activateOnTyping: true
        }),
        renderPlugin,
        EditorView.updateListener.of((update) => {
          if (!update.docChanged) {
            return
          }

          const nextValue = update.state.doc.toString()
          lastSyncedValueRef.current = nextValue
          syncOutline(nextValue)
          onChangeRef.current(nextValue)
        }),
        EditorView.domEventHandlers({
          paste: (event, view) => {
            const items = event.clipboardData?.items
            if (!items) {
              return false
            }

            for (let index = 0; index < items.length; index += 1) {
              const item = items[index]
              if (!item.type.startsWith('image/')) {
                continue
              }

              const blob = item.getAsFile()
              if (!blob) {
                return false
              }

              event.preventDefault()
              void (async () => {
                const extension = mimeTypeToExtension(item.type)
                const fileUrl = await onPasteImageRef.current(blob, extension)
                if (!fileUrl) {
                  return
                }

                const absolutePath = fileUrl.startsWith('vault-file://')
                  ? fileUrl.slice('vault-file://'.length)
                  : fileUrl
                const nextCurrentNotePath = currentNotePathRef.current
                const nextVaultRootPath = vaultRootPathRef.current
                const relativePath =
                  nextCurrentNotePath && nextVaultRootPath
                    ? buildRelativeAttachmentPath(nextVaultRootPath, nextCurrentNotePath, absolutePath)
                    : null

                insertTextAtSelection(view, `![](${relativePath ?? fileUrl})`)
              })()

              return true
            }

            return false
          },
          drop: (event) => {
            const file = event.dataTransfer?.files?.[0] as (File & { path?: string }) | undefined
            if (!file?.path) {
              return false
            }

            event.preventDefault()
            void onDropFileRef.current(file.path)
            return true
          }
        })
      ]
    })

    const view = new EditorView({
      state,
      parent: containerRef.current
    })

    editorViewRef.current = view
    lastSyncedValueRef.current = value
    syncOutline(value)
    const cancelScheduledPaint = scheduleEditorPaint(view)

    return () => {
      cancelScheduledPaint()
      editorViewRef.current = null
      view.destroy()
    }
  }, [currentNotePath, mentionCompletions, syncOutline])

  useLayoutEffect(() => {
    const view = editorViewRef.current
    if (!view) {
      return
    }

    if (normalizeMarkdown(lastSyncedValueRef.current) === normalizeMarkdown(value)) {
      return
    }

    const currentValue = view.state.doc.toString()
    if (normalizeMarkdown(currentValue) === normalizeMarkdown(value)) {
      lastSyncedValueRef.current = value
      syncOutline(value)
      return
    }

    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value }
    })
    lastSyncedValueRef.current = value
    syncOutline(value)
    return scheduleEditorPaint(view)
  }, [syncOutline, value])

  useEffect(() => {
    onJumpToHeadingChange?.(jumpToHeading)
    return () => onJumpToHeadingChange?.(null)
  }, [jumpToHeading, onJumpToHeadingChange])

  const onDragOver = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault()
  }

  return (
    <div
      className="note-editor-shell min-h-[60vh] rounded-lg bg-[var(--panel)]"
      onDragOver={onDragOver}
    >
      <div ref={containerRef} />
    </div>
  )
}
