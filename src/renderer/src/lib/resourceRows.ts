import type {
  Project,
  ResourceProvider,
  ResourceRef,
  ResourceRelation,
  ResourceState,
  ResourceType
} from '../../../shared/types'
import { resourceLocationLabel, resourceProductLabel, resourceTypeLabel } from './projectResources'

export const UNASSIGNED_RESOURCE_PROJECT_FILTER = '__unassigned__'

export interface ResourcePageRow {
  resource: ResourceRef
  projectIds: string[]
  projectNames: string[]
}

export interface ResourceFilterState {
  searchQuery?: string
  types?: readonly ResourceType[]
  providers?: readonly ResourceProvider[]
  states?: readonly ResourceState[]
  labelFilters?: Readonly<Record<string, readonly string[]>>
  projectIds?: readonly string[]
}

export interface ResourceFilterOption {
  value: string
  label: string
}

export interface ResourceFilterOptions {
  types: ResourceFilterOption[]
  providers: ResourceFilterOption[]
  states: ResourceFilterOption[]
  projects: ResourceFilterOption[]
  labels: Record<string, ResourceFilterOption[]>
}

export function getResourcePageRows(
  resources: readonly ResourceRef[],
  projects: readonly Project[],
  relations: readonly ResourceRelation[]
): ResourcePageRow[] {
  const rows = resources.map((resource) => {
    const projectIds = getResourceProjectIds(resource, projects, relations)
    const projectIdSet = new Set(projectIds)
    const projectNames = projects
      .filter((project) => projectIdSet.has(project.id))
      .map((project) => project.name)

    return { resource, projectIds, projectNames }
  })

  return rows.sort((left, right) => {
    const updatedOrder = right.resource.updatedAt.localeCompare(left.resource.updatedAt)
    return updatedOrder !== 0
      ? updatedOrder
      : left.resource.title.localeCompare(right.resource.title)
  })
}

export function getResourceProjectIds(
  resource: ResourceRef,
  projects: readonly Project[],
  relations: readonly ResourceRelation[]
): string[] {
  const ids = new Set(resource.projectIds ?? [])

  for (const relation of relations) {
    if (
      relation.type === 'project_contains_resource' &&
      relation.toKind === 'resource' &&
      relation.toId === resource.id &&
      relation.fromKind === 'project'
    ) {
      ids.add(relation.fromId)
    }
  }

  for (const project of projects) {
    if (project.resourceRefs?.some((ref) => ref.id === resource.id)) {
      ids.add(project.id)
    }
  }

  return Array.from(ids)
}

export function filterResourceRows(
  rows: readonly ResourcePageRow[],
  filters: ResourceFilterState
): ResourcePageRow[] {
  const query = filters.searchQuery?.trim().toLocaleLowerCase() ?? ''
  const labelFilters = filters.labelFilters ?? {}
  const projectIds = filters.projectIds ?? []

  return rows.filter((row) => {
    if (query && !resourceRowSearchText(row).includes(query)) return false

    if (filters.types?.length && !filters.types.includes(row.resource.type)) return false
    if (filters.providers?.length && !filters.providers.includes(row.resource.provider))
      return false
    if (filters.states?.length && !filters.states.includes(row.resource.state)) return false

    for (const [key, values] of Object.entries(labelFilters)) {
      if (values.length === 0) continue
      if (
        !row.resource.labels?.some((label) => label.key === key && values.includes(label.value))
      ) {
        return false
      }
    }

    if (projectIds.length > 0) {
      const matchesProject = projectIds.some((projectId) =>
        projectId === UNASSIGNED_RESOURCE_PROJECT_FILTER
          ? row.projectIds.length === 0
          : row.projectIds.includes(projectId)
      )
      if (!matchesProject) return false
    }

    return true
  })
}

export function hasResourceFilters(filters: ResourceFilterState): boolean {
  return Boolean(
    filters.types?.length ||
    filters.providers?.length ||
    filters.states?.length ||
    filters.projectIds?.length ||
    Object.values(filters.labelFilters ?? {}).some((values) => values.length > 0)
  )
}

export function getResourceFilterOptions(
  rows: readonly ResourcePageRow[],
  projects: readonly Project[]
): ResourceFilterOptions {
  const types = uniqueOptions(
    rows.map(({ resource }) => resource.type),
    (value) => resourceTypeLabel({ type: value })
  )
  const providers = uniqueOptions(
    rows.map(({ resource }) => resource.provider),
    resourceProviderLabel
  )
  const states = uniqueOptions(
    rows.map(({ resource }) => resource.state),
    humanizeResourceValue
  )
  const projectOptions = projects
    .map((project) => ({ value: project.id, label: project.name }))
    .sort((left, right) => left.label.localeCompare(right.label))

  if (rows.some((row) => row.projectIds.length === 0)) {
    projectOptions.push({ value: UNASSIGNED_RESOURCE_PROJECT_FILTER, label: 'Unassigned' })
  }

  const labelOptions = Object.fromEntries(
    Object.entries(getResourceLabelFilterOptions(rows)).map(([key, values]) => [
      key,
      values.map((value) => ({ value, label: value }))
    ])
  )

  return { types, providers, states, projects: projectOptions, labels: labelOptions }
}

export function getResourceLabelFilterOptions(
  rows: readonly ResourcePageRow[]
): Record<string, string[]> {
  const valuesByKey = new Map<string, Set<string>>()
  for (const row of rows) {
    for (const label of row.resource.labels ?? []) {
      const values = valuesByKey.get(label.key) ?? new Set<string>()
      values.add(label.value)
      valuesByKey.set(label.key, values)
    }
  }

  return Object.fromEntries(
    Array.from(valuesByKey.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, values]) => [
        key,
        Array.from(values).sort((left, right) => left.localeCompare(right))
      ])
  )
}

function uniqueOptions<T extends string>(
  values: readonly T[],
  getLabel: (value: T) => string
): ResourceFilterOption[] {
  return Array.from(new Set(values))
    .map((value) => ({ value, label: getLabel(value) }))
    .sort((left, right) => left.label.localeCompare(right.label))
}

function resourceProviderLabel(provider: string): string {
  switch (provider) {
    case 'google-drive':
      return 'Google Drive'
    case 'xingularity':
      return 'Xingularity'
    case 'filesystem':
      return 'Filesystem'
    case 'web':
      return 'Web'
    default:
      return humanizeResourceValue(provider)
  }
}

function humanizeResourceValue(value: string): string {
  return value.replace(/[-_]+/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase())
}

export function resourceRowSearchText(row: ResourcePageRow): string {
  const labels = (row.resource.labels ?? []).map((label) => `${label.key}=${label.value}`)
  return [
    row.resource.title,
    resourceProductLabel(row.resource),
    resourceLocationLabel(row.resource),
    ...row.projectNames,
    ...labels
  ]
    .join(' ')
    .toLocaleLowerCase()
}
