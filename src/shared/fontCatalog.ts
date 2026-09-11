export const APP_FONT_IDS = [
  'inter',
  'roboto',
  'open-sans',
  'source-sans-3',
  'dm-sans',
  'nunito-sans',
  'manrope',
  'plus-jakarta-sans',
  'ibm-plex-sans',
  'space-grotesk',
  'lora',
  'merriweather',
  'source-serif-4',
  'iowan-old-style',
  'jetbrains-mono',
  'fira-code',
  'ibm-plex-mono',
  'system-ui',
  'system-serif',
  'system-mono'
] as const

export type AppFontId = (typeof APP_FONT_IDS)[number]
export type AppFontCategory = 'sans' | 'serif' | 'mono' | 'system'

export interface AppFontOption {
  id: AppFontId
  label: string
  category: AppFontCategory
  cssFamily: string
}

export const DEFAULT_APP_FONT_ID: AppFontId = 'inter'

export const APP_FONT_OPTIONS = [
  {
    id: 'inter',
    label: 'Inter',
    category: 'sans',
    cssFamily: "'Inter Variable', Inter, ui-sans-serif, system-ui, sans-serif"
  },
  {
    id: 'roboto',
    label: 'Roboto',
    category: 'sans',
    cssFamily: "'Roboto', ui-sans-serif, system-ui, sans-serif"
  },
  {
    id: 'open-sans',
    label: 'Open Sans',
    category: 'sans',
    cssFamily: "'Open Sans', ui-sans-serif, system-ui, sans-serif"
  },
  {
    id: 'source-sans-3',
    label: 'Source Sans 3',
    category: 'sans',
    cssFamily: "'Source Sans 3', ui-sans-serif, system-ui, sans-serif"
  },
  {
    id: 'dm-sans',
    label: 'DM Sans',
    category: 'sans',
    cssFamily: "'DM Sans', ui-sans-serif, system-ui, sans-serif"
  },
  {
    id: 'nunito-sans',
    label: 'Nunito Sans',
    category: 'sans',
    cssFamily: "'Nunito Sans', ui-sans-serif, system-ui, sans-serif"
  },
  {
    id: 'manrope',
    label: 'Manrope',
    category: 'sans',
    cssFamily: "'Manrope', ui-sans-serif, system-ui, sans-serif"
  },
  {
    id: 'plus-jakarta-sans',
    label: 'Plus Jakarta Sans',
    category: 'sans',
    cssFamily: "'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif"
  },
  {
    id: 'ibm-plex-sans',
    label: 'IBM Plex Sans',
    category: 'sans',
    cssFamily: "'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif"
  },
  {
    id: 'space-grotesk',
    label: 'Space Grotesk',
    category: 'sans',
    cssFamily: "'Space Grotesk', ui-sans-serif, system-ui, sans-serif"
  },
  {
    id: 'lora',
    label: 'Lora',
    category: 'serif',
    cssFamily: "'Lora', ui-serif, Georgia, serif"
  },
  {
    id: 'merriweather',
    label: 'Merriweather',
    category: 'serif',
    cssFamily: "'Merriweather', ui-serif, Georgia, serif"
  },
  {
    id: 'source-serif-4',
    label: 'Source Serif 4',
    category: 'serif',
    cssFamily: "'Source Serif 4', ui-serif, Georgia, serif"
  },
  {
    id: 'iowan-old-style',
    label: 'Iowan Old Style',
    category: 'serif',
    cssFamily: "'Iowan Old Style', Iowan, 'Palatino Linotype', Palatino, Georgia, serif"
  },
  {
    id: 'jetbrains-mono',
    label: 'JetBrains Mono',
    category: 'mono',
    cssFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace"
  },
  {
    id: 'fira-code',
    label: 'Fira Code',
    category: 'mono',
    cssFamily: "'Fira Code', ui-monospace, SFMono-Regular, Menlo, monospace"
  },
  {
    id: 'ibm-plex-mono',
    label: 'IBM Plex Mono',
    category: 'mono',
    cssFamily: "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace"
  },
  {
    id: 'system-ui',
    label: 'System UI',
    category: 'system',
    cssFamily: 'ui-sans-serif, system-ui, sans-serif'
  },
  {
    id: 'system-serif',
    label: 'System Serif',
    category: 'system',
    cssFamily: 'ui-serif, Georgia, serif'
  },
  {
    id: 'system-mono',
    label: 'System Mono',
    category: 'system',
    cssFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace'
  }
] satisfies readonly AppFontOption[]

export const DEFAULT_CODE_FONT_ID: AppFontId = 'jetbrains-mono'

export const CODE_FONT_OPTIONS = APP_FONT_OPTIONS.filter(
  (option) => option.category === 'mono' || option.id === 'system-mono'
)

const LEGACY_APP_FONT_ALIASES: Record<string, AppFontId> = {
  Inter: 'inter',
  'Inter Variable': 'inter',
  Iowan: 'iowan-old-style',
  'Iowan Old Style': 'iowan-old-style',
  serif: 'system-serif',
  'sans-serif': 'system-ui',
  monospace: 'system-mono',
  'JetBrains Mono': 'jetbrains-mono'
}

export function isAppFontId(value: unknown): value is AppFontId {
  return typeof value === 'string' && APP_FONT_IDS.includes(value as AppFontId)
}

export function normalizeAppFontId(value: unknown): AppFontId {
  if (typeof value !== 'string') {
    return DEFAULT_APP_FONT_ID
  }

  const trimmed = value.trim()
  if (isAppFontId(trimmed)) {
    return trimmed
  }

  return LEGACY_APP_FONT_ALIASES[trimmed] ?? DEFAULT_APP_FONT_ID
}

export function getAppFontOption(value: unknown): AppFontOption {
  const normalizedId = normalizeAppFontId(value)
  return APP_FONT_OPTIONS.find((option) => option.id === normalizedId) ?? APP_FONT_OPTIONS[0]
}

export function isCodeFontId(value: unknown): value is AppFontId {
  return isAppFontId(value) && CODE_FONT_OPTIONS.some((option) => option.id === value)
}

export function normalizeCodeFontId(value: unknown): AppFontId {
  const normalizedId = normalizeAppFontId(value)
  return isCodeFontId(normalizedId) ? normalizedId : DEFAULT_CODE_FONT_ID
}

export function getCodeFontOption(value: unknown): AppFontOption {
  const normalizedId = normalizeCodeFontId(value)
  return CODE_FONT_OPTIONS.find((option) => option.id === normalizedId) ?? CODE_FONT_OPTIONS[0]
}
