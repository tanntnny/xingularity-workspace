import { syntaxTree } from '@codemirror/language'
import { EditorState } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import { noteMarkdownLanguage } from '../src/renderer/src/lib/noteMarkdownLanguage'

function syntaxTreeText(source: string): string {
  const state = EditorState.create({ doc: source, extensions: [noteMarkdownLanguage] })
  return syntaxTree(state).toString()
}

describe('note Markdown language', () => {
  it('treats dash lines as text instead of Setext headings', () => {
    const tree = syntaxTreeText('Test\n-\n\n# Explicit heading')

    expect(tree).not.toContain('SetextHeading')
    expect(tree).toContain('ATXHeading1')
  })

  it('parses single underscores as underline while preserving emphasis and strong emphasis', () => {
    const tree = syntaxTreeText('_underlined_ *italic* __bold__')

    expect(tree).toContain('Underline(')
    expect(tree).toContain('Emphasis(')
    expect(tree).toContain('StrongEmphasis(')
  })
})
