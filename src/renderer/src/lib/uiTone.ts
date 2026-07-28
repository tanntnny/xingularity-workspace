export const UI_TONES = [
  'subtle',
  'neutral',
  'info',
  'accent',
  'attention',
  'success',
  'warning',
  'danger'
] as const

export type UiTone = (typeof UI_TONES)[number]

export function getUiToneStyle(tone?: UiTone): CSSProperties | undefined {
  if (!tone) {
    return undefined
  }

  return {
    '--ui-tone-bg': `var(--ui-tone-${tone}-bg)`,
    '--ui-tone-border': `var(--ui-tone-${tone}-border)`,
    '--ui-tone-text': `var(--ui-tone-${tone}-text)`,
    '--ui-tone-meta': `var(--ui-tone-${tone}-meta)`
  } as CSSProperties
}
import type { CSSProperties } from 'react'
