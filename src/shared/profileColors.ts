export const PROFILE_COLOR_VALUES = [
  'indigo',
  'emerald',
  'rose',
  'amber',
  'cyan',
  'monotone'
] as const

export type ProfileColor = (typeof PROFILE_COLOR_VALUES)[number]

export function isProfileColor(value: unknown): value is ProfileColor {
  return typeof value === 'string' && PROFILE_COLOR_VALUES.includes(value as ProfileColor)
}
