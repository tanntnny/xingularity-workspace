import { getNoteDisplayName } from '../../../shared/noteDocument'
import { createNoteMentionResolver } from '../../../shared/noteMentions'
import type { CalendarTask, NoteListItem, Project, ResourceRef } from '../../../shared/types'

export type KnowledgeEntityKind = 'project' | 'task' | 'resource'

export interface KnowledgeGraphEntity {
  kind: KnowledgeEntityKind
  id: string
  label: string
  projectId?: string
  dependencyIds?: string[]
}

export interface KnowledgeGraphNode {
  id: string
  relPath: string
  label: string
  degree: number
  isOrphan: boolean
  kind?: 'note' | KnowledgeEntityKind
  entityId?: string
}

export interface KnowledgeGraphLink {
  source: string
  target: string
  relationType?: 'mention' | 'project-task' | 'project-resource' | 'task-dependency'
}

export interface KnowledgeGraphData {
  nodes: KnowledgeGraphNode[]
  links: KnowledgeGraphLink[]
}

export function buildKnowledgeGraph(
  notes: NoteListItem[],
  entities: KnowledgeGraphEntity[] = []
): KnowledgeGraphData {
  const resolveNoteMentionTarget = createNoteMentionResolver(notes)
  const degreeByPath = new Map<string, number>()
  const links: KnowledgeGraphLink[] = []
  const linkKeys = new Set<string>()

  notes.forEach((note) => {
    note.mentionTargets?.forEach((target) => {
      const resolvedTarget = resolveNoteMentionTarget(target)

      if (!resolvedTarget || resolvedTarget === note.relPath) {
        return
      }

      const [left, right] = [note.relPath, resolvedTarget].sort((a, b) => a.localeCompare(b))
      const linkKey = `${left}::${right}`
      if (linkKeys.has(linkKey)) {
        return
      }

      linkKeys.add(linkKey)
      links.push({ source: left, target: right })
      degreeByPath.set(left, (degreeByPath.get(left) ?? 0) + 1)
      degreeByPath.set(right, (degreeByPath.get(right) ?? 0) + 1)
    })
  })

  const entityNodes = entities.map((entity) => ({
    id: `${entity.kind}:${entity.id}`,
    relPath: `${entity.kind}:${entity.id}`,
    label: entity.label,
    degree: 0,
    isOrphan: true,
    kind: entity.kind,
    entityId: entity.id
  }))
  const entityById = new Map(entities.map((entity) => [`${entity.kind}:${entity.id}`, entity]))
  const addEntityLink = (
    source: string,
    target: string,
    relationType: KnowledgeGraphLink['relationType']
  ): void => {
    if (!entityById.has(source) || !entityById.has(target)) return
    const linkKey = `${source}::${target}::${relationType}`
    if (linkKeys.has(linkKey)) return
    linkKeys.add(linkKey)
    links.push({ source, target, relationType })
    degreeByPath.set(source, (degreeByPath.get(source) ?? 0) + 1)
    degreeByPath.set(target, (degreeByPath.get(target) ?? 0) + 1)
  }

  for (const entity of entities) {
    const entityId = `${entity.kind}:${entity.id}`
    if (entity.kind === 'task' && entity.projectId) {
      addEntityLink(entityId, `project:${entity.projectId}`, 'project-task')
    }
    if (entity.kind === 'task') {
      for (const dependencyId of entity.dependencyIds ?? []) {
        addEntityLink(entityId, `task:${dependencyId}`, 'task-dependency')
      }
    }
    if (entity.kind === 'resource' && entity.projectId) {
      addEntityLink(entityId, `project:${entity.projectId}`, 'project-resource')
    }
  }

  const nodes = notes
    .map((note) => ({
      id: note.relPath,
      relPath: note.relPath,
      label: getNoteDisplayName(note.relPath),
      degree: degreeByPath.get(note.relPath) ?? 0,
      isOrphan: !degreeByPath.has(note.relPath)
    }))
    .sort(
      (left, right) =>
        Number(left.isOrphan) - Number(right.isOrphan) ||
        right.degree - left.degree ||
        left.label.localeCompare(right.label)
    )

  for (const node of entityNodes) {
    node.degree = degreeByPath.get(node.id) ?? 0
    node.isOrphan = node.degree === 0
  }

  return { nodes: [...nodes, ...entityNodes], links }
}

export function createKnowledgeGraphEntities(
  projects: Project[],
  tasks: CalendarTask[],
  resources: ResourceRef[] = []
): KnowledgeGraphEntity[] {
  return [
    ...projects.map((project) => ({
      kind: 'project' as const,
      id: project.id,
      label: project.name
    })),
    ...tasks.map((task) => ({
      kind: 'task' as const,
      id: task.id,
      label: task.title,
      projectId: task.projectId,
      dependencyIds: task.dependencyIds
    })),
    ...resources.map((resource) => ({
      kind: 'resource' as const,
      id: resource.id,
      label: resource.title,
      projectId: resource.projectIds?.[0]
    }))
  ]
}

export function filterKnowledgeGraph(
  graph: KnowledgeGraphData,
  showOrphans: boolean
): KnowledgeGraphData {
  if (showOrphans) {
    return graph
  }

  const nodes = graph.nodes.filter((node) => !node.isOrphan)
  const visibleNodeIds = new Set(nodes.map((node) => node.id))
  const links = graph.links.filter(
    (link) => visibleNodeIds.has(link.source) && visibleNodeIds.has(link.target)
  )

  return { nodes, links }
}
