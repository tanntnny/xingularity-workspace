import { app } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import { AppSettings, AppSettingsUpdate } from '../shared/types'
import { ensureVaultAppDir } from './vaultData'

interface GlobalSettings {
  lastVaultPath: string | null
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
    calendarTasks: [],
    projectIcons: {},
    projects: []
  }
}

function normalizeSettings(parsed: Partial<AppSettings>): AppSettings {
  const defaults = createDefaultAppSettings()
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
    calendarTasks: Array.isArray(parsed.calendarTasks)
      ? parsed.calendarTasks
      : defaults.calendarTasks,
    projectIcons: parsed.projectIcons ?? defaults.projectIcons,
    projects: Array.isArray(parsed.projects) ? parsed.projects : defaults.projects,
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

function isLegacyAppSettings(value: unknown): value is AppSettings {
  return (
    typeof value === 'object' && value !== null && 'calendarTasks' in value && 'projects' in value
  )
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
    const settingsPath = await this.ensureVaultSettingsPath(vaultRoot)

    try {
      const raw = await fs.readFile(settingsPath, 'utf-8')
      const parsed = JSON.parse(raw) as Partial<AppSettings>
      return normalizeSettings({ ...parsed, lastVaultPath: vaultRoot })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('Failed to read vault settings:', error)
      }

      // Try migrating from legacy global file
      const legacy = await this.readLegacyAppSettings()
      if (legacy) {
        const migrated = normalizeSettings({ ...legacy, lastVaultPath: vaultRoot })
        await this.writeJsonFile(settingsPath, migrated)
        await this.writeGlobal({ lastVaultPath: legacy.lastVaultPath ?? vaultRoot })
        return migrated
      }

      const defaults = normalizeSettings({ lastVaultPath: vaultRoot })
      await this.writeJsonFile(settingsPath, defaults)
      return defaults
    }
  }

  async updateVault(vaultRoot: string, next: AppSettingsUpdate): Promise<AppSettings> {
    const current = await this.readVault(vaultRoot)
    const merged = normalizeSettings({ ...current, ...next, lastVaultPath: vaultRoot })
    const settingsPath = await this.ensureVaultSettingsPath(vaultRoot)
    await this.writeJsonFile(settingsPath, merged)
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

  private async ensureVaultSettingsPath(vaultRoot: string): Promise<string> {
    const dir = await ensureVaultAppDir(vaultRoot)
    return path.join(dir, 'settings.json')
  }

  private async writeJsonFile(filePath: string, data: unknown): Promise<void> {
    const dir = path.dirname(filePath)
    const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf-8')
    await fs.rename(tempPath, filePath)
  }
}
