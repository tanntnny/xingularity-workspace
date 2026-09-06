import type { IconNode } from '@tabler/icons-react'
import filledIconNodesJson from '@tabler-icon-data/tabler-nodes-filled.json'
import outlineIconNodesJson from '@tabler-icon-data/tabler-nodes-outline.json'
import type { ProjectIconSymbol, ProjectIconStyle, ProjectIconVariant } from '../../../shared/types'
import { PROJECT_ICON_SYMBOLS } from '../../../shared/projectIcons'

export const PROJECT_ICON_PICKER_RESULT_LIMIT = 48

export interface ProjectIconCatalogEntry {
  glyph: ProjectIconSymbol
  label: string
  variant: ProjectIconVariant
  iconNode: IconNode
  searchText: string
}

type IconNodeMap = Record<string, IconNode>

const FILLED_ICON_NODES = filledIconNodesJson as unknown as IconNodeMap
const OUTLINE_ICON_NODES = outlineIconNodesJson as unknown as IconNodeMap

function toLabel(glyph: ProjectIconSymbol): string {
  return glyph
    .split('-')
    .map((part) => (part ? `${part[0].toUpperCase()}${part.slice(1)}` : part))
    .join(' ')
}

function createCatalogEntry(
  glyph: ProjectIconSymbol,
  variant: ProjectIconVariant,
  iconNode: IconNode
): ProjectIconCatalogEntry {
  const label = toLabel(glyph)
  return {
    glyph,
    label,
    variant,
    iconNode,
    searchText: `${label} ${glyph} ${variant}`.toLowerCase()
  }
}

const LEGACY_FILLED_ICON_GLYPHS: Record<ProjectIconSymbol, string> = {
  briefcase: 'briefcase',
  'folder-kanban': 'layout-kanban',
  rocket: 'send',
  lightbulb: 'bulb',
  target: 'circle-dot',
  'book-open': 'book',
  package: 'layout-grid',
  'flask-conical': 'flask',
  sparkles: 'sparkles',
  'pen-tool': 'pencil',
  monitor: 'device-desktop',
  megaphone: 'device-speaker',
  globe: 'globe',
  shield: 'shield',
  camera: 'camera',
  calendar: 'calendar'
}

const LEGACY_OUTLINED_ICON_GLYPHS: Record<ProjectIconSymbol, string> = {
  briefcase: 'briefcase',
  'folder-kanban': 'layout-kanban',
  rocket: 'rocket',
  lightbulb: 'bulb',
  target: 'target',
  'book-open': 'book',
  package: 'package',
  'flask-conical': 'flask',
  sparkles: 'sparkles',
  'pen-tool': 'pencil',
  monitor: 'device-desktop',
  megaphone: 'device-speaker',
  globe: 'globe',
  shield: 'shield',
  camera: 'camera',
  calendar: 'calendar'
}

function buildProjectIconCatalog(): ProjectIconCatalogEntry[] {
  const entries: ProjectIconCatalogEntry[] = [
    ...Object.entries(OUTLINE_ICON_NODES).map(([glyph, iconNode]) =>
      createCatalogEntry(glyph, 'outlined', iconNode)
    ),
    ...Object.entries(FILLED_ICON_NODES).map(([glyph, iconNode]) =>
      createCatalogEntry(glyph, 'filled', iconNode)
    )
  ]

  const existingOutlinedGlyphs = new Set(
    entries.filter((entry) => entry.variant === 'outlined').map((entry) => entry.glyph)
  )
  for (const glyph of PROJECT_ICON_SYMBOLS) {
    if (existingOutlinedGlyphs.has(glyph)) continue

    const fallbackGlyph = LEGACY_OUTLINED_ICON_GLYPHS[glyph]
    const iconNode = OUTLINE_ICON_NODES[fallbackGlyph]
    if (!iconNode) continue

    entries.push(createCatalogEntry(glyph, 'outlined', iconNode))
  }

  const existingFilledGlyphs = new Set(
    entries.filter((entry) => entry.variant === 'filled').map((entry) => entry.glyph)
  )
  for (const glyph of PROJECT_ICON_SYMBOLS) {
    if (existingFilledGlyphs.has(glyph)) continue

    const fallbackGlyph = LEGACY_FILLED_ICON_GLYPHS[glyph]
    const iconNode = FILLED_ICON_NODES[fallbackGlyph]
    if (!iconNode) continue

    entries.push(createCatalogEntry(glyph, 'filled', iconNode))
  }

  return entries.sort((left, right) => {
    const labelOrder = left.label.localeCompare(right.label)
    if (labelOrder !== 0) return labelOrder
    return left.variant === right.variant ? 0 : left.variant === 'filled' ? -1 : 1
  })
}

export const PROJECT_ICON_CATALOG = buildProjectIconCatalog()

function getCatalogKey(glyph: ProjectIconSymbol, variant: ProjectIconVariant): string {
  return `${glyph}:${variant}`
}

const PROJECT_ICON_CATALOG_BY_GLYPH = new Map(
  PROJECT_ICON_CATALOG.map((entry) => [getCatalogKey(entry.glyph, entry.variant), entry])
)

export function getProjectIconCatalogEntry(
  glyph: ProjectIconSymbol,
  variant: ProjectIconVariant = 'filled'
): ProjectIconCatalogEntry {
  return (
    PROJECT_ICON_CATALOG_BY_GLYPH.get(getCatalogKey(glyph, variant)) ??
    PROJECT_ICON_CATALOG_BY_GLYPH.get(getCatalogKey(glyph, 'filled')) ??
    PROJECT_ICON_CATALOG[0]
  )
}

function getSearchRank(entry: ProjectIconCatalogEntry, query: string): number {
  const normalizedGlyph = entry.glyph.toLowerCase()
  const normalizedLabel = entry.label.toLowerCase()
  if (normalizedGlyph === query || normalizedLabel === query) return 0
  if (normalizedGlyph.startsWith(query) || normalizedLabel.startsWith(query)) return 1
  return 2
}

export function getFeaturedProjectIconEntries(
  currentIcon?: Pick<ProjectIconStyle, 'glyph' | 'variant'>
): ProjectIconCatalogEntry[] {
  const entries: ProjectIconCatalogEntry[] = []
  const seen = new Set<string>()

  const addEntry = (glyph: ProjectIconSymbol | undefined, variant: ProjectIconVariant): void => {
    if (!glyph) return

    const entry = getProjectIconCatalogEntry(glyph, variant)
    const key = getCatalogKey(entry.glyph, entry.variant)
    if (seen.has(key)) return

    seen.add(key)
    entries.push(entry)
  }

  if (currentIcon?.glyph) {
    addEntry(currentIcon.glyph, currentIcon.variant)
    addEntry(currentIcon.glyph, currentIcon.variant === 'filled' ? 'outlined' : 'filled')
  }

  for (const glyph of PROJECT_ICON_SYMBOLS) {
    addEntry(glyph, 'filled')
    addEntry(glyph, 'outlined')
  }

  return entries.slice(0, PROJECT_ICON_PICKER_RESULT_LIMIT)
}

export interface ProjectIconSearchResult {
  entries: ProjectIconCatalogEntry[]
  totalMatches: number
  isTruncated: boolean
}

export function searchProjectIcons(
  query: string,
  currentIcon?: Pick<ProjectIconStyle, 'glyph' | 'variant'>
): ProjectIconSearchResult {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) {
    const entries = getFeaturedProjectIconEntries(currentIcon)
    return { entries, totalMatches: entries.length, isTruncated: false }
  }

  const matches = PROJECT_ICON_CATALOG.filter((entry) => entry.searchText.includes(normalizedQuery))
  matches.sort((left, right) => {
    const rankOrder = getSearchRank(left, normalizedQuery) - getSearchRank(right, normalizedQuery)
    if (rankOrder !== 0) return rankOrder

    const labelOrder = left.label.localeCompare(right.label)
    if (labelOrder !== 0) return labelOrder
    return left.variant === right.variant ? 0 : left.variant === 'filled' ? -1 : 1
  })

  return {
    entries: matches.slice(0, PROJECT_ICON_PICKER_RESULT_LIMIT),
    totalMatches: matches.length,
    isTruncated: matches.length > PROJECT_ICON_PICKER_RESULT_LIMIT
  }
}
