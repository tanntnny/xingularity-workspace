import type { NoteTreeNode } from '../../../shared/types'

export interface NotebookFolderContents {
  path: string | null
  name: string
  parentPath: string | null
  children: NoteTreeNode[]
}

function findNodeByPath(nodes: NoteTreeNode[], relPath: string): NoteTreeNode | null {
  for (const node of nodes) {
    if (node.relPath === relPath) {
      return node
    }

    if (node.kind === 'folder') {
      const descendant = findNodeByPath(node.children, relPath)
      if (descendant) {
        return descendant
      }
    }
  }

  return null
}

function getParentPath(relPath: string | null): string | null {
  if (!relPath || !relPath.includes('/')) {
    return null
  }

  return relPath.slice(0, relPath.lastIndexOf('/')) || null
}

function getNearestFolderPath(nodes: NoteTreeNode[], requestedPath: string | null): string | null {
  let candidate = requestedPath

  while (candidate) {
    const node = findNodeByPath(nodes, candidate)
    if (node?.kind === 'folder') {
      return candidate
    }
    candidate = getParentPath(candidate)
  }

  return null
}

export function getNotebookFolderContents(
  tree: NoteTreeNode[],
  requestedPath: string | null
): NotebookFolderContents {
  const path = getNearestFolderPath(tree, requestedPath)

  if (!path) {
    return {
      path: null,
      name: 'Notebooks',
      parentPath: null,
      children: tree
    }
  }

  const node = findNodeByPath(tree, path)
  if (!node || node.kind !== 'folder') {
    return {
      path: null,
      name: 'Notebooks',
      parentPath: null,
      children: tree
    }
  }

  return {
    path,
    name: node.name,
    parentPath: getParentPath(path),
    children: node.children
  }
}
