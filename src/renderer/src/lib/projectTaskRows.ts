import type { Project } from '../../../shared/types'

export type ProjectsWorkspaceFilterMode = 'all' | 'favorites' | 'archived'

export const PROJECTS_WORKSPACE_FILTER_OPTIONS: Array<{
  value: ProjectsWorkspaceFilterMode
  label: string
}> = [
  { value: 'all', label: 'All' },
  { value: 'favorites', label: 'Favorite' },
  { value: 'archived', label: 'Archive' }
]

export function filterProjectsForWorkspace(
  projects: Project[],
  favoriteProjectIds: string[],
  filterMode: ProjectsWorkspaceFilterMode
): Project[] {
  const activeProjects = projects.filter((project) => project.state !== 'archived')

  if (filterMode === 'favorites') {
    const favoriteIds = new Set(favoriteProjectIds)
    return activeProjects.filter((project) => favoriteIds.has(project.id))
  }

  if (filterMode === 'archived') {
    return projects.filter((project) => project.state === 'archived')
  }

  return activeProjects
}
