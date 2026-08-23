import { describe, expect, it } from 'vitest'
import {
  getCodeHighlightRanges,
  resolveCodeLanguage
} from '../src/renderer/src/lib/codeSyntaxHighlighting'

describe('code syntax highlighting', () => {
  it('resolves supported fenced-language aliases', () => {
    expect(resolveCodeLanguage('py')?.name).toBe('python')
    expect(resolveCodeLanguage('python')?.name).toBe('python')
    expect(resolveCodeLanguage('js')?.name).toBe('javascript')
    expect(resolveCodeLanguage('javascript')?.name).toBe('javascript')
    expect(resolveCodeLanguage('ts')?.name).toBe('typescript')
    expect(resolveCodeLanguage('tsx')).not.toBeNull()
    expect(resolveCodeLanguage(' language-js ')).not.toBeNull()
  })

  it('creates Python token ranges with the Copilot token classes', () => {
    const ranges = getCodeHighlightRanges('def greet(name):\n  # comment\n  return "hello"', 'py')

    expect(ranges.some((range) => range.className.includes('code-token-keyword'))).toBe(true)
    expect(ranges.some((range) => range.className.includes('code-token-comment'))).toBe(true)
    expect(ranges.some((range) => range.className.includes('code-token-string'))).toBe(true)
  })

  it('creates JavaScript token ranges with the Copilot token classes', () => {
    const ranges = getCodeHighlightRanges('const value = 42\nconsole.log("value", value)', 'js')

    expect(ranges.some((range) => range.className.includes('code-token-keyword'))).toBe(true)
    expect(ranges.some((range) => range.className.includes('code-token-number'))).toBe(true)
    expect(ranges.some((range) => range.className.includes('code-token-function'))).toBe(true)
    expect(ranges.some((range) => range.className.includes('code-token-string'))).toBe(true)
  })

  it('leaves empty and unsupported code blocks unstyled', () => {
    expect(getCodeHighlightRanges('', 'js')).toEqual([])
    expect(getCodeHighlightRanges('puts "hello"', 'ruby')).toEqual([])
    expect(getCodeHighlightRanges('const value = 42', undefined)).toEqual([])
  })
})
