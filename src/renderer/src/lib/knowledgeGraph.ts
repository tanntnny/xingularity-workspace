import { getNoteDisplayName } from '../../../shared/noteDocument'
import { createNoteMentionResolver } from '../../../shared/noteMentions'
import type { NoteListItem } from '../../../shared/types'

export interface KnowledgeGraphNode {
  id: string
  relPath: string
  label: string
  degree: number
  isOrphan: boolean
}

export interface KnowledgeGraphLink {
  source: string
  target: string
}

export interface KnowledgeGraphData {
  nodes: KnowledgeGraphNode[]
  links: KnowledgeGraphLink[]
}

export function buildKnowledgeGraph(notes: NoteListItem[]): KnowledgeGraphData {
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

  return { nodes, links }
}
