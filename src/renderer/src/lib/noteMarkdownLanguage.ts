import { markdown } from '@codemirror/lang-markdown'
import { Tag, tags } from '@lezer/highlight'

export const noteMarkdownUnderlineTag = Tag.define()

const underlineDelimiter = {
  resolve: 'Underline',
  mark: 'UnderlineMark'
}

const markdownPunctuation = /[!"#$%&'()*+,\-.:;<=>?@[\\\]^_`{|}~]/

function isWhitespace(code: number): boolean {
  return Number.isNaN(code) || code < 0 || /\s/.test(String.fromCharCode(code))
}

function isPunctuation(code: number): boolean {
  return code === 47 || (code >= 0 && markdownPunctuation.test(String.fromCharCode(code)))
}

export const noteMarkdownLanguage = markdown({
  extensions: {
    remove: ['SetextHeading'],
    defineNodes: [
      { name: 'Underline', style: noteMarkdownUnderlineTag },
      { name: 'UnderlineMark', style: tags.processingInstruction }
    ],
    parseInline: [
      {
        name: 'Underline',
        before: 'Emphasis',
        parse(cx, next, position) {
          if (next !== 95 || cx.char(position - 1) === 95 || cx.char(position + 1) === 95) {
            return -1
          }

          const before = cx.char(position - 1)
          const after = cx.char(position + 1)
          const beforeIsPunctuation = isPunctuation(before)
          const afterIsPunctuation = isPunctuation(after)
          const beforeIsWhitespace = isWhitespace(before)
          const afterIsWhitespace = isWhitespace(after)
          const leftFlanking =
            !afterIsWhitespace && (!afterIsPunctuation || beforeIsWhitespace || beforeIsPunctuation)
          const rightFlanking =
            !beforeIsWhitespace && (!beforeIsPunctuation || afterIsWhitespace || afterIsPunctuation)
          const canOpen = leftFlanking && (!rightFlanking || beforeIsPunctuation)
          const canClose = rightFlanking && (!leftFlanking || afterIsPunctuation)

          if (!canOpen && !canClose) return -1
          return cx.addDelimiter(underlineDelimiter, position, position + 1, canOpen, canClose)
        }
      }
    ]
  }
})
