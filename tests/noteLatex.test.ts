import { describe, expect, it } from 'vitest'
import { findLatexTextMatches, normalizeLatexEscapes } from '../src/renderer/src/lib/noteLatex'

describe('findLatexTextMatches', () => {
  it('matches inline latex without changing existing behavior', () => {
    expect(findLatexTextMatches('Before $x^2$ after')).toEqual([
      {
        from: 7,
        to: 12,
        value: 'x^2',
        valid: true,
        displayMode: false,
        delimiter: '$'
      }
    ])
  })

  it('treats single-line $$...$$ as display latex', () => {
    expect(findLatexTextMatches('$$E = mc^2$$')).toEqual([
      {
        from: 0,
        to: 12,
        value: 'E = mc^2',
        valid: true,
        displayMode: true,
        delimiter: '$$'
      }
    ])
  })

  it('treats multi-line $$...$$ as one display latex block', () => {
    expect(findLatexTextMatches('$$\\frac{1}{2}\n+\n\\frac{1}{3}$$')).toEqual([
      {
        from: 0,
        to: 29,
        value: '\\frac{1}{2}\n+\n\\frac{1}{3}',
        valid: true,
        displayMode: true,
        delimiter: '$$'
      }
    ])
  })

  it('marks unclosed display latex as invalid', () => {
    expect(findLatexTextMatches('$$x + y')).toEqual([
      {
        from: 0,
        to: 7,
        value: 'x + y',
        valid: false,
        displayMode: true,
        delimiter: '$$'
      }
    ])
  })
})

describe('normalizeLatexEscapes', () => {
  it('restores escaped display and inline delimiters', () => {
    expect(normalizeLatexEscapes('\\$\\$x^2\\$\\$ and \\$y\\$')).toBe('$$x^2$$ and $y$')
  })
})
