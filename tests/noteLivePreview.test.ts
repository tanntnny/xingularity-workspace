import { EditorSelection, EditorState } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import {
  getActivePreviewLines,
  isPreviewSelectionTouchingRange
} from '../src/renderer/src/lib/noteLivePreview'

function createState(
  doc: string,
  selection: { anchor: number; head: number } | EditorSelection
): EditorState {
  return EditorState.create({
    doc,
    selection,
    extensions: [EditorState.allowMultipleSelections.of(true)]
  })
}

describe('note live preview active lines', () => {
  it('activates every physical line covered by a selection', () => {
    const doc = '# First\n\n# Middle\n# Last'
    const state = createState(doc, { anchor: 2, head: doc.length - 2 })

    expect([...getActivePreviewLines(state)]).toEqual([1, 2, 3, 4])
  })

  it('includes the line at a selection endpoint when it starts at column zero', () => {
    const doc = 'First\nSecond\nThird'
    const state = createState(doc, { anchor: 0, head: doc.indexOf('Third') })

    expect([...getActivePreviewLines(state)]).toEqual([1, 2, 3])
  })

  it('unions the inclusive line spans of multiple selections', () => {
    const doc = 'First\nSecond\nThird\nFourth\nFifth'
    const state = createState(
      doc,
      EditorSelection.create([
        EditorSelection.range(0, doc.indexOf('Second') + 2),
        EditorSelection.range(doc.indexOf('Fourth'), doc.length)
      ])
    )

    expect([...getActivePreviewLines(state)]).toEqual([1, 2, 4, 5])
  })

  it('keeps a collapsed cursor selection scoped to one line', () => {
    const doc = 'First\nSecond\nThird'
    const secondLineStart = doc.indexOf('Second')
    const state = createState(doc, { anchor: secondLineStart + 2, head: secondLineStart + 2 })

    expect([...getActivePreviewLines(state)]).toEqual([2])
  })
})

describe('note live preview list marker ranges', () => {
  it('treats positions immediately before and after a bullet marker as touching', () => {
    const doc = '- item'

    expect(isPreviewSelectionTouchingRange(createState(doc, { anchor: 0, head: 0 }), 0, 1)).toBe(
      true
    )
    expect(isPreviewSelectionTouchingRange(createState(doc, { anchor: 1, head: 1 }), 0, 1)).toBe(
      true
    )
    expect(isPreviewSelectionTouchingRange(createState(doc, { anchor: 2, head: 2 }), 0, 1)).toBe(
      false
    )
  })

  it('keeps nested marker boundaries tied to the marker instead of indentation', () => {
    const doc = '  * nested'

    expect(isPreviewSelectionTouchingRange(createState(doc, { anchor: 0, head: 0 }), 2, 3)).toBe(
      false
    )
    expect(isPreviewSelectionTouchingRange(createState(doc, { anchor: 2, head: 2 }), 2, 3)).toBe(
      true
    )
    expect(isPreviewSelectionTouchingRange(createState(doc, { anchor: 3, head: 3 }), 2, 3)).toBe(
      true
    )
  })

  it('reveals a marker when a selection touches it and supports multiple selections', () => {
    const doc = '- item'
    const selection = EditorSelection.create([
      EditorSelection.range(2, 4),
      EditorSelection.cursor(1)
    ])

    expect(isPreviewSelectionTouchingRange(createState(doc, selection), 0, 1)).toBe(true)
    expect(
      isPreviewSelectionTouchingRange(createState(doc, EditorSelection.range(2, 4)), 0, 1)
    ).toBe(false)
  })
})
