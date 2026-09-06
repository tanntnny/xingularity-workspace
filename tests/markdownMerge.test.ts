import { describe, expect, it } from 'vitest'
import { mergeMarkdownThreeWay } from '../src/shared/markdownMerge'

describe('markdown three-way merge', () => {
  it('takes the external version when the local side is unchanged', () => {
    const result = mergeMarkdownThreeWay(
      '# Title\n\nOriginal body\n',
      '# Title\n\nOriginal body\n',
      '# Title\n\nUpdated body\n'
    )

    expect(result).toEqual({
      status: 'merged',
      content: '# Title\n\nUpdated body\n'
    })
  })

  it('takes the local version when the external side is unchanged', () => {
    const result = mergeMarkdownThreeWay(
      'one\ntwo\nthree\n',
      'one\nlocal\nthree\n',
      'one\ntwo\nthree\n'
    )

    expect(result).toEqual({
      status: 'merged',
      content: 'one\nlocal\nthree\n'
    })
  })

  it('combines non-overlapping line edits from both sides', () => {
    const result = mergeMarkdownThreeWay(
      'one\ntwo\nthree\nfour\n',
      'local\ntwo\nthree\nfour\n',
      'one\ntwo\nexternal\nfour\n'
    )

    expect(result).toEqual({
      status: 'merged',
      content: 'local\ntwo\nexternal\nfour\n'
    })
  })

  it('returns an explicit conflict for overlapping edits without markers or content', () => {
    const result = mergeMarkdownThreeWay(
      'one\ntwo\nthree\n',
      'one\nlocal\nthree\n',
      'one\nexternal\nthree\n'
    )

    expect(result.status).toBe('conflict')
    if (result.status === 'conflict') {
      expect(result.reason).toBe('overlapping-edits')
      expect(result.local).toBe('one\nlocal\nthree\n')
      expect(result.external).toBe('one\nexternal\nthree\n')
      expect(result).not.toHaveProperty('content')
      expect(JSON.stringify(result)).not.toContain('<<<<<<<')
    }
  })

  it('merges an insertion on one side with a non-overlapping deletion on the other', () => {
    const result = mergeMarkdownThreeWay(
      'one\ntwo\nthree\nfour\n',
      'one\ninserted\ntwo\nthree\nfour\n',
      'one\ntwo\nthree\n'
    )

    expect(result).toEqual({
      status: 'merged',
      content: 'one\ninserted\ntwo\nthree\n'
    })
  })

  it('conflicts when an insertion competes with deletion at the same base position', () => {
    const result = mergeMarkdownThreeWay(
      'one\ntwo\nthree\n',
      'one\ninserted\ntwo\nthree\n',
      'one\nthree\n'
    )

    expect(result.status).toBe('conflict')
    if (result.status === 'conflict') {
      expect(result.reason).toBe('overlapping-edits')
      expect(result.hunks).toHaveLength(1)
    }
  })

  it('normalizes all line endings to LF and deterministically preserves the merged final newline', () => {
    const result = mergeMarkdownThreeWay('alpha\r\nbeta\r\n', 'ALPHA\r\nbeta', 'alpha\nbeta\n')

    expect(result).toEqual({
      status: 'merged',
      content: 'ALPHA\nbeta'
    })
  })
})
