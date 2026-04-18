import type { NoteTreeNode } from '../../../shared/types'

export function hideManagedProjectTree(nodes: NoteTreeNode[]): NoteTreeNode[] {
  return nodes.map((node) => {
    if (node.kind !== 'folder') {
      return node
    }

    return {
      ...node,
      children: hideManagedProjectTree(node.children)
    }
  })
}
