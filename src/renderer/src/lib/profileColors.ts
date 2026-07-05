import type { ProfileColor } from '../../../shared/profileColors'

type ProfileColorOption = {
  value: ProfileColor
  label: string
  swatch: string
  swatchBorder: string
}

export const PROFILE_COLOR_OPTIONS: ProfileColorOption[] = [
  {
    value: 'atmosphere',
    label: 'Atmosphere',
    swatch: 'linear-gradient(135deg, #325f6d 0%, #6e8f7b 56%, #c79b61 100%)',
    swatchBorder: 'rgba(98, 143, 155, 0.34)'
  },
  {
    value: 'monotone',
    label: 'Monotone',
    swatch: 'var(--text)',
    swatchBorder: 'rgba(148, 163, 184, 0.34)'
  }
]

export function getProfileColorOption(color: ProfileColor): ProfileColorOption {
  return PROFILE_COLOR_OPTIONS.find((option) => option.value === color) ?? PROFILE_COLOR_OPTIONS[0]!
}

export function resolveProfileAccent(
  color: ProfileColor,
  isDarkMode: boolean
): {
  accent: string
  soft: string
  line: string
} {
  if (color === 'atmosphere') {
    return isDarkMode
      ? {
          accent: '#a7d0d8',
          soft: 'rgba(167, 208, 216, 0.16)',
          line: 'rgba(167, 208, 216, 0.38)'
        }
      : {
          accent: '#325f6d',
          soft: 'rgba(50, 95, 109, 0.14)',
          line: 'rgba(98, 143, 155, 0.34)'
        }
  }

  return isDarkMode
    ? {
        accent: '#ffffff',
        soft: 'rgba(255, 255, 255, 0.14)',
        line: 'rgba(255, 255, 255, 0.34)'
      }
    : {
        accent: '#101010',
        soft: 'rgba(16, 16, 16, 0.12)',
        line: 'rgba(16, 16, 16, 0.26)'
      }
}
