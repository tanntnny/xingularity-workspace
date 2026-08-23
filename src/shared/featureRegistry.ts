export const FEATURE_REGISTRY_VERSION = 1

export const FEATURE_STATUSES = [
  'shipped',
  'backend-only',
  'hidden',
  'experimental',
  'planned'
] as const

export type FeatureStatus = (typeof FEATURE_STATUSES)[number]
export type FeaturePriority = 'P0' | 'P1' | 'P2' | 'P3'

export const BACKLOG_FEATURE_IDS = [
  'SEC-001',
  'DATA-001',
  'CAL-001',
  'PROD-001',
  'CAL-002',
  'CAL-003',
  'CAL-004',
  'SEC-002',
  'SEARCH-001',
  'CORE-001',
  'AUTO-001',
  'CORE-002',
  'VAULT-001',
  'CORE-003',
  'CAL-005',
  'PLAN-001',
  'PROJ-001',
  'CAP-001',
  'FIN-001',
  'KNOW-001',
  'MEDIA-001',
  'AGENT-001',
  'SYNC-001',
  'AI-001',
  'EXT-001',
  'TEST-001',
  'DOC-001'
] as const

export type BacklogFeatureId = (typeof BACKLOG_FEATURE_IDS)[number]

export interface FeatureRegistryEntry {
  id: BacklogFeatureId
  title: string
  priority: FeaturePriority
  status: FeatureStatus
  summary: string
}

const registryEntries = [
  {
    id: 'SEC-001',
    title: 'Enforce the vault-file protocol boundary',
    priority: 'P0',
    status: 'shipped',
    summary: 'Restrict vault file reads to approved roots and reject traversal or symlink escapes.'
  },
  {
    id: 'DATA-001',
    title: 'Make persistence, migration, and documentation agree',
    priority: 'P1',
    status: 'experimental',
    summary: 'Define canonical storage, migration reports, backups, and rollback behavior.'
  },
  {
    id: 'CAL-001',
    title: 'Reconcile reminder lifecycles and make notifications actionable',
    priority: 'P1',
    status: 'experimental',
    summary:
      'Reconcile desired reminder state with active notifications and actionable click-through.'
  },
  {
    id: 'PROD-001',
    title: 'Reconcile shipped, hidden, and documented features',
    priority: 'P1',
    status: 'shipped',
    summary:
      'Use one registry to describe which product capabilities are visible, backend-only, or planned.'
  },
  {
    id: 'CAL-002',
    title: 'Introduce a provider-neutral calendar domain',
    priority: 'P1',
    status: 'shipped',
    summary: 'Separate local tasks, calendar events, links, and provider connections.'
  },
  {
    id: 'CAL-003',
    title: 'Integrate Google Calendar in safe phases',
    priority: 'P1',
    status: 'experimental',
    summary: 'Start with read-only provider import and explicit external writes.'
  },
  {
    id: 'CAL-004',
    title: 'Make time, timezone, recurrence, and all-day semantics explicit',
    priority: 'P1',
    status: 'shipped',
    summary: 'Keep date-only values distinct from timed instants across travel, DST, and sync.'
  },
  {
    id: 'SEC-002',
    title: 'Move credentials out of vault settings and define secret scope',
    priority: 'P1',
    status: 'experimental',
    summary: 'Use device credential storage and opaque vault-scoped references.'
  },
  {
    id: 'SEARCH-001',
    title: 'Build unified workspace search',
    priority: 'P1',
    status: 'experimental',
    summary: 'Make notes and structured workspace records discoverable through one search contract.'
  },
  {
    id: 'CORE-001',
    title: 'Detect structured-file changes and resolve conflicts',
    priority: 'P1',
    status: 'experimental',
    summary:
      'Add deterministic change detection and explicit conflict resolution for structured records.'
  },
  {
    id: 'AUTO-001',
    title: 'Make schedules durable, cancellable, and capability-safe',
    priority: 'P1',
    status: 'experimental',
    summary: 'Persist schedule state and enforce runtime permissions, cancellation, and recovery.'
  },
  {
    id: 'CORE-002',
    title: 'Reduce renderer and domain coupling before adding more surfaces',
    priority: 'P1',
    status: 'experimental',
    summary: 'Keep domain contracts and page composition independent enough to evolve safely.'
  },
  {
    id: 'VAULT-001',
    title: 'Add backup, diagnostics, export/import, and migration recovery',
    priority: 'P1',
    status: 'experimental',
    summary:
      'Provide verified portable manifests, checksums, diagnostics, backup, and restore preview.'
  },
  {
    id: 'CORE-003',
    title: 'Unify undo, trash, archive, and history semantics',
    priority: 'P1',
    status: 'experimental',
    summary: 'Give destructive operations predictable recovery paths across domains.'
  },
  {
    id: 'CAL-005',
    title: 'Finish the calendar workspace hierarchy and interaction contract',
    priority: 'P2',
    status: 'experimental',
    summary: 'Complete calendar view hierarchy, filters, empty states, and interaction behavior.'
  },
  {
    id: 'PLAN-001',
    title: 'Bring weekly planning into the visible product',
    priority: 'P2',
    status: 'shipped',
    summary: 'Expose the existing weekly-plan model through a deliberate visible workspace.'
  },
  {
    id: 'PROJ-001',
    title: 'Evolve projects from task lists into planning spaces',
    priority: 'P2',
    status: 'experimental',
    summary:
      'Add milestones, dependencies, views, and project-level planning without breaking tasks.'
  },
  {
    id: 'CAP-001',
    title: 'Turn Quick Capture into an actionable inbox',
    priority: 'P2',
    status: 'experimental',
    summary: 'Preserve capture context and support safe triage into notes or tasks.'
  },
  {
    id: 'FIN-001',
    title: 'Connect subscriptions to real financial and calendar decisions',
    priority: 'P2',
    status: 'experimental',
    summary: 'Add renewal, payment, usage, and calendar context while keeping financial data local.'
  },
  {
    id: 'KNOW-001',
    title: 'Expand the knowledge graph beyond note mentions',
    priority: 'P2',
    status: 'experimental',
    summary: 'Relate notes to tasks, projects, events, captures, and durable workspace entities.'
  },
  {
    id: 'MEDIA-001',
    title: 'Make Excalidraw a first-class, recoverable workspace object',
    priority: 'P2',
    status: 'experimental',
    summary:
      'Add stable drawing metadata, asset lifecycle, export, conflict, and recovery semantics.'
  },
  {
    id: 'AGENT-001',
    title: 'Decide and surface the agent product boundary',
    priority: 'P2',
    status: 'experimental',
    summary:
      'Make provider, model, privacy, tools, approvals, provenance, and run recovery visible.'
  },
  {
    id: 'SYNC-001',
    title: 'Optional multi-device vault synchronization',
    priority: 'P3',
    status: 'experimental',
    summary: 'Keep local copies safe while detecting concurrent edits deterministically.'
  },
  {
    id: 'AI-001',
    title: 'Add assistive intelligence only around explicit workspace actions',
    priority: 'P3',
    status: 'experimental',
    summary:
      'Keep suggestions explainable, reviewable, and safe when models or networks are unavailable.'
  },
  {
    id: 'EXT-001',
    title: 'Provider and plugin ecosystem',
    priority: 'P3',
    status: 'experimental',
    summary:
      'Validate versioned provider manifests and least-privilege capabilities before loading adapters.'
  },
  {
    id: 'TEST-001',
    title: 'Establish a durable product verification matrix',
    priority: 'P1',
    status: 'experimental',
    summary:
      'Tie each roadmap capability to durable security, storage, workflow, renderer, and performance checks.'
  },
  {
    id: 'DOC-001',
    title: 'Keep product, data, and feature documentation generated from decisions',
    priority: 'P1',
    status: 'shipped',
    summary: 'Make the registry the shared status source for product and data documentation.'
  }
] as const satisfies readonly FeatureRegistryEntry[]

export const FEATURE_REGISTRY: readonly FeatureRegistryEntry[] = Object.freeze(registryEntries)
export const featureRegistry = FEATURE_REGISTRY
export const FEATURES = FEATURE_REGISTRY

export const FEATURE_REGISTRY_BY_ID: Readonly<Record<BacklogFeatureId, FeatureRegistryEntry>> =
  Object.freeze(Object.fromEntries(FEATURE_REGISTRY.map((entry) => [entry.id, entry]))) as Readonly<
    Record<BacklogFeatureId, FeatureRegistryEntry>
  >

export function getFeature(id: string): FeatureRegistryEntry | undefined {
  return FEATURE_REGISTRY_BY_ID[id as BacklogFeatureId]
}

export const getFeatureRegistryEntry = getFeature

export function getFeatureStatus(id: string): FeatureStatus | undefined {
  return getFeature(id)?.status
}

export function listFeaturesByStatus(status: FeatureStatus): FeatureRegistryEntry[] {
  return FEATURE_REGISTRY.filter((entry) => entry.status === status)
}

export function validateFeatureRegistry(
  entries: readonly FeatureRegistryEntry[] = FEATURE_REGISTRY
): { valid: boolean; missing: BacklogFeatureId[]; duplicate: string[]; unknown: string[] } {
  const known = new Set<string>(BACKLOG_FEATURE_IDS)
  const seen = new Set<string>()
  const duplicate: string[] = []
  const unknown: string[] = []

  for (const entry of entries) {
    if (!known.has(entry.id)) {
      unknown.push(entry.id)
    }
    if (seen.has(entry.id)) {
      duplicate.push(entry.id)
    }
    seen.add(entry.id)
  }

  const missing = BACKLOG_FEATURE_IDS.filter((id) => !seen.has(id))
  return {
    valid: missing.length === 0 && duplicate.length === 0 && unknown.length === 0,
    missing,
    duplicate,
    unknown
  }
}

export function assertCompleteFeatureRegistry(
  entries: readonly FeatureRegistryEntry[] = FEATURE_REGISTRY
): void {
  const result = validateFeatureRegistry(entries)
  if (!result.valid) {
    throw new Error(
      `Feature registry is incomplete (missing: ${result.missing.join(', ') || 'none'}; ` +
        `duplicate: ${result.duplicate.join(', ') || 'none'}; unknown: ${result.unknown.join(', ') || 'none'})`
    )
  }
}
