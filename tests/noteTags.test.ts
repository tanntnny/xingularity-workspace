import { describe, expect, it } from 'vitest'
import {
  listPreviewTagsFromMarkdown,
  listTagsFromMarkdown,
  normalizeTag,
  generateProjectTag,
  upsertTagsInMarkdown
} from '../src/shared/noteTags'

describe('note tag helpers', () => {
  it('normalizes tags from user input', () => {
    expect(normalizeTag('  #Product Roadmap  ')).toBe('product-roadmap')
    expect(normalizeTag('ok_tag-1')).toBe('ok_tag-1')
    expect(normalizeTag('bad*tag')).toBeNull()
  })

  it('generates stable project tags from project ids', () => {
    expect(generateProjectTag('project-1')).toBe('project:project-1')
    expect(generateProjectTag('Project 123')).toBe('project:project-123')
  })

  it('reads tags from frontmatter', () => {
    const markdown = `---
title: Sample
tags: [alpha, #beta, alpha]
---

Body`

    expect(listTagsFromMarkdown(markdown)).toEqual(['alpha', 'beta'])
  })

  it('upserts tags into existing frontmatter', () => {
    const markdown = `---
title: Sample
created: 2026-02-26T10:00:00.000Z
---

Body`
    const updated = upsertTagsInMarkdown(markdown, ['alpha', 'beta'])

    expect(updated).toContain('title: Sample')
    expect(updated).toContain('tags: [alpha, beta]')
    expect(updated).toContain('created: 2026-02-26T10:00:00.000Z')
    expect(updated.endsWith('Body')).toBe(true)
  })

  it('merges frontmatter tags with inline hashtags for previews', () => {
    const markdown = `---
title: Sample
tags: [alpha]
---

Work items #beta and #ALPHA and #release-1`

    expect(listPreviewTagsFromMarkdown(markdown)).toEqual(['alpha', 'beta', 'release-1'])
  })
})
