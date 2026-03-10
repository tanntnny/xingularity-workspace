import { app } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import { AppSettings } from '../shared/types'

function createDefaultSettings(): AppSettings {
  return {
    isSidebarCollapsed: false,
    lastVaultPath: null,
    fontFamily: "'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', Palatino, serif",
    calendarTasks: [],
    projectIcons: {},
    projects: [],
    uiTransparency: 0.96,
    uiBlur: 6
  }
}

export class SettingsStore {
  private readonly settingsPath: string

  constructor() {
    this.settingsPath = path.join(app.getPath('userData'), 'settings.json')
  }

  async read(): Promise<AppSettings> {
    let raw: string
    try {
      raw = await fs.readFile(this.settingsPath, 'utf-8')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('Failed to read settings file:', error)
      }
      return createDefaultSettings()
    }

    try {
      const parsed = JSON.parse(raw) as Partial<AppSettings>
      return {
        ...createDefaultSettings(),
        ...parsed
      }
    } catch (error) {
      const backupPath = `${this.settingsPath}.corrupt-${Date.now()}.json`
      console.error('Settings file is invalid JSON. Backing up and resetting defaults.', {
        settingsPath: this.settingsPath,
        backupPath,
        error
      })

      try {
        await fs.copyFile(this.settingsPath, backupPath)
      } catch (copyError) {
        console.error('Failed to back up corrupt settings file:', copyError)
      }

      const defaults = createDefaultSettings()
      await this.write(defaults)
      return defaults
    }
  }

  async write(next: AppSettings): Promise<void> {
    const settingsDir = path.dirname(this.settingsPath)
    const tempPath = `${this.settingsPath}.tmp-${process.pid}-${Date.now()}`
    await fs.mkdir(settingsDir, { recursive: true })
    await fs.writeFile(tempPath, JSON.stringify(next, null, 2), 'utf-8')
    await fs.rename(tempPath, this.settingsPath)
  }
}
