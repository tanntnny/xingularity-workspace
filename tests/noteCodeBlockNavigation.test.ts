import { describe, expect, it } from 'vitest'
import { Schema } from '@milkdown/kit/prose/model'
import { EditorState, TextSelection } from '@milkdown/kit/prose/state'
import type { EditorView } from '@milkdown/kit/prose/view'
import { createNoteCodeBlockNavigationPlugin } from '../src/renderer/src/lib/noteCodeBlockNavigation'

function createCodeBlockState(selectionPosition: number): EditorState {
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

  return EditorState.create({
    schema,
    doc,
    selection: TextSelection.create(doc, selectionPosition)
  })
}

function createCodeBlockView(selectionPosition: number): {
  view: EditorView
  getState: () => EditorState
} {
  let state = createCodeBlockState(selectionPosition)
  const view = {
    get state() {
      return state
    },
    dispatch(transaction: Parameters<EditorView['dispatch']>[0]) {
      state = state.apply(transaction)
    }
  } as unknown as EditorView

  return {
    view,
    getState: () => state
  }
}

function createKeyEvent(
  key: string,
  options: { ctrlKey?: boolean; metaKey?: boolean } = {}
): { event: KeyboardEvent; wasPrevented: () => boolean } {
  let prevented = false
  const event = {
    key,
    altKey: false,
    ctrlKey: options.ctrlKey ?? false,
    metaKey: options.metaKey ?? false,
    shiftKey: false,
    preventDefault() {
      prevented = true
    }
  } as KeyboardEvent

  return {
    event,
    wasPrevented: () => prevented
  }
}

function handleCodeBlockKey(view: EditorView, event: KeyboardEvent): boolean {
  const plugin = createNoteCodeBlockNavigationPlugin()
  return plugin.props.handleKeyDown?.call(plugin, view, event) === true
}

describe('note code block navigation', () => {
  const codeStart = 9
  const codeEnd = codeStart + 'alpha\nbeta'.length

  it('leaves a code block horizontally only at its outer boundaries', () => {
    const left = createCodeBlockView(codeStart)
    const leftEvent = createKeyEvent('ArrowLeft')

    expect(handleCodeBlockKey(left.view, leftEvent.event)).toBe(true)
    expect(leftEvent.wasPrevented()).toBe(true)
    expect(left.getState().selection.$from.parent.textContent).toBe('Before')

    const middle = createCodeBlockView(codeStart + 'alpha\n'.length)
    const middleEvent = createKeyEvent('ArrowLeft')
    expect(handleCodeBlockKey(middle.view, middleEvent.event)).toBe(false)
    expect(middleEvent.wasPrevented()).toBe(false)

    const right = createCodeBlockView(codeEnd)
    const rightEvent = createKeyEvent('ArrowRight')
    expect(handleCodeBlockKey(right.view, rightEvent.event)).toBe(true)
    expect(rightEvent.wasPrevented()).toBe(true)
    expect(right.getState().selection.$from.parent.textContent).toBe('After')
  })

  it('exits a code block with Ctrl/Cmd-Enter', () => {
    const { view, getState } = createCodeBlockView(codeStart)
    const event = createKeyEvent('Enter', { ctrlKey: true })

    expect(handleCodeBlockKey(view, event.event)).toBe(true)
    expect(event.wasPrevented()).toBe(true)
    expect(getState().selection.$from.parent.type.name).toBe('paragraph')
  })
})
