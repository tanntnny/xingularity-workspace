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
  '#0ea5e9',
  '#0891b2',
  '#2563eb',
  '#4f46e5',
  '#7c3aed',
  '#db2777',
  '#be123c',
  '#ea580c',
  '#c2410c',
  '#d97706',
  '#b45309',
  '#65a30d',
  '#16a34a',
  '#0f766e',
  '#475569',
  '#334155'
]

export const DEFAULT_PROJECT_ICON_COLOR = PROJECT_ICON_COLORS[0]

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
    color: isProjectIconColor(icon.color) ? icon.color : DEFAULT_PROJECT_ICON_COLOR
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

function hashString(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}

function normalizeSymbolGlyph(value: string | null): ProjectIconSymbol {
  return PROJECT_ICON_SYMBOLS.includes(value as ProjectIconSymbol)
    ? (value as ProjectIconSymbol)
    : PROJECT_ICON_SYMBOLS[0]
}
