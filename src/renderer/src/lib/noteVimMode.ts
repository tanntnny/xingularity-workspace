import { splitBlock } from '@milkdown/kit/prose/commands'
import { undo } from '@milkdown/kit/prose/history'
import { Slice } from '@milkdown/kit/prose/model'
import type { Schema } from '@milkdown/kit/prose/model'
import { Plugin, PluginKey, TextSelection } from '@milkdown/kit/prose/state'
import type { EditorState } from '@milkdown/kit/prose/state'
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view'
import type { EditorView } from '@milkdown/kit/prose/view'
import type { Parser, Serializer } from '@milkdown/transformer'
import type { NoteVimKeyMapping, NoteVimMappingAction } from '../../../shared/types'

export type NoteVimMode = 'insert' | 'normal' | 'visual' | 'visualLine'

interface NoteVimPluginState {
  mode: NoteVimMode
  pendingKey: 'd' | 'g' | null
  hasFocus: boolean
  visualAnchor: number | null
  visualHead: number | null
  preferredColumnX: number | null
  preferredColumnAnchorPos: number | null
}

interface NoteVimModePluginOptions {
  isEnabled: () => boolean
  getKeyMappings?: () => NoteVimKeyMapping[]
  getParser?: () => Parser
  getSchema?: () => Schema
  getSerializer?: () => Serializer
  shouldIgnoreKeyDown?: () => boolean
  onModeChange?: (mode: NoteVimMode) => void
}

interface IndexedText {
  text: string
  positions: number[]
}

interface NoteVimRegister {
  plainText: string
  markdown: string | null
}

interface NoteVimMarkdownTools {
  getParser?: () => Parser
  getSchema?: () => Schema
  getSerializer?: () => Serializer
}

interface TextblockRange {
  from: number
  to: number
  contentEnd: number
  isEmpty: boolean
}

const noteVimModePluginKey = new PluginKey<NoteVimPluginState>('note-vim-mode')
const VIM_MAPPING_SEQUENCE_TIMEOUT_MS = 1000
const vimRegisters = new WeakMap<EditorView, NoteVimRegister>()
const initialVimState: NoteVimPluginState = {
  mode: 'insert',
  pendingKey: null,
  hasFocus: false,
  visualAnchor: null,
  visualHead: null,
  preferredColumnX: null,
  preferredColumnAnchorPos: null
}

function getVimState(state: EditorState): NoteVimPluginState {
  return noteVimModePluginKey.getState(state) ?? initialVimState
}

function dispatchVimState(view: EditorView, next: Partial<NoteVimPluginState>): void {
  view.dispatch(view.state.tr.setMeta(noteVimModePluginKey, next))
}

function resetPreferredColumn(view: EditorView): void {
  dispatchVimState(view, {
    preferredColumnX: null,
    preferredColumnAnchorPos: null
  })
}

function setMode(view: EditorView, mode: NoteVimMode): void {
  dispatchVimState(view, {
    mode,
    pendingKey: null,
    visualAnchor: mode === 'visual' || mode === 'visualLine' ? view.state.selection.from : null,
    visualHead: mode === 'visual' || mode === 'visualLine' ? view.state.selection.to : null
  })
}

function safeSelect(view: EditorView, pos: number, bias = 1): boolean {
  const { doc } = view.state
  const boundedPos = Math.max(0, Math.min(pos, doc.content.size))

  try {
    view.dispatch(
      view.state.tr.setSelection(TextSelection.near(doc.resolve(boundedPos), bias)).scrollIntoView()
    )
    return true
  } catch {
    return false
  }
}

function boundedDocPos(state: EditorState, pos: number): number {
  return Math.max(0, Math.min(pos, state.doc.content.size))
}

function setCursorAndVimState(
  view: EditorView,
  pos: number,
  next: Partial<NoteVimPluginState>,
  bias = -1
): boolean {
  const boundedPos = boundedDocPos(view.state, pos)

  try {
    view.dispatch(
      view.state.tr
        .setSelection(TextSelection.near(view.state.doc.resolve(boundedPos), bias))
        .setMeta(noteVimModePluginKey, {
          pendingKey: null,
          visualAnchor: null,
          visualHead: null,
          ...next
        })
        .scrollIntoView()
    )
    return true
  } catch {
    dispatchVimState(view, {
      pendingKey: null,
      visualAnchor: null,
      visualHead: null,
      ...next
    })
    return false
  }
}

function enterNormalMode(view: EditorView, pos = view.state.selection.from): boolean {
  const normalized = normalizeNormalModePosition(view.state, pos)
  return setCursorAndVimState(view, normalized.pos, { mode: 'normal' }, normalized.bias)
}

function enterInsertMode(view: EditorView, pos = view.state.selection.from): boolean {
  return setCursorAndVimState(view, pos, { mode: 'insert' })
}

function getCurrentTextblockBounds(state: EditorState): { from: number; to: number } {
  const { $from } = state.selection

  if (!$from.parent.isTextblock) {
    return { from: state.selection.from, to: state.selection.to }
  }

  const from = $from.start()
  return {
    from,
    to: from + $from.parent.content.size
  }
}

function getCurrentTextblockNodeBounds(state: EditorState): { from: number; to: number } {
  const { $from } = state.selection

  if (!$from.parent.isTextblock || $from.depth <= 0) {
    return getCurrentTextblockBounds(state)
  }

  return {
    from: $from.before($from.depth),
    to: $from.after($from.depth)
  }
}

function getTextblockBoundsAtPos(state: EditorState, pos: number): { from: number; to: number } {
  const boundedPos = boundedDocPos(state, pos)
  const resolvedPos = state.doc.resolve(boundedPos)

  if (!resolvedPos.parent.isTextblock) {
    return { from: boundedPos, to: boundedPos }
  }

  const from = resolvedPos.start()
  return {
    from,
    to: from + resolvedPos.parent.content.size
  }
}

function getVisualSelectionRange(
  state: EditorState,
  mode: Extract<NoteVimMode, 'visual' | 'visualLine'>,
  anchor: number,
  head: number
): { from: number; to: number } {
  const boundedAnchor = boundedDocPos(state, anchor)
  const boundedHead = boundedDocPos(state, head)

  if (mode === 'visualLine') {
    const anchorBounds = getTextblockBoundsAtPos(state, boundedAnchor)
    const headBounds = getTextblockBoundsAtPos(state, boundedHead)
    return {
      from: Math.min(anchorBounds.from, headBounds.from),
      to: Math.max(anchorBounds.to, headBounds.to)
    }
  }

  return {
    from: Math.min(boundedAnchor, boundedHead),
    to: Math.max(boundedAnchor, boundedHead)
  }
}

function setVisualSelection(
  view: EditorView,
  mode: Extract<NoteVimMode, 'visual' | 'visualLine'>,
  anchor: number,
  head: number
): boolean {
  const range = getVisualSelectionRange(view.state, mode, anchor, head)

  try {
    const selection =
      range.from === range.to
        ? TextSelection.near(view.state.doc.resolve(range.from), head >= anchor ? 1 : -1)
        : TextSelection.create(view.state.doc, range.from, range.to)
    view.dispatch(
      view.state.tr
        .setSelection(selection)
        .setMeta(noteVimModePluginKey, {
          mode,
          pendingKey: null,
          visualAnchor: boundedDocPos(view.state, anchor),
          visualHead: boundedDocPos(view.state, head)
        })
        .scrollIntoView()
    )
    return true
  } catch {
    return false
  }
}

function enterVisualMode(
  view: EditorView,
  mode: Extract<NoteVimMode, 'visual' | 'visualLine'>
): boolean {
  const anchor = view.state.selection.from
  const defaultHead =
    mode === 'visual' ? Math.min(anchor + 1, view.state.doc.content.size) : view.state.selection.to
  const head = view.state.selection.empty ? defaultHead : view.state.selection.to
  return setVisualSelection(view, mode, anchor, head)
}

function getTextblockCharacterBoundsAtPos(
  state: EditorState,
  pos: number
): { from: number; to: number; isEmpty: boolean } {
  const bounds = getTextblockBoundsAtPos(state, pos)
  return {
    from: bounds.from,
    to: bounds.to > bounds.from ? bounds.to - 1 : bounds.from,
    isEmpty: bounds.to <= bounds.from
  }
}

function getTextblockRangeAtPos(state: EditorState, pos: number): TextblockRange {
  const bounds = getTextblockBoundsAtPos(state, pos)
  return {
    from: bounds.from,
    to: bounds.to > bounds.from ? bounds.to - 1 : bounds.from,
    contentEnd: bounds.to,
    isEmpty: bounds.to <= bounds.from
  }
}

function getTextblockRanges(state: EditorState): TextblockRange[] {
  const ranges: TextblockRange[] = []

  state.doc.descendants((node, pos) => {
    if (!node.isTextblock) {
      return true
    }

    const from = pos + 1
    const contentEnd = from + node.content.size
    ranges.push({
      from,
      to: contentEnd > from ? contentEnd - 1 : from,
      contentEnd,
      isEmpty: contentEnd <= from
    })

    return false
  })

  return ranges
}

function findTextblockRangeIndex(ranges: TextblockRange[], currentRange: TextblockRange): number {
  return ranges.findIndex(
    (range) =>
      range.from === currentRange.from &&
      range.to === currentRange.to &&
      range.contentEnd === currentRange.contentEnd &&
      range.isEmpty === currentRange.isEmpty
  )
}

function normalizeNormalModePosition(
  state: EditorState,
  pos: number
): { pos: number; bias: number } {
  const boundedPos = boundedDocPos(state, pos)
  const bounds = getTextblockCharacterBoundsAtPos(state, boundedPos)

  if (bounds.isEmpty) {
    return {
      pos: bounds.from,
      bias: 1
    }
  }

  return {
    pos: Math.max(bounds.from, Math.min(boundedPos, bounds.to)),
    bias: -1
  }
}

function selectNormalModePosition(view: EditorView, pos: number): boolean {
  const normalized = normalizeNormalModePosition(view.state, pos)
  return safeSelect(view, normalized.pos, normalized.bias)
}

function lineStart(view: EditorView): boolean {
  return safeSelect(view, getCurrentTextblockBounds(view.state).from, -1)
}

function lineEnd(view: EditorView): boolean {
  return safeSelect(view, getCurrentTextblockBounds(view.state).to, 1)
}

function normalLineEnd(view: EditorView): boolean {
  return selectNormalModePosition(view, getCurrentTextblockBounds(view.state).to)
}

function lineStartPos(state: EditorState, pos: number): number {
  return getTextblockBoundsAtPos(state, pos).from
}

function lineEndPos(state: EditorState, pos: number): number {
  return getTextblockCharacterBoundsAtPos(state, pos).to
}

function appendAfterCursorPos(state: EditorState, pos: number): number {
  const bounds = getCurrentTextblockBounds(state)
  if (bounds.to <= bounds.from) {
    return bounds.from
  }

  return Math.min(pos + 1, bounds.to)
}

function buildTextIndex(state: EditorState): IndexedText {
  const textParts: string[] = []
  const positions: number[] = []

  state.doc.descendants((node, pos) => {
    if (!node.isText) {
      return true
    }

    const text = node.text ?? ''
    for (let index = 0; index < text.length; index += 1) {
      textParts.push(text[index] ?? '')
      positions.push(pos + 1 + index)
    }

    return false
  })

  return {
    text: textParts.join(''),
    positions
  }
}

function textIndexAtPos(indexedText: IndexedText, pos: number): number {
  const { positions } = indexedText

  if (positions.length === 0) {
    return -1
  }

  for (let index = 0; index < positions.length; index += 1) {
    const indexedPos = positions[index]
    if (typeof indexedPos === 'number' && indexedPos >= pos) {
      return index
    }
  }

  return positions.length - 1
}

function isWordChar(value: string | undefined): boolean {
  return Boolean(value && /[\p{Letter}\p{Number}_]/u.test(value))
}

function wordStartAfter(state: EditorState, pos: number): number | null {
  const indexedText = buildTextIndex(state)
  const currentIndex = textIndexAtPos(indexedText, pos)

  if (currentIndex < 0) {
    return null
  }

  let nextIndex = currentIndex

  if (isWordChar(indexedText.text[nextIndex])) {
    while (nextIndex < indexedText.text.length && isWordChar(indexedText.text[nextIndex])) {
      nextIndex += 1
    }
  }

  while (nextIndex < indexedText.text.length && !isWordChar(indexedText.text[nextIndex])) {
    nextIndex += 1
  }

  return indexedText.positions[nextIndex] ?? null
}

function wordStartBefore(state: EditorState, pos: number): number | null {
  const indexedText = buildTextIndex(state)
  let currentIndex = textIndexAtPos(indexedText, pos) - 1

  if (currentIndex < 0) {
    return indexedText.positions[0] ?? null
  }

  while (currentIndex > 0 && !isWordChar(indexedText.text[currentIndex])) {
    currentIndex -= 1
  }

  while (currentIndex > 0 && isWordChar(indexedText.text[currentIndex - 1])) {
    currentIndex -= 1
  }

  return indexedText.positions[currentIndex] ?? null
}

function wordEndAfter(state: EditorState, pos: number): number | null {
  const indexedText = buildTextIndex(state)
  let currentIndex = textIndexAtPos(indexedText, pos)

  if (currentIndex < 0) {
    return null
  }

  while (currentIndex < indexedText.text.length && !isWordChar(indexedText.text[currentIndex])) {
    currentIndex += 1
  }

  while (
    currentIndex + 1 < indexedText.text.length &&
    isWordChar(indexedText.text[currentIndex + 1])
  ) {
    currentIndex += 1
  }

  const endPos = indexedText.positions[currentIndex]
  return typeof endPos === 'number' ? endPos : null
}

function firstTextPosition(state: EditorState): number {
  const indexedText = buildTextIndex(state)
  return indexedText.positions[0] ?? 0
}

function lastTextPosition(state: EditorState): number {
  const indexedText = buildTextIndex(state)
  const last = indexedText.positions[indexedText.positions.length - 1]
  return typeof last === 'number' ? last : state.doc.content.size
}

function findClosestColumnPosition(
  view: EditorView,
  range: TextblockRange,
  preferredColumnX: number
): number {
  if (range.isEmpty) {
    return range.from
  }

  let bestPos = range.from
  let bestDistance = Number.POSITIVE_INFINITY

  for (let pos = range.from; pos <= range.to; pos += 1) {
    try {
      const distance = Math.abs(view.coordsAtPos(pos).left - preferredColumnX)
      if (distance < bestDistance || (distance === bestDistance && pos < bestPos)) {
        bestDistance = distance
        bestPos = pos
      }
    } catch {
      continue
    }
  }

  return bestPos
}

function resolvePreferredColumnX(view: EditorView, pos: number): number {
  const currentPos = normalizeNormalModePosition(view.state, pos).pos
  const vimState = getVimState(view.state)

  if (
    typeof vimState.preferredColumnX === 'number' &&
    vimState.preferredColumnAnchorPos === currentPos
  ) {
    return vimState.preferredColumnX
  }

  return view.coordsAtPos(currentPos).left
}

function resolveVerticalTarget(
  view: EditorView,
  pos: number,
  direction: 'up' | 'down'
): { target: number; preferredColumnX: number } | null {
  const currentPos = normalizeNormalModePosition(view.state, pos).pos
  const ranges = getTextblockRanges(view.state)
  const currentRange = getTextblockRangeAtPos(view.state, currentPos)
  const currentIndex = findTextblockRangeIndex(ranges, currentRange)

  if (currentIndex < 0) {
    return null
  }

  const targetIndex = direction === 'down' ? currentIndex + 1 : currentIndex - 1
  const targetRange = ranges[targetIndex]
  if (!targetRange) {
    return null
  }

  const preferredColumnX = resolvePreferredColumnX(view, currentPos)
  return {
    target: findClosestColumnPosition(view, targetRange, preferredColumnX),
    preferredColumnX
  }
}

function moveVertically(view: EditorView, direction: 'up' | 'down'): boolean {
  const motion = resolveVerticalTarget(view, view.state.selection.from, direction)

  if (!motion) {
    return false
  }

  const moved = selectNormalModePosition(view, motion.target)
  if (moved) {
    dispatchVimState(view, {
      preferredColumnX: motion.preferredColumnX,
      preferredColumnAnchorPos: view.state.selection.from
    })
  }

  return moved
}

function getMotionTarget(view: EditorView, key: string, fromPos: number): number | null {
  const lineBounds = getTextblockCharacterBoundsAtPos(view.state, fromPos)

  switch (key) {
    case 'h':
      return Math.max(lineBounds.from, fromPos - 1)
    case 'l':
      return Math.min(lineBounds.to, fromPos + 1)
    case 'j': {
      const motion = resolveVerticalTarget(view, fromPos, 'down')
      return motion?.target ?? null
    }
    case 'k': {
      const motion = resolveVerticalTarget(view, fromPos, 'up')
      return motion?.target ?? null
    }
    case 'w':
      return wordStartAfter(view.state, fromPos)
    case 'b':
      return wordStartBefore(view.state, fromPos)
    case 'e':
      return wordEndAfter(view.state, fromPos)
    case '0':
    case '^':
      return lineStartPos(view.state, fromPos)
    case '$':
      return lineEndPos(view.state, fromPos)
    case 'G':
      return lastTextPosition(view.state)
    default:
      return null
  }
}

function deleteRange(view: EditorView, from: number, to: number): boolean {
  if (to <= from) {
    return false
  }

  view.dispatch(view.state.tr.delete(from, to).scrollIntoView())
  return true
}

function deleteSelectionAndEnterNormal(view: EditorView): boolean {
  resetPreferredColumn(view)
  const { from, to } = view.state.selection

  if (to <= from) {
    return enterNormalMode(view, from)
  }

  const nextPos = Math.min(from, view.state.doc.content.size)
  view.dispatch(view.state.tr.delete(from, to).scrollIntoView())
  return enterNormalMode(view, Math.min(nextPos, view.state.doc.content.size))
}

function serializeSelectionMarkdown(view: EditorView, tools: NoteVimMarkdownTools): string | null {
  const schema = tools.getSchema?.()
  const serializer = tools.getSerializer?.()
  if (!schema || !serializer || view.state.selection.empty) {
    return null
  }

  const slice = view.state.selection.content()
  const doc = schema.topNodeType.createAndFill(undefined, slice.content)
  if (!doc) {
    return null
  }

  const markdown = serializer(doc).trim()
  return markdown.length > 0 ? markdown : null
}

function getVimRegister(view: EditorView): NoteVimRegister | null {
  return vimRegisters.get(view) ?? null
}

function setVimRegister(view: EditorView, register: NoteVimRegister): void {
  vimRegisters.set(view, register)
}

function sliceFromMarkdown(markdown: string, tools: NoteVimMarkdownTools): Slice | null {
  const parser = tools.getParser?.()
  if (!parser || !markdown.trim()) {
    return null
  }

  try {
    const parsed = parser(markdown)
    if (!parsed || typeof parsed === 'string') {
      return null
    }

    return new Slice(parsed.content, 0, 0)
  } catch (error) {
    console.warn('Failed to parse note editor Vim register markdown:', error)
    return null
  }
}

function pasteSliceAt(view: EditorView, slice: Slice, pos: number): boolean {
  const insertAt = boundedDocPos(view.state, pos)
  view.dispatch(
    view.state.tr
      .setSelection(TextSelection.near(view.state.doc.resolve(insertAt), -1))
      .replaceSelection(slice)
      .scrollIntoView()
  )
  const nextPos = Math.min(insertAt + slice.size, view.state.doc.content.size)
  return enterNormalMode(view, nextPos)
}

function yankSelectionAndEnterNormal(view: EditorView, tools: NoteVimMarkdownTools): boolean {
  resetPreferredColumn(view)
  const { from, to } = view.state.selection
  const selectedText = to > from ? view.state.doc.textBetween(from, to, '\n') : ''
  const markdown = serializeSelectionMarkdown(view, tools)

  if (selectedText) {
    setVimRegister(view, {
      plainText: selectedText,
      markdown
    })
    void navigator.clipboard.writeText(selectedText).catch((error: unknown) => {
      console.warn('Failed to yank note editor selection:', error)
    })
  }

  return enterNormalMode(view, from)
}

function pastePlainTextAt(view: EditorView, text: string, pos: number): boolean {
  resetPreferredColumn(view)
  const insertAt = boundedDocPos(view.state, pos)
  view.dispatch(view.state.tr.insertText(text, insertAt).scrollIntoView())
  const nextPos = Math.min(insertAt + text.length, view.state.doc.content.size)
  return enterNormalMode(view, nextPos)
}

function pasteClipboardText(
  view: EditorView,
  placement: 'after' | 'before',
  tools: NoteVimMarkdownTools
): boolean {
  const selectionFrom = view.state.selection.from
  const insertAt =
    placement === 'after'
      ? appendAfterCursorPos(view.state, selectionFrom)
      : boundedDocPos(view.state, selectionFrom)
  const register = getVimRegister(view)
  const registerMarkdownSlice = register?.markdown
    ? sliceFromMarkdown(register.markdown, tools)
    : null

  if (registerMarkdownSlice) {
    return pasteSliceAt(view, registerMarkdownSlice, insertAt)
  }

  if (register?.plainText) {
    return pastePlainTextAt(view, register.plainText, insertAt)
  }

  void navigator.clipboard
    .readText()
    .then((clipboardText) => {
      if (!clipboardText) {
        return
      }

      const currentInsertAt = boundedDocPos(view.state, insertAt)
      pastePlainTextAt(view, clipboardText, currentInsertAt)
    })
    .catch((error: unknown) => {
      console.warn('Failed to paste note editor clipboard text:', error)
    })

  return true
}

function deleteCurrentTextblock(view: EditorView): boolean {
  resetPreferredColumn(view)
  const bounds = getCurrentTextblockNodeBounds(view.state)
  if (bounds.to <= bounds.from) {
    return false
  }

  view.dispatch(view.state.tr.delete(bounds.from, bounds.to).scrollIntoView())
  return enterNormalMode(view, Math.min(bounds.from, view.state.doc.content.size))
}

function splitAtSelection(view: EditorView): boolean {
  return splitBlock(view.state, (transaction) => view.dispatch(transaction), view)
}

function isPrintableMappingInput(value: string): boolean {
  return value.length > 0 && /^[\x20-\x7E]+$/.test(value)
}

function getMappingsForMode(
  mappings: NoteVimKeyMapping[] | undefined,
  mode: NoteVimMode
): NoteVimKeyMapping[] {
  return (mappings ?? []).filter((mapping) => mapping.mode === mode)
}

function runVimMappingAction(
  view: EditorView,
  action: NoteVimMappingAction,
  tools: NoteVimMarkdownTools
): boolean {
  resetPreferredColumn(view)
  switch (action) {
    case 'enterNormalMode':
      return enterNormalMode(view)
    case 'enterInsertMode':
      return enterInsertMode(view)
    case 'appendAfterCursor':
      safeSelect(view, appendAfterCursorPos(view.state, view.state.selection.from), 1)
      setMode(view, 'insert')
      return true
    case 'appendLineEnd':
      lineEnd(view)
      setMode(view, 'insert')
      return true
    case 'openLineBelow':
      lineEnd(view)
      splitAtSelection(view)
      setMode(view, 'insert')
      return true
    case 'openLineAbove':
      lineStart(view)
      splitAtSelection(view)
      setMode(view, 'insert')
      return true
    case 'pasteAfterCursor':
      return pasteClipboardText(view, 'after', tools)
    case 'pasteBeforeCursor':
      return pasteClipboardText(view, 'before', tools)
    case 'deleteSelection':
      return deleteSelectionAndEnterNormal(view)
    case 'yankSelection':
      return yankSelectionAndEnterNormal(view, tools)
    default:
      return false
  }
}

function runInsertModeMappingAction(
  view: EditorView,
  action: NoteVimMappingAction,
  deleteFrom: number,
  deleteTo: number
): boolean {
  if (action !== 'enterNormalMode') {
    return false
  }

  resetPreferredColumn(view)
  let tr = view.state.tr
  if (deleteTo > deleteFrom) {
    tr = tr.delete(deleteFrom, deleteTo)
  }

  const nextPos = Math.min(deleteFrom, tr.doc.content.size)
  view.dispatch(tr.scrollIntoView())
  return enterNormalMode(view, nextPos)
}

function handleInsertModeKey(view: EditorView, event: KeyboardEvent): boolean {
  if (event.key !== 'Escape') {
    return false
  }

  event.preventDefault()
  resetPreferredColumn(view)
  return enterNormalMode(view)
}

function handlePendingKey(
  view: EditorView,
  key: string,
  pendingKey: NoteVimPluginState['pendingKey']
): boolean {
  if (pendingKey === 'g') {
    if (key === 'g') {
      selectNormalModePosition(view, firstTextPosition(view.state))
    }
    dispatchVimState(view, { pendingKey: null })
    return true
  }

  if (pendingKey === 'd') {
    if (key === 'd') {
      deleteCurrentTextblock(view)
    } else if (key === 'w') {
      const to = wordStartAfter(view.state, view.state.selection.from)
      if (typeof to === 'number') {
        deleteRange(view, view.state.selection.from, to)
      }
    }
    dispatchVimState(view, { pendingKey: null })
    return true
  }

  return false
}

function handleNormalModeKey(
  view: EditorView,
  event: KeyboardEvent,
  tools: NoteVimMarkdownTools
): boolean {
  const key = event.key
  const vimState = getVimState(view.state)

  if (event.metaKey || event.ctrlKey || event.altKey) {
    return false
  }

  event.preventDefault()

  if (key !== 'j' && key !== 'k') {
    resetPreferredColumn(view)
  }

  if (handlePendingKey(view, key, vimState.pendingKey)) {
    return true
  }

  switch (key) {
    case 'Escape':
      dispatchVimState(view, { pendingKey: null })
      return true
    case 'i':
      setMode(view, 'insert')
      return true
    case 'a':
      safeSelect(view, appendAfterCursorPos(view.state, view.state.selection.from), 1)
      setMode(view, 'insert')
      return true
    case 'A':
      lineEnd(view)
      setMode(view, 'insert')
      return true
    case 'o':
      lineEnd(view)
      splitAtSelection(view)
      setMode(view, 'insert')
      return true
    case 'O':
      lineStart(view)
      splitAtSelection(view)
      setMode(view, 'insert')
      return true
    case 'v':
      return enterVisualMode(view, 'visual')
    case 'V':
      return enterVisualMode(view, 'visualLine')
    case 'h':
      return selectNormalModePosition(view, view.state.selection.from - 1)
    case 'l':
      return selectNormalModePosition(view, view.state.selection.from + 1)
    case 'j':
      return moveVertically(view, 'down')
    case 'k':
      return moveVertically(view, 'up')
    case 'w': {
      const pos = wordStartAfter(view.state, view.state.selection.from)
      return typeof pos === 'number' ? selectNormalModePosition(view, pos) : true
    }
    case 'b': {
      const pos = wordStartBefore(view.state, view.state.selection.from)
      return typeof pos === 'number' ? selectNormalModePosition(view, pos) : true
    }
    case 'e': {
      const pos = wordEndAfter(view.state, view.state.selection.from)
      return typeof pos === 'number' ? selectNormalModePosition(view, pos) : true
    }
    case '0':
    case '^':
      return selectNormalModePosition(view, lineStartPos(view.state, view.state.selection.from))
    case '$':
      return normalLineEnd(view)
    case 'G':
      return selectNormalModePosition(view, lastTextPosition(view.state))
    case 'g':
      dispatchVimState(view, { pendingKey: 'g' })
      return true
    case 'd':
      dispatchVimState(view, { pendingKey: 'd' })
      return true
    case 'x':
      return deleteRange(view, view.state.selection.from, view.state.selection.from + 1)
    case 'D':
      return deleteRange(view, view.state.selection.from, getCurrentTextblockBounds(view.state).to)
    case 'p':
      return pasteClipboardText(view, 'after', tools)
    case 'P':
      return pasteClipboardText(view, 'before', tools)
    case 'u':
      undo(view.state, (transaction) => view.dispatch(transaction), view)
      return true
    default:
      return key.length === 1
  }
}

function handleVisualModeKey(
  view: EditorView,
  event: KeyboardEvent,
  tools: NoteVimMarkdownTools
): boolean {
  const key = event.key
  const vimState = getVimState(view.state)
  const mode = vimState.mode === 'visualLine' ? 'visualLine' : 'visual'

  if (event.metaKey || event.ctrlKey || event.altKey) {
    return false
  }

  event.preventDefault()

  if (key !== 'j' && key !== 'k') {
    resetPreferredColumn(view)
  }

  if (vimState.pendingKey === 'g') {
    if (key === 'g') {
      const anchor = vimState.visualAnchor ?? view.state.selection.from
      return setVisualSelection(view, mode, anchor, firstTextPosition(view.state))
    }

    dispatchVimState(view, { pendingKey: null })
    return true
  }

  switch (key) {
    case 'Escape':
      return enterNormalMode(view, view.state.selection.from)
    case 'i':
      return enterInsertMode(view, view.state.selection.from)
    case 'v':
      return mode === 'visual'
        ? enterNormalMode(view, view.state.selection.from)
        : enterVisualMode(view, 'visual')
    case 'V':
      return mode === 'visualLine'
        ? enterNormalMode(view, view.state.selection.from)
        : enterVisualMode(view, 'visualLine')
    case 'g':
      dispatchVimState(view, { pendingKey: 'g' })
      return true
    case 'd':
    case 'x':
      return deleteSelectionAndEnterNormal(view)
    case 'y':
      return yankSelectionAndEnterNormal(view, tools)
    default: {
      const anchor = vimState.visualAnchor ?? view.state.selection.from
      const head = vimState.visualHead ?? view.state.selection.to
      const target = getMotionTarget(view, key, head)
      if (typeof target !== 'number') {
        return key.length === 1
      }

      const didSetSelection = setVisualSelection(view, mode, anchor, target)
      if (!didSetSelection) {
        return false
      }

      if (key === 'j' || key === 'k') {
        dispatchVimState(view, {
          preferredColumnX: resolvePreferredColumnX(view, head),
          preferredColumnAnchorPos: target
        })
      }

      return true
    }
  }
}

function createBlockCursorWidget(): HTMLSpanElement {
  const element = document.createElement('span')
  element.className = 'note-vim-block-cursor-empty'
  element.setAttribute('aria-hidden', 'true')
  return element
}

function getBlockCursorDecorations(state: EditorState): DecorationSet {
  const vimState = getVimState(state)
  const { selection } = state

  if (
    vimState.mode !== 'normal' ||
    !vimState.hasFocus ||
    !selection.empty ||
    !(selection instanceof TextSelection)
  ) {
    return DecorationSet.empty
  }

  const pos = selection.from
  const decorations: Decoration[] = []
  const bounds = getTextblockCharacterBoundsAtPos(state, pos)

  if (!bounds.isEmpty) {
    const normalized = normalizeNormalModePosition(state, pos)
    decorations.push(
      Decoration.inline(normalized.pos, normalized.pos + 1, {
        class: 'note-vim-block-cursor-char'
      })
    )
    return DecorationSet.create(state.doc, decorations)
  }

  decorations.push(
    Decoration.widget(pos, createBlockCursorWidget, {
      side: -1
    })
  )
  return DecorationSet.create(state.doc, decorations)
}

export function createNoteVimModePlugin({
  isEnabled,
  getKeyMappings,
  getParser,
  getSchema,
  getSerializer,
  shouldIgnoreKeyDown,
  onModeChange
}: NoteVimModePluginOptions): Plugin {
  let lastReportedMode: NoteVimMode = initialVimState.mode
  let insertMappingSequence = ''
  let insertMappingTimestamp = 0
  let normalMappingSequence = ''
  let normalMappingTimestamp = 0
  let visualMappingSequence = ''
  let visualMappingTimestamp = 0
  let visualLineMappingSequence = ''
  let visualLineMappingTimestamp = 0
  const markdownTools: NoteVimMarkdownTools = {
    getParser,
    getSchema,
    getSerializer
  }

  const resetMappingSequences = (): void => {
    insertMappingSequence = ''
    insertMappingTimestamp = 0
    normalMappingSequence = ''
    normalMappingTimestamp = 0
    visualMappingSequence = ''
    visualMappingTimestamp = 0
    visualLineMappingSequence = ''
    visualLineMappingTimestamp = 0
  }

  const resolveNextSequence = (
    currentSequence: string,
    currentTimestamp: number,
    nextInput: string
  ): string => {
    const now = Date.now()
    return now - currentTimestamp <= VIM_MAPPING_SEQUENCE_TIMEOUT_MS
      ? currentSequence + nextInput
      : nextInput
  }

  const getCommandMappingState = (
    mode: Exclude<NoteVimMode, 'insert'>
  ): { sequence: string; timestamp: number } => {
    if (mode === 'visual') {
      return { sequence: visualMappingSequence, timestamp: visualMappingTimestamp }
    }

    if (mode === 'visualLine') {
      return { sequence: visualLineMappingSequence, timestamp: visualLineMappingTimestamp }
    }

    return { sequence: normalMappingSequence, timestamp: normalMappingTimestamp }
  }

  const setCommandMappingState = (
    mode: Exclude<NoteVimMode, 'insert'>,
    sequence: string,
    timestamp: number
  ): void => {
    if (mode === 'visual') {
      visualMappingSequence = sequence
      visualMappingTimestamp = timestamp
      return
    }

    if (mode === 'visualLine') {
      visualLineMappingSequence = sequence
      visualLineMappingTimestamp = timestamp
      return
    }

    normalMappingSequence = sequence
    normalMappingTimestamp = timestamp
  }

  return new Plugin<NoteVimPluginState>({
    key: noteVimModePluginKey,
    state: {
      init: () => initialVimState,
      apply(transaction, previousState) {
        const meta = transaction.getMeta(noteVimModePluginKey) as
          | Partial<NoteVimPluginState>
          | undefined

        if (!meta) {
          return previousState
        }

        return {
          ...previousState,
          ...meta
        }
      }
    },
    view(view) {
      onModeChange?.(getVimState(view.state).mode)

      return {
        update(nextView) {
          const mode = getVimState(nextView.state).mode
          if (mode === lastReportedMode) {
            return
          }

          lastReportedMode = mode
          onModeChange?.(mode)
        }
      }
    },
    props: {
      decorations(state) {
        return getBlockCursorDecorations(state)
      },
      handleDOMEvents: {
        focus(view) {
          if (isEnabled()) {
            resetMappingSequences()
            dispatchVimState(view, {
              mode: 'insert',
              pendingKey: null,
              hasFocus: true,
              visualAnchor: null,
              visualHead: null,
              preferredColumnX: null,
              preferredColumnAnchorPos: null
            })
          }
          return false
        },
        mousedown(view) {
          dispatchVimState(view, {
            preferredColumnX: null,
            preferredColumnAnchorPos: null
          })
          return false
        },
        blur(view) {
          dispatchVimState(view, {
            hasFocus: false,
            pendingKey: null,
            visualAnchor: null,
            visualHead: null,
            preferredColumnX: null,
            preferredColumnAnchorPos: null
          })
          return false
        }
      },
      handleTextInput(view, from, to, text) {
        if (!isEnabled() || shouldIgnoreKeyDown?.() || !isPrintableMappingInput(text)) {
          return false
        }

        const vimState = getVimState(view.state)
        if (vimState.mode !== 'insert') {
          return false
        }

        const mappings = getMappingsForMode(getKeyMappings?.(), 'insert')
        if (mappings.length === 0) {
          return false
        }

        const nextSequence = resolveNextSequence(
          insertMappingSequence,
          insertMappingTimestamp,
          text
        )
        const matchingMapping = mappings.find((mapping) => mapping.sequence === nextSequence)
        const hasPrefix = mappings.some(
          (mapping) =>
            mapping.sequence !== nextSequence && mapping.sequence.startsWith(nextSequence)
        )

        if (matchingMapping) {
          const previousLength = nextSequence.length - text.length
          const deleteFrom = Math.max(0, from - previousLength)
          resetMappingSequences()
          return runInsertModeMappingAction(view, matchingMapping.action, deleteFrom, to)
        }

        if (hasPrefix) {
          insertMappingSequence = nextSequence
          insertMappingTimestamp = Date.now()
          return false
        }

        insertMappingSequence = ''
        insertMappingTimestamp = 0
        return false
      },
      handleKeyDown(view, event) {
        if (!isEnabled()) {
          return false
        }

        if (shouldIgnoreKeyDown?.()) {
          resetMappingSequences()
          return false
        }

        const vimState = getVimState(view.state)
        if (vimState.mode === 'insert' && event.key !== 'Escape' && event.key.length > 1) {
          insertMappingSequence = ''
          insertMappingTimestamp = 0
        }

        if (
          vimState.mode !== 'insert' &&
          !event.metaKey &&
          !event.ctrlKey &&
          !event.altKey &&
          isPrintableMappingInput(event.key)
        ) {
          const mode = vimState.mode
          const mappings = getMappingsForMode(getKeyMappings?.(), mode)
          const mappingState = getCommandMappingState(mode)
          const nextSequence = resolveNextSequence(
            mappingState.sequence,
            mappingState.timestamp,
            event.key
          )
          const matchingMapping = mappings.find((mapping) => mapping.sequence === nextSequence)
          const hasPrefix = mappings.some(
            (mapping) =>
              mapping.sequence !== nextSequence && mapping.sequence.startsWith(nextSequence)
          )

          if (matchingMapping) {
            event.preventDefault()
            resetMappingSequences()
            return runVimMappingAction(view, matchingMapping.action, markdownTools)
          }

          if (hasPrefix) {
            event.preventDefault()
            resetPreferredColumn(view)
            setCommandMappingState(mode, nextSequence, Date.now())
            return true
          }

          setCommandMappingState(mode, '', 0)
        }

        if (vimState.mode === 'insert') {
          return handleInsertModeKey(view, event)
        }

        if (vimState.mode === 'visual' || vimState.mode === 'visualLine') {
          return handleVisualModeKey(view, event, markdownTools)
        }

        return handleNormalModeKey(view, event, markdownTools)
      }
    }
  })
}
