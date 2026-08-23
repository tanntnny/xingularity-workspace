import {
  ProjectIconGlyph,
  ProjectIconInput,
  ProjectIconSet,
  ProjectIconShape,
  ProjectIconStyle,
  ProjectIconSymbol,
  ProjectIconVariant
} from './types'

export const PROJECT_ICON_SHAPES: ProjectIconShape[] = [
  'circle',
  'square',
  'triangle',
  'diamond',
  'hex'
]

export const PROJECT_ICON_SETS: ProjectIconSet[] = ['tabler']
export const PROJECT_ICON_SYMBOLS: ProjectIconSymbol[] = [
  'briefcase',
  'folder-kanban',
  'rocket',
  'lightbulb',
  'target',
  'book-open',
  'package',
  'flask-conical',
  'sparkles',
  'pen-tool',
  'monitor',
  'megaphone',
  'globe',
  'shield',
  'camera',
  'calendar'
]
export const PROJECT_ICON_VARIANTS: ProjectIconVariant[] = ['filled']

export const PROJECT_ICON_COLORS: string[] = [
  '#38bdf8',
  '#22d3ee',
  '#60a5fa',
  '#818cf8',
  '#a78bfa',
  '#e879f9',
  '#f472b6',
  '#fb7185',
  '#fb923c',
  '#fbbf24',
  '#facc15',
  '#a3e635',
  '#4ade80',
  '#2dd4bf',
  '#34d399',
  '#94a3b8'
]

export const DEFAULT_PROJECT_ICON_COLOR = PROJECT_ICON_COLORS[0]
const PROJECT_ICON_CONTRAST_SURFACE = '#212122'
const PROJECT_ICON_MIN_CONTRAST_RATIO = 3

export function createRandomProjectIcon(seed: string): ProjectIconStyle {
  const hash = hashString(seed)
  const glyph = PROJECT_ICON_SYMBOLS[hash % PROJECT_ICON_SYMBOLS.length]

  return {
    set: 'tabler',
    glyph,
    shape: undefined,
    variant: 'filled',
    color: PROJECT_ICON_COLORS[Math.floor(hash / 13) % PROJECT_ICON_COLORS.length]
  }
}

export function coerceFilledTablerProjectIcon(
  icon: ProjectIconInput | null | undefined,
  fallbackSeed: string
): ProjectIconStyle {
  const normalized = normalizeProjectIcon(icon, fallbackSeed)
  return {
    set: 'tabler',
    glyph: normalized.glyph,
    shape: undefined,
    variant: 'filled',
    color: normalized.color
  }
}

export function normalizeProjectIcon(
  icon: ProjectIconInput | null | undefined,
  fallbackSeed: string
): ProjectIconStyle {
  if (!icon || typeof icon !== 'object') {
    return createRandomProjectIcon(fallbackSeed)
  }

  const candidateGlyph =
    typeof icon.glyph === 'string' ? icon.glyph : typeof icon.shape === 'string' ? icon.shape : null
  const preservesSymbolGlyph =
    icon.set === 'tabler' ||
    icon.set === 'lucide' ||
    (icon.set === undefined && PROJECT_ICON_SYMBOLS.includes(candidateGlyph as ProjectIconSymbol))
  const glyph = preservesSymbolGlyph
    ? normalizeSymbolGlyph(candidateGlyph)
    : PROJECT_ICON_SYMBOLS[
        hashString(`${fallbackSeed}:${candidateGlyph ?? ''}`) % PROJECT_ICON_SYMBOLS.length
      ]

  return {
    set: 'tabler',
    glyph,
    shape: undefined,
    variant: 'filled',
    color: normalizeProjectIconColor(icon.color, fallbackSeed)
  }
}

export function resolveProjectIconSet(): ProjectIconSet {
  return 'tabler'
}

export function resolveProjectIconGlyph(
  icon: Pick<ProjectIconStyle, 'set' | 'glyph' | 'shape'>
): ProjectIconGlyph {
  return normalizeSymbolGlyph(typeof icon.glyph === 'string' ? icon.glyph : null)
}

export function isProjectIconColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value)
}

function normalizeProjectIconColor(value: unknown, fallbackSeed: string): string {
  if (!isProjectIconColor(value)) {
    return DEFAULT_PROJECT_ICON_COLOR
  }

  if (getProjectIconContrastRatio(value) >= PROJECT_ICON_MIN_CONTRAST_RATIO) {
    return value
  }

  return PROJECT_ICON_COLORS[
    hashString(`${fallbackSeed}:${value.toLowerCase()}`) % PROJECT_ICON_COLORS.length
  ]
}

function getProjectIconContrastRatio(color: string): number {
  const foregroundLuminance = getRelativeLuminance(color)
  const surfaceLuminance = getRelativeLuminance(PROJECT_ICON_CONTRAST_SURFACE)
  const lighter = Math.max(foregroundLuminance, surfaceLuminance)
  const darker = Math.min(foregroundLuminance, surfaceLuminance)
  return (lighter + 0.05) / (darker + 0.05)
}

function getRelativeLuminance(color: string): number {
  const channels = [0, 2, 4].map(
    (offset) => Number.parseInt(color.slice(offset + 1, offset + 3), 16) / 255
  )
  const linearChannels = channels.map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  )

  return 0.2126 * linearChannels[0] + 0.7152 * linearChannels[1] + 0.0722 * linearChannels[2]
}

function hashString(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}

function normalizeSymbolGlyph(value: string | null): ProjectIconSymbol {
  return value?.trim() ? value.trim() : PROJECT_ICON_SYMBOLS[0]
}
