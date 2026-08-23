import type { SearchEntityType as AppSearchEntityType } from './types'

export type SearchEntityType = AppSearchEntityType

export const SEARCH_ENTITY_TYPES: readonly SearchEntityType[] = [
  'note',
  'task',
  'project',
  'resource',
  'calendar-event',
  'subscription',
  'schedule',
  'agent-run',
  'drawing',
  'capture'
]

export type SearchSource = string

export type SearchMetadataValue = string | number | boolean | null

export type SearchDisplayMetadata = Readonly<Record<string, SearchMetadataValue>>

export interface SearchTarget {
  kind: SearchEntityType
  id: string
  relPath?: string
  page?: string
  anchor?: string
  resourceId?: string
  provider?: string
}

export interface SearchDocument {
  id: string
  entityType: SearchEntityType
  source: SearchSource
  title: string
  body: string
  summary?: string
  tags: string[]
  createdAt?: string
  updatedAt?: string
  date?: string
  status?: string
  projectId?: string
  relPath?: string
  target: SearchTarget
  metadata: SearchDisplayMetadata
  resourceId?: string
  provider?: string
  freshness?: string
  access?: string
  state?: string
}

export interface SearchDocumentInput {
  id: string
  entityType: SearchEntityType
  source?: SearchSource
  title: string
  body?: string
  summary?: string
  tags?: readonly string[]
  createdAt?: string
  updatedAt?: string
  date?: string
  status?: string
  projectId?: string
  relPath?: string
  target?: Partial<SearchTarget>
  metadata?: Readonly<Record<string, unknown>>
  resourceId?: string
  provider?: string
  freshness?: string
  access?: string
  state?: string
}

export interface SearchEntityOptions {
  id?: string
  source?: SearchSource
  relPath?: string
  target?: Partial<SearchTarget>
  metadata?: Readonly<Record<string, unknown>>
}

export interface SearchFilters {
  entityTypes?: readonly SearchEntityType[]
  entityType?: SearchEntityType
  sources?: readonly SearchSource[]
  source?: SearchSource
  statuses?: readonly string[]
  status?: string
  projectIds?: readonly string[]
  projectId?: string | null
  tags?: readonly string[]
  tag?: string
  dateFrom?: string
  dateTo?: string
  from?: string
  to?: string
  providers?: readonly string[]
  provider?: string
  resourceKinds?: readonly string[]
  resourceKind?: string
  resourceStates?: readonly string[]
  resourceState?: string
}

export interface NormalizedSearchFilters {
  entityTypes?: SearchEntityType[]
  sources?: string[]
  statuses?: string[]
  projectIds?: string[]
  projectId?: string | null
  tags?: string[]
  dateFrom?: string
  dateTo?: string
  providers?: string[]
  resourceKinds?: string[]
  resourceStates?: string[]
}

export interface SearchRequest {
  query: string
  filters?: SearchFilters
  limit?: number
}

export interface RecentSearchEntry {
  query: string
  filters?: NormalizedSearchFilters
  usedAt: string
}

export const DEFAULT_RECENT_SEARCH_LIMIT = 10
export const MAX_SEARCH_QUERY_LENGTH = 200

const SENSITIVE_KEY_PATTERN =
  /pass(word)?|secret|token|api[-_ ]?key|access[-_ ]?key|refresh|credential|authorization|bearer|private[-_ ]?key|client[-_ ]?secret|cookie|session/i

const SENSITIVE_TEXT_PATTERNS: readonly RegExp[] = [
  /-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/gi,
  /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi,
  /\b(?:api[-_ ]?key|access[-_ ]?token|refresh[-_ ]?token|client[-_ ]?secret|password|secret)\s*[:=]\s*["']?[^\s,;"']+/gi,
  /\b(?:sk|rk)[-_][A-Za-z0-9_-]{8,}\b/g,
  /\b(?:ghp|github_pat|xox[baprs])[-_][A-Za-z0-9_-]{8,}\b/g,
  /\bAIza[A-Za-z0-9_-]{20,}\b/g,
  /\bAKIA[0-9A-Z]{16}\b/g
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeText(value: unknown, maxLength = 20_000): string {
  if (typeof value !== 'string') {
    return ''
  }

  return redactSensitiveText(value).replaceAll(String.fromCharCode(0), '').slice(0, maxLength)
}

export function redactSensitiveText(value: string): string {
  return SENSITIVE_TEXT_PATTERNS.reduce(
    (current, pattern) => current.replace(pattern, '[redacted]'),
    value
  )
}

export function normalizeSearchQuery(value: unknown): string {
  return normalizeText(value, MAX_SEARCH_QUERY_LENGTH).trim()
}

export function normalizeSearchTags(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return Array.from(
    new Set(
      value
        .filter((tag): tag is string => typeof tag === 'string')
        .map((tag) => normalizeText(tag, 80).trim())
        .filter(Boolean)
    )
  ).slice(0, 50)
}

export function normalizeSearchDate(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return undefined
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed
  }

  const parsed = new Date(trimmed)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString()
}

function normalizeOptionalText(value: unknown, maxLength = 500): string | undefined {
  const normalized = normalizeText(value, maxLength).trim()
  return normalized || undefined
}

function normalizeEntityType(value: unknown): SearchEntityType | undefined {
  return typeof value === 'string' && SEARCH_ENTITY_TYPES.includes(value as SearchEntityType)
    ? (value as SearchEntityType)
    : undefined
}

function normalizeStringList(value: unknown, maxLength = 80, lowerCase = true): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => {
          const normalized = normalizeText(item, maxLength).trim()
          return lowerCase ? normalized.toLocaleLowerCase() : normalized
        })
        .filter(Boolean)
    )
  )
}

export function isSensitiveMetadataKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERN.test(key)
}

export function toSafeSearchMetadata(
  input: Readonly<Record<string, unknown>> | undefined
): SearchDisplayMetadata {
  if (!input) {
    return {}
  }

  const safe: Record<string, SearchMetadataValue> = {}
  for (const [rawKey, rawValue] of Object.entries(input).slice(0, 50)) {
    const key = rawKey.trim()
    if (!key || isSensitiveMetadataKey(key)) {
      continue
    }

    if (typeof rawValue === 'string') {
      safe[key] = normalizeText(rawValue, 240)
    } else if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
      safe[key] = rawValue
    } else if (typeof rawValue === 'boolean' || rawValue === null) {
      safe[key] = rawValue
    }
  }

  return safe
}

function inferSource(entityType: SearchEntityType): SearchSource {
  if (entityType === 'note' || entityType === 'drawing') {
    return 'notes'
  }
  if (entityType === 'agent-run') {
    return 'agent'
  }
  if (entityType === 'capture') {
    return 'capture'
  }
  if (entityType === 'resource') {
    return 'resources'
  }
  if (entityType === 'calendar-event') {
    return 'calendar'
  }
  return 'structured'
}

export function normalizeSearchDocument(input: unknown): SearchDocument | null {
  if (!isRecord(input)) {
    return null
  }

  const entityType = normalizeEntityType(input.entityType)
  const id = normalizeOptionalText(input.id, 500)
  const title = normalizeText(input.title, 500).trim()
  if (!entityType || !id || !title) {
    return null
  }

  const targetInput = isRecord(input.target) ? input.target : {}
  const target: SearchTarget = {
    kind: entityType,
    id,
    ...(normalizeOptionalText(input.relPath, 2_000)
      ? { relPath: normalizeOptionalText(input.relPath, 2_000) }
      : {}),
    ...(normalizeOptionalText(targetInput.page, 120)
      ? { page: normalizeOptionalText(targetInput.page, 120) }
      : {}),
    ...(normalizeOptionalText(targetInput.anchor, 240)
      ? { anchor: normalizeOptionalText(targetInput.anchor, 240) }
      : {}),
    ...(normalizeOptionalText(input.resourceId, 500)
      ? { resourceId: normalizeOptionalText(input.resourceId, 500) }
      : {}),
    ...(normalizeOptionalText(input.provider, 120)
      ? { provider: normalizeOptionalText(input.provider, 120) }
      : {})
  }

  if (typeof targetInput.kind === 'string' && normalizeEntityType(targetInput.kind)) {
    target.kind = normalizeEntityType(targetInput.kind) as SearchEntityType
  }
  if (typeof targetInput.id === 'string' && targetInput.id.trim()) {
    target.id = targetInput.id.trim().slice(0, 500)
  }

  const tags = normalizeSearchTags(input.tags)
  const summary = normalizeOptionalText(input.summary)
  const body = normalizeText(input.body, 30_000)
  const source = normalizeOptionalText(input.source, 120) ?? inferSource(entityType)
  const status = normalizeOptionalText(input.status, 120)
  const projectId = normalizeOptionalText(input.projectId, 500)

  return {
    id,
    entityType,
    source,
    title,
    body,
    ...(summary ? { summary } : {}),
    tags,
    ...(normalizeSearchDate(input.createdAt)
      ? { createdAt: normalizeSearchDate(input.createdAt) }
      : {}),
    ...(normalizeSearchDate(input.updatedAt)
      ? { updatedAt: normalizeSearchDate(input.updatedAt) }
      : {}),
    ...(normalizeSearchDate(input.date) ? { date: normalizeSearchDate(input.date) } : {}),
    ...(status ? { status } : {}),
    ...(projectId ? { projectId } : {}),
    ...(target.relPath ? { relPath: target.relPath } : {}),
    target,
    metadata: toSafeSearchMetadata(isRecord(input.metadata) ? input.metadata : undefined),
    ...(normalizeOptionalText(input.resourceId, 500)
      ? { resourceId: normalizeOptionalText(input.resourceId, 500) }
      : {}),
    ...(normalizeOptionalText(input.provider, 120)
      ? { provider: normalizeOptionalText(input.provider, 120) }
      : {}),
    ...(normalizeOptionalText(input.freshness, 40)
      ? { freshness: normalizeOptionalText(input.freshness, 40) }
      : {}),
    ...(normalizeOptionalText(input.access, 40)
      ? { access: normalizeOptionalText(input.access, 40) }
      : {}),
    ...(normalizeOptionalText(input.state, 60)
      ? { state: normalizeOptionalText(input.state, 60) }
      : {})
  }
}

export function createSearchDocument(input: SearchDocumentInput): SearchDocument {
  const normalized = normalizeSearchDocument(input)
  if (!normalized) {
    throw new Error('Cannot create a search document without an entity type, id, and title')
  }
  return normalized
}

function readFirstText(record: Record<string, unknown>, keys: readonly string[]): string {
  for (const key of keys) {
    if (typeof record[key] === 'string' && record[key].trim()) {
      return record[key] as string
    }
  }
  return ''
}

function readRecordDate(
  record: Record<string, unknown>,
  keys: readonly string[]
): string | undefined {
  for (const key of keys) {
    const date = normalizeSearchDate(record[key])
    if (date) {
      return date
    }
  }
  return undefined
}

function entityMetadata(
  entityType: SearchEntityType,
  record: Record<string, unknown>
): Record<string, unknown> {
  switch (entityType) {
    case 'task':
      return {
        priority: record.priority,
        taskType: record.taskType,
        endDate: record.endDate,
        time: record.time
      }
    case 'project':
      return {
        state: record.state,
        startDate: record.startDate,
        endDate: record.endDate
      }
    case 'calendar-event':
      return {
        allDay: record.allDay,
        start: record.start,
        end: record.end,
        timezone: record.timezone,
        location: record.location,
        source: record.source
      }
    case 'subscription':
      return {
        provider: record.provider,
        category: record.category,
        billingCycle: record.billingCycle,
        currency: record.currency
      }
    case 'schedule':
      return {
        enabled: record.enabled,
        runtime: record.runtime,
        outputMode: record.outputMode,
        triggerType: isRecord(record.trigger) ? record.trigger.type : undefined
      }
    case 'agent-run':
      return {
        agentName: record.agentName,
        source: record.source,
        model: record.model
      }
    case 'resource':
      return {
        provider: record.provider,
        kind: record.kind,
        state: record.state,
        access: record.access,
        freshness: record.freshness,
        canonicalUri: record.canonicalUri
      }
    default:
      return {}
  }
}

export function createSearchDocumentFromEntity(
  entityType: SearchEntityType,
  record: unknown,
  options: SearchEntityOptions = {}
): SearchDocument | null {
  if (!isRecord(record)) {
    return null
  }

  const id = options.id ?? readFirstText(record, ['id', 'path', 'relPath'])
  const title = readFirstText(record, ['title', 'name', 'agentName', 'displayName'])
  if (!id || !title) {
    return null
  }

  const body = readFirstText(record, [
    'body',
    'description',
    'summary',
    'notes',
    'markdown',
    'input',
    'output'
  ])
  const summary = readFirstText(record, ['summary', 'description', 'notes'])
  const date = readRecordDate(record, ['date', 'start', 'nextRenewalAt', 'startedAt'])
  const metadata = {
    ...entityMetadata(entityType, record),
    ...options.metadata
  }

  return createSearchDocument({
    id,
    entityType,
    source: options.source ?? (typeof record.source === 'string' ? record.source : undefined),
    title,
    body,
    summary,
    tags: normalizeSearchTags(record.tags),
    createdAt: readRecordDate(record, ['createdAt']),
    updatedAt: readRecordDate(record, ['updatedAt', 'endedAt', 'lastRunAt']),
    date,
    status: readFirstText(record, ['status', 'state', 'lastStatus']),
    projectId: readFirstText(record, ['projectId', 'linkedProjectId']),
    relPath: options.relPath ?? readFirstText(record, ['relPath', 'path']),
    target: options.target,
    metadata,
    resourceId: typeof record.resourceId === 'string' ? record.resourceId : undefined,
    provider: typeof record.provider === 'string' ? record.provider : undefined,
    freshness: typeof record.freshness === 'string' ? record.freshness : undefined,
    access: typeof record.access === 'string' ? record.access : undefined,
    state: typeof record.state === 'string' ? record.state : undefined
  })
}

function normalizedFilterList(value: unknown, lowerCase: boolean): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined
  }

  const values = normalizeStringList(value, 80, lowerCase)
  return values.length > 0 ? values : undefined
}

export function normalizeSearchFilters(input: SearchFilters | undefined): NormalizedSearchFilters {
  if (!input) {
    return {}
  }

  const entityTypes = Array.from(
    new Set(
      [...(input.entityTypes ?? []), ...(input.entityType ? [input.entityType] : [])].filter(
        (value): value is SearchEntityType => SEARCH_ENTITY_TYPES.includes(value)
      )
    )
  )
  const sources = normalizedFilterList(
    [...(input.sources ?? []), ...(input.source ? [input.source] : [])],
    true
  )
  const statuses = normalizedFilterList(
    [...(input.statuses ?? []), ...(input.status ? [input.status] : [])],
    true
  )
  const projectIds = normalizedFilterList(
    [
      ...(input.projectIds ?? []),
      ...(input.projectId && input.projectId !== null ? [input.projectId] : [])
    ],
    false
  )
  const tags = normalizedFilterList(
    [...(input.tags ?? []), ...(input.tag ? [input.tag] : [])],
    true
  )
  const dateFrom = normalizeSearchDate(input.dateFrom ?? input.from)
  const dateTo = normalizeSearchDate(input.dateTo ?? input.to)
  const providers = normalizedFilterList(
    [...(input.providers ?? []), ...(input.provider ? [input.provider] : [])],
    true
  )
  const resourceKinds = normalizedFilterList(
    [...(input.resourceKinds ?? []), ...(input.resourceKind ? [input.resourceKind] : [])],
    true
  )
  const resourceStates = normalizedFilterList(
    [...(input.resourceStates ?? []), ...(input.resourceState ? [input.resourceState] : [])],
    true
  )

  return {
    ...(entityTypes.length > 0 ? { entityTypes } : {}),
    ...(sources ? { sources } : {}),
    ...(statuses ? { statuses } : {}),
    ...(projectIds ? { projectIds } : {}),
    ...(input.projectId === null ? { projectId: null } : {}),
    ...(tags ? { tags } : {}),
    ...(dateFrom ? { dateFrom } : {}),
    ...(dateTo ? { dateTo } : {}),
    ...(providers ? { providers } : {}),
    ...(resourceKinds ? { resourceKinds } : {}),
    ...(resourceStates ? { resourceStates } : {})
  }
}

export function searchDocumentKey(document: Pick<SearchDocument, 'entityType' | 'id'>): string {
  return `${document.entityType}:${document.id}`
}

export function normalizeSearchDocuments(input: Iterable<unknown>): SearchDocument[] {
  const documents: SearchDocument[] = []
  for (const candidate of input) {
    const normalized = normalizeSearchDocument(candidate)
    if (normalized) {
      documents.push(normalized)
    }
  }
  return documents
}

export function normalizeRecentSearches(
  input: unknown,
  limit = DEFAULT_RECENT_SEARCH_LIMIT
): RecentSearchEntry[] {
  if (!Array.isArray(input)) {
    return []
  }

  const entries: RecentSearchEntry[] = []
  for (const candidate of input) {
    if (!isRecord(candidate)) {
      continue
    }
    const query = normalizeSearchQuery(candidate.query)
    const usedAt = normalizeSearchDate(candidate.usedAt)
    if (!query || !usedAt) {
      continue
    }
    entries.push({
      query,
      ...(isRecord(candidate.filters)
        ? { filters: normalizeSearchFilters(candidate.filters as SearchFilters) }
        : {}),
      usedAt
    })
  }

  return entries
    .sort((left, right) => right.usedAt.localeCompare(left.usedAt))
    .slice(0, Math.max(0, Math.min(100, Math.floor(limit))))
}

export function rememberRecentSearch(
  entries: readonly RecentSearchEntry[],
  query: string,
  filters?: SearchFilters,
  usedAt = new Date().toISOString(),
  limit = DEFAULT_RECENT_SEARCH_LIMIT
): RecentSearchEntry[] {
  const normalizedQuery = normalizeSearchQuery(query)
  const normalizedUsedAt = normalizeSearchDate(usedAt) ?? new Date().toISOString()
  if (!normalizedQuery) {
    return normalizeRecentSearches(entries, limit)
  }

  const normalizedFilters = normalizeSearchFilters(filters)
  const fingerprint = JSON.stringify([normalizedQuery.toLocaleLowerCase(), normalizedFilters])
  const next = normalizeRecentSearches(entries, 100).filter(
    (entry) =>
      JSON.stringify([entry.query.toLocaleLowerCase(), entry.filters ?? {}]) !== fingerprint
  )
  next.unshift({
    query: normalizedQuery,
    ...(Object.keys(normalizedFilters).length > 0 ? { filters: normalizedFilters } : {}),
    usedAt: normalizedUsedAt
  })
  return next.slice(0, Math.max(0, Math.min(100, Math.floor(limit))))
}

export function removeRecentSearch(
  entries: readonly RecentSearchEntry[],
  query: string,
  filters?: SearchFilters
): RecentSearchEntry[] {
  const normalizedQuery = normalizeSearchQuery(query).toLocaleLowerCase()
  const normalizedFilters = normalizeSearchFilters(filters)
  const fingerprint = JSON.stringify([normalizedQuery, normalizedFilters])
  return normalizeRecentSearches(entries, 100).filter(
    (entry) =>
      JSON.stringify([entry.query.toLocaleLowerCase(), entry.filters ?? {}]) !== fingerprint
  )
}
