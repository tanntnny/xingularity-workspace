import { Project } from './types'
import { generateProjectTag } from './noteTags'

export const PROJECTS_ROOT_FOLDER_NAME = 'Projects'

export type ProjectTreeProtectionKind = 'projects-root' | 'project-folder'

function normalizePathSeparators(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
}

export function sanitizeProjectFolderName(projectName: string): string {
  const trimmed = projectName.trim()
  const sanitized = trimmed
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)

  return sanitized || 'Untitled Project'
}

export function getProjectsRootPath(): string {
  return PROJECTS_ROOT_FOLDER_NAME
}

export function getProjectFolderPath(project: Pick<Project, 'name'>): string {
  return `${PROJECTS_ROOT_FOLDER_NAME}/${sanitizeProjectFolderName(project.name)}`
}

export function isProjectsRootPath(relPath: string): boolean {
  return normalizePathSeparators(relPath) === PROJECTS_ROOT_FOLDER_NAME
}

export function getProjectFolderSegments(relPath: string): string[] {
  const normalized = normalizePathSeparators(relPath)
  return normalized ? normalized.split('/') : []
}

export function isDirectProjectFolderPath(relPath: string): boolean {
  const segments = getProjectFolderSegments(relPath)
  return segments.length === 2 && segments[0] === PROJECTS_ROOT_FOLDER_NAME
}

export function getDirectProjectFolderName(relPath: string): string | null {
  if (!isDirectProjectFolderPath(relPath)) {
    return null
  }
  return getProjectFolderSegments(relPath)[1] ?? null
}

export function isInsideProjectFolder(relPath: string): boolean {
  const segments = getProjectFolderSegments(relPath)
  return segments.length >= 2 && segments[0] === PROJECTS_ROOT_FOLDER_NAME
}

export function resolveProjectByFolderPath(
  relPath: string,
  projects: Project[]
): Project | null {
  const segments = getProjectFolderSegments(relPath)
  if (segments.length < 2 || segments[0] !== PROJECTS_ROOT_FOLDER_NAME) {
    return null
  }

  const projectFolderPath = `${PROJECTS_ROOT_FOLDER_NAME}/${segments[1]}`
  return (
    projects.find((project) => getProjectFolderPath(project) === projectFolderPath) ?? null
  )
}

export function getProjectTagForPath(relPath: string, projects: Project[]): string | null {
  const project = resolveProjectByFolderPath(relPath, projects)
  return project ? generateProjectTag(project.name) : null
}

export function isProtectedProjectTreePath(relPath: string, projects: Project[]): boolean {
  if (isProjectsRootPath(relPath)) {
    return true
  }

  return projects.some((project) => getProjectFolderPath(project) === normalizePathSeparators(relPath))
}

export function getProjectProtectionKind(
  relPath: string,
  projects: Project[]
): ProjectTreeProtectionKind | null {
  if (isProjectsRootPath(relPath)) {
    return 'projects-root'
  }

  return projects.some((project) => getProjectFolderPath(project) === normalizePathSeparators(relPath))
    ? 'project-folder'
    : null
}

export function isManagedProjectsRootChild(relPath: string): boolean {
  const segments = getProjectFolderSegments(relPath)
  return segments.length === 2 && segments[0] === PROJECTS_ROOT_FOLDER_NAME
}

export function getProjectFolderRelativeChildPath(relPath: string): string {
  const normalized = normalizePathSeparators(relPath)
  if (!normalized.startsWith(`${PROJECTS_ROOT_FOLDER_NAME}/`)) {
    return normalized
  }
  return normalized.slice(`${PROJECTS_ROOT_FOLDER_NAME}/`.length)
}
