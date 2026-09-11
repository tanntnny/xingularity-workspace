import { describe, expect, it } from 'vitest'
import {
  getAppFontOption,
  getCodeFontOption,
  normalizeAppFontId,
  normalizeCodeFontId
} from '../src/shared/fontCatalog'

describe('font catalog', () => {
  it.each([
    ['Inter', 'inter'],
    ['Inter Variable', 'inter'],
    ['Iowan', 'iowan-old-style'],
    ['Iowan Old Style', 'iowan-old-style'],
    ['serif', 'system-serif'],
    ['sans-serif', 'system-ui'],
    ['monospace', 'system-mono'],
    ['JetBrains Mono', 'jetbrains-mono']
  ])('normalizes legacy %s to %s', (value, expected) => {
    expect(normalizeAppFontId(value)).toBe(expected)
  })

  it('resolves unknown values to the Inter option', () => {
    expect(getAppFontOption('Comic Sans')).toEqual(
      expect.objectContaining({ id: 'inter', label: 'Inter' })
    )
  })

  it('keeps code fonts in the monospace catalog', () => {
    expect(normalizeCodeFontId('fira-code')).toBe('fira-code')
    expect(getCodeFontOption('system-serif')).toEqual(
      expect.objectContaining({ id: 'jetbrains-mono', label: 'JetBrains Mono' })
    )
  })
})
