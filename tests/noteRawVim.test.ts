import { describe, expect, it } from 'vitest'

import * as noteRawVim from '../src/renderer/src/lib/noteRawVim'
import {
  findNoteRawHeadingPositions,
  getNoteRawAdjacentLinePosition,
  getNoteRawFirstNonWhitespacePosition,
  getNoteRawLineBounds,
  getNoteRawLineEndPosition,
  getNoteRawLinewiseRange,
  getNoteRawLinewiseText,
  getNoteRawVisualLineRange,
  getNoteRawWordEndAfter,
  getNoteRawWordStartAfter,
  getNoteRawWordStartBefore
} from '../src/renderer/src/lib/noteRawVim'

describe('raw note editor text motions', () => {
  const text = '# One\nSecond\nThird'

  it('finds line bounds and line ends', () => {
    expect(getNoteRawLineBounds(text, 7)).toEqual({ start: 6, end: 12 })
    expect(getNoteRawLineEndPosition(text, 7)).toBe(11)
    expect(getNoteRawFirstNonWhitespacePosition('  ## Heading', 4)).toBe(2)
  })

  it('moves vertically while preserving a preferred column', () => {
    expect(getNoteRawAdjacentLinePosition(text, 7, 'up', 2)).toBe(2)
    expect(getNoteRawAdjacentLinePosition(text, 7, 'down', 2)).toBe(15)
    expect(getNoteRawAdjacentLinePosition(text, 14, 'down', 2)).toBe(14)
  })

  it('keeps the cursor at the current position at vertical boundaries', () => {
    expect(getNoteRawAdjacentLinePosition(text, 2, 'up', 2)).toBe(2)
    expect(getNoteRawAdjacentLinePosition(text, 17, 'down', 2)).toBe(17)
  })

  it('moves across word boundaries', () => {
    const words = 'map sun wax'

    expect(getNoteRawWordStartAfter(words, 1)).toBe(4)
    expect(getNoteRawWordStartAfter(words, 4)).toBe(8)
    expect(getNoteRawWordStartBefore(words, 8)).toBe(4)
    expect(getNoteRawWordEndAfter(words, 1)).toBe(2)
    expect(getNoteRawWordEndAfter(words, 4)).toBe(6)
  })

  it('selects complete lines for visual and operator motions', () => {
    const lines = 'one\ntwo\nthree'

    expect(getNoteRawVisualLineRange(lines, 4, 10)).toEqual({ from: 4, to: 13 })
    expect(getNoteRawLinewiseRange(lines, 1)).toEqual({ from: 0, to: 4 })
    expect(getNoteRawLinewiseRange(lines, 9)).toEqual({ from: 7, to: 13 })
    expect(getNoteRawLinewiseText(lines, 1)).toBe('one\n')
    expect(getNoteRawLinewiseText(lines, 9)).toBe('three')
  })

  it('ignores headings inside fenced code blocks', () => {
    const markdown = '# First\n```md\n## Not a heading\n```\n### Last\n'

    expect(findNoteRawHeadingPositions(markdown)).toEqual([
      markdown.indexOf('# First'),
      markdown.indexOf('### Last')
    ])
  })
})

describe('raw Markdown Enter contract', () => {
  const getEnter = ():
    | ((
        text: string,
        from: number,
        to?: number,
        options?: { continueList?: boolean }
      ) => { text: string; selection: number; behavior: string })
    | undefined =>
    (
      noteRawVim as typeof noteRawVim & {
        applyNoteRawEnter?: (
          text: string,
          from: number,
          to?: number,
          options?: { continueList?: boolean }
        ) => { text: string; selection: number; behavior: string }
      }
    ).applyNoteRawEnter

  it('continues a non-empty list item and exits an empty list item', () => {
    const applyNoteRawEnter = getEnter()

    expect(applyNoteRawEnter).toEqual(expect.any(Function))

    expect(applyNoteRawEnter?.('- first', 7)).toEqual({
      text: '- first\n- ',
      selection: 10,
      behavior: 'continue-list'
    })
    expect(applyNoteRawEnter?.('- ', 2)).toEqual({
      text: '',
      selection: 0,
      behavior: 'exit-list'
    })
  })

  it('preserves Markdown structure while continuing ordered and task lists', () => {
    const applyNoteRawEnter = getEnter()

    expect(applyNoteRawEnter?.('1. first', 8)).toMatchObject({
      text: '1. first\n2. ',
      behavior: 'continue-list'
    })
    expect(applyNoteRawEnter?.('- [x] done', 10)).toMatchObject({
      text: '- [x] done\n- [ ] ',
      behavior: 'continue-list'
    })
  })

  it('does not create list markers inside a fenced code block', () => {
    const applyNoteRawEnter = getEnter()
    const code = '```md\n- literal\n```'
    const position = code.indexOf('- literal') + '- literal'.length

    expect(applyNoteRawEnter?.(code, position)).toEqual({
      text: '```md\n- literal\n\n```',
      selection: position + 1,
      behavior: 'newline'
    })
  })

  it('replaces a selection before applying list continuation', () => {
    const applyNoteRawEnter = getEnter()
    const text = '- first item'

    expect(applyNoteRawEnter?.(text, 2, 7)).toEqual({
      text: '- \n-  item',
      selection: 5,
      behavior: 'continue-list'
    })
  })

  it('can insert a plain newline when list continuation is disabled', () => {
    const applyNoteRawEnter = getEnter()

    expect(applyNoteRawEnter?.('- first', 7, 7, { continueList: false })).toEqual({
      text: '- first\n',
      selection: 8,
      behavior: 'newline'
    })
  })
})
