import type { NoteTreeFolder, NoteTreeNode, Project, ResourceRef } from '../../../shared/types'
export { getProjectNotebookPath } from '../../../shared/projectNotebook'

export const PROJECT_NOTEBOOK_AUTO_VALUE = '__automatic_project_notebook__'

export interface NotebookFolderOption {
  path: string
  name: string
  depth: number
}

export function flattenNotebookFolders(nodes: readonly NoteTreeNode[]): NotebookFolderOption[] {
  const folders: NotebookFolderOption[] = []

  const visit = (entries: readonly NoteTreeNode[], depth: number): void => {
    for (const entry of entries) {
      if (entry.kind !== 'folder') continue

      folders.push({ path: entry.relPath, name: entry.name, depth })
      visit(entry.children, depth + 1)
    }
  }

  visit(nodes, 0)
  return folders.sort((left, right) => left.path.localeCompare(right.path))
}

export function findNotebookFolder(
  nodes: readonly NoteTreeNode[],
  path: string
): NoteTreeFolder | null {
  for (const node of nodes) {
    if (node.kind === 'folder' && node.relPath === path) {
      return node
    }

    if (node.kind === 'folder') {
      const descendant = findNotebookFolder(node.children, path)
      if (descendant) return descendant
    }
  }

  return null
}

export function getProjectNotebookResource(
  project: Pick<Project, 'resourceRefs'>
): ResourceRef | null {
  return project.resourceRefs?.find((resource) => resource.type === 'notebook') ?? null
}

export function getNotebookFolderName(path: string): string {
  return path.split('/').filter(Boolean).pop() ?? 'Notebooks'
}
