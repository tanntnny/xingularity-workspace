import type { ProfileColor } from '../../../shared/profileColors'

type ProfileColorOption = {
  value: ProfileColor
  label: string
  swatch: string
  swatchBorder: string
}

export const PROFILE_COLOR_OPTIONS: ProfileColorOption[] = [
  {
    value: 'indigo',
    label: 'Indigo',
    swatch: '#6366f1',
    swatchBorder: 'rgba(129, 140, 248, 0.34)'
  },
  {
    value: 'emerald',
    label: 'Emerald',
    swatch: '#10b981',
    swatchBorder: 'rgba(52, 211, 153, 0.34)'
  },
  {
    value: 'rose',
    label: 'Rose',
    swatch: '#f43f5e',
    swatchBorder: 'rgba(251, 113, 133, 0.34)'
  },
  {
    value: 'amber',
    label: 'Amber',
    swatch: '#f59e0b',
    swatchBorder: 'rgba(251, 191, 36, 0.34)'
  },
  {
    value: 'cyan',
    label: 'Cyan',
    swatch: '#06b6d4',
    swatchBorder: 'rgba(34, 211, 238, 0.34)'
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
  if (color === 'indigo') {
    return {
      accent: '#6366f1',
      soft: 'rgba(99, 102, 241, 0.16)',
      line: 'rgba(129, 140, 248, 0.34)'
    }
  }

  if (color === 'emerald') {
    return {
      accent: '#10b981',
      soft: 'rgba(16, 185, 129, 0.16)',
      line: 'rgba(52, 211, 153, 0.34)'
    }
  }

  if (color === 'rose') {
    return {
      accent: '#f43f5e',
      soft: 'rgba(244, 63, 94, 0.16)',
      line: 'rgba(251, 113, 133, 0.34)'
    }
  }

  if (color === 'amber') {
    return {
      accent: '#f59e0b',
      soft: 'rgba(245, 158, 11, 0.16)',
      line: 'rgba(251, 191, 36, 0.34)'
    }
  }

  if (color === 'cyan') {
    return {
      accent: '#06b6d4',
      soft: 'rgba(6, 182, 212, 0.16)',
      line: 'rgba(34, 211, 238, 0.34)'
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
