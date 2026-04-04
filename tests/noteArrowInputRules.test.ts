import { describe, expect, it } from 'vitest'
import { replaceTrailingArrowSequence } from '../src/renderer/src/lib/noteArrowInputRules'

describe('replaceTrailingArrowSequence', () => {
  it('replaces a trailing right arrow sequence', () => {
    expect(replaceTrailingArrowSequence('draft ->')).toBe('draft →')
  })

  it('replaces a trailing left arrow sequence', () => {
    expect(replaceTrailingArrowSequence('draft <-')).toBe('draft ←')
  })

  it('prefers the longest matching bidirectional arrow sequence', () => {
    expect(replaceTrailingArrowSequence('draft <->')).toBe('draft ↔')
    expect(replaceTrailingArrowSequence('draft ←>')).toBe('draft ↔')
    expect(replaceTrailingArrowSequence('draft <=>')).toBe('draft ⇔')
    expect(replaceTrailingArrowSequence('draft ⇐>')).toBe('draft ⇔')
    expect(replaceTrailingArrowSequence('draft <==>')).toBe('draft ⟺')
    expect(replaceTrailingArrowSequence('draft ⇐=>')).toBe('draft ⟺')
    expect(replaceTrailingArrowSequence('draft ⟸>')).toBe('draft ⟺')
    expect(replaceTrailingArrowSequence('draft <-->')).toBe('draft ⟷')
    expect(replaceTrailingArrowSequence('draft ←->')).toBe('draft ⟷')
    expect(replaceTrailingArrowSequence('draft ⟵>')).toBe('draft ⟷')
  })

  it('replaces double-line and extended directional arrows', () => {
    expect(replaceTrailingArrowSequence('draft =>')).toBe('draft ⇒')
    expect(replaceTrailingArrowSequence('draft <=')).toBe('draft ⇐')
    expect(replaceTrailingArrowSequence('draft ==>')).toBe('draft ⟹')
    expect(replaceTrailingArrowSequence('draft <==')).toBe('draft ⟸')
    expect(replaceTrailingArrowSequence('draft ⇐=')).toBe('draft ⟸')
    expect(replaceTrailingArrowSequence('draft -->')).toBe('draft ⟶')
    expect(replaceTrailingArrowSequence('draft <--')).toBe('draft ⟵')
    expect(replaceTrailingArrowSequence('draft ←-')).toBe('draft ⟵')
  })

  it('replaces additional ASCII symbols', () => {
    expect(replaceTrailingArrowSequence('draft !=')).toBe('draft ≠')
    expect(replaceTrailingArrowSequence('draft ===')).toBe('draft ≡')
    expect(replaceTrailingArrowSequence('draft !==')).toBe('draft ≢')
    expect(replaceTrailingArrowSequence('draft ≠=')).toBe('draft ≢')
    expect(replaceTrailingArrowSequence('draft >=')).toBe('draft ≥')
  })

  it('leaves other text unchanged', () => {
    expect(replaceTrailingArrowSequence('draft =<')).toBe('draft =<')
  })
})
