import { indentString } from '@codemirror/language'
import type { EditorState } from '@codemirror/state'

const MARKDOWN_HARD_BREAK = '  \n'
const LIST_ITEM_PREFIX = /^([ \t]*(?:(?:>\s?)+)?)([-+*]|\d+[.)])([ \t]+)(\[[ xX]\])?([ \t]+)?/
const BLOCKQUOTE_PREFIX = /^([ \t]*(?:>\s?)+)/

function visualColumn(text: string, tabSize: number): number {
  let column = 0

  for (const character of text) {
    if (character === '\t') {
      column += tabSize - (column % tabSize)
    } else {
      column += 1
    }
  }

  return column
}

export function getMarkdownLineBreakText(state: EditorState, position: number): string {
  const line = state.doc.lineAt(position)
  const offset = Math.max(0, Math.min(position - line.from, line.text.length))
  const match = LIST_ITEM_PREFIX.exec(line.text)

  if (!match) {
    const quote = BLOCKQUOTE_PREFIX.exec(line.text)
    if (!quote || offset < quote[0].length) return MARKDOWN_HARD_BREAK
    return `${MARKDOWN_HARD_BREAK}${quote[1]}`
  }

  if (offset < match[0].length) {
    return MARKDOWN_HARD_BREAK
  }

  let prefixEnd = match[0].length
  if (match[4] && !match[5]) {
    prefixEnd += 1
  }

  const continuationColumn = visualColumn(line.text.slice(0, prefixEnd), state.tabSize)
  const quotePrefix = /^(?:[ \t]*(?:>\s?)+)/.exec(match[1])?.[0]
  if (quotePrefix) {
    const quoteColumn = visualColumn(quotePrefix, state.tabSize)
    return `${MARKDOWN_HARD_BREAK}${quotePrefix}${indentString(
      state,
      Math.max(0, continuationColumn - quoteColumn)
    )}`
  }

  return `${MARKDOWN_HARD_BREAK}${indentString(state, continuationColumn)}`
}
