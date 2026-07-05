import { describe, expect, it } from 'vitest'
import { resolveProfileAccent } from '../src/renderer/src/lib/profileColors'

describe('resolveProfileAccent', () => {
  it('returns the curated atmosphere palette in light mode', () => {
    expect(resolveProfileAccent('atmosphere', false)).toEqual({
      accent: '#325f6d',
      soft: 'rgba(50, 95, 109, 0.14)',
      line: 'rgba(98, 143, 155, 0.34)'
    })
  })

  it('returns the curated atmosphere palette in dark mode', () => {
    expect(resolveProfileAccent('atmosphere', true)).toEqual({
      accent: '#a7d0d8',
      soft: 'rgba(167, 208, 216, 0.16)',
      line: 'rgba(167, 208, 216, 0.38)'
    })
  })

  it('keeps monotone adaptive to light and dark mode', () => {
    expect(resolveProfileAccent('monotone', false)).toEqual({
      accent: '#101010',
      soft: 'rgba(16, 16, 16, 0.12)',
      line: 'rgba(16, 16, 16, 0.26)'
    })
    expect(resolveProfileAccent('monotone', true)).toEqual({
      accent: '#ffffff',
      soft: 'rgba(255, 255, 255, 0.14)',
      line: 'rgba(255, 255, 255, 0.34)'
    })
  })
})
