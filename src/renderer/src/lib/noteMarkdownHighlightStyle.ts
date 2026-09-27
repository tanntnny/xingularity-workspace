import { defaultHighlightStyle, HighlightStyle } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import { noteMarkdownUnderlineTag } from './noteMarkdownLanguage'

export const noteMarkdownHighlightStyle = HighlightStyle.define([
  ...defaultHighlightStyle.specs,
  { tag: tags.meta, color: 'var(--foreground)' },
  { tag: tags.processingInstruction, color: 'var(--foreground)' },
  { tag: tags.contentSeparator, color: 'var(--foreground)' },
  { tag: noteMarkdownUnderlineTag, fontStyle: 'normal', textDecoration: 'underline' }
])
