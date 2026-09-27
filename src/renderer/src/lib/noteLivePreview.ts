import { StateField, type EditorState, type Extension, type Range } from '@codemirror/state'
import katex from 'katex'
import { Decoration, EditorView, WidgetType, type DecorationSet } from '@codemirror/view'
import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import {
  MarkdownCodeBlockCopyButton,
  MarkdownCodeBlockView
} from '../components/MarkdownCodeBlockView'
import { MarkdownTableView } from '../components/MarkdownTableView'
import { findMarkdownCodeBlocks, type MarkdownCodeBlock } from './noteMarkdownCodeBlock'
import {
  findMarkdownTables,
  serializeMarkdownTable,
  type MarkdownTableModel
} from './noteMarkdownTable'
import { findLatexTextMatches } from './noteLatex'

class TextWidget extends WidgetType {
  constructor(
    private readonly text: string,
    private readonly className: string
  ) {
    super()
  }

  eq(other: TextWidget): boolean {
    return this.text === other.text && this.className === other.className
  }

  toDOM(): HTMLElement {
    const element = document.createElement('span')
    element.className = this.className
    element.textContent = this.text
    return element
  }
}

class ListMarkerWidget extends WidgetType {
  constructor(
    private readonly text: string,
    private readonly kind: 'bullet' | 'ordered'
  ) {
    super()
  }

  eq(other: ListMarkerWidget): boolean {
    return this.text === other.text && this.kind === other.kind
  }

  toDOM(): HTMLElement {
    const element = document.createElement('span')
    element.className = 'note-live-list-marker'
    element.dataset.noteListMarkerKind = this.kind
    element.textContent = this.text
    return element
  }
}

class ImageWidget extends WidgetType {
  constructor(
    private readonly alt: string,
    private readonly source: string
  ) {
    super()
  }

  eq(other: ImageWidget): boolean {
    return this.alt === other.alt && this.source === other.source
  }

  toDOM(): HTMLElement {
    const image = document.createElement('img')
    image.className = 'note-live-image'
    image.alt = this.alt
    image.src = this.source
    image.loading = 'lazy'
    return image
  }
}

class LatexWidget extends WidgetType {
  constructor(
    private readonly value: string,
    private readonly displayMode: boolean,
    private readonly valid: boolean
  ) {
    super()
  }

  eq(other: LatexWidget): boolean {
    return (
      this.value === other.value &&
      this.displayMode === other.displayMode &&
      this.valid === other.valid
    )
  }

  toDOM(): HTMLElement {
    const element = document.createElement(this.displayMode ? 'div' : 'span')
    element.className = this.valid
      ? this.displayMode
        ? 'note-live-latex note-live-latex-block'
        : 'note-live-latex'
      : 'note-live-latex-error'

    if (!this.valid) {
      element.textContent = this.value
      return element
    }

    katex.render(this.value, element, {
      displayMode: this.displayMode,
      throwOnError: false
    })
    return element
  }
}

class TaskCheckboxWidget extends WidgetType {
  constructor(
    private readonly position: number,
    private readonly checked: boolean
  ) {
    super()
  }

  eq(other: TaskCheckboxWidget): boolean {
    return this.position === other.position && this.checked === other.checked
  }

  toDOM(view: EditorView): HTMLElement {
    const marker = document.createElement('span')
    marker.className = 'note-live-list-marker note-live-task-marker'
    marker.dataset.noteListMarkerKind = 'task'

    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.checked = this.checked
    checkbox.className = 'note-live-task-checkbox'
    checkbox.setAttribute(
      'aria-label',
      this.checked ? 'Mark task incomplete' : 'Mark task complete'
    )
    checkbox.addEventListener('change', () => {
      view.dispatch({
        changes: {
          from: this.position + 1,
          to: this.position + 2,
          insert: checkbox.checked ? 'x' : ' '
        }
      })
    })
    marker.append(checkbox)
    return marker
  }

  ignoreEvent(): boolean {
    return true
  }
}

interface CodeBlockWidgetHost extends HTMLElement {
  __noteCodeBlockRoot?: Root
  __noteCodeBlockOwner?: MarkdownCodeBlockWidget
}

class MarkdownCodeBlockWidget extends WidgetType {
  private root: Root | null = null
  private host: CodeBlockWidgetHost | null = null

  constructor(private readonly block: MarkdownCodeBlock) {
    super()
  }

  eq(other: MarkdownCodeBlockWidget): boolean {
    return this.block.source === other.block.source && this.block.from === other.block.from
  }

  private render(view: EditorView): void {
    this.root?.render(
      createElement(MarkdownCodeBlockView, {
        block: this.block,
        onActivate: () => {
          view.dispatch({
            selection: { anchor: this.block.bodyFrom },
            scrollIntoView: true
          })
          requestAnimationFrame(() => view.focus())
        },
        onLayoutChange: () => view.requestMeasure()
      })
    )
  }

  toDOM(view: EditorView): HTMLElement {
    const host = document.createElement('div') as CodeBlockWidgetHost
    host.className = 'note-live-code-widget-host'
    this.host = host
    this.root = createRoot(host)
    host.__noteCodeBlockRoot = this.root
    host.__noteCodeBlockOwner = this
    this.render(view)
    return host
  }

  updateDOM(dom: HTMLElement, view: EditorView): boolean {
    const host = dom as CodeBlockWidgetHost
    this.host = host
    this.root = host.__noteCodeBlockRoot ?? null
    host.__noteCodeBlockOwner = this
    this.render(view)
    return true
  }

  destroy(): void {
    if (this.host?.__noteCodeBlockOwner !== this) return
    this.root?.unmount()
    this.root = null
    this.host = null
  }

  ignoreEvent(): boolean {
    return true
  }
}

interface CodeBlockCopyWidgetHost extends HTMLElement {
  __noteCodeBlockCopyRoot?: Root
  __noteCodeBlockCopyOwner?: MarkdownCodeBlockCopyWidget
}

class MarkdownCodeBlockCopyWidget extends WidgetType {
  private root: Root | null = null
  private host: CodeBlockCopyWidgetHost | null = null

  constructor(private readonly block: MarkdownCodeBlock) {
    super()
  }

  eq(other: MarkdownCodeBlockCopyWidget): boolean {
    return this.block.source === other.block.source && this.block.from === other.block.from
  }

  private render(): void {
    this.root?.render(
      createElement(MarkdownCodeBlockCopyButton, {
        code: this.block.body
      })
    )
  }

  toDOM(): HTMLElement {
    const host = document.createElement('span') as CodeBlockCopyWidgetHost
    host.className = 'note-live-code-source-copy-host'
    this.host = host
    this.root = createRoot(host)
    host.__noteCodeBlockCopyRoot = this.root
    host.__noteCodeBlockCopyOwner = this
    this.render()
    return host
  }

  updateDOM(dom: HTMLElement): boolean {
    const host = dom as CodeBlockCopyWidgetHost
    this.host = host
    this.root = host.__noteCodeBlockCopyRoot ?? null
    host.__noteCodeBlockCopyOwner = this
    this.render()
    return true
  }

  destroy(): void {
    if (this.host?.__noteCodeBlockCopyOwner !== this) return
    this.root?.unmount()
    this.root = null
    this.host = null
  }

  ignoreEvent(): boolean {
    return true
  }
}

class MarkdownTableWidget extends WidgetType {
  private root: Root | null = null

  constructor(
    private readonly table: MarkdownTableModel,
    private readonly source: string
  ) {
    super()
  }

  eq(other: MarkdownTableWidget): boolean {
    return this.source === other.source && this.table.from === other.table.from
  }

  updateDOM(): boolean {
    return true
  }

  toDOM(view: EditorView): HTMLElement {
    const root = document.createElement('section')
    root.className = 'note-live-table'
    let currentSource = this.source
    this.root = createRoot(root)
    this.root.render(
      createElement(MarkdownTableView, {
        table: this.table,
        onChange: (nextTable) => {
          const nextSource = serializeMarkdownTable(nextTable)
          view.dispatch({
            changes: {
              from: this.table.from,
              to: this.table.from + currentSource.length,
              insert: nextSource
            }
          })
          currentSource = nextSource
        },
        onDelete: () => {
          view.dispatch({
            changes: {
              from: this.table.from,
              to: this.table.from + currentSource.length
            }
          })
        }
      })
    )
    return root
  }

  destroy(): void {
    this.root?.unmount()
    this.root = null
  }

  ignoreEvent(): boolean {
    return true
  }
}

function overlaps(ranges: readonly [number, number][], from: number, to: number): boolean {
  return ranges.some(([rangeFrom, rangeTo]) => from < rangeTo && to > rangeFrom)
}

const SOURCE_SYNTAX_CLASS = 'note-live-source-syntax'

function addSourceSyntaxDecoration(
  decorations: Range<Decoration>[],
  from: number,
  to: number
): void {
  if (from >= to) return
  decorations.push(Decoration.mark({ class: SOURCE_SYNTAX_CLASS }).range(from, to))
}

function addSourceSyntaxAround(
  decorations: Range<Decoration>[],
  from: number,
  to: number,
  markerSize: number
): void {
  addSourceSyntaxDecoration(decorations, from, from + markerSize)
  addSourceSyntaxDecoration(decorations, to - markerSize, to)
}

function addUnmatchedSourceSyntaxDecorations(
  text: string,
  lineFrom: number,
  decorations: Range<Decoration>[],
  occupied: readonly [number, number][],
  excluded: readonly [number, number][]
): void {
  for (const match of text.matchAll(/`+|~{2,}|[*_]+|[()[\]{}]/g)) {
    const from = lineFrom + (match.index ?? 0)
    const to = from + match[0].length
    if (overlaps(occupied, from, to) || overlaps(excluded, from, to)) continue
    addSourceSyntaxDecoration(decorations, from, to)
  }
}

function addInlineDecorations(
  text: string,
  lineFrom: number,
  decorations: Range<Decoration>[],
  hideSyntax: boolean,
  excludedSourceRanges: readonly [number, number][] = []
): void {
  const occupied: [number, number][] = []
  const addMatch = (
    match: RegExpExecArray,
    markerSize: number,
    className: string,
    attributes?: Record<string, string>
  ): void => {
    const from = lineFrom + match.index
    const to = from + match[0].length
    if (overlaps(occupied, from, to) || match[0].length <= markerSize * 2) return
    occupied.push([from, to])
    if (hideSyntax) decorations.push(Decoration.replace({}).range(from, from + markerSize))
    else addSourceSyntaxAround(decorations, from, to, markerSize)
    decorations.push(
      Decoration.mark({ class: className, attributes }).range(from + markerSize, to - markerSize)
    )
    if (hideSyntax) decorations.push(Decoration.replace({}).range(to - markerSize, to))
  }

  for (const match of text.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)) {
    const from = lineFrom + (match.index ?? 0)
    const to = from + match[0].length
    if (overlaps(occupied, from, to)) continue
    occupied.push([from, to])
    if (hideSyntax) {
      decorations.push(
        Decoration.replace({
          widget: new ImageWidget(match[1], match[2])
        }).range(from, to)
      )
    } else {
      addSourceSyntaxDecoration(decorations, from, from + 2)
      const labelEnd = from + 2 + match[1].length
      addSourceSyntaxDecoration(decorations, labelEnd, labelEnd + 2)
      addSourceSyntaxDecoration(decorations, to - 1, to)
    }
  }

  for (const match of findLatexTextMatches(text)) {
    const from = lineFrom + match.from
    const to = lineFrom + match.to
    if (overlaps(occupied, from, to)) continue
    occupied.push([from, to])
    if (hideSyntax) {
      decorations.push(
        Decoration.replace({
          widget: new LatexWidget(match.value, match.displayMode, match.valid),
          block: match.displayMode
        }).range(from, to)
      )
    } else {
      addSourceSyntaxDecoration(decorations, from, from + match.delimiter.length)
      addSourceSyntaxDecoration(decorations, to - match.delimiter.length, to)
    }
  }

  for (const match of text.matchAll(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g)) {
    const from = lineFrom + (match.index ?? 0)
    const to = from + match[0].length
    const labelStart = match[0].includes('|') ? match[0].indexOf('|') + 1 : 2
    if (overlaps(occupied, from, to)) continue
    occupied.push([from, to])
    if (hideSyntax) decorations.push(Decoration.replace({}).range(from, from + labelStart))
    else {
      addSourceSyntaxDecoration(decorations, from, from + 2)
      const pipeIndex = match[0].indexOf('|')
      if (pipeIndex >= 0) {
        addSourceSyntaxDecoration(decorations, from + pipeIndex, from + pipeIndex + 1)
      }
      addSourceSyntaxDecoration(decorations, to - 2, to)
    }
    decorations.push(
      Decoration.mark({
        class: 'note-live-link',
        attributes: { 'data-note-target': match[1] }
      }).range(from + labelStart, to - 2)
    )
    if (hideSyntax) decorations.push(Decoration.replace({}).range(to - 2, to))
  }

  for (const match of text.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)) {
    const from = lineFrom + (match.index ?? 0)
    const to = from + match[0].length
    const labelTo = from + 1 + match[1].length
    if (overlaps(occupied, from, to)) continue
    occupied.push([from, to])
    if (hideSyntax) decorations.push(Decoration.replace({}).range(from, from + 1))
    else {
      addSourceSyntaxDecoration(decorations, from, from + 1)
      addSourceSyntaxDecoration(decorations, labelTo, labelTo + 2)
      addSourceSyntaxDecoration(decorations, to - 1, to)
    }
    decorations.push(
      Decoration.mark({
        class: 'note-live-link',
        attributes: { 'data-note-href': match[2] }
      }).range(from + 1, labelTo)
    )
    if (hideSyntax) decorations.push(Decoration.replace({}).range(labelTo, to))
  }

  for (const match of text.matchAll(/\*\*([^*]+)\*\*/g)) {
    addMatch(match as RegExpExecArray, 2, 'note-live-strong')
  }
  for (const match of text.matchAll(/__(?!_)([^_\n]+)__(?!_)/g)) {
    addMatch(match as RegExpExecArray, 2, 'note-live-strong')
  }
  for (const match of text.matchAll(/~~([^~]+)~~/g)) {
    addMatch(match as RegExpExecArray, 2, 'note-live-strike')
  }
  for (const match of text.matchAll(/`([^`]+)`/g)) {
    addMatch(match as RegExpExecArray, 1, 'note-live-inline-code')
  }
  for (const match of text.matchAll(/(?<![_\\\w])_([^_\n]+)_(?![_\w])/g)) {
    addMatch(match as RegExpExecArray, 1, 'note-live-underline')
  }
  for (const match of text.matchAll(/(?<!\*)\*([^*]+)\*(?!\*)/g)) {
    addMatch(match as RegExpExecArray, 1, 'note-live-emphasis')
  }

  if (!hideSyntax) {
    addUnmatchedSourceSyntaxDecorations(text, lineFrom, decorations, occupied, excludedSourceRanges)
  }
}

function addCodeFenceSourceDecorations(
  block: MarkdownCodeBlock,
  decorations: Range<Decoration>[]
): void {
  const markFence = (lineFrom: number, text: string): void => {
    const match = /^(\s*)(`{3,}|~{3,})/.exec(text)
    if (!match) return
    const markerFrom = lineFrom + match[1].length
    addSourceSyntaxDecoration(decorations, markerFrom, markerFrom + match[2].length)
  }

  markFence(block.from, block.openingLine)
  if (block.closingLine) {
    markFence(block.to - block.closingLine.length, block.closingLine)
  }
}

function addActiveCodeBlockDecorations(
  state: EditorState,
  block: MarkdownCodeBlock,
  decorations: Range<Decoration>[]
): void {
  const firstLine = state.doc.lineAt(block.from).number
  const lastLine = state.doc.lineAt(block.to).number

  for (let lineNumber = firstLine; lineNumber <= lastLine; lineNumber += 1) {
    const line = state.doc.line(lineNumber)
    const kind =
      firstLine === lastLine
        ? 'single'
        : lineNumber === firstLine
          ? 'start'
          : lineNumber === lastLine
            ? 'end'
            : 'middle'

    decorations.push(
      Decoration.line({
        class: `note-live-code-source-line note-live-code-source-line-${kind}`,
        attributes: {
          'data-note-live-code-state': 'active',
          'data-note-live-code-line': kind
        }
      }).range(line.from)
    )
  }

  decorations.push(
    Decoration.widget({
      side: -1,
      widget: new MarkdownCodeBlockCopyWidget(block)
    }).range(block.from)
  )
}

export function getActivePreviewLines(state: EditorState): ReadonlySet<number> {
  const activeLines = new Set<number>()

  for (const range of state.selection.ranges) {
    const firstLine = state.doc.lineAt(range.from).number
    const lastLine = state.doc.lineAt(range.to).number

    for (let lineNumber = firstLine; lineNumber <= lastLine; lineNumber += 1) {
      activeLines.add(lineNumber)
    }
  }

  return activeLines
}

export function isPreviewSelectionTouchingRange(
  state: EditorState,
  from: number,
  to: number
): boolean {
  return state.selection.ranges.some((range) => range.from <= to && range.to >= from)
}

interface ListMarker {
  markerFrom: number
  markerTo: number
  replacementTo: number
}

function addListMarkerDecorations(
  state: EditorState,
  decorations: Range<Decoration>[],
  marker: ListMarker,
  renderedText: string,
  kind: 'bullet' | 'ordered'
): void {
  if (isPreviewSelectionTouchingRange(state, marker.markerFrom, marker.markerTo)) {
    decorations.push(
      Decoration.mark({
        class: 'note-live-list-marker note-live-list-marker-source',
        attributes: { 'data-note-list-marker-kind': kind }
      }).range(marker.markerFrom, marker.replacementTo)
    )
    return
  }

  decorations.push(
    Decoration.replace({
      widget: new ListMarkerWidget(renderedText, kind)
    }).range(marker.markerFrom, marker.replacementTo)
  )
}

function buildDecorations(state: EditorState): DecorationSet {
  const decorations: Range<Decoration>[] = []
  const activeLines = getActivePreviewLines(state)

  const markdown = state.doc.toString()
  const codeBlocks = findMarkdownCodeBlocks(markdown)
  const codeBlockLines = new Set<number>()
  for (const block of codeBlocks) {
    const firstLine = state.doc.lineAt(block.from).number
    const lastLine = state.doc.lineAt(block.to).number
    for (let line = firstLine; line <= lastLine; line += 1) codeBlockLines.add(line)

    const active = isPreviewSelectionTouchingRange(state, block.from, block.to)
    if (active) {
      addActiveCodeBlockDecorations(state, block, decorations)
      addCodeFenceSourceDecorations(block, decorations)
      continue
    }

    decorations.push(
      Decoration.replace({
        block: true,
        widget: new MarkdownCodeBlockWidget(block)
      }).range(block.from, block.to)
    )
  }

  const tables = findMarkdownTables(markdown)
  const hiddenTableLines = new Set<number>()
  for (const table of tables) {
    const active = state.selection.ranges.some(
      (range) => range.head >= table.from && range.head <= table.to
    )
    if (active) continue
    const firstLine = state.doc.lineAt(table.from).number
    const lastLine = state.doc.lineAt(table.to).number
    for (let line = firstLine; line <= lastLine; line += 1) hiddenTableLines.add(line)
    decorations.push(
      Decoration.replace({
        block: true,
        widget: new MarkdownTableWidget(table, markdown.slice(table.from, table.to))
      }).range(table.from, table.to)
    )
  }

  for (let lineNumber = 1; lineNumber <= state.doc.lines; lineNumber += 1) {
    if (hiddenTableLines.has(lineNumber) || codeBlockLines.has(lineNumber)) continue
    const line = state.doc.line(lineNumber)
    const text = line.text
    const active = activeLines.has(lineNumber)
    const excludedSourceRanges: [number, number][] = []

    const isHorizontalRule = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/.test(text)

    const heading = /^(#{1,6})\s+/.exec(text)
    if (heading) {
      if (!active) {
        decorations.push(Decoration.replace({}).range(line.from, line.from + heading[0].length))
      } else {
        decorations.push(
          Decoration.mark({
            class: 'note-live-leading-source-marker note-live-source-syntax'
          }).range(line.from, line.from + heading[0].length)
        )
      }
      decorations.push(
        Decoration.line({
          class: `note-live-heading note-live-heading-${heading[1].length}`
        }).range(line.from)
      )
    }

    const task = /^(\s*)([-+*])(\s+)\[([ xX])\](\s+)/.exec(text)
    if (task) {
      const markerFrom = line.from + task[1].length
      const replacementTo = line.from + task[0].length
      const checkboxPosition = line.from + task[1].length + task[2].length + task[3].length
      excludedSourceRanges.push([markerFrom, replacementTo])

      if (isPreviewSelectionTouchingRange(state, markerFrom, replacementTo)) {
        decorations.push(
          Decoration.mark({
            class: 'note-live-list-marker note-live-list-marker-source',
            attributes: { 'data-note-list-marker-kind': 'task' }
          }).range(markerFrom, replacementTo)
        )
      } else {
        decorations.push(
          Decoration.replace({
            widget: new TaskCheckboxWidget(checkboxPosition, task[4].toLowerCase() === 'x')
          }).range(markerFrom, replacementTo)
        )
      }
    } else {
      const bullet = /^(\s*)([-+*])(\s+)/.exec(text)
      if (bullet && !isHorizontalRule) {
        const markerFrom = line.from + bullet[1].length
        const markerTo = markerFrom + bullet[2].length
        const marker: ListMarker = {
          markerFrom,
          markerTo,
          replacementTo: line.from + bullet[0].length
        }
        excludedSourceRanges.push([marker.markerFrom, marker.replacementTo])
        addListMarkerDecorations(state, decorations, marker, '•', 'bullet')
      }

      const ordered = /^(\s*)(\d+)([.)])(\s+)/.exec(text)
      if (ordered && !isHorizontalRule) {
        const markerFrom = line.from + ordered[1].length
        const markerTo = markerFrom + ordered[2].length + ordered[3].length
        const marker: ListMarker = {
          markerFrom,
          markerTo,
          replacementTo: line.from + ordered[0].length
        }
        excludedSourceRanges.push([marker.markerFrom, marker.replacementTo])
        addListMarkerDecorations(state, decorations, marker, `${ordered[2]}.`, 'ordered')
      }
    }

    const quote = /^\s*>\s?/.exec(text)
    if (quote) {
      if (!active) {
        decorations.push(Decoration.replace({}).range(line.from, line.from + quote[0].length))
      } else {
        addSourceSyntaxDecoration(decorations, line.from, line.from + quote[0].length)
      }
      decorations.push(Decoration.line({ class: 'note-live-blockquote' }).range(line.from))
    }

    if (active && isHorizontalRule) {
      addSourceSyntaxDecoration(decorations, line.from, line.to)
    }

    if (!active && isHorizontalRule) {
      decorations.push(
        Decoration.replace({
          widget: new TextWidget('', 'note-live-horizontal-rule')
        }).range(line.from, line.to)
      )
      continue
    }

    addInlineDecorations(text, line.from, decorations, !active, excludedSourceRanges)
  }

  return Decoration.set(decorations, true)
}

export function noteLivePreview(): Extension {
  const preview = StateField.define<DecorationSet>({
    create: (state) => buildDecorations(state),
    update(decorations, transaction) {
      return transaction.docChanged || transaction.selection
        ? buildDecorations(transaction.state)
        : decorations
    },
    provide: (field) => EditorView.decorations.from(field)
  })

  return [preview]
}
