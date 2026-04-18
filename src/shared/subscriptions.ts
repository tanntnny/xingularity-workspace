import type {
  CreateSubscriptionInput,
  SubscriptionAnalytics,
  SubscriptionAnalyticsFilters,
  SubscriptionBillingCycle,
  SubscriptionRecord,
  SubscriptionReviewFlag,
  SubscriptionStatus,
  UpdateSubscriptionInput
} from './types'

const ACTIVE_SPEND_STATUSES: SubscriptionStatus[] = ['active']
const REVIEW_FLAGS_WITH_SAVINGS: SubscriptionReviewFlag[] = [
  'review',
  'unused',
  'duplicate',
  'expensive'
]

function normalizeString(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

export function getBillingIntervalMonths(
  billingCycle: SubscriptionBillingCycle,
  explicitMonths?: number | null
): number {
  if (billingCycle === 'custom') {
    return Math.max(1, Math.round(explicitMonths ?? 1))
  }
  if (billingCycle === 'quarterly') {
    return 3
  }
  if (billingCycle === 'yearly') {
    return 12
  }
  return 1
}

export function normalizeMonthlyAmount(amount: number, billingIntervalMonths: number): number {
  const safeAmount = Number.isFinite(amount) ? Math.max(0, amount) : 0
  const safeMonths = Math.max(1, Math.round(billingIntervalMonths))
  return Number((safeAmount / safeMonths).toFixed(2))
}

export function buildSubscriptionRecord(
  id: string,
  input: CreateSubscriptionInput,
  nowIso: string
): SubscriptionRecord {
  const billingIntervalMonths = getBillingIntervalMonths(
    input.billingCycle,
    input.billingIntervalMonths
  )

  return {
    id,
    name: input.name.trim(),
    provider: normalizeString(input.provider),
    category: input.category.trim(),
    amount: Math.max(0, input.amount),
    currency: input.currency.trim().toUpperCase(),
    billingCycle: input.billingCycle,
    billingIntervalMonths,
    normalizedMonthlyAmount: normalizeMonthlyAmount(input.amount, billingIntervalMonths),
    nextRenewalAt: normalizeString(input.nextRenewalAt),
    status: input.status,
    reviewFlag: input.reviewFlag ?? 'none',
    lastUsedAt: normalizeString(input.lastUsedAt),
    tags: input.tags?.map((tag) => tag.trim()).filter(Boolean) ?? [],
    notes: normalizeString(input.notes),
    createdAt: nowIso,
    updatedAt: nowIso
  }
}

export function applySubscriptionUpdate(
  current: SubscriptionRecord,
  patch: UpdateSubscriptionInput,
  nowIso: string
): SubscriptionRecord {
  const billingCycle = patch.billingCycle ?? current.billingCycle
  const amount = patch.amount ?? current.amount
  const billingIntervalMonths = getBillingIntervalMonths(
    billingCycle,
    patch.billingIntervalMonths ?? current.billingIntervalMonths
  )

  return {
    ...current,
    name: patch.name?.trim() ? patch.name.trim() : current.name,
    provider:
      patch.provider === null
        ? undefined
        : patch.provider !== undefined
          ? normalizeString(patch.provider)
          : current.provider,
    category: patch.category?.trim() ? patch.category.trim() : current.category,
    amount: Math.max(0, amount),
    currency: patch.currency?.trim() ? patch.currency.trim().toUpperCase() : current.currency,
    billingCycle,
    billingIntervalMonths,
    normalizedMonthlyAmount: normalizeMonthlyAmount(amount, billingIntervalMonths),
    nextRenewalAt:
      patch.nextRenewalAt === null
        ? undefined
        : patch.nextRenewalAt !== undefined
          ? normalizeString(patch.nextRenewalAt)
          : current.nextRenewalAt,
    status: patch.status ?? current.status,
    reviewFlag: patch.reviewFlag ?? current.reviewFlag ?? 'none',
    lastUsedAt:
      patch.lastUsedAt === null
        ? undefined
        : patch.lastUsedAt !== undefined
          ? normalizeString(patch.lastUsedAt)
          : current.lastUsedAt,
    tags:
      patch.tags === undefined ? current.tags : patch.tags.map((tag) => tag.trim()).filter(Boolean),
    notes:
      patch.notes === null
        ? undefined
        : patch.notes !== undefined
          ? normalizeString(patch.notes)
          : current.notes,
    updatedAt: nowIso
  }
}

export function getRenewalBucket(
  nextRenewalAt: string | undefined,
  now = new Date()
): 'soon' | 'later' | undefined {
  if (!nextRenewalAt) {
    return undefined
  }

  const renewal = new Date(nextRenewalAt)
  const diffMs = renewal.getTime() - now.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  return diffDays <= 30 ? 'soon' : 'later'
}

export function matchesSubscriptionFilters(
  record: SubscriptionRecord,
  filters: SubscriptionAnalyticsFilters = {}
): boolean {
  if (!filters.includeArchived && record.status === 'archived') {
    return false
  }

  if (filters.statuses?.length && !filters.statuses.includes(record.status)) {
    return false
  }

  if (filters.categories?.length && !filters.categories.includes(record.category)) {
    return false
  }

  if (filters.search?.trim()) {
    const query = filters.search.trim().toLowerCase()
    const haystack = [
      record.name,
      record.provider ?? '',
      record.category,
      record.notes ?? '',
      ...(record.tags ?? [])
    ]
      .join(' ')
      .toLowerCase()

    if (!haystack.includes(query)) {
      return false
    }
  }

  return true
}

export function deriveSubscriptionAnalytics(
  records: SubscriptionRecord[],
  filters: SubscriptionAnalyticsFilters = {},
  now = new Date()
): SubscriptionAnalytics {
  const filtered = records.filter((record) => matchesSubscriptionFilters(record, filters))
  const activeSpendRecords = filtered.filter((record) =>
    ACTIVE_SPEND_STATUSES.includes(record.status)
  )
  const renewingSoon = activeSpendRecords.filter(
    (record) => getRenewalBucket(record.nextRenewalAt, now) === 'soon'
  )
  const reviewRecords = filtered.filter((record) => (record.reviewFlag ?? 'none') !== 'none')
  const potentialSavings = filtered.filter((record) =>
    REVIEW_FLAGS_WITH_SAVINGS.includes(record.reviewFlag ?? 'none')
  )

  return {
    totalMonthlyRecurring: Number(
      activeSpendRecords.reduce((sum, record) => sum + record.normalizedMonthlyAmount, 0).toFixed(2)
    ),
    totalYearlyRecurring: Number(
      activeSpendRecords
        .reduce((sum, record) => sum + record.normalizedMonthlyAmount * 12, 0)
        .toFixed(2)
    ),
    renewingSoonCount: renewingSoon.length,
    renewingSoonAmount: Number(
      renewingSoon.reduce((sum, record) => sum + record.normalizedMonthlyAmount, 0).toFixed(2)
    ),
    reviewCount: reviewRecords.length,
    potentialSavingsMonthly: Number(
      potentialSavings.reduce((sum, record) => sum + record.normalizedMonthlyAmount, 0).toFixed(2)
    ),
    treemapNodes: activeSpendRecords.map((record) => ({
      id: record.id,
      name: record.name,
      value: record.normalizedMonthlyAmount,
      category: record.category,
      status: record.status,
      reviewFlag: record.reviewFlag ?? 'none',
      renewalBucket: getRenewalBucket(record.nextRenewalAt, now)
    }))
  }
}
