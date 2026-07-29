import { app } from 'electron'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { normalizeProjectIcon } from '../shared/projectIcons'
import {
  AppSettings,
  AppSettingsUpdate,
  CalendarTask,
  NOTE_VIM_MAPPING_ACTION_VALUES,
  NOTE_VIM_MAPPING_MODE_VALUES,
  NoteVimKeyMapping,
  Project,
  ProjectMilestone,
  ProjectSubtask
} from '../shared/types'
import {
  deleteLegacyVaultPath,
  getLegacyRootVaultCalendarTasksPath,
  getLegacySystemVaultCalendarTasksPath,
  getLegacyVaultSettingsPath,
  getVaultCalendarTasksPath,
  getVaultSettingsPath
} from './vaultData'
import { ProjectStore } from './projectStore'

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

interface LegacyVaultTasksData {
  calendarTasks: CalendarTask[]
}

function isNoteVimMappingMode(value: unknown): value is NoteVimKeyMapping['mode'] {
  return NOTE_VIM_MAPPING_MODE_VALUES.includes(value as NoteVimKeyMapping['mode'])
}

function isNoteVimMappingAction(value: unknown): value is NoteVimKeyMapping['action'] {
  return NOTE_VIM_MAPPING_ACTION_VALUES.includes(value as NoteVimKeyMapping['action'])
}

function isValidNoteVimSequence(value: string): boolean {
  return value.trim().length > 0 && value.length <= 8 && /^[\x20-\x7E]+$/.test(value)
}

function normalizeEditorVimKeyMappings(value: unknown): NoteVimKeyMapping[] {
  if (!Array.isArray(value)) {
    return []
  }

  const seen = new Set<string>()
  const mappings: NoteVimKeyMapping[] = []

  for (const item of value) {
    if (!item || typeof item !== 'object') {
      continue
    }

    const candidate = item as Partial<NoteVimKeyMapping>
    const id = typeof candidate.id === 'string' && candidate.id.trim() ? candidate.id : randomUUID()
    const sequence = typeof candidate.sequence === 'string' ? candidate.sequence : ''

    if (
      !isNoteVimMappingMode(candidate.mode) ||
      !isNoteVimMappingAction(candidate.action) ||
      !isValidNoteVimSequence(sequence)
    ) {
      continue
    }

    const key = `${candidate.mode}:${sequence}`
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    mappings.push({
      id,
      mode: candidate.mode,
      sequence,
      action: candidate.action
    })
  }

  return mappings
}

function hasLegacyAppearanceSettings(value: unknown): boolean {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Record<string, unknown>
  const profile = candidate.profile

  return (
    Object.hasOwn(candidate, 'performanceModeEnabled') ||
    Object.hasOwn(candidate, 'workspaceVibrancyEnabled') ||
    (profile !== null && typeof profile === 'object' && Object.hasOwn(profile, 'color'))
  )
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
    editorVimModeEnabled: false,
    editorVimKeyMappings: [],
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
  const sanitizedParsed = { ...(parsed as Partial<AppSettings> & Record<string, unknown>) }
  delete sanitizedParsed.performanceModeEnabled
  delete sanitizedParsed.workspaceVibrancyEnabled

  if (sanitizedParsed.profile && typeof sanitizedParsed.profile === 'object') {
    const sanitizedProfile = { ...(sanitizedParsed.profile as Record<string, unknown>) }
    delete sanitizedProfile.color
    sanitizedParsed.profile = sanitizedProfile as AppSettings['profile']
  }

  const parsedProfile = sanitizedParsed.profile as Partial<AppSettings['profile']> | undefined

  return {
    ...defaults,
    ...sanitizedParsed,
    profile: {
      name:
        typeof parsedProfile?.name === 'string' && parsedProfile.name.trim().length > 0
          ? parsedProfile.name
          : defaults.profile.name
    },
    ai: {
      mistralApiKey:
        typeof parsed.ai?.mistralApiKey === 'string'
          ? parsed.ai.mistralApiKey
          : defaults.ai.mistralApiKey
    },
    editorVimModeEnabled:
      typeof parsed.editorVimModeEnabled === 'boolean'
        ? parsed.editorVimModeEnabled
        : defaults.editorVimModeEnabled,
    editorVimKeyMappings: normalizeEditorVimKeyMappings(parsed.editorVimKeyMappings),
    calendarTasks: Array.isArray(parsed.calendarTasks)
      ? parsed.calendarTasks
      : defaults.calendarTasks,
    projectIcons: normalizeProjectIcons(parsed.projectIcons),
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
      icon: normalizeProjectIcon(
        candidate.icon && typeof candidate.icon === 'object'
          ? (candidate.icon as Partial<Project['icon']>)
          : null,
        name
      )
    }
  ]
}

function normalizeProjectIcons(
  input: Record<string, AppSettings['projectIcons'][string]> | null | undefined
): AppSettings['projectIcons'] {
  if (!input || typeof input !== 'object') {
    return {}
  }

  return Object.fromEntries(
    Object.entries(input)
      .filter(([projectId]) => projectId.trim().length > 0)
      .map(([projectId, icon]) => [projectId, normalizeProjectIcon(icon, projectId)])
  )
}

function applyProjectIconCompatibility(settings: AppSettings, input: unknown): AppSettings {
  const legacyIcons =
    input && typeof input === 'object' && !Array.isArray(input)
      ? normalizeProjectIcons(input as Record<string, AppSettings['projectIcons'][string]>)
      : {}
  const projects = settings.projects.map((project) => {
    const legacyIcon = legacyIcons[project.id]
    return legacyIcon ? { ...project, icon: legacyIcon } : project
  })

  return {
    ...settings,
    projects,
    projectIcons: Object.fromEntries(projects.map((project) => [project.id, project.icon]))
  }
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

function clearRememberedGlobalVault(settings: GlobalSettings, rootPath: string): GlobalSettings {
  const nextRootPath = path.resolve(rootPath)

  if (settings.lastVaultPath !== nextRootPath) {
    return settings
  }

  return normalizeGlobalSettings({
    lastVaultPath: null,
    savedVaults: settings.savedVaults
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

function hasMaterialCoreSettingsData(settings: VaultCoreSettings | null): boolean {
  if (!settings) {
    return false
  }

  if (typeof settings.lastOpenedNotePath === 'string' && settings.lastOpenedNotePath.trim()) {
    return true
  }

  if (typeof settings.lastOpenedProjectId === 'string' && settings.lastOpenedProjectId.trim()) {
    return true
  }

  if (Array.isArray(settings.favoriteNotePaths) && settings.favoriteNotePaths.length > 0) {
    return true
  }

  if (Array.isArray(settings.favoriteProjectIds) && settings.favoriteProjectIds.length > 0) {
    return true
  }

  if (typeof settings.profile?.name === 'string' && settings.profile.name.trim()) {
    return true
  }

  if (Array.isArray(settings.gridBoard?.items) && settings.gridBoard.items.length > 0) {
    return true
  }

  return false
}

function hasMaterialProjectsData(projects: Project[] | null | undefined): boolean {
  return Boolean(projects && Array.isArray(projects) && projects.length > 0)
}

function hasMaterialProjectIconsData(
  projectIcons: AppSettings['projectIcons'] | null | undefined
): boolean {
  return Boolean(projectIcons && Object.keys(projectIcons).length > 0)
}

function hasMaterialTasksData(tasks: CalendarTask[] | null | undefined): boolean {
  return Boolean(tasks && Array.isArray(tasks) && tasks.length > 0)
}

function resolvePreferredData<T>(
  current: T | null,
  legacy: T | undefined,
  hasMaterial: (value: T | null | undefined) => boolean
): T | undefined {
  if (current === null) {
    return legacy
  }

  if (!hasMaterial(current) && hasMaterial(legacy)) {
    return legacy ?? current
  }

  return current
}

function resolveLegacyTasksData(
  rootTasks: CalendarTask[] | null,
  systemTasks: LegacyVaultTasksData | null
): CalendarTask[] | undefined {
  if (
    rootTasks === null ||
    (!hasMaterialTasksData(rootTasks) && hasMaterialTasksData(systemTasks?.calendarTasks))
  ) {
    return systemTasks?.calendarTasks ?? rootTasks ?? undefined
  }

  return rootTasks
}

export class SettingsStore {
  private readonly globalSettingsPath: string

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

  async clearRememberedVault(rootPath: string): Promise<GlobalSettings> {
    const next = clearRememberedGlobalVault(await this.readGlobal(), rootPath)
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
    const settingsPath = getVaultSettingsPath(vaultRoot)
    const legacySettingsPath = getLegacyVaultSettingsPath(vaultRoot)
    const tasksPath = getVaultCalendarTasksPath(vaultRoot)
    const legacyRootTasksPath = getLegacyRootVaultCalendarTasksPath(vaultRoot)
    const legacySystemTasksPath = getLegacySystemVaultCalendarTasksPath(vaultRoot)
    const projectStore = new ProjectStore(vaultRoot)

    try {
      const [
        coreParsed,
        legacyCoreParsed,
        projectStorage,
        tasksData,
        legacyRootTasksData,
        legacySystemTasksData
      ] = await Promise.all([
        this.readJsonFile<VaultCoreSettings>(settingsPath),
        this.readJsonFile<VaultCoreSettings>(legacySettingsPath),
        projectStore.read(),
        this.readJsonFile<CalendarTask[]>(tasksPath),
        this.readJsonFile<CalendarTask[]>(legacyRootTasksPath),
        this.readJsonFile<LegacyVaultTasksData>(legacySystemTasksPath)
      ])

      const resolvedCore =
        coreParsed === null ||
        (!hasMaterialCoreSettingsData(coreParsed) && hasMaterialCoreSettingsData(legacyCoreParsed))
          ? (legacyCoreParsed ?? coreParsed)
          : coreParsed

      const resolvedProjects = resolvePreferredData(
        projectStorage.canonicalFiles || projectStorage.projects.length > 0
          ? projectStorage.projects
          : null,
        resolvedCore?.projects,
        hasMaterialProjectsData
      )
      const resolvedProjectIcons = resolvePreferredData(
        Object.keys(projectStorage.projectIcons).length > 0 ? projectStorage.projectIcons : null,
        resolvedCore?.projectIcons,
        hasMaterialProjectIconsData
      )
      const resolvedTasks = resolvePreferredData(
        tasksData,
        resolveLegacyTasksData(legacyRootTasksData, legacySystemTasksData) ??
          resolvedCore?.calendarTasks,
        hasMaterialTasksData
      )
      const needsSplitMigration =
        coreParsed === null ||
        tasksData === null ||
        legacyCoreParsed !== null ||
        !projectStorage.canonicalFiles ||
        legacyRootTasksData !== null ||
        legacySystemTasksData !== null ||
        hasLegacyAppearanceSettings(resolvedCore) ||
        resolvedCore !== coreParsed ||
        resolvedTasks !== tasksData ||
        Boolean(resolvedCore?.projects) ||
        Boolean(resolvedCore?.projectIcons) ||
        Boolean(resolvedCore?.calendarTasks)

      const normalized = normalizeSettings({
        ...(resolvedCore ?? {}),
        projects: resolvedProjects,
        projectIcons: resolvedProjectIcons,
        calendarTasks: resolvedTasks,
        lastVaultPath: vaultRoot
      })
      const merged = applyProjectIconCompatibility(normalized, resolvedProjectIcons)

      if (needsSplitMigration) {
        await this.persistVaultFiles(vaultRoot, merged)
        await this.cleanupLegacyVaultFiles(vaultRoot, projectStore)
      }
      return merged
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('Failed to read vault settings:', error)
      }

      // Try migrating from legacy global file
      const legacy = await this.readLegacyAppSettings()
      if (legacy) {
        const migrated = applyProjectIconCompatibility(
          normalizeSettings({ ...legacy, lastVaultPath: vaultRoot }),
          legacy.projectIcons
        )
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

  private async persistVaultFiles(vaultRoot: string, settings: AppSettings): Promise<void> {
    const corePath = getVaultSettingsPath(vaultRoot)
    const tasksPath = getVaultCalendarTasksPath(vaultRoot)
    const projectStore = new ProjectStore(vaultRoot)

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
      editorVimModeEnabled: settings.editorVimModeEnabled,
      editorVimKeyMappings: settings.editorVimKeyMappings,
      gridBoard: settings.gridBoard
    }

    await Promise.all([
      this.writeJsonFile(corePath, coreSettings),
      projectStore.writeAll(settings.projects),
      this.writeJsonFile(tasksPath, settings.calendarTasks)
    ])
  }

  private async cleanupLegacyVaultFiles(
    vaultRoot: string,
    projectStore = new ProjectStore(vaultRoot)
  ): Promise<void> {
    await Promise.all([
      deleteLegacyVaultPath(getLegacyVaultSettingsPath(vaultRoot), vaultRoot),
      projectStore.cleanupLegacyFiles(),
      deleteLegacyVaultPath(getLegacyRootVaultCalendarTasksPath(vaultRoot), vaultRoot),
      deleteLegacyVaultPath(getLegacySystemVaultCalendarTasksPath(vaultRoot), vaultRoot)
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
    const tempPath = `${filePath}.tmp-${process.pid}-${randomUUID()}`
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
