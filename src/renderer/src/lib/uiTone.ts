import type { CSSProperties } from 'react'

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

  const style: Record<string, string> = {
    '--ui-tone-bg': `var(--ui-tone-${tone}-bg)`,
    '--ui-tone-border': `var(--ui-tone-${tone}-border)`,
    '--ui-tone-text': `var(--ui-tone-${tone}-text)`,
    '--ui-tone-meta': `var(--ui-tone-${tone}-meta)`
  }

  return style as CSSProperties
}

export function mergeUiToneStyle(tone?: UiTone, style?: CSSProperties): CSSProperties | undefined {
  const toneStyle = getUiToneStyle(tone)
  if (!toneStyle) {
    return style
  }
  return style ? { ...toneStyle, ...style } : toneStyle
}
