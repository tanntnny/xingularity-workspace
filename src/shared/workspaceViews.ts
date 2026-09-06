import { normalizeProjectIcon } from './projectIcons'
import { RESOURCE_PROVIDERS, RESOURCE_STATES, RESOURCE_TYPES } from './resourceDomain'
import {
  CALENDAR_TASK_TYPE_VALUES,
  TASK_STATUS_VALUES,
  WORKSPACE_VIEW_RESOURCE_SORTABLE_COLUMNS,
  WORKSPACE_VIEW_SOURCE_VALUES,
  WORKSPACE_VIEW_TASK_GROUP_BY_VALUES,
  WORKSPACE_VIEW_TASK_SCHEDULE_FILTER_VALUES,
  WORKSPACE_VIEW_TASK_SORTABLE_COLUMNS,
  type ProjectIconInput,
  type WorkspaceView,
  type WorkspaceViewResourceConfig,
  type WorkspaceViewSource,
  type WorkspaceViewSortState,
  type WorkspaceViewTaskConfig
} from './types'

const TASK_PRIORITIES = ['low', 'medium', 'high'] as const
const DEFAULT_TASK_VIEW_NAME = 'Untitled Tasks View'
const DEFAULT_RESOURCE_VIEW_NAME = 'Untitled Resources View'

export function createWorkspaceView(
  id: string,
  source: 'tasks',
  existingViews?: readonly WorkspaceView[],
  createdAt?: string
): Extract<WorkspaceView, { source: 'tasks' }>
export function createWorkspaceView(
  id: string,
  source: 'resources',
  existingViews?: readonly WorkspaceView[],
  createdAt?: string
): Extract<WorkspaceView, { source: 'resources' }>
export function createWorkspaceView(
  id: string,
  source: WorkspaceViewSource,
  existingViews?: readonly WorkspaceView[],
  createdAt?: string
): WorkspaceView
export function createWorkspaceView(
  id: string,
  source: WorkspaceViewSource,
  existingViews: readonly WorkspaceView[] = [],
  createdAt = new Date().toISOString()
): WorkspaceView {
  const name = getUniqueWorkspaceViewName(source, existingViews)
  const icon = normalizeProjectIcon(
    {
      set: 'tabler',
      glyph: source === 'tasks' ? 'list-check' : 'table',
      variant: 'filled',
      color: source === 'tasks' ? '#38bdf8' : '#22d3ee'
    },
    `${source}:${id}`
  )

  if (source === 'tasks') {
    return {
      id,
      name,
      icon,
      source,
      config: createDefaultWorkspaceViewTaskConfig(),
      createdAt,
      updatedAt: createdAt
    }
  }

  return {
    id,
    name,
    icon,
    source,
    config: createDefaultWorkspaceViewResourceConfig(),
    createdAt,
    updatedAt: createdAt
  }
}

export function getUniqueWorkspaceViewName(
  source: WorkspaceViewSource,
  existingViews: readonly WorkspaceView[]
): string {
  const baseName = source === 'tasks' ? DEFAULT_TASK_VIEW_NAME : DEFAULT_RESOURCE_VIEW_NAME
  const names = new Set(existingViews.map((view) => view.name.trim().toLocaleLowerCase()))
  if (!names.has(baseName.toLocaleLowerCase())) {
    return baseName
  }

  let suffix = 2
  while (names.has(`${baseName} ${suffix}`.toLocaleLowerCase())) {
    suffix += 1
  }
  return `${baseName} ${suffix}`
}

export function createDefaultWorkspaceViewTaskConfig(): WorkspaceViewTaskConfig {
  return {
    searchQuery: '',
    statuses: [],
    taskTypes: [],
    priorities: [],
    projectIds: [],
    milestoneIds: [],
    scheduleStates: [],
    tags: [],
    groupBy: 'none',
    sortState: { columnId: 'start-date', direction: 'asc' }
  }
}

export function createDefaultWorkspaceViewResourceConfig(): WorkspaceViewResourceConfig {
  return {
    searchQuery: '',
    types: [],
    providers: [],
    states: [],
    labelFilters: {},
    projectIds: [],
    sortState: null
  }
}

export function normalizeWorkspaceViews(value: unknown): WorkspaceView[] {
  if (!Array.isArray(value)) {
    return []
  }

  const seenIds = new Set<string>()
  const normalized: WorkspaceView[] = []

  for (const candidate of value.slice(0, 100)) {
    if (!candidate || typeof candidate !== 'object') {
      continue
    }

    const record = candidate as Record<string, unknown>
    const id = typeof record.id === 'string' ? record.id.trim() : ''
    const source = isWorkspaceViewSource(record.source) ? record.source : null
    if (!id || id.length > 120 || !source || seenIds.has(id)) {
      continue
    }

    seenIds.add(id)
    const now = new Date().toISOString()
    const createdAt = normalizeTimestamp(record.createdAt, now)
    const updatedAt = normalizeTimestamp(record.updatedAt, createdAt)
    const name =
      typeof record.name === 'string' && record.name.trim()
        ? record.name.trim().slice(0, 160)
        : getUniqueWorkspaceViewName(source, normalized)
    const config = record.config && typeof record.config === 'object' ? record.config : {}
    const icon = normalizeWorkspaceViewIcon(record.icon, source, id)

    if (source === 'tasks') {
      normalized.push({
        id,
        name,
        icon,
        source,
        config: normalizeWorkspaceViewTaskConfig(config as Record<string, unknown>),
        createdAt,
        updatedAt
      })
    } else {
      normalized.push({
        id,
        name,
        icon,
        source,
        config: normalizeWorkspaceViewResourceConfig(config as Record<string, unknown>),
        createdAt,
        updatedAt
      })
    }
  }

  return normalized
}

function normalizeWorkspaceViewTaskConfig(value: Record<string, unknown>): WorkspaceViewTaskConfig {
  const defaults = createDefaultWorkspaceViewTaskConfig()
  return {
    searchQuery: typeof value.searchQuery === 'string' ? value.searchQuery : defaults.searchQuery,
    statuses: normalizeEnumArray(value.statuses, TASK_STATUS_VALUES),
    taskTypes: normalizeEnumArray(value.taskTypes, CALENDAR_TASK_TYPE_VALUES),
    priorities: normalizeEnumArray(value.priorities, TASK_PRIORITIES),
    projectIds: normalizeStringArray(value.projectIds),
    milestoneIds: normalizeStringArray(value.milestoneIds),
    scheduleStates: normalizeEnumArray(
      value.scheduleStates,
      WORKSPACE_VIEW_TASK_SCHEDULE_FILTER_VALUES
    ),
    tags: normalizeStringArray(value.tags),
    groupBy: normalizeEnumValue(value.groupBy, WORKSPACE_VIEW_TASK_GROUP_BY_VALUES, 'none'),
    sortState: normalizeSortState(
      value.sortState,
      WORKSPACE_VIEW_TASK_SORTABLE_COLUMNS,
      defaults.sortState
    )
  }
}

function normalizeWorkspaceViewResourceConfig(
  value: Record<string, unknown>
): WorkspaceViewResourceConfig {
  const defaults = createDefaultWorkspaceViewResourceConfig()
  const labelFilters: Record<string, string[]> = {}
  if (value.labelFilters && typeof value.labelFilters === 'object') {
    for (const [key, values] of Object.entries(value.labelFilters)) {
      const normalizedValues = normalizeStringArray(values)
      if (key.trim() && normalizedValues.length > 0) {
        labelFilters[key.trim()] = normalizedValues
      }
    }
  }

  return {
    searchQuery: typeof value.searchQuery === 'string' ? value.searchQuery : defaults.searchQuery,
    types: normalizeEnumArray(value.types, RESOURCE_TYPES),
    providers: normalizeEnumArray(value.providers, RESOURCE_PROVIDERS),
    states: normalizeEnumArray(value.states, RESOURCE_STATES),
    labelFilters,
    projectIds: normalizeStringArray(value.projectIds),
    sortState: normalizeSortState(
      value.sortState,
      WORKSPACE_VIEW_RESOURCE_SORTABLE_COLUMNS,
      defaults.sortState
    )
  }
}

function normalizeWorkspaceViewIcon(
  value: unknown,
  source: WorkspaceViewSource,
  id: string
): ReturnType<typeof normalizeProjectIcon> {
  const fallback: ProjectIconInput = {
    set: 'tabler',
    glyph: source === 'tasks' ? 'list-check' : 'table',
    variant: 'filled',
    color: source === 'tasks' ? '#38bdf8' : '#22d3ee'
  }
  return normalizeProjectIcon(
    value && typeof value === 'object' ? (value as ProjectIconInput) : fallback,
    `${source}:${id}`
  )
}

function normalizeSortState(
  value: unknown,
  validColumns: readonly string[],
  fallback: WorkspaceViewSortState | null
): WorkspaceViewSortState | null {
  if (value === null) {
    return null
  }
  if (!value || typeof value !== 'object') {
    return fallback
  }

  const candidate = value as { columnId?: unknown; direction?: unknown }
  return typeof candidate.columnId === 'string' &&
    validColumns.includes(candidate.columnId) &&
    (candidate.direction === 'asc' || candidate.direction === 'desc')
    ? { columnId: candidate.columnId, direction: candidate.direction }
    : fallback
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }
  return Array.from(
    new Set(
      value.filter((entry): entry is string => typeof entry === 'string' && Boolean(entry.trim()))
    )
  )
}

function normalizeEnumArray<T extends string>(value: unknown, values: readonly T[]): T[] {
  if (!Array.isArray(value)) {
    return []
  }
  return Array.from(new Set(value.filter((entry): entry is T => values.includes(entry as T))))
}

function normalizeEnumValue<T extends string>(
  value: unknown,
  values: readonly T[],
  fallback: T
): T {
  return values.includes(value as T) ? (value as T) : fallback
}

function normalizeTimestamp(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    return fallback
  }
  return value
}

function isWorkspaceViewSource(value: unknown): value is WorkspaceViewSource {
  return WORKSPACE_VIEW_SOURCE_VALUES.includes(value as WorkspaceViewSource)
}
