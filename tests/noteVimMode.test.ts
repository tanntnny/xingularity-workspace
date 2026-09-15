import { describe, expect, it } from 'vitest'
import { Schema } from 'prosemirror-model'
import { EditorState, TextSelection } from 'prosemirror-state'
import type { EditorView } from '@milkdown/kit/prose/view'
import {
  __noteVimModeTestUtils,
  createNoteVimModePlugin
} from '../src/renderer/src/lib/noteVimMode'

function createState(text: string): EditorState {
  return createStateFromParagraphs([text])
}

function createStateFromParagraphs(paragraphs: string[]): EditorState {
  const schema = new Schema({
    nodes: {
      doc: { content: 'block+' },
      paragraph: {
        content: 'text*',
        group: 'block',
        toDOM() {
          return ['p', 0]
        }
      },
      text: { group: 'inline' }
    }
  })

  return EditorState.create({
    schema,
    doc: schema.node(
      'doc',
      null,
      paragraphs.map((paragraph) =>
        schema.node('paragraph', null, paragraph.length > 0 ? [schema.text(paragraph)] : [])
      )
    )
  })
}

function createVimCodeBlockView(selectionPosition = 9): {
  view: EditorView
  getState: () => EditorState
} {
  const schema = new Schema({
    nodes: {
      doc: { content: 'block+' },
      paragraph: {
        content: 'text*',
        group: 'block',
        toDOM() {
          return ['p', 0]
        }
      },
      code_block: {
        content: 'text*',
        group: 'block',
        code: true,
        marks: '',
        toDOM() {
          return ['pre', ['code', 0]]
        }
      },
      text: { group: 'inline' }
    }
  })
  const doc = schema.node('doc', null, [
    schema.node('paragraph', null, schema.text('Before')),
    schema.node('code_block', null, schema.text('alpha\nbeta')),
    schema.node('paragraph', null, schema.text('After'))
  ])
  const plugin = createNoteVimModePlugin({ isEnabled: () => true })
  let state = EditorState.create({
    schema,
    doc,
    selection: TextSelection.create(doc, selectionPosition),
    plugins: [plugin]
  })
  const view = {
    get state() {
      return state
    },
    dispatch(transaction: Parameters<EditorView['dispatch']>[0]) {
      state = state.apply(transaction)
    }
  } as unknown as EditorView

  return { view, getState: () => state }
}

function createVimKeyEvent(key: string, onPreventDefault?: () => void): KeyboardEvent {
  return {
    key,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    preventDefault: () => onPreventDefault?.()
  } as KeyboardEvent
}

describe('noteVimMode word motions', () => {
  it('resolves logical line boundaries inside multiline text', () => {
    const getLogicalLineBounds = (
      __noteVimModeTestUtils as typeof __noteVimModeTestUtils & {
        getLogicalLineBounds?: (text: string, offset: number) => { start: number; end: number }
      }
    ).getLogicalLineBounds

    expect(getLogicalLineBounds).toEqual(expect.any(Function))
    expect(getLogicalLineBounds?.('alpha\nbeta', 2)).toEqual({ start: 0, end: 5 })
    expect(getLogicalLineBounds?.('alpha\nbeta', 7)).toEqual({ start: 6, end: 10 })
  })

  it('indexes text using document character positions', () => {
    const state = createState('map sun wax')

    expect(__noteVimModeTestUtils.buildTextIndex(state)).toEqual({
      text: 'map sun wax',
      positions: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
    })
  })

  it('moves `w` to the next word start', () => {
    const state = createState('map sun wax')

    expect(__noteVimModeTestUtils.wordStartAfter(state, 1)).toBe(5)
    expect(__noteVimModeTestUtils.wordStartAfter(state, 3)).toBe(5)
    expect(__noteVimModeTestUtils.wordStartAfter(state, 4)).toBe(5)
    expect(__noteVimModeTestUtils.wordStartAfter(state, 5)).toBe(9)
  })

  it('moves `b` to the expected word start', () => {
    const state = createState('map sun wax')

    expect(__noteVimModeTestUtils.wordStartBefore(state, 9)).toBe(5)
    expect(__noteVimModeTestUtils.wordStartBefore(state, 6)).toBe(5)
    expect(__noteVimModeTestUtils.wordStartBefore(state, 5)).toBe(1)
  })

  it('moves repeated `e` calls across word boundaries', () => {
    const state = createState('map sun wax')

    expect(__noteVimModeTestUtils.wordEndAfter(state, 1)).toBe(3)
    expect(__noteVimModeTestUtils.wordEndAfter(state, 3)).toBe(7)
    expect(__noteVimModeTestUtils.wordEndAfter(state, 4)).toBe(7)
    expect(__noteVimModeTestUtils.wordEndAfter(state, 7)).toBe(11)
  })

  it('treats paragraph boundaries as word separators', () => {
    const state = createStateFromParagraphs(['one', 'two', 'three', 'four five'])

    expect(__noteVimModeTestUtils.buildTextIndex(state).text).toBe('one\ntwo\nthree\nfour five')
    expect(__noteVimModeTestUtils.wordStartAfter(state, 1)).toBe(6)
    expect(__noteVimModeTestUtils.wordStartAfter(state, 6)).toBe(11)
    expect(__noteVimModeTestUtils.wordStartAfter(state, 11)).toBe(18)
    expect(__noteVimModeTestUtils.wordEndAfter(state, 3)).toBe(8)
    expect(__noteVimModeTestUtils.wordStartBefore(state, 23)).toBe(18)
  })

  it('moves by logical lines inside a multiline code block', () => {
    const { view, getState } = createVimCodeBlockView()
    const plugin = createNoteVimModePlugin({ isEnabled: () => true })
    const handler = plugin.props.handleKeyDown

    expect(handler).toBeTypeOf('function')
    handler?.call(plugin, view, createVimKeyEvent('Escape'))
    handler?.call(plugin, view, createVimKeyEvent('j'))

    expect(getState().selection.$from.parent.type.name).toBe('code_block')
    expect(getState().selection.$from.parentOffset).toBe(6)
  })

  it('consumes normal-mode Enter without mutating and yields unsupported special keys', () => {
    const { view, getState } = createVimCodeBlockView(11)
    const plugin = createNoteVimModePlugin({ isEnabled: () => true })
    const handler = plugin.props.handleKeyDown
    const before = getState().doc.toJSON()
    let enterPrevented = false

    handler?.call(plugin, view, createVimKeyEvent('Escape'))
    expect(
      handler?.call(
        plugin,
        view,
        createVimKeyEvent('Enter', () => (enterPrevented = true))
      )
    ).toBe(true)
    expect(enterPrevented).toBe(true)
    expect(getState().doc.toJSON()).toEqual(before)

    let arrowPrevented = false
    expect(
      handler?.call(
        plugin,
        view,
        createVimKeyEvent('ArrowLeft', () => (arrowPrevented = true))
      )
    ).toBe(false)
    expect(arrowPrevented).toBe(false)
  })

  it('moves one character left when leaving insert mode', () => {
    const state = createState('map sun wax')

    expect(__noteVimModeTestUtils.resolveInsertModeExitPos(state, 1)).toBe(1)
    expect(__noteVimModeTestUtils.resolveInsertModeExitPos(state, 2)).toBe(1)
    expect(__noteVimModeTestUtils.resolveInsertModeExitPos(state, 5)).toBe(4)
    expect(__noteVimModeTestUtils.resolveInsertModeExitPos(state, 12)).toBe(11)
  })
})
