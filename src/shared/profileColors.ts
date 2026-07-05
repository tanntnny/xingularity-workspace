export const PROFILE_COLOR_VALUES = ['atmosphere', 'monotone'] as const

export type ProfileColor = (typeof PROFILE_COLOR_VALUES)[number]

const LEGACY_PROFILE_COLOR_VALUES = ['indigo', 'emerald', 'rose', 'amber', 'cyan'] as const

export function isProfileColor(value: unknown): value is ProfileColor {
  return typeof value === 'string' && PROFILE_COLOR_VALUES.includes(value as ProfileColor)
}

export function normalizeProfileColor(
  value: unknown,
  fallback: ProfileColor = 'atmosphere'
): ProfileColor {
  if (isProfileColor(value)) {
    return value
  }

  if (
    typeof value === 'string' &&
    LEGACY_PROFILE_COLOR_VALUES.includes(value as (typeof LEGACY_PROFILE_COLOR_VALUES)[number])
  ) {
    return 'atmosphere'
  }

  return fallback
}
