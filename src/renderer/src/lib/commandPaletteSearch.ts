import type { NoteListItem, Project, ProjectIconStyle } from '../../../shared/types'
import { stripNoteExtension } from '../../../shared/noteDocument'
import {
  createSearchTextIndex,
  findSearchMatchRanges,
  mergeSearchMatchRanges,
  normalizeSearchText,
  type SearchMatchRange,
  type SearchTextIndex
} from '../../../shared/searchText'
import { getCommandPaletteFolderBreadcrumbs } from './commandPaletteNoteRows'

export type CommandPaletteSearchMode = 'name' | 'body'

export type CommandPaletteMatchRange = SearchMatchRange

export interface CommandPaletteSearchHighlights {
  title?: readonly CommandPaletteMatchRange[]
  subtitle?: readonly CommandPaletteMatchRange[]
  folders?: readonly (readonly CommandPaletteMatchRange[])[]
  excerpt?: readonly CommandPaletteMatchRange[]
}

export interface CommandPaletteSearchResult {
  id: string
  kind: 'note' | 'project'
  title: string
  subtitle: string
  value: string
  icon?: ProjectIconStyle
  keywords?: string[]
  tags?: string[]
  updatedAt?: string
  searchMode?: CommandPaletteSearchMode
  snippet?: string
  highlights?: CommandPaletteSearchHighlights
}

export interface CommandPaletteCommandSearchItem {
  value: string
  label: string
  keywords?: readonly string[]
}

export interface CommandPaletteCommandSearchResult<T extends CommandPaletteCommandSearchItem> {
  command: T
  score: number
  highlights?: CommandPaletteSearchHighlights
}

type IndexedText = SearchTextIndex

interface WeightedIndexedText {
  field: IndexedText
  weight: number
}

interface IndexedCommand<T extends CommandPaletteCommandSearchItem> {
  command: T
  label: IndexedText
  value: IndexedText
  keywords: IndexedText
}

export interface CommandPaletteCommandSearchIndex<T extends CommandPaletteCommandSearchItem> {
  entries: readonly IndexedCommand<T>[]
}

interface IndexedNote {
  note: NoteListItem
  title: IndexedText
  fileName: IndexedText
  aliases: IndexedText
  pathSegments: IndexedText
  pathSegmentKeywords: readonly string[]
  relPath: IndexedText
  body: IndexedText
  folderFields: readonly IndexedText[]
}

export interface CommandPaletteNoteSearchIndex {
  entries: readonly IndexedNote[]
}

interface IndexedProject {
  project: Project
  name: IndexedText
  summary: IndexedText
  folderPath: IndexedText
  pathSegments: IndexedText
  pathSegmentKeywords: readonly string[]
}

export interface CommandPaletteProjectSearchIndex {
  entries: readonly IndexedProject[]
}

type SearchFuzzyProfile = 'command' | 'document'

const SEARCH_TOKEN_SEPARATOR = /[\s/_.-]+/

export function tokenizeCommandPaletteQuery(query: string): string[] {
  return normalizeSearchText(query)
    .split(SEARCH_TOKEN_SEPARATOR)
    .map((term) => term.trim())
    .filter(Boolean)
}

export function createCommandPaletteCommandSearchIndex<T extends CommandPaletteCommandSearchItem>(
  commands: readonly T[]
): CommandPaletteCommandSearchIndex<T> {
  return {
    entries: commands.map((command) => ({
      command,
      label: indexText(command.label),
      value: indexText(command.value.replace(/^>/, '').trim()),
      keywords: indexText(command.keywords?.join(' ') ?? '')
    }))
  }
}

export function searchCommandPaletteCommands<T extends CommandPaletteCommandSearchItem>(
  index: CommandPaletteCommandSearchIndex<T>,
  query: string
): CommandPaletteCommandSearchResult<T>[] {
  const terms = tokenizeCommandPaletteQuery(query.trim())
  if (terms.length === 0) {
    return index.entries.map((entry) => ({ command: entry.command, score: 0 }))
  }

  return index.entries
    .map((entry) => {
      const score = scoreSearchDocument(
        terms,
        [
          { field: entry.label, weight: 8 },
          { field: entry.value, weight: 6 },
          { field: entry.keywords, weight: 5 }
        ],
        'command'
      )

      return score > 0 ? { entry, score } : null
    })
    .filter((result): result is { entry: IndexedCommand<T>; score: number } => result !== null)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }

      return left.entry.command.label.localeCompare(right.entry.command.label)
    })
    .map(({ entry, score }) => ({
      command: entry.command,
      score,
      highlights: createHighlights({
        title: collectMatchRanges(entry.label, terms)
      })
    }))
}

export function createCommandPaletteNoteSearchIndex(
  notes: readonly NoteListItem[]
): CommandPaletteNoteSearchIndex {
  return {
    entries: notes.map((note) => {
      const title = stripNoteExtension(note.name)
      const folderBreadcrumbs = getCommandPaletteFolderBreadcrumbs(note.relPath)
      const pathSegmentKeywords = getSearchPathSegments(note.relPath)

      return {
        note,
        title: indexText(title),
        fileName: indexText(note.name),
        aliases: indexText((note.mentionTargets ?? []).join(' ')),
        pathSegments: indexText(pathSegmentKeywords.join(' ')),
        pathSegmentKeywords,
        relPath: indexText(note.relPath),
        body: indexText(note.bodyPreview ?? ''),
        folderFields: folderBreadcrumbs.map(({ label }) => indexText(label))
      }
    })
  }
}

export function searchCommandPaletteNotes(
  index: CommandPaletteNoteSearchIndex,
  query: string,
  mode: CommandPaletteSearchMode = 'name',
  limit = 15,
  excludedRelPaths?: ReadonlySet<string>
): CommandPaletteSearchResult[] {
  const terms = tokenizeCommandPaletteQuery(query.trim())
  if (terms.length === 0 || limit <= 0) {
    return []
  }

  const rankedResults = index.entries
    .map((entry) => {
      const fields =
        mode === 'body'
          ? [{ field: entry.body, weight: 7 }]
          : [
              { field: entry.title, weight: 7 },
              { field: entry.fileName, weight: 6 },
              { field: entry.aliases, weight: 5 },
              { field: entry.pathSegments, weight: 4 },
              { field: entry.relPath, weight: 3 }
            ]
      const score = scoreSearchDocument(terms, fields, 'document')

      return score > 0 ? { entry, score } : null
    })
    .filter((result): result is { entry: IndexedNote; score: number } => result !== null)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }

      return right.entry.note.updatedAt.localeCompare(left.entry.note.updatedAt)
    })
    .filter(({ entry }) => !excludedRelPaths?.has(entry.note.relPath))
    .slice(0, limit)

  return rankedResults.map(({ entry }) => {
    const snippet = mode === 'body' ? createCommandPaletteBodyExcerpt(entry.body.text, query) : null

    return {
      id: `note:${entry.note.relPath}`,
      kind: 'note',
      title: entry.title.text,
      subtitle: entry.note.relPath,
      value: `note:${entry.note.relPath}`,
      keywords: [
        entry.title.text,
        entry.fileName.text,
        entry.note.relPath,
        ...(entry.note.mentionTargets ?? []),
        ...entry.pathSegmentKeywords,
        ...(mode === 'body' && entry.body.text ? [entry.body.text] : [])
      ],
      tags: entry.note.tags,
      updatedAt: entry.note.updatedAt,
      searchMode: mode,
      snippet: snippet?.text,
      highlights: createHighlights({
        title: collectMatchRanges(entry.title, terms),
        folders: entry.folderFields.map((field) => collectMatchRanges(field, terms)),
        excerpt: snippet?.highlights
      })
    }
  })
}

export function createCommandPaletteProjectSearchIndex(
  projects: readonly Project[]
): CommandPaletteProjectSearchIndex {
  return {
    entries: projects.map((project) => {
      const folderPath = project.folderPath ?? ''
      const pathSegmentKeywords = getSearchPathSegments(folderPath)
      return {
        project,
        name: indexText(project.name),
        summary: indexText(project.summary),
        folderPath: indexText(folderPath),
        pathSegments: indexText(pathSegmentKeywords.join(' ')),
        pathSegmentKeywords
      }
    })
  }
}

export function searchCommandPaletteProjects(
  index: CommandPaletteProjectSearchIndex,
  query: string,
  limit = 10
): CommandPaletteSearchResult[] {
  const terms = tokenizeCommandPaletteQuery(query.trim())
  if (terms.length === 0 || limit <= 0) {
    return []
  }

  return index.entries
    .map((entry) => {
      const score = scoreSearchDocument(
        terms,
        [
          { field: entry.name, weight: 7 },
          { field: entry.folderPath, weight: 4 },
          { field: entry.pathSegments, weight: 4 },
          { field: entry.summary, weight: 3 }
        ].filter(({ field }) => field.searchable.length > 0),
        'document'
      )

      return score > 0 ? { entry, score } : null
    })
    .filter((result): result is { entry: IndexedProject; score: number } => result !== null)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }

      return right.entry.project.updatedAt.localeCompare(left.entry.project.updatedAt)
    })
    .slice(0, limit)
    .map(({ entry }) => ({
      id: `project:${entry.project.id}`,
      kind: 'project' as const,
      title: entry.name.text,
      subtitle: entry.project.summary || 'Project',
      value: `project:${entry.project.id}`,
      icon: entry.project.icon,
      keywords: [
        entry.name.text,
        entry.summary.text,
        entry.folderPath.text,
        ...entry.pathSegmentKeywords
      ],
      searchMode: 'name' as const,
      highlights: createHighlights({
        title: collectMatchRanges(entry.name, terms),
        subtitle: collectMatchRanges(entry.summary, terms)
      })
    }))
}

export function createCommandPaletteNoteHighlights(options: {
  title: string
  relPath: string
  query: string
  excerpt?: string
}): CommandPaletteSearchHighlights | undefined {
  const terms = tokenizeCommandPaletteQuery(options.query.trim())
  if (terms.length === 0) {
    return undefined
  }

  const breadcrumbs = getCommandPaletteFolderBreadcrumbs(options.relPath)
  const excerpt = options.excerpt
    ? createCommandPaletteBodyExcerpt(options.excerpt, options.query)
    : null

  return createHighlights({
    title: collectMatchRanges(indexText(options.title), terms),
    folders: breadcrumbs.map(({ label }) => collectMatchRanges(indexText(label), terms)),
    excerpt: excerpt?.highlights
  })
}

export function createCommandPaletteBodyExcerpt(
  text: string,
  query: string,
  maxLength = 160
): { text: string; highlights: readonly CommandPaletteMatchRange[] } | undefined {
  const normalizedText = text.replace(/\s+/g, ' ').trim()
  const terms = tokenizeCommandPaletteQuery(query.trim())
  if (!normalizedText || terms.length === 0) {
    return undefined
  }

  const indexedText = indexText(normalizedText)
  const firstNormalizedMatchIndex = terms
    .map((term) => indexedText.normalized.indexOf(term))
    .filter((index) => index >= 0)
    .sort((left, right) => left - right)[0]
  const firstMatchIndex =
    firstNormalizedMatchIndex === undefined
      ? -1
      : (indexedText.sourceRanges[firstNormalizedMatchIndex]?.start ?? -1)

  const boundedLength = Math.max(40, maxLength)
  const matchOffset = Math.floor(boundedLength / 3)
  const start =
    normalizedText.length <= boundedLength
      ? 0
      : Math.max(
          0,
          Math.min(
            firstMatchIndex >= 0 ? firstMatchIndex - matchOffset : 0,
            normalizedText.length - boundedLength
          )
        )
  const end = Math.min(normalizedText.length, start + boundedLength)
  const prefix = start > 0 ? '… ' : ''
  const suffix = end < normalizedText.length ? ' …' : ''
  const excerptText = `${prefix}${normalizedText.slice(start, end)}${suffix}`
  const excerptOffset = prefix.length
  const highlights = collectMatchRanges(indexText(normalizedText.slice(start, end)), terms).map(
    (range) => ({
      start: range.start + excerptOffset,
      end: range.end + excerptOffset
    })
  )

  return {
    text: excerptText,
    highlights
  }
}

export function mergeCommandPaletteMatchRanges(
  ranges: readonly CommandPaletteMatchRange[]
): CommandPaletteMatchRange[] {
  return mergeSearchMatchRanges(ranges)
}

function indexText(text: string): IndexedText {
  return createSearchTextIndex(text)
}

function scoreSearchDocument(
  terms: readonly string[],
  fields: readonly WeightedIndexedText[],
  profile: SearchFuzzyProfile
): number {
  if (terms.length === 0) {
    return 0
  }

  let totalScore = 0

  for (const term of terms) {
    let bestTermScore = 0

    for (const field of fields) {
      const fieldScore = scoreSearchField(term, field.field, profile) * field.weight
      if (fieldScore > bestTermScore) {
        bestTermScore = fieldScore
      }
    }

    if (bestTermScore === 0) {
      return 0
    }

    totalScore += bestTermScore
  }

  return totalScore
}

function scoreSearchField(term: string, field: IndexedText, profile: SearchFuzzyProfile): number {
  const fieldText = field.searchable
  if (!term || !fieldText) {
    return 0
  }

  if (fieldText === term) {
    return 140
  }

  if (fieldText.startsWith(term)) {
    return 110
  }

  if (field.words.some((word) => field.normalized.slice(word.start, word.end) === term)) {
    return 95
  }

  if (field.words.some((word) => field.normalized.slice(word.start, word.end).startsWith(term))) {
    return 78
  }

  const includesIndex = fieldText.indexOf(term)
  if (includesIndex >= 0) {
    return Math.max(52 - includesIndex, 28)
  }

  return scoreSubsequenceMatch(term, fieldText, profile)
}

function scoreSubsequenceMatch(
  term: string,
  fieldText: string,
  profile: SearchFuzzyProfile
): number {
  let searchIndex = 0
  let firstMatchIndex = -1
  let lastMatchIndex = -1

  for (const char of term) {
    const nextIndex = fieldText.indexOf(char, searchIndex)
    if (nextIndex === -1) {
      return 0
    }

    if (firstMatchIndex === -1) {
      firstMatchIndex = nextIndex
    }

    lastMatchIndex = nextIndex
    searchIndex = nextIndex + char.length
  }

  const span = lastMatchIndex - firstMatchIndex + 1
  const compactnessPenalty = Math.max(span - term.length, 0)
  if (profile === 'command') {
    return Math.max(36 - compactnessPenalty - firstMatchIndex, 12)
  }

  return Math.max(26 - compactnessPenalty - Math.floor(firstMatchIndex / 2), 8)
}

function collectMatchRanges(
  field: IndexedText,
  terms: readonly string[]
): CommandPaletteMatchRange[] {
  return findSearchMatchRanges(field, terms, { fuzzy: true })
}

function createHighlights(
  input: CommandPaletteSearchHighlights
): CommandPaletteSearchHighlights | undefined {
  const hasTitle = Boolean(input.title?.length)
  const hasSubtitle = Boolean(input.subtitle?.length)
  const hasFolders = input.folders?.some((ranges) => ranges.length) ?? false
  const hasExcerpt = Boolean(input.excerpt?.length)

  if (!hasTitle && !hasSubtitle && !hasFolders && !hasExcerpt) {
    return undefined
  }

  return input
}

function getSearchPathSegments(input: string): string[] {
  if (!input) {
    return []
  }

  return input
    .split('/')
    .flatMap((segment) => stripNoteExtension(segment).split(SEARCH_TOKEN_SEPARATOR))
    .map((segment) => segment.trim().toLowerCase())
    .filter(Boolean)
}
