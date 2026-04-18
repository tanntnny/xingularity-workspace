import { randomUUID } from 'node:crypto'
import {
  applySubscriptionUpdate,
  buildSubscriptionRecord,
  deriveSubscriptionAnalytics
} from '../shared/subscriptions'
import type {
  CreateSubscriptionInput,
  Maybe,
  SubscriptionAnalytics,
  SubscriptionAnalyticsFilters,
  SubscriptionRecord,
  UpdateSubscriptionInput
} from '../shared/types'
import { SubscriptionsStore } from './subscriptionsStore'

export class SubscriptionsService {
  private store: SubscriptionsStore | null = null
  private mutationQueue: Promise<void> = Promise.resolve()

  handleVaultChange(vaultRoot: string | null): void {
    this.store = vaultRoot ? new SubscriptionsStore(vaultRoot) : null
  }

  async list(): Promise<SubscriptionRecord[]> {
    await this.mutationQueue
    const records = await this.assertStore().read()
    return records.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  }

  async get(id: string): Promise<Maybe<SubscriptionRecord>> {
    const records = await this.list()
    return records.find((record) => record.id === id) ?? null
  }

  async create(input: CreateSubscriptionInput): Promise<SubscriptionRecord> {
    return this.enqueueMutation(async () => {
      const nowIso = new Date().toISOString()
      const record = buildSubscriptionRecord(randomUUID(), input, nowIso)
      await this.assertStore().update((records) => [record, ...records])
      return record
    })
  }

  async update(input: UpdateSubscriptionInput): Promise<SubscriptionRecord> {
    return this.enqueueMutation(async () => {
      const nowIso = new Date().toISOString()
      let updatedRecord: SubscriptionRecord | null = null
      await this.assertStore().update((records) =>
        records.map((record) => {
          if (record.id !== input.id) {
            return record
          }
          updatedRecord = applySubscriptionUpdate(record, input, nowIso)
          return updatedRecord
        })
      )
      if (!updatedRecord) {
        throw new Error(`Subscription not found: ${input.id}`)
      }
      return updatedRecord
    })
  }

  async delete(id: string): Promise<void> {
    return this.enqueueMutation(async () => {
      let found = false
      await this.assertStore().update((records) =>
        records.filter((record) => {
          const keep = record.id !== id
          if (!keep) {
            found = true
          }
          return keep
        })
      )
      if (!found) {
        throw new Error(`Subscription not found: ${id}`)
      }
    })
  }

  async archive(id: string): Promise<SubscriptionRecord> {
    return this.update({ id, status: 'archived' })
  }

  async getAnalytics(filters: SubscriptionAnalyticsFilters = {}): Promise<SubscriptionAnalytics> {
    const records = await this.list()
    return deriveSubscriptionAnalytics(records, filters)
  }

  private assertStore(): SubscriptionsStore {
    if (!this.store) {
      throw new Error('No vault is open')
    }
    return this.store
  }

  private async enqueueMutation<T>(operation: () => Promise<T>): Promise<T> {
    const queued = this.mutationQueue.then(() => operation())
    this.mutationQueue = queued.then(
      () => undefined,
      () => undefined
    )
    return queued
  }
}
