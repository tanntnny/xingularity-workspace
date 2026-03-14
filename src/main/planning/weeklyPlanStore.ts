import fs from 'node:fs/promises'
import path from 'node:path'
import { WeeklyPlanState } from '../../shared/types'
import { ensureVaultAppDir, getVaultAppDir } from '../vaultData'

const FILE_NAME = 'weekly-plan.json'

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

  constructor(vaultRoot: string) {
    this.vaultRoot = vaultRoot
    this.filePath = path.join(getVaultAppDir(vaultRoot), FILE_NAME)
  }

  async read(): Promise<WeeklyPlanState> {
    await ensureVaultAppDir(this.vaultRoot)
    try {
      const raw = await fs.readFile(this.filePath, 'utf-8')
      return normalizeState(JSON.parse(raw) as Partial<WeeklyPlanState>)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('[WeeklyPlanStore] Failed to read state', error)
      }
      const defaults = defaultState()
      await this.write(defaults)
      return defaults
    }
  }

  async write(state: WeeklyPlanState): Promise<void> {
    await ensureVaultAppDir(this.vaultRoot)
    const tempPath = `${this.filePath}.tmp-${process.pid}-${Date.now()}`
    await fs.writeFile(tempPath, JSON.stringify(state, null, 2), 'utf-8')
    await fs.rename(tempPath, this.filePath)
  }

  async update(updater: (state: WeeklyPlanState) => WeeklyPlanState): Promise<WeeklyPlanState> {
    const current = await this.read()
    const next = updater(current)
    await this.write(next)
    return next
  }
}
