import { app } from 'electron'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { AgentRunRecord } from '../shared/types'
import {
  deleteLegacyVaultPath,
  getLegacyPageVaultAgentRunsPath,
  getLegacyVaultAgentRunsPath,
  getVaultAgentRunsPath
} from './vaultData'

const MAX_AGENT_RUNS = 200

export class AgentHistoryStore {
  private readonly vaultRoot: string
  private readonly runsPath: string
  private readonly legacyPageRunsPath: string
  private readonly legacyRunsPath: string
  private readonly deviceLegacyRunsPath: string

  constructor(vaultRoot: string) {
    this.vaultRoot = vaultRoot
    this.runsPath = getVaultAgentRunsPath(vaultRoot)
    this.legacyPageRunsPath = getLegacyPageVaultAgentRunsPath(vaultRoot)
    this.legacyRunsPath = getLegacyVaultAgentRunsPath(vaultRoot)
    this.deviceLegacyRunsPath = path.join(app.getPath('userData'), 'agent-runs.json')
  }

  async readRuns(): Promise<AgentRunRecord[]> {
    const runs = await this.readJsonFile<AgentRunRecord[]>(
      this.runsPath,
      [this.legacyPageRunsPath, this.legacyRunsPath, this.deviceLegacyRunsPath],
      []
    )
    return runs.sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  }

  async appendRun(run: AgentRunRecord): Promise<void> {
    const runs = await this.readRuns()
    runs.unshift(run)
    await this.writeJsonFile(this.runsPath, runs.slice(0, MAX_AGENT_RUNS))
  }

  private async readJsonFile<T>(filePath: string, legacyPaths: string[], fallback: T): Promise<T> {
    try {
      const raw = await fs.readFile(filePath, 'utf-8')
      return JSON.parse(raw) as T
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('Failed to read agent history store:', error)
      }

      for (const legacyPath of legacyPaths) {
        try {
          const legacyRaw = await fs.readFile(legacyPath, 'utf-8')
          const parsed = JSON.parse(legacyRaw) as T
          await this.writeJsonFile(filePath, parsed)
          if (legacyPath !== this.deviceLegacyRunsPath) {
            await this.cleanupLegacyFiles()
          }
          return parsed
        } catch (legacyError) {
          if ((legacyError as NodeJS.ErrnoException).code !== 'ENOENT') {
            console.error('Failed to read legacy agent history store:', legacyError)
          }
        }
      }

      return fallback
    }
  }

  private async writeJsonFile(filePath: string, data: unknown): Promise<void> {
    const dir = path.dirname(filePath)
    const tmp = `${filePath}.tmp-${process.pid}-${randomUUID()}`
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf-8')
    await fs.rename(tmp, filePath)
  }

  private async cleanupLegacyFiles(): Promise<void> {
    await Promise.all([
      deleteLegacyVaultPath(this.legacyPageRunsPath, this.vaultRoot),
      deleteLegacyVaultPath(this.legacyRunsPath, this.vaultRoot)
    ])
  }
}
