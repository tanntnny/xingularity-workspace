import type {
  CreateSubscriptionInput,
  SubscriptionRecord,
  SubscriptionReviewFlag,
  SubscriptionStatus
} from '../../../shared/types'

export interface SubscriptionDraft {
  id?: string
  name: string
  provider: string
  category: string
  amount: string
  billingCycle: CreateSubscriptionInput['billingCycle']
  billingIntervalMonths: string
  nextRenewalAt: string
  renewalReminderDays: string
  cancellationUrl: string
  cancellationContact: string
  usageReviewState: NonNullable<SubscriptionRecord['usageReviewState']>
  status: SubscriptionStatus
  reviewFlag: SubscriptionReviewFlag
  lastUsedAt: string
  tags: string[]
  notes: string
}

export interface SubscriptionWorkspaceSession {
  selectedId: string | null
  draft: SubscriptionDraft
  isDrawerOpen: boolean
}

export function createEmptySubscriptionDraft(): SubscriptionDraft {
  return {
    name: '',
    provider: '',
    category: '',
    amount: '',
    billingCycle: 'monthly',
    billingIntervalMonths: '1',
    nextRenewalAt: '',
    renewalReminderDays: '7, 1',
    cancellationUrl: '',
    cancellationContact: '',
    usageReviewState: 'not-reviewed',
    status: 'active',
    reviewFlag: 'none',
    lastUsedAt: '',
    tags: [],
    notes: ''
  }
}

export function createEmptySubscriptionWorkspaceSession(): SubscriptionWorkspaceSession {
  return {
    selectedId: null,
    draft: createEmptySubscriptionDraft(),
    isDrawerOpen: false
  }
}
