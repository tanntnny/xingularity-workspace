import { describe, expect, it } from 'vitest'
import { Schema } from 'prosemirror-model'
import { EditorState } from 'prosemirror-state'
import { __noteVimModeTestUtils } from '../src/renderer/src/lib/noteVimMode'

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

describe('noteVimMode word motions', () => {
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

  it('moves one character left when leaving insert mode', () => {
    const state = createState('map sun wax')

    expect(__noteVimModeTestUtils.resolveInsertModeExitPos(state, 1)).toBe(1)
    expect(__noteVimModeTestUtils.resolveInsertModeExitPos(state, 2)).toBe(1)
    expect(__noteVimModeTestUtils.resolveInsertModeExitPos(state, 5)).toBe(4)
    expect(__noteVimModeTestUtils.resolveInsertModeExitPos(state, 12)).toBe(11)
  })
})
