import { tags } from '@lezer/highlight'
import { describe, expect, it } from 'vitest'
import { noteMarkdownHighlightStyle } from '../src/renderer/src/lib/noteMarkdownHighlightStyle'

describe('note editor syntax highlighting', () => {
  it('uses the normal foreground for raw structural markers', () => {
    const contentSeparatorStyles = noteMarkdownHighlightStyle.specs.filter(
      (spec) => spec.tag === tags.contentSeparator
    )
    const metaStyles = noteMarkdownHighlightStyle.specs.filter((spec) => spec.tag === tags.meta)

    expect(contentSeparatorStyles[contentSeparatorStyles.length - 1]).toMatchObject({
      color: 'var(--foreground)'
    })
    expect(metaStyles[metaStyles.length - 1]).toMatchObject({
      color: 'var(--foreground)'
    })
  })
})
