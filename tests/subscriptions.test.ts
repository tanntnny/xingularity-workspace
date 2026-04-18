import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  applySubscriptionUpdate,
  buildSubscriptionRecord,
  deriveSubscriptionAnalytics,
  getBillingIntervalMonths,
  normalizeMonthlyAmount
} from '../src/shared/subscriptions'
import { SubscriptionsService } from '../src/main/subscriptionsService'

const tempRoots: string[] = []

function trackTempRoot(root: string): string {
  tempRoots.push(root)
  return root
}

afterEach(async () => {
  await Promise.all(
    tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))
  )
})

describe('subscription helpers', () => {
  it('normalizes billing intervals and monthly amounts', () => {
    expect(getBillingIntervalMonths('monthly')).toBe(1)
    expect(getBillingIntervalMonths('quarterly')).toBe(3)
    expect(getBillingIntervalMonths('yearly')).toBe(12)
    expect(getBillingIntervalMonths('custom', 6)).toBe(6)
    expect(normalizeMonthlyAmount(120, 12)).toBe(10)
  })

  it('derives analytics from active records and review flags', () => {
    const records = [
      buildSubscriptionRecord(
        'sub-chatgpt',
        {
          name: 'ChatGPT',
          category: 'AI',
          amount: 20,
          currency: 'USD',
          billingCycle: 'monthly',
          status: 'active',
          nextRenewalAt: '2099-04-18',
          reviewFlag: 'none'
        },
        '2026-04-06T00:00:00.000Z'
      ),
      buildSubscriptionRecord(
        'sub-vercel',
        {
          name: 'Vercel',
          category: 'Developer Tools',
          amount: 120,
          currency: 'USD',
          billingCycle: 'yearly',
          status: 'active',
          nextRenewalAt: '2026-04-15',
          reviewFlag: 'expensive'
        },
        '2026-04-06T00:00:00.000Z'
      ),
      buildSubscriptionRecord(
        'sub-archive',
        {
          name: 'Legacy Tool',
          category: 'Ops',
          amount: 18,
          currency: 'USD',
          billingCycle: 'monthly',
          status: 'archived',
          reviewFlag: 'unused'
        },
        '2026-04-06T00:00:00.000Z'
      )
    ]

    const analytics = deriveSubscriptionAnalytics(
      records,
      { includeArchived: false },
      new Date('2026-04-06T00:00:00.000Z')
    )

    expect(analytics.totalMonthlyRecurring).toBe(30)
    expect(analytics.totalYearlyRecurring).toBe(360)
    expect(analytics.renewingSoonCount).toBe(1)
    expect(analytics.reviewCount).toBe(1)
    expect(analytics.potentialSavingsMonthly).toBe(10)
    expect(analytics.treemapNodes).toHaveLength(2)
  })

  it('recomputes normalized monthly amount when billing fields change', () => {
    const current = buildSubscriptionRecord(
      'sub-1',
      {
        name: 'Tool',
        category: 'AI',
        amount: 120,
        currency: 'USD',
        billingCycle: 'yearly',
        status: 'active'
      },
      '2026-04-06T00:00:00.000Z'
    )

    const updated = applySubscriptionUpdate(
      current,
      {
        id: current.id,
        amount: 24,
        billingCycle: 'monthly'
      },
      '2026-04-07T00:00:00.000Z'
    )

    expect(updated.billingIntervalMonths).toBe(1)
    expect(updated.normalizedMonthlyAmount).toBe(24)
    expect(updated.updatedAt).toBe('2026-04-07T00:00:00.000Z')
  })
})

describe('SubscriptionsService', () => {
  it('persists subscriptions in the vault app directory and archives records', async () => {
    const vaultRoot = trackTempRoot(
      await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-subscriptions-'))
    )
    await fs.mkdir(path.join(vaultRoot, 'notes'), { recursive: true })
    await fs.mkdir(path.join(vaultRoot, 'attachments'), { recursive: true })

    const service = new SubscriptionsService()
    service.handleVaultChange(vaultRoot)

    const created = await service.create({
      name: 'Raycast Pro',
      provider: 'Raycast',
      category: 'Developer Tools',
      amount: 96,
      currency: 'USD',
      billingCycle: 'yearly',
      status: 'active',
      reviewFlag: 'review'
    })

    expect(created.normalizedMonthlyAmount).toBe(8)

    const archived = await service.archive(created.id)
    expect(archived.status).toBe('archived')

    const analytics = await service.getAnalytics()
    expect(analytics.totalMonthlyRecurring).toBe(0)
    expect(analytics.reviewCount).toBe(0)

    const persistedRaw = await fs.readFile(
      path.join(vaultRoot, '.xingularity', 'subscriptions.json'),
      'utf-8'
    )
    const persisted = JSON.parse(persistedRaw) as Array<{ id: string; status: string }>

    expect(persisted).toHaveLength(1)
    expect(persisted[0]).toMatchObject({
      id: created.id,
      status: 'archived'
    })
  })
})
