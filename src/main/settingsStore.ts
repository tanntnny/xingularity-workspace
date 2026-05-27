import { app } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createRandomProjectIcon } from '../shared/projectIcons'
import { isProfileColor } from '../shared/profileColors'
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
  savedVaults: SavedVaultRecord[]
}

interface SavedVaultRecord {
  rootPath: string
  addedAt: string
  lastOpenedAt: string | null
  isFavorite: boolean
}

interface VaultCoreSettings extends Omit<
  AppSettings,
  'projects' | 'projectIcons' | 'calendarTasks'
> {
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
      name: '',
      color: 'indigo'
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
          : defaults.profile.name,
      color: isProfileColor(parsed.profile?.color) ? parsed.profile.color : defaults.profile.color
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
  const title =
    typeof candidate.title === 'string' && candidate.title.trim() ? candidate.title.trim() : null
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
    description:
      typeof candidate.description === 'string' ? candidate.description.trim() : undefined,
    completed: Boolean(candidate.completed),
    priority:
      candidate.priority === 'low' ||
      candidate.priority === 'medium' ||
      candidate.priority === 'high'
        ? candidate.priority
        : undefined,
    createdAt,
    dueDate:
      typeof candidate.dueDate === 'string' && candidate.dueDate.trim()
        ? candidate.dueDate
        : undefined
  }
}

function normalizeProjectMilestone(input: unknown): ProjectMilestone | null {
  if (typeof input !== 'object' || input === null) {
    return null
  }

  const candidate = input as Partial<ProjectMilestone>
  const title =
    typeof candidate.title === 'string' && candidate.title.trim() ? candidate.title.trim() : null
  const dueDate =
    typeof candidate.dueDate === 'string' && candidate.dueDate.trim()
      ? candidate.dueDate
      : undefined

  if (!title || typeof candidate.id !== 'string' || !candidate.id.trim()) {
    return null
  }

  return {
    id: candidate.id,
    title,
    description:
      typeof candidate.description === 'string' ? candidate.description.trim() : undefined,
    collapsed: typeof candidate.collapsed === 'boolean' ? candidate.collapsed : undefined,
    dueDate,
    priority:
      candidate.priority === 'low' ||
      candidate.priority === 'medium' ||
      candidate.priority === 'high'
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
  const name =
    typeof candidate.name === 'string' && candidate.name.trim() ? candidate.name.trim() : null
  if (!name || typeof candidate.id !== 'string' || !candidate.id.trim()) {
    return []
  }

  const milestones = Array.isArray(candidate.milestones)
    ? candidate.milestones
        .map((milestone) => normalizeProjectMilestone(milestone))
        .filter((milestone): milestone is ProjectMilestone => milestone !== null)
    : []
  const completedMilestones = milestones.filter(
    (milestone) => milestone.status === 'completed'
  ).length
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
      folderPath:
        typeof candidate.folderPath === 'string' && candidate.folderPath.trim()
          ? candidate.folderPath
          : undefined,
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

function normalizeSavedVaultRecord(input: unknown): SavedVaultRecord | null {
  if (typeof input !== 'object' || input === null) {
    return null
  }

  const candidate = input as Partial<SavedVaultRecord>
  const rootPath =
    typeof candidate.rootPath === 'string' && candidate.rootPath.trim().length > 0
      ? path.resolve(candidate.rootPath)
      : null

  if (!rootPath) {
    return null
  }

  return {
    rootPath,
    addedAt:
      typeof candidate.addedAt === 'string' && candidate.addedAt.trim().length > 0
        ? candidate.addedAt
        : new Date().toISOString(),
    lastOpenedAt:
      typeof candidate.lastOpenedAt === 'string' && candidate.lastOpenedAt.trim().length > 0
        ? candidate.lastOpenedAt
        : null,
    isFavorite: candidate.isFavorite === true
  }
}

function normalizeGlobalSettings(parsed: Partial<GlobalSettings>): GlobalSettings {
  const normalizedVaults = Array.isArray(parsed.savedVaults)
    ? parsed.savedVaults
        .map((item) => normalizeSavedVaultRecord(item))
        .filter((item): item is SavedVaultRecord => item !== null)
    : []
  const savedVaults = new Map<string, SavedVaultRecord>()

  for (const record of normalizedVaults) {
    const existing = savedVaults.get(record.rootPath)
    if (
      !existing ||
      (record.lastOpenedAt ?? '') > (existing.lastOpenedAt ?? '') ||
      record.addedAt > existing.addedAt
    ) {
      savedVaults.set(record.rootPath, record)
    }
  }

  const lastVaultPath =
    typeof parsed.lastVaultPath === 'string' && parsed.lastVaultPath.trim().length > 0
      ? path.resolve(parsed.lastVaultPath)
      : null

  if (lastVaultPath && !savedVaults.has(lastVaultPath)) {
    savedVaults.set(lastVaultPath, {
      rootPath: lastVaultPath,
      addedAt: new Date().toISOString(),
      lastOpenedAt: null,
      isFavorite: false
    })
  }

  return {
    lastVaultPath,
    savedVaults: Array.from(savedVaults.values())
  }
}

function rememberGlobalVault(settings: GlobalSettings, rootPath: string): GlobalSettings {
  const nextRootPath = path.resolve(rootPath)
  const now = new Date().toISOString()
  const existing = settings.savedVaults.find((item) => item.rootPath === nextRootPath)

  return normalizeGlobalSettings({
    lastVaultPath: nextRootPath,
    savedVaults: [
      ...settings.savedVaults.filter((item) => item.rootPath !== nextRootPath),
      {
        rootPath: nextRootPath,
        addedAt: existing?.addedAt ?? now,
        lastOpenedAt: now,
        isFavorite: existing?.isFavorite === true
      }
    ]
  })
}

function forgetGlobalVault(settings: GlobalSettings, rootPath: string): GlobalSettings {
  const nextRootPath = path.resolve(rootPath)

  return normalizeGlobalSettings({
    lastVaultPath: settings.lastVaultPath === nextRootPath ? null : settings.lastVaultPath,
    savedVaults: settings.savedVaults.filter((item) => item.rootPath !== nextRootPath)
  })
}

function toggleFavoriteGlobalVault(settings: GlobalSettings, rootPath: string): GlobalSettings {
  const nextRootPath = path.resolve(rootPath)
  const existing = settings.savedVaults.find((item) => item.rootPath === nextRootPath)

  if (!existing) {
    return settings
  }

  return normalizeGlobalSettings({
    lastVaultPath: settings.lastVaultPath,
    savedVaults: [
      ...settings.savedVaults.filter((item) => item.rootPath !== nextRootPath),
      {
        ...existing,
        isFavorite: !existing.isFavorite
      }
    ]
  })
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
        return normalizeGlobalSettings({ lastVaultPath: parsed.lastVaultPath ?? null })
      }
      return normalizeGlobalSettings(parsed)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('Failed to read global settings:', error)
      }
      return normalizeGlobalSettings({})
    }
  }

  async writeGlobal(next: GlobalSettings): Promise<void> {
    await this.writeJsonFile(this.globalSettingsPath, normalizeGlobalSettings(next))
  }

  async rememberVault(rootPath: string): Promise<GlobalSettings> {
    const next = rememberGlobalVault(await this.readGlobal(), rootPath)
    await this.writeGlobal(next)
    return next
  }

  async forgetVault(rootPath: string): Promise<GlobalSettings> {
    const next = forgetGlobalVault(await this.readGlobal(), rootPath)
    await this.writeGlobal(next)
    return next
  }

  async toggleFavoriteVault(rootPath: string): Promise<GlobalSettings> {
    const next = toggleFavoriteGlobalVault(await this.readGlobal(), rootPath)
    await this.writeGlobal(next)
    return next
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
        await this.rememberVault(legacy.lastVaultPath ?? vaultRoot)
        return migrated
      }

      const defaults = normalizeSettings({ lastVaultPath: vaultRoot })
      await this.persistVaultFiles(vaultRoot, defaults)
      return defaults
    }
  }

  async updateVault(vaultRoot: string, next: AppSettingsUpdate): Promise<AppSettings> {
    const current = await this.readVault(vaultRoot)
    const merged = normalizeSettings({
      ...current,
      ...next,
      profile: next.profile ? { ...current.profile, ...next.profile } : current.profile,
      ai: next.ai ? { ...current.ai, ...next.ai } : current.ai,
      lastVaultPath: vaultRoot
    })
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
