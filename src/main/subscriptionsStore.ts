import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { SubscriptionRecord } from '../shared/types'
import {
  normalizeSubscriptionTagsWithDetails,
  SUBSCRIPTION_TAG_MAX_COUNT,
  SUBSCRIPTION_TAG_MAX_LENGTH
} from '../shared/subscriptions'
import {
  deleteLegacyVaultPath,
  getLegacyRootVaultSubscriptionsPath,
  getLegacySystemVaultSubscriptionsPath,
  getVaultSubscriptionsPath
} from './vaultData'

export interface SubscriptionStoreReadResult {
  records: SubscriptionRecord[]
  migrationWarnings: string[]
  changed: boolean
}

function normalizeState(records: unknown): SubscriptionStoreReadResult {
  if (!Array.isArray(records)) {
    return { records: [], migrationWarnings: [], changed: false }
  }

  const migrationWarnings: string[] = []
  let changed = false
  const normalizedRecords = records
    .filter((record): record is SubscriptionRecord => Boolean(record))
    .map((record) => {
      if (record.tags === undefined) return record
      const details = normalizeSubscriptionTagsWithDetails(record.tags)
      if (!details.changed) return record

      changed = true
      const removedCount = details.invalidCount + details.duplicateCount + details.overflowCount
      const changes: string[] = []
      if (details.canonicalizedCount > 0) {
        changes.push(
          `${details.canonicalizedCount} tag${details.canonicalizedCount === 1 ? '' : 's'} normalized`
        )
      }
      if (removedCount > 0) {
        changes.push(
          `${removedCount} invalid, duplicate, or over-limit tag${removedCount === 1 ? '' : 's'} removed`
        )
      }
      if (changes.length === 0) {
        changes.push('invalid tag data replaced')
      }
      migrationWarnings.push(
        `Subscription “${record.name}” migrated: ${changes.join('; ')}. Tags now use lowercase namespace-safe names (up to ${SUBSCRIPTION_TAG_MAX_COUNT} tags, ${SUBSCRIPTION_TAG_MAX_LENGTH} characters each).`
      )
      return { ...record, tags: details.tags }
    })

  return { records: normalizedRecords, migrationWarnings, changed }
}

export class SubscriptionsStore {
  private readonly vaultRoot: string
  private readonly filePath: string
  private readonly legacySystemFilePath: string

  constructor(vaultRoot: string) {
    this.vaultRoot = vaultRoot
    this.filePath = getVaultSubscriptionsPath(vaultRoot)
    this.legacySystemFilePath = getLegacySystemVaultSubscriptionsPath(vaultRoot)
  }

  async read(): Promise<SubscriptionStoreReadResult> {
    const current = await this.readJsonFile(this.filePath)
    if (current) {
      const normalized = normalizeState(current)
      if (normalized.changed) await this.write(normalized.records)
      return normalized
    }

    const legacyRoot = await this.readJsonFile(getLegacyRootVaultSubscriptionsPath(this.vaultRoot))
    if (legacyRoot) {
      const normalized = normalizeState(legacyRoot)
      await this.write(normalized.records)
      await this.cleanupLegacyFiles()
      return normalized
    }

    const legacy = await this.readJsonFile(this.legacySystemFilePath)
    if (legacy) {
      const normalized = normalizeState(legacy)
      await this.write(normalized.records)
      await this.cleanupLegacyFiles()
      return normalized
    }

    await this.write([])
    return { records: [], migrationWarnings: [], changed: false }
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
    const next = updater(current.records)
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

  private async cleanupLegacyFiles(): Promise<void> {
    await Promise.all([
      deleteLegacyVaultPath(getLegacyRootVaultSubscriptionsPath(this.vaultRoot), this.vaultRoot),
      deleteLegacyVaultPath(this.legacySystemFilePath, this.vaultRoot)
    ])
  }
}
