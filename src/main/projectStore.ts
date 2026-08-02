import fs from 'node:fs/promises'
import path from 'node:path'
import type { Project } from '../shared/types'
import {
  deleteLegacyVaultPath,
  getLegacyPageVaultProjectsPath,
  getLegacySystemVaultProjectsPath,
  getLegacyVaultProjectIconsPath,
  getLegacyVaultProjectsPath,
  getVaultProjectPath,
  getVaultProjectsDir
} from './vaultData'

export interface ProjectStorageSnapshot {
  canonicalFiles: boolean
  projects: Project[]
  projectIcons: Record<string, Project['icon']>
}

type LegacyProjectPayload = {
  projects?: unknown
  projectIcons?: unknown
}

export class ProjectStore {
  private readonly projectsDir: string

  constructor(private readonly vaultRoot: string) {
    this.projectsDir = getVaultProjectsDir(vaultRoot)
  }

  async read(): Promise<ProjectStorageSnapshot> {
    const canonical = await this.readCanonicalFiles()
    if (canonical) {
      return canonical
    }

    return (
      (await this.readLegacyFiles()) ?? {
        canonicalFiles: false,
        projects: [],
        projectIcons: {}
      }
    )
  }

  async writeAll(projects: Project[]): Promise<void> {
    await fs.mkdir(this.projectsDir, { recursive: true })
    const existingEntries = await fs.readdir(this.projectsDir, { withFileTypes: true })
    const nextPaths = new Set<string>()

    await Promise.all(
      projects.map(async (project) => {
        const targetPath = getVaultProjectPath(this.vaultRoot, project.id)
        nextPaths.add(path.basename(targetPath))
        await writeJsonAtomically(targetPath, serializeProject(project))
      })
    )

    await Promise.all(
      existingEntries
        .filter(
          (entry) => entry.isFile() && entry.name.endsWith('.json') && entry.name !== 'index.json'
        )
        .filter((entry) => !nextPaths.has(entry.name))
        .map((entry) => fs.unlink(path.join(this.projectsDir, entry.name)))
    )
  }

  async cleanupLegacyFiles(): Promise<void> {
    await Promise.all([
      fs.rm(getLegacyPageVaultProjectsPath(this.vaultRoot), { force: true }),
      deleteLegacyVaultPath(getLegacyVaultProjectsPath(this.vaultRoot), this.vaultRoot),
      deleteLegacyVaultPath(getLegacyVaultProjectIconsPath(this.vaultRoot), this.vaultRoot),
      deleteLegacyVaultPath(getLegacySystemVaultProjectsPath(this.vaultRoot), this.vaultRoot)
    ])
  }

  private async readCanonicalFiles(): Promise<ProjectStorageSnapshot | null> {
    try {
      const entries = await fs.readdir(this.projectsDir, { withFileTypes: true })
      const projectEntries = entries.filter(
        (entry) => entry.isFile() && entry.name.endsWith('.json') && entry.name !== 'index.json'
      )

      if (projectEntries.length === 0) {
        if (entries.length === 0 && !(await this.hasLegacyFiles())) {
          return {
            canonicalFiles: true,
            projects: [],
            projectIcons: {}
          }
        }
        return null
      }

      const projects: Project[] = []
      for (const entry of projectEntries) {
        try {
          const raw = await fs.readFile(path.join(this.projectsDir, entry.name), 'utf-8')
          projects.push(JSON.parse(raw) as Project)
        } catch (error) {
          console.error(`[ProjectStore] Failed to read ${entry.name}`, error)
        }
      }

      return {
        canonicalFiles: true,
        projects,
        projectIcons: {}
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('[ProjectStore] Failed to list project files', error)
      }
      return null
    }
  }

  private async hasLegacyFiles(): Promise<boolean> {
    for (const filePath of [
      getLegacyVaultProjectsPath(this.vaultRoot),
      getLegacyPageVaultProjectsPath(this.vaultRoot),
      getLegacyVaultProjectIconsPath(this.vaultRoot),
      getLegacySystemVaultProjectsPath(this.vaultRoot)
    ]) {
      try {
        await fs.access(filePath)
        return true
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          console.error(`[ProjectStore] Failed to check ${filePath}`, error)
        }
      }
    }

    return false
  }

  private async readLegacyFiles(): Promise<ProjectStorageSnapshot | null> {
    let fallback: ProjectStorageSnapshot | null = null

    for (const filePath of [
      getLegacyVaultProjectsPath(this.vaultRoot),
      getLegacyPageVaultProjectsPath(this.vaultRoot),
      getLegacySystemVaultProjectsPath(this.vaultRoot)
    ]) {
      const payload = await readJsonFile(filePath)
      if (payload === null) {
        continue
      }

      const normalized = await normalizeLegacyPayload(payload, filePath, this.vaultRoot)
      if (!fallback) {
        fallback = normalized
      }
      if (normalized.projects.length > 0 || Object.keys(normalized.projectIcons).length > 0) {
        return normalized
      }
    }

    return fallback
  }
}

function serializeProject(
  project: Project
): Pick<Project, 'id' | 'name' | 'description' | 'icon' | 'state' | 'updatedAt'> {
  return {
    id: project.id,
    name: project.name,
    description: project.description ?? project.summary ?? '',
    icon: project.icon,
    state: project.state,
    updatedAt: project.updatedAt
  }
}

async function normalizeLegacyPayload(
  payload: unknown,
  sourcePath: string,
  vaultRoot: string
): Promise<ProjectStorageSnapshot> {
  if (Array.isArray(payload)) {
    const projectIcons = (await readJsonFile(getLegacyVaultProjectIconsPath(vaultRoot))) ?? {}
    return {
      canonicalFiles: false,
      projects: payload,
      projectIcons: isRecord(projectIcons) ? (projectIcons as Record<string, Project['icon']>) : {}
    }
  }

  if (isRecord(payload)) {
    const legacy = payload as LegacyProjectPayload
    return {
      canonicalFiles: false,
      projects: Array.isArray(legacy.projects) ? (legacy.projects as Project[]) : [],
      projectIcons: isRecord(legacy.projectIcons)
        ? (legacy.projectIcons as Record<string, Project['icon']>)
        : {}
    }
  }

  console.error(`[ProjectStore] Ignoring invalid project payload at ${sourcePath}`)
  return {
    canonicalFiles: false,
    projects: [],
    projectIcons: {}
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

async function readJsonFile(filePath: string): Promise<unknown | null> {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf-8'))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error(`[ProjectStore] Failed to read ${filePath}`, error)
    }
    return null
  }
}

async function writeJsonAtomically(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  const tempPath = `${filePath}.tmp-${process.pid}`
  await fs.writeFile(tempPath, JSON.stringify(value, null, 2), 'utf-8')
  await fs.rename(tempPath, filePath)
}
