import type { SearchResult as LegacySearchResult } from '../shared/types'
import {
  createSearchDocumentFromEntity,
  DEFAULT_RECENT_SEARCH_LIMIT,
  normalizeRecentSearches,
  normalizeSearchDocument,
  normalizeSearchFilters,
  normalizeSearchQuery,
  rememberRecentSearch,
  removeRecentSearch,
  searchDocumentKey,
  type NormalizedSearchFilters,
  type RecentSearchEntry,
  type SearchDocument,
  type SearchDocumentInput,
  type SearchEntityType,
  type SearchEntityOptions,
  type SearchFilters,
  type SearchRequest,
  type SearchTarget
} from '../shared/searchDomain'

export type SearchMatchField = 'title' | 'tags' | 'summary' | 'body' | 'status' | 'metadata'

export interface UnifiedSearchResult extends SearchDocument {
  score: number
  snippet: string
  matchedFields: SearchMatchField[]
}

export type WorkspaceSearchResult = UnifiedSearchResult
export type SearchDocumentRecord = SearchDocument

export interface SearchRankingOptions {
  now?: Date | string | number
  limit?: number
}

export interface UnifiedSearchIndexOptions extends SearchRankingOptions {
  documents?: Iterable<unknown>
  recentSearches?: unknown
  recentSearchLimit?: number
}

export interface ReplaceDocumentsResult {
  accepted: number
  rejected: number
}

export interface SearchResultTarget extends SearchTarget {}

const DEFAULT_RESULT_LIMIT = 50

function asTimestamp(value: string | undefined): number | undefined {
  if (!value) {
    return undefined
  }
  const parsed = new Date(value).getTime()
  return Number.isNaN(parsed) ? undefined : parsed
}

function normalizeLimit(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback
  }
  return Math.max(0, Math.min(200, Math.floor(value)))
}

function normalizeNow(value: Date | string | number | undefined): number {
  if (value instanceof Date) {
    return value.getTime()
  }
  if (typeof value === 'number') {
    return value
  }
  if (typeof value === 'string') {
    return new Date(value).getTime()
  }
  return Date.now()
}

function tokenize(value: string): string[] {
  return value
    .toLocaleLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
}

function containsToken(text: string, token: string): boolean {
  return text.includes(token)
}

function countTokenMatches(text: string, token: string): number {
  if (!token) {
    return 0
  }

  let count = 0
  let offset = 0
  while (offset < text.length) {
    const index = text.indexOf(token, offset)
    if (index < 0) {
      break
    }
    count += 1
    offset = index + token.length
  }
  return count
}

function getSearchDate(document: SearchDocument): string | undefined {
  return document.date ?? document.updatedAt ?? document.createdAt
}

function isDateInRange(value: string | undefined, filters: NormalizedSearchFilters): boolean {
  if (!filters.dateFrom && !filters.dateTo) {
    return true
  }

  const timestamp = asTimestamp(value)
  if (timestamp === undefined) {
    return false
  }

  const from = asTimestamp(filters.dateFrom)
  if (from !== undefined && timestamp < from) {
    return false
  }

  const to = asTimestamp(filters.dateTo)
  if (to !== undefined) {
    const isDateOnly = Boolean(filters.dateTo && /^\d{4}-\d{2}-\d{2}$/.test(filters.dateTo))
    const endOfDay = isDateOnly ? to + 24 * 60 * 60 * 1000 - 1 : to
    if (timestamp > endOfDay) {
      return false
    }
  }

  return true
}

function matchesFilters(document: SearchDocument, filters: NormalizedSearchFilters): boolean {
  if (filters.entityTypes && !filters.entityTypes.includes(document.entityType)) {
    return false
  }

  if (filters.sources && !filters.sources.includes(document.source.toLocaleLowerCase())) {
    return false
  }

  if (
    filters.statuses &&
    (!document.status || !filters.statuses.includes(document.status.toLocaleLowerCase()))
  ) {
    return false
  }

  if (
    filters.projectIds &&
    (!document.projectId || !filters.projectIds.includes(document.projectId))
  ) {
    return false
  }

  if (filters.projectId === null && document.projectId) {
    return false
  }

  if (
    filters.providers &&
    (!document.provider || !filters.providers.includes(document.provider.toLocaleLowerCase()))
  ) {
    return false
  }

  if (
    filters.resourceKinds &&
    (!document.metadata.kind ||
      !filters.resourceKinds.includes(String(document.metadata.kind).toLocaleLowerCase()))
  ) {
    return false
  }

  if (
    filters.resourceStates &&
    (!document.state || !filters.resourceStates.includes(document.state.toLocaleLowerCase()))
  ) {
    return false
  }

  if (
    filters.tags &&
    !filters.tags.some((tag) =>
      document.tags.some((candidate) => candidate.toLocaleLowerCase() === tag)
    )
  ) {
    return false
  }

  return isDateInRange(getSearchDate(document), filters)
}

function recencyScore(document: SearchDocument, now: number): number {
  const timestamp = asTimestamp(document.updatedAt ?? document.date ?? document.createdAt)
  if (timestamp === undefined || !Number.isFinite(now)) {
    return 0
  }

  const ageInDays = Math.max(0, (now - timestamp) / (24 * 60 * 60 * 1000))
  return Math.max(0, 10 - Math.min(10, ageInDays / 30))
}

function scoreText(
  text: string,
  phrase: string,
  tokens: readonly string[],
  weights: { phrase: number; token: number; prefix: number }
): number {
  const normalized = text.toLocaleLowerCase()
  let score = 0
  if (phrase && normalized.includes(phrase)) {
    score += weights.phrase
  }
  for (const token of tokens) {
    if (containsToken(normalized, token)) {
      score += weights.token * Math.min(3, countTokenMatches(normalized, token))
    }
  }
  if (tokens.length > 0 && normalized.startsWith(tokens[0])) {
    score += weights.prefix
  }
  return score
}

function documentSearchText(document: SearchDocument): Record<SearchMatchField, string> {
  const metadata = Object.values(document.metadata)
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
  return {
    title: document.title,
    tags: document.tags.join(' '),
    summary: document.summary ?? '',
    body: document.body,
    status: document.status ?? '',
    metadata
  }
}

function buildSnippet(document: SearchDocument, phrase: string, tokens: readonly string[]): string {
  const source = (document.body || document.summary || document.title).replace(/\s+/g, ' ').trim()
  if (!source) {
    return ''
  }

  const normalized = source.toLocaleLowerCase()
  const searchTerm = phrase || tokens[0] || ''
  const matchIndex = searchTerm ? normalized.indexOf(searchTerm) : -1
  if (matchIndex < 0) {
    return source.slice(0, 180)
  }

  const start = Math.max(0, matchIndex - 60)
  const end = Math.min(source.length, start + 180)
  return `${start > 0 ? '…' : ''}${source.slice(start, end)}${end < source.length ? '…' : ''}`
}

function rankDocument(
  document: SearchDocument,
  phrase: string,
  tokens: readonly string[],
  now: number
): UnifiedSearchResult | null {
  const fields = documentSearchText(document)
  const combinedText = Object.values(fields).join(' ').toLocaleLowerCase()
  if (tokens.some((token) => !combinedText.includes(token))) {
    return null
  }
  const matchedFields: SearchMatchField[] = []
  let score = 0

  const fieldWeights: Record<SearchMatchField, { phrase: number; token: number; prefix: number }> =
    {
      title: { phrase: 120, token: 32, prefix: 52 },
      tags: { phrase: 58, token: 18, prefix: 12 },
      summary: { phrase: 34, token: 12, prefix: 6 },
      body: { phrase: 24, token: 8, prefix: 3 },
      status: { phrase: 18, token: 8, prefix: 2 },
      metadata: { phrase: 12, token: 5, prefix: 1 }
    }

  for (const field of Object.keys(fields) as SearchMatchField[]) {
    const fieldScore = scoreText(fields[field], phrase, tokens, fieldWeights[field])
    if (fieldScore > 0) {
      matchedFields.push(field)
      score += fieldScore
    }
  }

  if (score <= 0) {
    return null
  }

  return {
    ...document,
    score: Number((score + recencyScore(document, now)).toFixed(4)),
    snippet: buildSnippet(document, phrase, tokens),
    matchedFields
  }
}

export function rankSearchDocuments(
  documents: Iterable<SearchDocument>,
  query: string,
  filters?: SearchFilters,
  options: SearchRankingOptions = {}
): UnifiedSearchResult[] {
  const normalizedQuery = normalizeSearchQuery(query)
  if (!normalizedQuery) {
    return []
  }

  const phrase = normalizedQuery.toLocaleLowerCase()
  const tokens = tokenize(normalizedQuery)
  const normalizedFilters = normalizeSearchFilters(filters)
  const now = normalizeNow(options.now)
  const results: UnifiedSearchResult[] = []

  for (const document of documents) {
    if (!matchesFilters(document, normalizedFilters)) {
      continue
    }
    const result = rankDocument(document, phrase, tokens, now)
    if (result) {
      results.push(result)
    }
  }

  results.sort(
    (left, right) =>
      right.score - left.score ||
      (right.updatedAt ?? right.date ?? right.createdAt ?? '').localeCompare(
        left.updatedAt ?? left.date ?? left.createdAt ?? ''
      ) ||
      left.title.localeCompare(right.title) ||
      left.entityType.localeCompare(right.entityType) ||
      left.id.localeCompare(right.id)
  )

  return results.slice(0, normalizeLimit(options.limit, DEFAULT_RESULT_LIMIT))
}

export function searchDocuments(
  documents: Iterable<SearchDocument>,
  request: SearchRequest | string,
  options: SearchRankingOptions = {}
): UnifiedSearchResult[] {
  if (typeof request === 'string') {
    return rankSearchDocuments(documents, request, undefined, options)
  }

  return rankSearchDocuments(documents, request.query, request.filters, {
    ...options,
    limit: request.limit ?? options.limit
  })
}

export class RecentSearchStore {
  private entries: RecentSearchEntry[]
  private readonly limit: number
  private readonly now: () => string

  constructor(initial: unknown = [], options: { limit?: number; now?: () => string } = {}) {
    this.limit = normalizeLimit(options.limit, DEFAULT_RECENT_SEARCH_LIMIT)
    this.now = options.now ?? (() => new Date().toISOString())
    this.entries = normalizeRecentSearches(initial, this.limit)
  }

  list(limit = this.limit): RecentSearchEntry[] {
    return this.entries.slice(0, normalizeLimit(limit, this.limit)).map((entry) => ({
      ...entry,
      ...(entry.filters ? { filters: { ...entry.filters } } : {})
    }))
  }

  add(query: string, filters?: SearchFilters, usedAt = this.now()): RecentSearchEntry[] {
    this.entries = rememberRecentSearch(this.entries, query, filters, usedAt, this.limit)
    return this.list()
  }

  remove(query: string, filters?: SearchFilters): RecentSearchEntry[] {
    this.entries = removeRecentSearch(this.entries, query, filters)
    return this.list()
  }

  clear(): void {
    this.entries = []
  }

  replace(input: unknown): void {
    this.entries = normalizeRecentSearches(input, this.limit)
  }

  serialize(): RecentSearchEntry[] {
    return this.list()
  }
}

export class UnifiedSearchIndex {
  private readonly documents = new Map<string, SearchDocument>()
  readonly recentSearches: RecentSearchStore
  private readonly now: () => Date
  private readonly defaultLimit: number

  constructor(options: UnifiedSearchIndexOptions = {}) {
    this.now = () => new Date(normalizeNow(options.now))
    this.defaultLimit = normalizeLimit(options.limit, DEFAULT_RESULT_LIMIT)
    this.recentSearches = new RecentSearchStore(options.recentSearches, {
      limit: options.recentSearchLimit
    })
    if (options.documents) {
      this.replaceAll(options.documents)
    }
  }

  get size(): number {
    return this.documents.size
  }

  get all(): SearchDocument[] {
    return Array.from(this.documents.values())
  }

  upsert(input: SearchDocument | SearchDocumentInput): SearchDocument | null {
    const document = normalizeSearchDocument(input)
    if (!document) {
      return null
    }
    this.documents.set(searchDocumentKey(document), document)
    return document
  }

  add(input: SearchDocument | SearchDocumentInput): SearchDocument | null {
    return this.upsert(input)
  }

  upsertEntity(
    entityType: SearchEntityType,
    record: unknown,
    options: SearchEntityOptions = {}
  ): SearchDocument | null {
    const document = createSearchDocumentFromEntity(entityType, record, options)
    return document ? this.upsert(document) : null
  }

  addEntity(
    entityType: SearchEntityType,
    record: unknown,
    options: SearchEntityOptions = {}
  ): SearchDocument | null {
    return this.upsertEntity(entityType, record, options)
  }

  remove(entityType: SearchEntityType, id: string): boolean
  remove(key: string): boolean
  remove(entityTypeOrKey: SearchEntityType | string, id?: string): boolean {
    if (id === undefined) {
      return this.documents.delete(entityTypeOrKey)
    }
    return (
      this.documents.delete(`${entityTypeOrKey}:${id}`) ||
      this.documents.delete(`${entityTypeOrKey}:${entityTypeOrKey}:${id}`)
    )
  }

  delete(entityType: SearchEntityType, id: string): boolean
  delete(key: string): boolean
  delete(entityTypeOrKey: SearchEntityType | string, id?: string): boolean {
    return id === undefined
      ? this.remove(entityTypeOrKey)
      : this.remove(entityTypeOrKey as SearchEntityType, id)
  }

  get(entityType: SearchEntityType, id: string): SearchDocument | undefined
  get(key: string): SearchDocument | undefined
  get(entityTypeOrKey: SearchEntityType | string, id?: string): SearchDocument | undefined {
    if (id === undefined) {
      return this.documents.get(entityTypeOrKey)
    }
    return (
      this.documents.get(`${entityTypeOrKey}:${id}`) ??
      this.documents.get(`${entityTypeOrKey}:${entityTypeOrKey}:${id}`)
    )
  }

  replaceAll(inputs: Iterable<unknown>): ReplaceDocumentsResult {
    this.documents.clear()
    let accepted = 0
    let rejected = 0
    for (const input of inputs) {
      const document = this.upsert(input as SearchDocumentInput)
      if (document) {
        accepted += 1
      } else {
        rejected += 1
      }
    }
    return { accepted, rejected }
  }

  search(
    request: SearchRequest | string,
    filters?: SearchFilters,
    limit?: number
  ): UnifiedSearchResult[] {
    const resolvedRequest =
      typeof request === 'string' ? { query: request, filters, limit } : request
    return searchDocuments(this.documents.values(), resolvedRequest, {
      now: this.now(),
      limit: resolvedRequest.limit ?? this.defaultLimit
    })
  }

  query(
    request: SearchRequest | string,
    filters?: SearchFilters,
    limit?: number
  ): UnifiedSearchResult[] {
    return this.search(request, filters, limit)
  }

  rememberSearch(query: string, filters?: SearchFilters, usedAt?: string): RecentSearchEntry[] {
    return this.recentSearches.add(query, filters, usedAt)
  }

  toLegacyResult(result: UnifiedSearchResult): LegacySearchResult {
    return {
      id: result.id,
      relPath: result.relPath ?? '',
      title: result.title,
      tags: result.tags,
      updated: result.updatedAt ?? result.date ?? result.createdAt ?? '',
      snippet: result.snippet,
      entityType: result.entityType,
      target: result.target,
      ...(result.status ? { status: result.status } : {}),
      ...(result.date ? { date: result.date } : {}),
      ...(result.projectId ? { projectId: result.projectId } : {})
    }
  }
}

export const WorkspaceSearchIndex = UnifiedSearchIndex
