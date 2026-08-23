import type { Project } from './types'
import { getProjectFolderPath } from './projectFolders'
import { notebookPathFromResource } from './resourceDomain'

export function getProjectNotebookPath(project: Pick<Project, 'name' | 'resourceRefs'>): string {
  const notebookResource = project.resourceRefs?.find((resource) => resource.type === 'notebook')
  const explicitPath = notebookResource ? notebookPathFromResource(notebookResource) : null
  return explicitPath || getProjectFolderPath(project)
}
