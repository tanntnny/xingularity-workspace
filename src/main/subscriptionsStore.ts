import fs from 'node:fs/promises'
import path from 'node:path'
import type { SubscriptionRecord } from '../shared/types'
import { ensureVaultAppDir, getVaultAppDir } from './vaultData'

const FILE_NAME = 'subscriptions.json'

function normalizeState(records: unknown): SubscriptionRecord[] {
  if (!Array.isArray(records)) {
    return []
  }
  return records.filter((record): record is SubscriptionRecord => Boolean(record))
}

export class SubscriptionsStore {
  private readonly vaultRoot: string
  private readonly filePath: string

  constructor(vaultRoot: string) {
    this.vaultRoot = vaultRoot
    this.filePath = path.join(getVaultAppDir(vaultRoot), FILE_NAME)
  }

  async read(): Promise<SubscriptionRecord[]> {
    await ensureVaultAppDir(this.vaultRoot)
    try {
      const raw = await fs.readFile(this.filePath, 'utf-8')
      return normalizeState(JSON.parse(raw))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('[SubscriptionsStore] Failed to read state', error)
      }
      await this.write([])
      return []
    }
  }

  async write(records: SubscriptionRecord[]): Promise<void> {
    await ensureVaultAppDir(this.vaultRoot)
    const tempPath = `${this.filePath}.tmp-${process.pid}-${Date.now()}`
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
}
