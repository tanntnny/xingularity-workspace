import { deleteCharBackward, indentWithTab } from '@codemirror/commands'
import { getIndentUnit } from '@codemirror/language'
import { EditorState, type StateCommand, type Transaction } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import {
  EDITOR_INDENT_UNIT,
  EDITOR_TAB_SIZE,
  sharedEditorIndentation
} from '../src/renderer/src/lib/editorIndentation'
import { getMarkdownLineBreakText } from '../src/renderer/src/lib/noteMarkdownLineBreak'

function applyCommand(state: EditorState, command: StateCommand): EditorState {
  let nextState = state
  command({
    state,
    dispatch: (transaction) => {
      nextState = transaction.state
    }
  })
  return nextState
}

function applyBackspace(state: EditorState): EditorState {
  let nextState = state
  deleteCharBackward({
    state,
    dispatch: (transaction: Transaction) => {
      nextState = transaction.state
    }
  } as unknown as Parameters<typeof deleteCharBackward>[0])
  return nextState
}

function createState(doc: string, anchor = 0, head = anchor): EditorState {
  return EditorState.create({
    doc,
    selection: { anchor, head },
    extensions: [sharedEditorIndentation]
  })
}

describe('shared editor indentation', () => {
  it('uses literal tabs and a four-column tab display', () => {
    const state = createState('text')

    expect(EDITOR_INDENT_UNIT).toBe('\t')
    expect(EDITOR_TAB_SIZE).toBe(4)
    expect(state.facet(EditorState.tabSize)).toBe(4)
    expect(getIndentUnit(state)).toBe(4)
  })

  it('makes Tab and Shift-Tab add or remove one unit across selected lines', () => {
    let state = createState('first\nsecond', 0, 'first\nsecond'.length)

    state = applyCommand(state, indentWithTab.run as unknown as StateCommand)
    expect(state.doc.toString()).toBe('\tfirst\n\tsecond')

    if (!indentWithTab.shift) throw new Error('Shift-Tab command is not configured')
    state = applyCommand(state, indentWithTab.shift as unknown as StateCommand)
    expect(state.doc.toString()).toBe('first\nsecond')
  })

  it('keeps smart Backspace aligned to the shared indent unit', () => {
    let state = createState('      item', 6)

    state = applyBackspace(state)
    expect(state.doc.toString()).toBe('    item')

    state = applyBackspace(state)
    expect(state.doc.toString()).toBe('item')
  })

  it('aligns Shift-Enter continuation text with unordered list content', () => {
    const state = createState('- Test')
    const alternateBullet = createState('+ Test')

    expect(getMarkdownLineBreakText(state, state.doc.length)).toBe('  \n  ')
    expect(getMarkdownLineBreakText(alternateBullet, alternateBullet.doc.length)).toBe('  \n  ')
  })

  it('adapts continuation indentation to ordered and task list markers', () => {
    const ordered = createState('10. Test')
    const task = createState('- [ ] Test')
    const checkedTask = createState('* [x] Test')

    expect(getMarkdownLineBreakText(ordered, ordered.doc.length)).toBe('  \n\t')
    expect(getMarkdownLineBreakText(task, task.doc.length)).toBe('  \n\t  ')
    expect(getMarkdownLineBreakText(checkedTask, checkedTask.doc.length)).toBe('  \n\t  ')
  })

  it('preserves nested list indentation using the active tab size', () => {
    const state = createState('    - Test')

    expect(getMarkdownLineBreakText(state, state.doc.length)).toBe('  \n\t  ')
  })

  it('continues blockquotes with the active quote markers', () => {
    const quote = createState('> Quote')
    const nestedQuote = createState('> > Quote')

    expect(getMarkdownLineBreakText(quote, quote.doc.length)).toBe('  \n> ')
    expect(getMarkdownLineBreakText(nestedQuote, nestedQuote.doc.length)).toBe('  \n> > ')
  })

  it('keeps the existing hard break outside list items', () => {
    const state = createState('Paragraph')

    expect(getMarkdownLineBreakText(state, state.doc.length)).toBe('  \n')
  })
})
