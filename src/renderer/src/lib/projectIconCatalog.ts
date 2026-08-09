import * as TablerIcons from '@tabler/icons-react'
import type { TablerIcon } from '@tabler/icons-react'
import {
  BookOpen,
  Briefcase,
  Calendar,
  Camera,
  FlaskConical,
  FolderKanban,
  Globe,
  Lightbulb,
  Megaphone,
  Monitor,
  Package,
  PenTool,
  Rocket,
  Shield,
  Sparkles,
  Target
} from '../components/ui/icons'
import type { ProjectIconSymbol } from '../../../shared/types'
import { PROJECT_ICON_SYMBOLS } from '../../../shared/projectIcons'

export interface ProjectIconCatalogEntry {
  glyph: ProjectIconSymbol
  label: string
  Icon: TablerIcon
}

const FILLED_ICON_NAME_PATTERN = /^Icon(.+)Filled$/

function toGlyph(value: string): ProjectIconSymbol {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .replace(/([A-Za-z])(\d)/g, '$1-$2')
    .replace(/(\d)([A-Za-z])/g, '$1-$2')
    .toLowerCase()
}

function toLabel(glyph: ProjectIconSymbol): string {
  return glyph
    .split('-')
    .map((part) => (part ? `${part[0].toUpperCase()}${part.slice(1)}` : part))
    .join(' ')
}

const LEGACY_PROJECT_ICON_COMPONENTS: Record<ProjectIconSymbol, TablerIcon> = {
  briefcase: Briefcase,
  'folder-kanban': FolderKanban,
  rocket: Rocket,
  lightbulb: Lightbulb,
  target: Target,
  'book-open': BookOpen,
  package: Package,
  'flask-conical': FlaskConical,
  sparkles: Sparkles,
  'pen-tool': PenTool,
  monitor: Monitor,
  megaphone: Megaphone,
  globe: Globe,
  shield: Shield,
  camera: Camera,
  calendar: Calendar
}

function buildProjectIconCatalog(): ProjectIconCatalogEntry[] {
  const seenIcons = new Set<TablerIcon>()
  const entries: ProjectIconCatalogEntry[] = []

  for (const [exportName, value] of Object.entries(TablerIcons)) {
    const match = exportName.match(FILLED_ICON_NAME_PATTERN)
    if (!match || typeof value !== 'object' || value === null) {
      continue
    }

    const Icon = value as unknown as TablerIcon
    if (seenIcons.has(Icon)) {
      continue
    }

    seenIcons.add(Icon)
    const glyph = toGlyph(match[1])
    entries.push({ glyph, label: toLabel(glyph), Icon })
  }

  const existingGlyphs = new Set(entries.map((entry) => entry.glyph))
  for (const glyph of PROJECT_ICON_SYMBOLS) {
    if (!existingGlyphs.has(glyph)) {
      entries.push({
        glyph,
        label: toLabel(glyph),
        Icon: LEGACY_PROJECT_ICON_COMPONENTS[glyph]
      })
    }
  }

  return entries.sort((left, right) => left.label.localeCompare(right.label))
}

export const PROJECT_ICON_CATALOG = buildProjectIconCatalog()

const PROJECT_ICON_CATALOG_BY_GLYPH = new Map(
  PROJECT_ICON_CATALOG.map((entry) => [entry.glyph, entry])
)

export function getProjectIconCatalogEntry(glyph: ProjectIconSymbol): ProjectIconCatalogEntry {
  return PROJECT_ICON_CATALOG_BY_GLYPH.get(glyph) ?? PROJECT_ICON_CATALOG[0]
}

export function getProjectIconComponent(glyph: ProjectIconSymbol): TablerIcon {
  return getProjectIconCatalogEntry(glyph).Icon
}
