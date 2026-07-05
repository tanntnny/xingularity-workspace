import { describe, expect, it } from 'vitest'
import { switchStyles } from '../src/renderer/src/components/ui/switchStyles'

describe('switchStyles', () => {
  it('uses theme-adaptive variables for the thumb colors', () => {
    const baseStyles = switchStyles['& .MuiSwitch-switchBase']
    const checkedStyles = switchStyles['& .MuiSwitch-switchBase.Mui-checked']
    const thumbStyles = switchStyles['& .MuiSwitch-thumb']

    expect(baseStyles.color).toBe('var(--switch-thumb-off-color)')
    expect(checkedStyles.color).toBe('var(--switch-thumb-on-color)')
    expect(thumbStyles.backgroundColor).toBe('currentColor')
  })

  it('uses theme-adaptive variables for the off-state track', () => {
    const trackStyles = switchStyles['& .MuiSwitch-track']

    expect(trackStyles.opacity).toBe(1)
    expect(trackStyles.backgroundColor).toBe('var(--switch-track-off-bg)')
    expect(trackStyles.border).toBe('1px solid var(--switch-track-off-border)')
  })

  it('keeps the checked track fully visible', () => {
    const checkedTrackStyles =
      switchStyles['& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track']

    expect(checkedTrackStyles.opacity).toBe(1)
    expect(checkedTrackStyles.backgroundColor).toBe('var(--accent)')
    expect(checkedTrackStyles.borderColor).toBe('var(--accent)')
  })
})
