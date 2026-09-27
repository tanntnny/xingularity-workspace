import { describe, expect, it } from 'vitest'
import {
  expandMarkdownCodeBlockDeletion,
  findMarkdownCodeBlockAt,
  findMarkdownCodeBlocks,
  getMarkdownCodeFencePairCompletion,
  getMarkdownCodeFenceCompletion,
  isMarkdownCodeBlockEmpty,
  serializeMarkdownCodeBlock
} from '../src/renderer/src/lib/noteMarkdownCodeBlock'

describe('source-owned Markdown code blocks', () => {
  it('finds fenced blocks and exposes a body range for source activation', () => {
    const markdown = 'Before\n\n```ts\nconst value = 1\n```\n\nAfter'
    const [block] = findMarkdownCodeBlocks(markdown)

    expect(block).toMatchObject({
      language: 'ts',
      body: 'const value = 1',
      openingLine: '```ts',
      closingLine: '```'
    })
    expect(markdown.slice(block.bodyFrom, block.bodyTo)).toBe('const value = 1')
    expect(serializeMarkdownCodeBlock(block, 'const value = 2')).toBe('```ts\nconst value = 2\n```')
  })

  it('recognizes an empty block even when the source has an empty body line', () => {
    const markdown = '```\n\n```'
    const [block] = findMarkdownCodeBlocks(markdown)

    expect(isMarkdownCodeBlockEmpty(block)).toBe(true)
    expect(findMarkdownCodeBlockAt([block], block.bodyFrom)).toBe(block)
  })

  it('preserves a trailing empty body line before the closing fence', () => {
    const markdown = '```\nconst value = 1\n\n```'
    const [block] = findMarkdownCodeBlocks(markdown)

    expect(block.body).toBe('const value = 1\n')
    expect(markdown.slice(block.bodyFrom, block.bodyTo)).toBe(block.body)
    expect(serializeMarkdownCodeBlock(block, block.body)).toBe(markdown)
  })

  it('expands a selection that crosses any part of a fenced block', () => {
    const markdown = 'Before\n```\nline one\nline two\n```\nAfter'
    const [block] = findMarkdownCodeBlocks(markdown)
    const selection = expandMarkdownCodeBlockDeletion(
      [block],
      markdown.indexOf('line one') + 2,
      markdown.indexOf('After')
    )

    expect(selection).toEqual({ from: block.from, to: markdown.indexOf('After') })
  })

  it('completes a backtick fence on Enter while preserving an optional language', () => {
    const markdown = '```tsx'
    const completion = getMarkdownCodeFenceCompletion(markdown, markdown.length)

    expect(completion).toEqual({
      from: markdown.length,
      to: markdown.length,
      insert: '\n\n```',
      cursor: markdown.length + 1
    })
    expect(getMarkdownCodeFenceCompletion('~~~', 3)).toBeNull()
    const closingFence = '```\nbody\n```'
    expect(getMarkdownCodeFenceCompletion(closingFence, closingFence.length)).toBeNull()
  })

  it('pairs a newly typed bare fence without pairing a closing fence', () => {
    expect(getMarkdownCodeFencePairCompletion('  ```', 5)).toEqual({
      from: 5,
      to: 5,
      insert: '\n\n  ```',
      cursor: 6
    })
    expect(getMarkdownCodeFencePairCompletion('```ts', 5)).toBeNull()
    expect(getMarkdownCodeFencePairCompletion('~~~', 3)).toBeNull()
    const closingFence = '```\nbody\n```'
    expect(getMarkdownCodeFencePairCompletion(closingFence, closingFence.length)).toBeNull()
  })

  it('keeps mixed fence markers inside the body and renders tilde fences', () => {
    const markdown = '~~~\n```\nbody\n~~~'
    const [block] = findMarkdownCodeBlocks(markdown)

    expect(block.marker).toBe('~~~')
    expect(block.body).toBe('```\nbody')
    expect(block.closingLine).toBe('~~~')
  })
})
