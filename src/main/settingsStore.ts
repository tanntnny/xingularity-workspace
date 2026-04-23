import { app } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createRandomProjectIcon } from '../shared/projectIcons'
import {
  AppSettings,
  AppSettingsUpdate,
  CalendarTask,
  Project,
  ProjectMilestone,
  ProjectSubtask
} from '../shared/types'
import { ensureVaultAppDir } from './vaultData'

interface GlobalSettings {
  lastVaultPath: string | null
}

interface VaultCoreSettings
  extends Omit<AppSettings, 'projects' | 'projectIcons' | 'calendarTasks'> {
  projects?: Project[]
  projectIcons?: Record<string, AppSettings['projectIcons'][string]>
  calendarTasks?: CalendarTask[]
}

interface VaultProjectsData {
  projects: Project[]
  projectIcons: AppSettings['projectIcons']
}

interface VaultTasksData {
  calendarTasks: CalendarTask[]
}

export function createDefaultAppSettings(): AppSettings {
  return {
    isSidebarCollapsed: false,
    lastVaultPath: null,
    lastOpenedNotePath: null,
    lastOpenedProjectId: null,
    favoriteNotePaths: [],
    favoriteProjectIds: [],
    profile: {
      name: ''
    },
    ai: {
      mistralApiKey: ''
    },
    fontFamily: "'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', Palatino, serif",
    workspaceVibrancyEnabled: true,
    calendarTasks: [],
    projectIcons: {},
    projects: [],
    gridBoard: {
      viewport: {
        x: 0,
        y: 0,
        zoom: 1
      },
      items: []
    }
  }
}

function normalizeSettings(parsed: Partial<AppSettings>): AppSettings {
  const defaults = createDefaultAppSettings()
  const parsedGridBoard = parsed.gridBoard
  return {
    ...defaults,
    ...parsed,
    profile: {
      name:
        typeof parsed.profile?.name === 'string' && parsed.profile.name.trim().length > 0
          ? parsed.profile.name
          : defaults.profile.name
    },
    ai: {
      mistralApiKey:
        typeof parsed.ai?.mistralApiKey === 'string'
          ? parsed.ai.mistralApiKey
          : defaults.ai.mistralApiKey
    },
    workspaceVibrancyEnabled:
      typeof parsed.workspaceVibrancyEnabled === 'boolean'
        ? parsed.workspaceVibrancyEnabled
        : defaults.workspaceVibrancyEnabled,
    calendarTasks: Array.isArray(parsed.calendarTasks)
      ? parsed.calendarTasks
      : defaults.calendarTasks,
    projectIcons: parsed.projectIcons ?? defaults.projectIcons,
    projects: Array.isArray(parsed.projects)
      ? parsed.projects.flatMap((project) => normalizeProject(project))
      : defaults.projects,
    gridBoard:
      parsedGridBoard &&
      typeof parsedGridBoard === 'object' &&
      Array.isArray(parsedGridBoard.items) &&
      parsedGridBoard.viewport &&
      typeof parsedGridBoard.viewport === 'object'
        ? {
            viewport: {
              x:
                typeof parsedGridBoard.viewport.x === 'number'
                  ? parsedGridBoard.viewport.x
                  : defaults.gridBoard.viewport.x,
              y:
                typeof parsedGridBoard.viewport.y === 'number'
                  ? parsedGridBoard.viewport.y
                  : defaults.gridBoard.viewport.y,
              zoom:
                typeof parsedGridBoard.viewport.zoom === 'number'
                  ? parsedGridBoard.viewport.zoom
                  : defaults.gridBoard.viewport.zoom
            },
            items: parsedGridBoard.items.flatMap((item) => {
              if (
                typeof item !== 'object' ||
                item === null ||
                typeof item.id !== 'string' ||
                (item.kind !== 'note' && item.kind !== 'project' && item.kind !== 'text') ||
                typeof item.position?.x !== 'number' ||
                typeof item.position?.y !== 'number' ||
                typeof item.zIndex !== 'number'
              ) {
                return []
              }

              const size =
                typeof item.size?.width === 'number' &&
                Number.isFinite(item.size.width) &&
                item.size.width > 0 &&
                typeof item.size?.height === 'number' &&
                Number.isFinite(item.size.height) &&
                item.size.height > 0
                  ? {
                      width: item.size.width,
                      height: item.size.height
                    }
                  : undefined

              return [
                {
                  ...item,
                  size
                }
              ]
            })
          }
        : defaults.gridBoard,
    lastVaultPath: parsed.lastVaultPath ?? defaults.lastVaultPath,
    lastOpenedNotePath: parsed.lastOpenedNotePath ?? defaults.lastOpenedNotePath,
    lastOpenedProjectId: parsed.lastOpenedProjectId ?? defaults.lastOpenedProjectId,
    favoriteNotePaths: Array.isArray(parsed.favoriteNotePaths)
      ? parsed.favoriteNotePaths.filter((item): item is string => typeof item === 'string')
      : defaults.favoriteNotePaths,
    favoriteProjectIds: Array.isArray(parsed.favoriteProjectIds)
      ? parsed.favoriteProjectIds.filter((item): item is string => typeof item === 'string')
      : defaults.favoriteProjectIds
  }
}

function normalizeProjectSubtask(input: unknown): ProjectSubtask | null {
  if (typeof input !== 'object' || input === null) {
    return null
  }

  const candidate = input as Partial<ProjectSubtask>
  const title = typeof candidate.title === 'string' && candidate.title.trim() ? candidate.title.trim() : null
  const createdAt =
    typeof candidate.createdAt === 'string' && candidate.createdAt.trim()
      ? candidate.createdAt
      : new Date().toISOString()

  if (!title || typeof candidate.id !== 'string' || !candidate.id.trim()) {
    return null
  }

  return {
    id: candidate.id,
    title,
    description: typeof candidate.description === 'string' ? candidate.description.trim() : undefined,
    completed: Boolean(candidate.completed),
    priority:
      candidate.priority === 'low' || candidate.priority === 'medium' || candidate.priority === 'high'
        ? candidate.priority
        : undefined,
    createdAt,
    dueDate: typeof candidate.dueDate === 'string' && candidate.dueDate.trim() ? candidate.dueDate : undefined
  }
}

function normalizeProjectMilestone(input: unknown): ProjectMilestone | null {
  if (typeof input !== 'object' || input === null) {
    return null
  }

  const candidate = input as Partial<ProjectMilestone>
  const title = typeof candidate.title === 'string' && candidate.title.trim() ? candidate.title.trim() : null
  const dueDate =
    typeof candidate.dueDate === 'string' && candidate.dueDate.trim() ? candidate.dueDate : undefined

  if (!title || typeof candidate.id !== 'string' || !candidate.id.trim()) {
    return null
  }

  return {
    id: candidate.id,
    title,
    description: typeof candidate.description === 'string' ? candidate.description.trim() : undefined,
    collapsed: typeof candidate.collapsed === 'boolean' ? candidate.collapsed : undefined,
    dueDate,
    priority:
      candidate.priority === 'low' || candidate.priority === 'medium' || candidate.priority === 'high'
        ? candidate.priority
        : undefined,
    status:
      candidate.status === 'pending' ||
      candidate.status === 'in-progress' ||
      candidate.status === 'completed' ||
      candidate.status === 'blocked'
        ? candidate.status
        : 'pending',
    subtasks: Array.isArray(candidate.subtasks)
      ? candidate.subtasks
          .map((subtask) => normalizeProjectSubtask(subtask))
          .filter((subtask): subtask is ProjectSubtask => subtask !== null)
      : []
  }
}

function normalizeProject(input: unknown): Project[] {
  if (typeof input !== 'object' || input === null) {
    return []
  }

  const candidate = input as Partial<Project>
  const name = typeof candidate.name === 'string' && candidate.name.trim() ? candidate.name.trim() : null
  if (!name || typeof candidate.id !== 'string' || !candidate.id.trim()) {
    return []
  }

  const milestones = Array.isArray(candidate.milestones)
    ? candidate.milestones
        .map((milestone) => normalizeProjectMilestone(milestone))
        .filter((milestone): milestone is ProjectMilestone => milestone !== null)
    : []
  const completedMilestones = milestones.filter((milestone) => milestone.status === 'completed').length
  const progress =
    typeof candidate.progress === 'number' && Number.isFinite(candidate.progress)
      ? Math.max(0, Math.min(100, candidate.progress))
      : milestones.length > 0
        ? Math.round((completedMilestones / milestones.length) * 100)
        : 0

  return [
    {
      id: candidate.id,
      name,
      summary: typeof candidate.summary === 'string' ? candidate.summary.trim() : '',
      folderPath: typeof candidate.folderPath === 'string' && candidate.folderPath.trim() ? candidate.folderPath : undefined,
      status:
        candidate.status === 'on-track' ||
        candidate.status === 'at-risk' ||
        candidate.status === 'blocked' ||
        candidate.status === 'completed'
          ? candidate.status
          : 'on-track',
      updatedAt:
        typeof candidate.updatedAt === 'string' && candidate.updatedAt.trim()
          ? candidate.updatedAt
          : new Date().toISOString(),
      progress,
      milestones,
      icon:
        candidate.icon &&
        typeof candidate.icon === 'object' &&
        (candidate.icon as Project['icon']).shape &&
        (candidate.icon as Project['icon']).variant &&
        typeof (candidate.icon as Project['icon']).color === 'string'
          ? (candidate.icon as Project['icon'])
          : createRandomProjectIcon(name)
    }
  ]
}

function isLegacyAppSettings(value: unknown): value is AppSettings {
  return (
    typeof value === 'object' && value !== null && 'calendarTasks' in value && 'projects' in value
  )
}

export class SettingsStore {
  private readonly globalSettingsPath: string
  private static readonly CORE_SETTINGS_FILE = 'settings.json'
  private static readonly PROJECTS_FILE = 'projects.json'
  private static readonly TASKS_FILE = 'tasks.json'

  constructor() {
    this.globalSettingsPath = path.join(app.getPath('userData'), 'settings.json')
  }

  // ── Global settings (last opened vault) ───────────────────────────────────

  async readGlobal(): Promise<GlobalSettings> {
    try {
      const raw = await fs.readFile(this.globalSettingsPath, 'utf-8')
      const parsed = JSON.parse(raw) as GlobalSettings | AppSettings
      if (isLegacyAppSettings(parsed)) {
        return { lastVaultPath: parsed.lastVaultPath ?? null }
      }
      return {
        lastVaultPath: parsed?.lastVaultPath ?? null
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('Failed to read global settings:', error)
      }
      return { lastVaultPath: null }
    }
  }

  async writeGlobal(next: GlobalSettings): Promise<void> {
    await this.writeJsonFile(this.globalSettingsPath, next)
  }

  // ── Vault-specific settings ───────────────────────────────────────────────

  async readVault(vaultRoot: string): Promise<AppSettings> {
    const settingsPath = await this.getVaultDataPath(vaultRoot, SettingsStore.CORE_SETTINGS_FILE)
    const projectsPath = await this.getVaultDataPath(vaultRoot, SettingsStore.PROJECTS_FILE)
    const tasksPath = await this.getVaultDataPath(vaultRoot, SettingsStore.TASKS_FILE)

    try {
      const [coreParsed, projectsData, tasksData] = await Promise.all([
        this.readJsonFile<VaultCoreSettings>(settingsPath),
        this.readJsonFile<VaultProjectsData>(projectsPath),
        this.readJsonFile<VaultTasksData>(tasksPath)
      ])

      const needsSplitMigration =
        projectsData === null ||
        tasksData === null ||
        Boolean(coreParsed?.projects) ||
        Boolean(coreParsed?.projectIcons) ||
        Boolean(coreParsed?.calendarTasks)

      const merged = normalizeSettings({
        ...(coreParsed ?? {}),
        projects: projectsData?.projects ?? coreParsed?.projects,
        projectIcons: projectsData?.projectIcons ?? coreParsed?.projectIcons,
        calendarTasks: tasksData?.calendarTasks ?? coreParsed?.calendarTasks,
        lastVaultPath: vaultRoot
      })

      if (needsSplitMigration) {
        await this.persistVaultFiles(vaultRoot, merged)
      }
      return merged
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('Failed to read vault settings:', error)
      }

      // Try migrating from legacy global file
      const legacy = await this.readLegacyAppSettings()
      if (legacy) {
        const migrated = normalizeSettings({ ...legacy, lastVaultPath: vaultRoot })
        await this.persistVaultFiles(vaultRoot, migrated)
        await this.writeGlobal({ lastVaultPath: legacy.lastVaultPath ?? vaultRoot })
        return migrated
      }

      const defaults = normalizeSettings({ lastVaultPath: vaultRoot })
      await this.persistVaultFiles(vaultRoot, defaults)
      return defaults
    }
  }

  async updateVault(vaultRoot: string, next: AppSettingsUpdate): Promise<AppSettings> {
    const current = await this.readVault(vaultRoot)
    const merged = normalizeSettings({ ...current, ...next, lastVaultPath: vaultRoot })
    await this.persistVaultFiles(vaultRoot, merged)
    return merged
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async readLegacyAppSettings(): Promise<AppSettings | null> {
    try {
      const raw = await fs.readFile(this.globalSettingsPath, 'utf-8')
      const parsed = JSON.parse(raw)
      if (isLegacyAppSettings(parsed)) {
        return normalizeSettings(parsed)
      }
      return null
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('Failed to read legacy settings:', error)
      }
      return null
    }
  }

  private async getVaultDataPath(vaultRoot: string, fileName: string): Promise<string> {
    const dir = await ensureVaultAppDir(vaultRoot)
    return path.join(dir, fileName)
  }

  private async persistVaultFiles(vaultRoot: string, settings: AppSettings): Promise<void> {
    const corePath = await this.getVaultDataPath(vaultRoot, SettingsStore.CORE_SETTINGS_FILE)
    const projectsPath = await this.getVaultDataPath(vaultRoot, SettingsStore.PROJECTS_FILE)
    const tasksPath = await this.getVaultDataPath(vaultRoot, SettingsStore.TASKS_FILE)

    const coreSettings: VaultCoreSettings = {
      isSidebarCollapsed: settings.isSidebarCollapsed,
      lastVaultPath: settings.lastVaultPath,
      lastOpenedNotePath: settings.lastOpenedNotePath,
      lastOpenedProjectId: settings.lastOpenedProjectId,
      favoriteNotePaths: settings.favoriteNotePaths,
      favoriteProjectIds: settings.favoriteProjectIds,
      profile: settings.profile,
      ai: settings.ai,
      fontFamily: settings.fontFamily,
      workspaceVibrancyEnabled: settings.workspaceVibrancyEnabled,
      gridBoard: settings.gridBoard
    }

    const projectsData: VaultProjectsData = {
      projects: settings.projects,
      projectIcons: settings.projectIcons
    }

    const tasksData: VaultTasksData = {
      calendarTasks: settings.calendarTasks
    }

    await Promise.all([
      this.writeJsonFile(corePath, coreSettings),
      this.writeJsonFile(projectsPath, projectsData),
      this.writeJsonFile(tasksPath, tasksData)
    ])
  }

  private async readJsonFile<T>(filePath: string): Promise<T | null> {
    try {
      const raw = await fs.readFile(filePath, 'utf-8')
      return JSON.parse(raw) as T
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null
      }
      throw error
    }
  }

  private async writeJsonFile(filePath: string, data: unknown): Promise<void> {
    const dir = path.dirname(filePath)
    const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`
    await fs.mkdir(dir, { recursive: true })
    await this.backupExistingFile(filePath)
    await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf-8')
    await fs.rename(tempPath, filePath)
  }

  private async backupExistingFile(filePath: string): Promise<void> {
    try {
      await fs.access(filePath)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return
      }
      throw error
    }

    const backupPath = filePath.replace(/\.json$/i, '.bak.json')
    await fs.copyFile(filePath, backupPath)
  }
}
