import {
  ProjectIconGlyph,
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

export const PROJECT_ICON_SETS: ProjectIconSet[] = ['shape', 'lucide']
export const PROJECT_ICON_SYMBOLS: ProjectIconSymbol[] = [
  'briefcase',
  'folder-kanban',
  'rocket',
  'lightbulb',
  'target',
  'book-open',
  'package',
  'flask-conical'
]
export const PROJECT_ICON_VARIANTS: ProjectIconVariant[] = ['filled', 'outlined']

export const PROJECT_ICON_COLORS: string[] = [
  '#2563eb',
  '#0f766e',
  '#c2410c',
  '#be123c',
  '#7c3aed',
  '#334155',
  '#16a34a',
  '#d97706'
]

export const DEFAULT_PROJECT_ICON_COLOR = PROJECT_ICON_COLORS[0]

export function createRandomProjectIcon(seed: string): ProjectIconStyle {
  const hash = hashString(seed)
  const glyph = PROJECT_ICON_SYMBOLS[hash % PROJECT_ICON_SYMBOLS.length]

  return {
    set: 'lucide',
    glyph,
    shape: undefined,
    variant: 'filled',
    color: PROJECT_ICON_COLORS[Math.floor(hash / 13) % PROJECT_ICON_COLORS.length]
  }
}

export function coerceFilledLucideProjectIcon(
  icon: Partial<ProjectIconStyle> | null | undefined,
  fallbackSeed: string
): ProjectIconStyle {
  const normalized = normalizeProjectIcon(icon, fallbackSeed)
  const glyph =
    normalized.set === 'lucide'
      ? normalizeSymbolGlyph(typeof normalized.glyph === 'string' ? normalized.glyph : null)
      : PROJECT_ICON_SYMBOLS[
          hashString(`${fallbackSeed}:${normalized.glyph ?? normalized.shape ?? ''}`) %
            PROJECT_ICON_SYMBOLS.length
        ]

  return {
    set: 'lucide',
    glyph,
    shape: undefined,
    variant: 'filled',
    color: normalized.color
  }
}

export function normalizeProjectIcon(
  icon: Partial<ProjectIconStyle> | null | undefined,
  fallbackSeed: string
): ProjectIconStyle {
  if (!icon || typeof icon !== 'object') {
    return createRandomProjectIcon(fallbackSeed)
  }

  const set = icon.set === 'lucide' ? 'lucide' : 'shape'
  const candidateGlyph =
    typeof icon.glyph === 'string' ? icon.glyph : typeof icon.shape === 'string' ? icon.shape : null
  const glyph =
    set === 'shape' ? normalizeShapeGlyph(candidateGlyph) : normalizeSymbolGlyph(candidateGlyph)

  return {
    set,
    glyph,
    shape: set === 'shape' ? (glyph as ProjectIconShape) : undefined,
    variant: icon.variant === 'outlined' ? 'outlined' : 'filled',
    color: isProjectIconColor(icon.color) ? icon.color : DEFAULT_PROJECT_ICON_COLOR
  }
}

export function resolveProjectIconSet(
  icon: Pick<ProjectIconStyle, 'set' | 'glyph' | 'shape'>
): ProjectIconSet {
  return icon.set === 'lucide' ? 'lucide' : 'shape'
}

export function resolveProjectIconGlyph(
  icon: Pick<ProjectIconStyle, 'set' | 'glyph' | 'shape'>
): ProjectIconGlyph {
  if (resolveProjectIconSet(icon) === 'lucide') {
    return normalizeSymbolGlyph(typeof icon.glyph === 'string' ? icon.glyph : null)
  }

  return normalizeShapeGlyph(
    typeof icon.glyph === 'string' ? icon.glyph : typeof icon.shape === 'string' ? icon.shape : null
  )
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

function normalizeShapeGlyph(value: string | null): ProjectIconShape {
  return PROJECT_ICON_SHAPES.includes(value as ProjectIconShape)
    ? (value as ProjectIconShape)
    : PROJECT_ICON_SHAPES[0]
}

function normalizeSymbolGlyph(value: string | null): ProjectIconSymbol {
  return PROJECT_ICON_SYMBOLS.includes(value as ProjectIconSymbol)
    ? (value as ProjectIconSymbol)
    : PROJECT_ICON_SYMBOLS[0]
}
