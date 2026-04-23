export interface NoteTreeSelectionEntry {
  kind: 'note' | 'folder'
  relPath: string
}

export type NoteTreeSelection = NoteTreeSelectionEntry[]

export function normalizeNoteTreeSelection(entries: NoteTreeSelection): NoteTreeSelection {
  const dedupedEntries: NoteTreeSelection = []
  const seen = new Set<string>()

  for (const entry of entries) {
    const key = `${entry.kind}:${entry.relPath}`
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    dedupedEntries.push(entry)
  }

  return dedupedEntries.filter((entry, index) => {
    return !dedupedEntries.some((candidate, candidateIndex) => {
      if (candidateIndex === index || candidate.kind !== 'folder') {
        return false
      }

      return isNestedPath(entry.relPath, candidate.relPath)
    })
  })
}

export function getPrimaryNoteTreeSelectionEntry(
  entries: NoteTreeSelection
): NoteTreeSelectionEntry | null {
  return entries.length > 0 ? entries[entries.length - 1] : null
}

function isNestedPath(candidatePath: string, parentPath: string): boolean {
  return candidatePath === parentPath || candidatePath.startsWith(`${parentPath}/`)
}
