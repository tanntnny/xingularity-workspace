import type {
  ExternalProduct,
  Project,
  ResourceAccess,
  ResourceFreshness,
  ResourceInput,
  ResourceKind,
  ResourceProvider,
  ResourceRef,
  ResourceRelation,
  ResourceRelationType,
  ResourceSourceOfTruth,
  ResourceState
} from './types'

export const RESOURCE_SCHEMA_VERSION = 1
export const NOTEBOOK_RESOURCE_URI_PREFIX = 'xingularity://notebook/'

export const RESOURCE_TYPES = ['notebook', 'external'] as const

export const EXTERNAL_PRODUCTS: readonly ExternalProduct[] = [
  'google-docs',
  'google-sheets',
  'google-slides',
  'google-drive',
  'canva',
  'generic'
]

export const RESOURCE_PROVIDERS: readonly ResourceProvider[] = [
  'xingularity',
  'google-drive',
  'filesystem',
  'web'
]

export const RESOURCE_KINDS: readonly ResourceKind[] = [
  'note',
  'notebook',
  'project',
  'task',
  'local-file',
  'local-folder',
  'google-doc',
  'google-sheet',
  'google-slide',
  'drive-file',
  'url'
]

export const RESOURCE_STATES: readonly ResourceState[] = [
  'available',
  'stale',
  'moved',
  'offline',
  'permission-denied',
  'reauthorization-required',
  'missing',
  'conflict',
  'unindexed'
]

export const RESOURCE_RELATION_TYPES: readonly ResourceRelationType[] = [
  'project_contains_resource',
  'task_derived_from_resource',
  'note_references_resource',
  'decision_supported_by_resource',
  'milestone_delivered_by_resource',
  'resource_related_to_resource',
  'resource_snapshot_of_external',
  'resource_supersedes_resource',
  'capture_came_from_resource'
]

export interface ResourceStoreSnapshot {
  version: typeof RESOURCE_SCHEMA_VERSION
  resources: ResourceRef[]
  relations: ResourceRelation[]
}

export interface ResourceMigrationResult {
  projects: Project[]
  resources: ResourceRef[]
  relations: ResourceRelation[]
  migrated: number
  preserved: number
}

const LOCAL_FILE_EXTENSIONS: Record<string, string> = {
  '.md': 'text/markdown',
  '.markdown': 'text/markdown',
  '.txt': 'text/plain',
  '.json': 'application/json',
  '.csv': 'text/csv',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp'
}

export function resourceIdForCanonicalUri(
  provider: ResourceProvider,
  canonicalUri: string
): string {
  return `resource-${stableDigest(`${provider}:${canonicalUri}`)}`
}

export function resourceCanonicalKey(
  resource: Pick<ResourceRef, 'provider' | 'canonicalUri'>
): string {
  return `${resource.provider}:${resource.canonicalUri}`
}

export function inferResourceKind(
  provider: ResourceProvider,
  canonicalUri: string,
  mimeType?: string
): ResourceKind {
  if (provider === 'web') return 'url'
  if (provider === 'google-drive') {
    if (mimeType === 'application/vnd.google-apps.document') return 'google-doc'
    if (mimeType === 'application/vnd.google-apps.spreadsheet') return 'google-sheet'
    if (mimeType === 'application/vnd.google-apps.presentation') return 'google-slide'
    return 'drive-file'
  }
  if (provider === 'xingularity') return isNotebookResourceUri(canonicalUri) ? 'notebook' : 'note'
  return canonicalUri.endsWith('/') ? 'local-folder' : 'local-file'
}

export function inferExternalProduct(value: string, mimeType?: string): ExternalProduct {
  if (mimeType === 'application/vnd.google-apps.document') return 'google-docs'
  if (mimeType === 'application/vnd.google-apps.spreadsheet') return 'google-sheets'
  if (mimeType === 'application/vnd.google-apps.presentation') return 'google-slides'

  try {
    const url = new URL(value)
    const hostname = url.hostname.toLowerCase()
    const pathname = url.pathname.toLowerCase()
    if (hostname === 'docs.google.com') {
      if (pathname.startsWith('/document/')) return 'google-docs'
      if (pathname.startsWith('/spreadsheets/')) return 'google-sheets'
      if (pathname.startsWith('/presentation/')) return 'google-slides'
    }
    if (hostname === 'sheets.google.com') return 'google-sheets'
    if (hostname === 'slides.google.com') return 'google-slides'
    if (hostname === 'drive.google.com') return 'google-drive'
    if (hostname === 'canva.com' || hostname.endsWith('.canva.com')) return 'canva'
  } catch {
    // Non-URL resources use the generic external mark.
  }

  return 'generic'
}

export function notebookResourceUri(notebookPath: string): string {
  const normalizedPath = normalizeNotebookPath(notebookPath)
  if (!normalizedPath) throw new Error('Notebook path must be vault-relative')
  return `${NOTEBOOK_RESOURCE_URI_PREFIX}${encodeURIComponent(normalizedPath)}`
}

export function notebookPathFromResource(
  resource: Pick<ResourceRef, 'canonicalUri' | 'type'>
): string | null {
  if (resource.type !== 'notebook' || !isNotebookResourceUri(resource.canonicalUri)) return null
  const encodedPath = resource.canonicalUri.slice(NOTEBOOK_RESOURCE_URI_PREFIX.length)
  try {
    return normalizeNotebookPath(decodeURIComponent(encodedPath)) || null
  } catch {
    return null
  }
}

export function inferMimeType(canonicalUri: string): string | undefined {
  try {
    const url = new URL(canonicalUri)
    if (url.protocol !== 'file:') return undefined
    const lastSegment = url.pathname.split('/').pop() ?? ''
    const dot = lastSegment.lastIndexOf('.')
    return dot < 0 ? undefined : LOCAL_FILE_EXTENSIONS[lastSegment.slice(dot).toLowerCase()]
  } catch {
    return undefined
  }
}

export function normalizeResourceInput(
  input: ResourceInput,
  now = new Date().toISOString()
): ResourceRef {
  const requestedType = input.type
  const provider =
    requestedType === 'notebook'
      ? 'xingularity'
      : (input.provider ?? inferProviderFromUri(input.canonicalUri))
  const canonicalUri =
    requestedType === 'notebook' && !isNotebookResourceUri(input.canonicalUri)
      ? notebookResourceUri(input.canonicalUri)
      : normalizeCanonicalUri(input.canonicalUri, provider)
  const kind =
    requestedType === 'notebook' || isNotebookResourceUri(canonicalUri)
      ? 'notebook'
      : (input.kind ?? inferResourceKind(provider, canonicalUri, input.mimeType))
  const type = requestedType ?? (kind === 'notebook' ? 'notebook' : 'external')
  const sourceOfTruth: ResourceSourceOfTruth =
    type === 'notebook'
      ? 'xingularity'
      : (input.sourceOfTruth ?? (provider === 'xingularity' ? 'xingularity' : 'external'))
  const access: ResourceAccess =
    input.access ?? (sourceOfTruth === 'xingularity' ? 'read-write' : 'read-only')
  const title = (input.title?.trim() || titleFromCanonicalUri(canonicalUri)).slice(0, 500)
  const externalProduct =
    type === 'external'
      ? (input.externalProduct ?? inferExternalProduct(canonicalUri, input.mimeType))
      : undefined
  const resource: ResourceRef = {
    id: resourceIdForCanonicalUri(provider, canonicalUri),
    type,
    provider,
    kind,
    title,
    canonicalUri,
    ...(externalProduct ? { externalProduct } : {}),
    ...(input.externalId ? { externalId: input.externalId.trim().slice(0, 500) } : {}),
    ...(input.mimeType || inferMimeType(canonicalUri)
      ? { mimeType: input.mimeType ?? inferMimeType(canonicalUri) }
      : {}),
    sourceOfTruth,
    access,
    state: 'unindexed',
    ...(input.projectId ? { projectIds: [input.projectId] } : {}),
    createdAt: now,
    updatedAt: now,
    lastSeenAt: now,
    freshness: provider === 'xingularity' ? 'live' : 'manual',
    ...(input.metadata ? { metadata: sanitizeResourceMetadata(input.metadata) } : {})
  }
  return resource
}

export function normalizeResourceRef(
  input: unknown,
  now = new Date().toISOString()
): ResourceRef | null {
  if (!isRecord(input)) return null
  const canonicalUri = typeof input.canonicalUri === 'string' ? input.canonicalUri : ''
  if (!canonicalUri.trim()) return null
  const provider = isResourceProvider(input.provider)
    ? input.provider
    : inferProviderFromUri(canonicalUri)
  const type = isResourceType(input.type)
    ? input.type
    : input.kind === 'notebook' || isNotebookResourceUri(canonicalUri)
      ? 'notebook'
      : 'external'
  const base = normalizeResourceInput(
    {
      type,
      canonicalUri,
      provider,
      kind: isResourceKind(input.kind) ? input.kind : undefined,
      title: typeof input.title === 'string' ? input.title : undefined,
      externalId: typeof input.externalId === 'string' ? input.externalId : undefined,
      mimeType: typeof input.mimeType === 'string' ? input.mimeType : undefined,
      externalProduct: isExternalProduct(input.externalProduct) ? input.externalProduct : undefined,
      sourceOfTruth:
        type === 'notebook' || input.sourceOfTruth === 'xingularity' ? 'xingularity' : 'external',
      access: isResourceAccess(input.access) ? input.access : undefined,
      projectId: undefined,
      metadata: isRecord(input.metadata) ? sanitizeResourceMetadata(input.metadata) : undefined
    },
    typeof input.createdAt === 'string' ? input.createdAt : now
  )
  const projectIds = normalizeStringArray(input.projectIds)
  const state = isResourceState(input.state) ? input.state : base.state
  const freshness = isResourceFreshness(input.freshness) ? input.freshness : base.freshness
  return {
    ...base,
    id: typeof input.id === 'string' && input.id.trim() ? input.id.trim() : base.id,
    type,
    state,
    freshness,
    ...(projectIds.length ? { projectIds } : {}),
    ...(typeof input.updatedAt === 'string' ? { updatedAt: input.updatedAt } : {}),
    ...(typeof input.lastSeenAt === 'string' ? { lastSeenAt: input.lastSeenAt } : {}),
    ...(typeof input.lastIndexedAt === 'string' ? { lastIndexedAt: input.lastIndexedAt } : {}),
    ...(typeof input.sourceModifiedAt === 'string'
      ? { sourceModifiedAt: input.sourceModifiedAt }
      : {})
  }
}

export function normalizeResourceRelation(
  input: unknown,
  now = new Date().toISOString()
): ResourceRelation | null {
  if (!isRecord(input)) return null
  if (
    typeof input.fromId !== 'string' ||
    typeof input.toId !== 'string' ||
    !isResourceRelationType(input.type)
  ) {
    return null
  }
  const fromKind = typeof input.fromKind === 'string' ? input.fromKind : 'resource'
  const toKind = typeof input.toKind === 'string' ? input.toKind : 'resource'
  return {
    id:
      typeof input.id === 'string' && input.id.trim()
        ? input.id.trim()
        : relationId(input.type, fromKind, input.fromId, toKind, input.toId),
    type: input.type,
    fromId: input.fromId.trim(),
    fromKind: fromKind as ResourceRelation['fromKind'],
    toId: input.toId.trim(),
    toKind: toKind as ResourceRelation['toKind'],
    createdAt: typeof input.createdAt === 'string' ? input.createdAt : now,
    createdBy:
      input.createdBy === 'agent' || input.createdBy === 'system' ? input.createdBy : 'user',
    confidence: input.confidence === 'suggested' ? 'suggested' : 'confirmed',
    ...(typeof input.sourceLocation === 'string'
      ? { sourceLocation: input.sourceLocation.slice(0, 500) }
      : {}),
    ...(typeof input.note === 'string' ? { note: input.note.slice(0, 1000) } : {})
  }
}

export function relationId(
  type: ResourceRelationType,
  fromKind: string,
  fromId: string,
  toKind: string,
  toId: string
): string {
  return `relation-${stableDigest(`${type}:${fromKind}:${fromId}:${toKind}:${toId}`)}`
}

export function migrateProjectResources(
  projects: readonly Project[],
  existingResources: readonly ResourceRef[] = [],
  existingRelations: readonly ResourceRelation[] = [],
  now = new Date().toISOString()
): ResourceMigrationResult {
  const resources = existingResources.flatMap((resource) => {
    const normalized = normalizeResourceRef(resource, now)
    return normalized ? [normalized] : []
  })
  const relations = [...existingRelations]
  const byKey = new Map(resources.map((resource) => [resourceCanonicalKey(resource), resource]))
  let migrated = 0
  let preserved = 0

  const nextProjects = projects.map((project) => {
    const legacy = project as Project & { notebookPath?: unknown; resources?: unknown }
    const refs: ResourceRef[] = []

    const addProjectResource = (candidate: ResourceRef, isLegacy = false): void => {
      const key = resourceCanonicalKey(candidate)
      let resource = byKey.get(key)
      if (!resource) {
        resource = candidate
        resources.push(resource)
        byKey.set(key, resource)
        if (isLegacy) migrated += 1
      } else if (isLegacy) {
        preserved += 1
      }

      if (!resource.projectIds?.includes(project.id)) {
        const nextResource = {
          ...resource,
          projectIds: [...(resource.projectIds ?? []), project.id]
        }
        const resourceIndex = resources.findIndex((item) => item.id === resource?.id)
        if (resourceIndex >= 0) resources[resourceIndex] = nextResource
        byKey.set(key, nextResource)
        resource = nextResource
      }

      if (!refs.some((ref) => ref.id === resource?.id)) refs.push(resource)
      const relation = normalizeResourceRelation(
        {
          type: 'project_contains_resource',
          fromId: project.id,
          fromKind: 'project',
          toId: resource.id,
          toKind: 'resource',
          createdAt: now,
          createdBy: 'system',
          confidence: 'confirmed'
        },
        now
      )
      if (relation && !relations.some((candidate) => candidate.id === relation.id)) {
        relations.push(relation)
      }
    }

    for (const ref of project.resourceRefs ?? []) {
      const normalized = normalizeResourceRef(ref, now)
      if (normalized) addProjectResource(normalized)
    }

    if (typeof legacy.notebookPath === 'string') {
      const notebookPath = normalizeNotebookPath(legacy.notebookPath)
      if (notebookPath) {
        addProjectResource(
          normalizeResourceInput(
            {
              type: 'notebook',
              canonicalUri: notebookResourceUri(notebookPath),
              title: notebookPath.split('/').pop() ?? project.name,
              projectId: project.id
            },
            now
          ),
          true
        )
      }
    }

    const legacyResources = Array.isArray(legacy.resources)
      ? legacy.resources.filter((value): value is string => typeof value === 'string')
      : []
    for (const rawValue of legacyResources) {
      const canonicalUri = legacyResourceToUri(rawValue)
      const provider = inferProviderFromUri(canonicalUri)
      addProjectResource(
        normalizeResourceInput(
          {
            type: 'external',
            provider,
            canonicalUri,
            title: rawValue,
            kind: inferResourceKind(provider, canonicalUri),
            projectId: project.id
          },
          now
        ),
        true
      )
    }

    const nextProject = {
      ...project,
      resourceRefs: refs.length ? refs : undefined
    }
    delete (nextProject as Project & { notebookPath?: unknown }).notebookPath
    delete (nextProject as Project & { resources?: unknown }).resources
    return nextProject
  })

  return { projects: nextProjects, resources, relations, migrated, preserved }
}

export function resourceStateLabel(state: ResourceState): string {
  return state.replaceAll('-', ' ')
}

export function resourceHealthFromError(error: unknown): ResourceState {
  if (error instanceof TypeError) return 'offline'
  const code = isRecord(error) && typeof error.code === 'string' ? error.code : ''
  if (code === 'ENOENT') return 'missing'
  if (code === 'EACCES' || code === 'EPERM') return 'permission-denied'
  if (code === 'ENETUNREACH' || code === 'ENOTFOUND' || code === 'ETIMEDOUT') return 'offline'
  return 'stale'
}

export function inferProviderFromUri(value: string): ResourceProvider {
  const trimmed = value.trim()
  if (
    /^https?:\/\/docs\.google\.com\//i.test(trimmed) ||
    /^https?:\/\/drive\.google\.com\//i.test(trimmed)
  )
    return 'google-drive'
  if (/^https?:\/\//i.test(trimmed)) return 'web'
  if (/^file:\/\//i.test(trimmed) || trimmed.startsWith('/') || /^[A-Za-z]:[\\/]/.test(trimmed))
    return 'filesystem'
  return 'xingularity'
}

function normalizeCanonicalUri(value: string, provider: ResourceProvider): string {
  const trimmed = value.trim()
  if (provider === 'filesystem' && !trimmed.startsWith('file://')) {
    return `file://${encodeURI(trimmed)}`
  }
  return trimmed
}

function titleFromCanonicalUri(value: string): string {
  if (isNotebookResourceUri(value)) {
    return (
      notebookPathFromResource({ type: 'notebook', canonicalUri: value })?.split('/').pop() ??
      'Notebook'
    )
  }
  try {
    const url = new URL(value)
    if (url.protocol === 'file:')
      return decodeURIComponent(url.pathname.split('/').pop() || url.pathname)
    return url.hostname + (url.pathname === '/' ? '' : url.pathname)
  } catch {
    return value.split(/[\\/]/).pop() || value
  }
}

function legacyResourceToUri(value: string): string {
  const trimmed = value.trim()
  if (
    /^(https?|file):\/\//i.test(trimmed) ||
    trimmed.startsWith('/') ||
    /^[A-Za-z]:[\\/]/.test(trimmed)
  )
    return trimmed
  return `xingularity://resource/${encodeURIComponent(trimmed)}`
}

function normalizeNotebookPath(value: string): string {
  const normalized = value
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$|\s+$/g, '')
  if (!normalized || normalized.startsWith('/') || /^[A-Za-z]:\//.test(normalized)) return ''
  const segments = normalized.split('/')
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) return ''
  return segments.join('/')
}

function isNotebookResourceUri(value: string): boolean {
  return value.trim().startsWith(NOTEBOOK_RESOURCE_URI_PREFIX)
}

function sanitizeResourceMetadata(
  input: Record<string, unknown>
): Record<string, string | number | boolean | null> {
  const result: Record<string, string | number | boolean | null> = {}
  for (const [key, value] of Object.entries(input).slice(0, 50)) {
    if (!key.trim() || /token|secret|password|credential|private/i.test(key)) continue
    if (typeof value === 'string') result[key] = value.slice(0, 500)
    else if (typeof value === 'number' && Number.isFinite(value)) result[key] = value
    else if (typeof value === 'boolean' || value === null) result[key] = value
  }
  return result
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
        .map((item) => item.trim().slice(0, 200))
    )
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isResourceProvider(value: unknown): value is ResourceProvider {
  return typeof value === 'string' && RESOURCE_PROVIDERS.includes(value as ResourceProvider)
}

function isResourceType(value: unknown): value is ResourceRef['type'] {
  return value === 'notebook' || value === 'external'
}

function isExternalProduct(value: unknown): value is ExternalProduct {
  return typeof value === 'string' && EXTERNAL_PRODUCTS.includes(value as ExternalProduct)
}

function isResourceKind(value: unknown): value is ResourceKind {
  return typeof value === 'string' && RESOURCE_KINDS.includes(value as ResourceKind)
}

function isResourceAccess(value: unknown): value is ResourceAccess {
  return value === 'read-only' || value === 'read-write' || value === 'unknown'
}

function isResourceState(value: unknown): value is ResourceState {
  return typeof value === 'string' && RESOURCE_STATES.includes(value as ResourceState)
}

function isResourceFreshness(value: unknown): value is ResourceFreshness {
  return value === 'live' || value === 'periodic' || value === 'manual' || value === 'unknown'
}

function isResourceRelationType(value: unknown): value is ResourceRelationType {
  return (
    typeof value === 'string' && RESOURCE_RELATION_TYPES.includes(value as ResourceRelationType)
  )
}

function stableDigest(value: string): string {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0') + value.length.toString(16).padStart(4, '0')
}
