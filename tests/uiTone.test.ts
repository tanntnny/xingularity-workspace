import { describe, expect, it } from 'vitest'
import { getUiToneStyle } from '../src/renderer/src/lib/uiTone'

describe('getUiToneStyle', () => {
  it('returns the semantic tone variables for a tone', () => {
    expect(getUiToneStyle('warning')).toMatchObject({
      '--ui-tone-bg': 'var(--ui-tone-warning-bg)',
      '--ui-tone-border': 'var(--ui-tone-warning-border)',
      '--ui-tone-text': 'var(--ui-tone-warning-text)',
      '--ui-tone-meta': 'var(--ui-tone-warning-meta)'
    })
  })
})
