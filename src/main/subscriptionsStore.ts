import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { SubscriptionRecord } from '../shared/types'
import { getLegacyVaultSubscriptionsPath, getVaultSubscriptionsPath } from './vaultData'

function normalizeState(records: unknown): SubscriptionRecord[] {
  if (!Array.isArray(records)) {
    return []
  }
  return records.filter((record): record is SubscriptionRecord => Boolean(record))
}

export class SubscriptionsStore {
  private readonly filePath: string
  private readonly legacyFilePath: string

  constructor(vaultRoot: string) {
    this.filePath = getVaultSubscriptionsPath(vaultRoot)
    this.legacyFilePath = getLegacyVaultSubscriptionsPath(vaultRoot)
  }

  async read(): Promise<SubscriptionRecord[]> {
    const current = await this.readJsonFile(this.filePath)
    if (current) {
      return normalizeState(current)
    }

    const legacy = await this.readJsonFile(this.legacyFilePath)
    if (legacy) {
      const normalized = normalizeState(legacy)
      await this.write(normalized)
      return normalized
    }

    await this.write([])
    return []
  }

  async write(records: SubscriptionRecord[]): Promise<void> {
    const tempPath = `${this.filePath}.tmp-${process.pid}-${randomUUID()}`
    await fs.mkdir(path.dirname(this.filePath), { recursive: true })
    await fs.writeFile(tempPath, JSON.stringify(records, null, 2), 'utf-8')
    await fs.rename(tempPath, this.filePath)
  }

  async update(
    updater: (records: SubscriptionRecord[]) => SubscriptionRecord[]
  ): Promise<SubscriptionRecord[]> {
    const current = await this.read()
    const next = updater(current)
    await this.write(next)
    return next
  }

  private async readJsonFile(filePath: string): Promise<unknown[] | null> {
    try {
      const raw = await fs.readFile(filePath, 'utf-8')
      return JSON.parse(raw) as unknown[]
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('[SubscriptionsStore] Failed to read state', error)
      }
      return null
    }
  }
}
