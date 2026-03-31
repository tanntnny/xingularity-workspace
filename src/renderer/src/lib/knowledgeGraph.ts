import { getNoteDisplayName } from '../../../shared/noteDocument'
import { normalizeMentionTarget } from '../../../shared/noteMentions'
import type { NoteListItem } from '../../../shared/types'

export interface KnowledgeGraphNode {
  id: string
  relPath: string
  label: string
  degree: number
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
  const exactPathLookup = new Map<string, string>()
  const noteNameGroups = new Map<string, NoteListItem[]>()

  notes.forEach((note) => {
    exactPathLookup.set(normalizeMentionTarget(note.relPath), note.relPath)
    const nameKey = normalizeMentionTarget(note.name)
    const matches = noteNameGroups.get(nameKey)
    if (matches) {
      matches.push(note)
      return
    }

    noteNameGroups.set(nameKey, [note])
  })

  const degreeByPath = new Map<string, number>()
  const links: KnowledgeGraphLink[] = []
  const linkKeys = new Set<string>()

  notes.forEach((note) => {
    note.mentionTargets?.forEach((target) => {
      const normalizedTarget = normalizeMentionTarget(target)
      const resolvedTarget =
        exactPathLookup.get(normalizedTarget) ??
        (() => {
          const matches = noteNameGroups.get(normalizedTarget) ?? []
          return matches.length === 1 ? matches[0].relPath : null
        })()

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
    .filter((note) => degreeByPath.has(note.relPath))
    .map((note) => ({
      id: note.relPath,
      relPath: note.relPath,
      label: getNoteDisplayName(note.relPath),
      degree: degreeByPath.get(note.relPath) ?? 0
    }))
    .sort((left, right) => right.degree - left.degree || left.label.localeCompare(right.label))

  return { nodes, links }
}
