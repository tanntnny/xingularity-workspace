import { splitBlock } from '@milkdown/kit/prose/commands'
import { undo } from '@milkdown/kit/prose/history'
import { Plugin, PluginKey, TextSelection } from '@milkdown/kit/prose/state'
import type { EditorState } from '@milkdown/kit/prose/state'
import type { EditorView } from '@milkdown/kit/prose/view'

export type NoteVimMode = 'insert' | 'normal'

interface NoteVimPluginState {
  mode: NoteVimMode
  pendingKey: 'd' | 'g' | null
}

interface NoteVimModePluginOptions {
  isEnabled: () => boolean
  shouldIgnoreKeyDown?: () => boolean
  onModeChange?: (mode: NoteVimMode) => void
}

interface IndexedText {
  text: string
  positions: number[]
}

const noteVimModePluginKey = new PluginKey<NoteVimPluginState>('note-vim-mode')
const initialVimState: NoteVimPluginState = {
  mode: 'insert',
  pendingKey: null
}

function getVimState(state: EditorState): NoteVimPluginState {
  return noteVimModePluginKey.getState(state) ?? initialVimState
}

function dispatchVimState(view: EditorView, next: Partial<NoteVimPluginState>): void {
  view.dispatch(view.state.tr.setMeta(noteVimModePluginKey, next))
}

function setMode(view: EditorView, mode: NoteVimMode): void {
  dispatchVimState(view, { mode, pendingKey: null })
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

function lineStart(view: EditorView): boolean {
  return safeSelect(view, getCurrentTextblockBounds(view.state).from, -1)
}

function lineEnd(view: EditorView): boolean {
  return safeSelect(view, getCurrentTextblockBounds(view.state).to, 1)
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
  return typeof endPos === 'number' ? endPos + 1 : null
}

function firstTextPosition(state: EditorState): number {
  const indexedText = buildTextIndex(state)
  return indexedText.positions[0] ?? 0
}

function lastTextPosition(state: EditorState): number {
  const indexedText = buildTextIndex(state)
  const last = indexedText.positions[indexedText.positions.length - 1]
  return typeof last === 'number' ? last + 1 : state.doc.content.size
}

function moveVertically(view: EditorView, direction: 'up' | 'down'): boolean {
  const pos = view.state.selection.from
  const coords = view.coordsAtPos(pos)
  const lineHeight = Number.parseFloat(window.getComputedStyle(view.dom).lineHeight)
  const step = Number.isFinite(lineHeight) ? lineHeight : 22
  const target = view.posAtCoords({
    left: coords.left,
    top: direction === 'up' ? coords.top - step : coords.bottom + step
  })

  if (!target) {
    return false
  }

  return safeSelect(view, target.pos, direction === 'up' ? -1 : 1)
}

function deleteRange(view: EditorView, from: number, to: number): boolean {
  if (to <= from) {
    return false
  }

  view.dispatch(view.state.tr.delete(from, to).scrollIntoView())
  return true
}

function deleteCurrentTextblock(view: EditorView): boolean {
  const bounds = getCurrentTextblockBounds(view.state)
  return deleteRange(view, bounds.from, bounds.to)
}

function splitAtSelection(view: EditorView): boolean {
  return splitBlock(view.state, (transaction) => view.dispatch(transaction), view)
}

function handleInsertModeKey(view: EditorView, event: KeyboardEvent): boolean {
  if (event.key !== 'Escape') {
    return false
  }

  event.preventDefault()
  setMode(view, 'normal')
  return true
}

function handlePendingKey(
  view: EditorView,
  key: string,
  pendingKey: NoteVimPluginState['pendingKey']
): boolean {
  if (pendingKey === 'g') {
    if (key === 'g') {
      safeSelect(view, firstTextPosition(view.state), -1)
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

function handleNormalModeKey(view: EditorView, event: KeyboardEvent): boolean {
  const key = event.key
  const vimState = getVimState(view.state)

  if (event.metaKey || event.ctrlKey || event.altKey) {
    return false
  }

  event.preventDefault()

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
      safeSelect(view, view.state.selection.from + 1, 1)
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
    case 'h':
      return safeSelect(view, view.state.selection.from - 1, -1)
    case 'l':
      return safeSelect(view, view.state.selection.from + 1, 1)
    case 'j':
      return moveVertically(view, 'down')
    case 'k':
      return moveVertically(view, 'up')
    case 'w': {
      const pos = wordStartAfter(view.state, view.state.selection.from)
      return typeof pos === 'number' ? safeSelect(view, pos, 1) : true
    }
    case 'b': {
      const pos = wordStartBefore(view.state, view.state.selection.from)
      return typeof pos === 'number' ? safeSelect(view, pos, -1) : true
    }
    case 'e': {
      const pos = wordEndAfter(view.state, view.state.selection.from)
      return typeof pos === 'number' ? safeSelect(view, pos, 1) : true
    }
    case '0':
    case '^':
      return lineStart(view)
    case '$':
      return lineEnd(view)
    case 'G':
      return safeSelect(view, lastTextPosition(view.state), 1)
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
    case 'u':
      undo(view.state, (transaction) => view.dispatch(transaction), view)
      return true
    default:
      return key.length === 1
  }
}

export function createNoteVimModePlugin({
  isEnabled,
  shouldIgnoreKeyDown,
  onModeChange
}: NoteVimModePluginOptions): Plugin {
  let lastReportedMode: NoteVimMode = initialVimState.mode

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
      handleDOMEvents: {
        focus(view) {
          if (isEnabled()) {
            setMode(view, 'insert')
          }
          return false
        }
      },
      handleKeyDown(view, event) {
        if (!isEnabled()) {
          return false
        }

        if (shouldIgnoreKeyDown?.()) {
          return false
        }

        const vimState = getVimState(view.state)
        return vimState.mode === 'insert'
          ? handleInsertModeKey(view, event)
          : handleNormalModeKey(view, event)
      }
    }
  })
}
