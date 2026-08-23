import { describe, expect, it } from 'vitest'
import {
  buildResourceWritePreview,
  hashResourceContent,
  isPathWithinRoot
} from '../src/shared/resourceActions'

describe('resource write safety', () => {
  it('requires a matching expected hash for changed content', () => {
    const preview = buildResourceWritePreview(
      {
        targetPath: '/tmp/work/out.md',
        authorizedRoot: '/tmp/work',
        operation: 'append',
        content: 'next',
        expectedHash: hashResourceContent('old')
      },
      'changed'
    )

    expect(preview.requiresConfirmation).toBe(true)
    expect(preview.warning).toContain('changed')
  })

  it('keeps writes inside the explicitly authorized root', () => {
    expect(isPathWithinRoot('/tmp/work/out.md', '/tmp/work')).toBe(true)
    expect(isPathWithinRoot('/tmp/work-other/out.md', '/tmp/work')).toBe(false)
  })
})
