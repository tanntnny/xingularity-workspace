import type { Project, ResourceRef, ResourceRelation } from '../../../shared/types'
import { notebookPathFromResource } from '../../../shared/resourceDomain'

export interface ProjectResourceRow {
  resource: ResourceRef
}

export function getProjectResourceRows(
  project: Pick<Project, 'id' | 'resourceRefs'>,
  resources: readonly ResourceRef[],
  relations: readonly ResourceRelation[]
): ProjectResourceRow[] {
  const resourceById = new Map(resources.map((resource) => [resource.id, resource]))
  const attachedIds = new Set([
    ...(project.resourceRefs ?? []).map((resource) => resource.id),
    ...relations
      .filter(
        (relation) =>
          relation.type === 'project_contains_resource' && relation.fromId === project.id
      )
      .map((relation) => relation.toId)
  ])
  const rows: ProjectResourceRow[] = []
  const seenIds = new Set<string>()

  for (const resource of project.resourceRefs ?? []) {
    const resolved = resourceById.get(resource.id) ?? resource
    if (seenIds.has(resolved.id)) continue
    seenIds.add(resolved.id)
    rows.push({ resource: resolved })
  }

  for (const resourceId of attachedIds) {
    const resource = resourceById.get(resourceId)
    if (!resource || seenIds.has(resource.id)) continue
    seenIds.add(resource.id)
    rows.push({ resource })
  }

  return rows
}

export function resourceTypeLabel(resource: Pick<ResourceRef, 'type'>): string {
  return resource.type === 'notebook' ? 'Notebook' : 'External'
}

export function resourceProductLabel(
  resource: Pick<ResourceRef, 'type' | 'externalProduct' | 'provider' | 'kind'>
): string {
  if (resource.type === 'notebook') return 'Notebook folder'
  if (resource.provider === 'filesystem') {
    return resource.kind === 'local-folder' ? 'Local folder' : 'Local file'
  }
  switch (resource.externalProduct) {
    case 'google-docs':
      return 'Google Docs'
    case 'google-sheets':
      return 'Google Sheets'
    case 'google-slides':
      return 'Google Slides'
    case 'google-drive':
      return 'Google Drive'
    case 'canva':
      return 'Canva'
    default:
      return resource.provider === 'google-drive' ? 'Google Drive' : 'External link'
  }
}

export function resourceLocationLabel(resource: ResourceRef): string {
  return resource.type === 'notebook'
    ? (notebookPathFromResource(resource) ?? resource.title)
    : resource.canonicalUri
}

export function isExternalHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim())
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}
