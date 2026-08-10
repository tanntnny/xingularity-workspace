import type { NoteTreeNode } from '../../../shared/types'
import type { RecentNotebookFile } from '../components/NotebookEmptyState'

export function flattenRecentNotebookFiles(
  tree: NoteTreeNode[],
  recentPaths: readonly string[]
): RecentNotebookFile[] {
  const entries = new Map<string, RecentNotebookFile>()

  const visit = (nodes: NoteTreeNode[]): void => {
    for (const node of nodes) {
      if (node.kind === 'note' || node.kind === 'excalidraw') {
        entries.set(node.relPath, { kind: node.kind, relPath: node.relPath })
      }

      if (node.kind === 'folder') {
        visit(node.children)
      }
    }
  }

  visit(tree)

  return recentPaths.flatMap((relPath) => {
    const entry = entries.get(relPath)
    return entry ? [entry] : []
  })
}
