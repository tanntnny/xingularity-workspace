import { ProjectIconShape, ProjectIconStyle, ProjectIconVariant } from './types'

export const PROJECT_ICON_SHAPES: ProjectIconShape[] = [
  'circle',
  'square',
  'triangle',
  'diamond',
  'hex'
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

export function createRandomProjectIcon(seed: string): ProjectIconStyle {
  const hash = hashString(seed)
  return {
    shape: PROJECT_ICON_SHAPES[hash % PROJECT_ICON_SHAPES.length],
    variant: PROJECT_ICON_VARIANTS[Math.floor(hash / 7) % PROJECT_ICON_VARIANTS.length],
    color: PROJECT_ICON_COLORS[Math.floor(hash / 13) % PROJECT_ICON_COLORS.length]
  }
}

function hashString(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}
