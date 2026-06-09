import { describe, expect, it } from 'vitest'
import {
  findTrailingArrowReplacement,
  replaceTrailingArrowSequence,
  resolveArrowReplacementForTextInput
} from '../src/renderer/src/lib/noteArrowInputRules'

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

describe('findTrailingArrowReplacement', () => {
  it('returns the longest trailing match', () => {
    expect(findTrailingArrowReplacement('draft <->')).toEqual({
      sequence: '<->',
      replacement: '↔'
    })
    expect(findTrailingArrowReplacement('draft <==>')).toEqual({
      sequence: '<==>',
      replacement: '⟺'
    })
  })

  it('returns null when there is no trailing match', () => {
    expect(findTrailingArrowReplacement('draft =<')).toBeNull()
  })
})

describe('resolveArrowReplacementForTextInput', () => {
  it('returns a replacement plan for prose typing', () => {
    expect(
      resolveArrowReplacementForTextInput({
        textBeforeCursor: 'Flow -',
        insertedText: '>'
      })
    ).toEqual({
      deletePreviousTextLength: 1,
      replacement: '→'
    })

    expect(
      resolveArrowReplacementForTextInput({
        textBeforeCursor: 'Flow <-',
        insertedText: '>'
      })
    ).toEqual({
      deletePreviousTextLength: 2,
      replacement: '↔'
    })
  })

  it('skips code text and unrelated typing', () => {
    expect(
      resolveArrowReplacementForTextInput({
        textBeforeCursor: 'const fn = (x) =',
        insertedText: '>',
        isCodeText: true
      })
    ).toBeNull()

    expect(
      resolveArrowReplacementForTextInput({
        textBeforeCursor: 'draft =',
        insertedText: '<'
      })
    ).toBeNull()
  })
})
