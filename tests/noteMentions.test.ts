import { describe, expect, it } from 'vitest'
import {
  createNoteMentionResolver,
  extractMentionTargetsFromMarkdown,
  normalizeNoteMentionMarkdown,
  noteMentionHref,
  rewriteNoteMentionTargets
} from '../src/shared/noteMentions'

describe('note mention helpers', () => {
  it('extracts canonical note links from markdown', () => {
    const markdown = `See [Beta](${noteMentionHref('nested/beta')}) and [[gamma]].`

    expect(extractMentionTargetsFromMarkdown(markdown)).toEqual(['nested/beta', 'gamma'])
  })

  it('normalizes wikilinks into canonical note links', () => {
    expect(normalizeNoteMentionMarkdown('Visit [[nested/beta.md]] today.')).toBe(
      `Visit [nested/beta](${noteMentionHref('nested/beta')}) today.`
    )
  })

  it('rewrites canonical note links and exact-path wikilinks', () => {
    const markdown = [
      `See [Project Beta](${noteMentionHref('notes/beta')})`,
      'and [[notes/beta]].',
      'Leave [[beta]] alone.'
    ].join(' ')

    expect(
      rewriteNoteMentionTargets(markdown, (target) =>
        target === 'notes/beta' ? 'archive/beta-renamed' : null
      )
    ).toBe(
      [
        `See [Project Beta](${noteMentionHref('archive/beta-renamed')})`,
        'and [[archive/beta-renamed]].',
        'Leave [[beta]] alone.'
      ].join(' ')
    )
  })

  it('resolves exact paths before unique note names', () => {
    const resolve = createNoteMentionResolver([
      { relPath: 'nested/beta.md', name: 'beta.md' },
      { relPath: 'projects/alpha.md', name: 'alpha.md' }
    ])

    expect(resolve('nested/beta')).toBe('nested/beta.md')
    expect(resolve('alpha')).toBe('projects/alpha.md')
  })

  it('ignores ambiguous note names', () => {
    const resolve = createNoteMentionResolver([
      { relPath: 'one/shared.md', name: 'shared.md' },
      { relPath: 'two/shared.md', name: 'shared.md' }
    ])

    expect(resolve('shared')).toBeNull()
  })
})
