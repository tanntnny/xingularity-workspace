import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { WeeklyPlanState } from '../../shared/types'
import {
  deleteLegacyVaultPath,
  getLegacyRootVaultWeeklyPlanPath,
  getLegacySystemVaultWeeklyPlanPath,
  getVaultWeeklyPlanPath
} from '../vaultData'

function defaultState(): WeeklyPlanState {
  return {
    weeks: [],
    priorities: [],
    reviews: []
  }
}

function normalizeState(parsed: Partial<WeeklyPlanState>): WeeklyPlanState {
  const fallback = defaultState()
  return {
    weeks: Array.isArray(parsed.weeks) ? parsed.weeks : fallback.weeks,
    priorities: Array.isArray(parsed.priorities) ? parsed.priorities : fallback.priorities,
    reviews: Array.isArray(parsed.reviews) ? parsed.reviews : fallback.reviews
  }
}

export class WeeklyPlanStore {
  private readonly vaultRoot: string
  private readonly filePath: string
  private readonly legacyRootFilePath: string
  private readonly legacySystemFilePath: string

  constructor(vaultRoot: string) {
    this.vaultRoot = vaultRoot
    this.filePath = getVaultWeeklyPlanPath(vaultRoot)
    this.legacyRootFilePath = getLegacyRootVaultWeeklyPlanPath(vaultRoot)
    this.legacySystemFilePath = getLegacySystemVaultWeeklyPlanPath(vaultRoot)
  }

  async read(): Promise<WeeklyPlanState> {
    const migrated = await this.readJsonFile(this.filePath)
    if (migrated) {
      return normalizeState(migrated)
    }

    const legacy = await this.readJsonFile(this.legacyRootFilePath)
    if (legacy) {
      const normalized = normalizeState(legacy)
      await this.write(normalized)
      await this.cleanupLegacyFiles()
      return normalized
    }

    const legacySystem = await this.readJsonFile(this.legacySystemFilePath)
    if (legacySystem) {
      const normalized = normalizeState(legacySystem)
      await this.write(normalized)
      await this.cleanupLegacyFiles()
      return normalized
    }

    const defaults = defaultState()
    await this.write(defaults)
    return defaults
  }

  async write(state: WeeklyPlanState): Promise<void> {
    const tempPath = `${this.filePath}.tmp-${process.pid}-${randomUUID()}`
    await fs.mkdir(path.dirname(this.filePath), { recursive: true })
    await fs.writeFile(tempPath, JSON.stringify(state, null, 2), 'utf-8')
    await fs.rename(tempPath, this.filePath)
  }

  async update(updater: (state: WeeklyPlanState) => WeeklyPlanState): Promise<WeeklyPlanState> {
    const current = await this.read()
    const next = updater(current)
    await this.write(next)
    return next
  }

  private async readJsonFile(filePath: string): Promise<Partial<WeeklyPlanState> | null> {
    try {
      const raw = await fs.readFile(filePath, 'utf-8')
      return JSON.parse(raw) as Partial<WeeklyPlanState>
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('[WeeklyPlanStore] Failed to read state', error)
      }
      return null
    }
  }

  private async cleanupLegacyFiles(): Promise<void> {
    await Promise.all([
      deleteLegacyVaultPath(this.legacyRootFilePath, this.vaultRoot),
      deleteLegacyVaultPath(this.legacySystemFilePath, this.vaultRoot)
    ])
  }
}
