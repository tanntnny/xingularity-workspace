import { z } from 'zod'
import { SUBSCRIPTION_CHANNELS } from '../shared/ipc'
import { SUBSCRIPTION_TAG_MAX_COUNT, SUBSCRIPTION_TAG_MAX_LENGTH } from '../shared/subscriptions'
import { SubscriptionsService } from './subscriptionsService'
import { handleIpc } from './errorReporting'

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}(T.*)?$/)
const subscriptionStatusSchema = z.enum(['active', 'paused', 'cancelled', 'archived'])
const billingCycleSchema = z.enum(['monthly', 'quarterly', 'yearly', 'custom'])
const reviewFlagSchema = z.enum(['none', 'review', 'unused', 'duplicate', 'expensive'])
const reminderDaysSchema = z.array(z.number().int().min(1).max(365)).max(10).optional()

const createSubscriptionSchema = z.object({
  name: z.string().trim().min(1).max(200),
  provider: z.string().trim().max(200).optional(),
  category: z.string().trim().min(1).max(120),
  amount: z.number().finite().min(0),
  currency: z.string().trim().min(1).max(12),
  billingCycle: billingCycleSchema,
  billingIntervalMonths: z.number().int().min(1).max(120).optional(),
  nextRenewalAt: isoDateSchema.optional(),
  status: subscriptionStatusSchema,
  reviewFlag: reviewFlagSchema.optional(),
  lastUsedAt: isoDateSchema.optional(),
  tags: z
    .array(z.string().trim().min(1).max(SUBSCRIPTION_TAG_MAX_LENGTH))
    .max(SUBSCRIPTION_TAG_MAX_COUNT)
    .optional(),
  notes: z.string().trim().max(4000).optional(),
  renewalReminderDays: reminderDaysSchema,
  cancellationUrl: z.string().trim().url().max(1000).optional(),
  cancellationContact: z.string().trim().max(500).optional()
})

const updateSubscriptionSchema = z.object({
  id: z.string().min(1).max(200),
  name: z.string().trim().min(1).max(200).optional(),
  provider: z.string().trim().max(200).optional().nullable(),
  category: z.string().trim().min(1).max(120).optional(),
  amount: z.number().finite().min(0).optional(),
  currency: z.string().trim().min(1).max(12).optional(),
  billingCycle: billingCycleSchema.optional(),
  billingIntervalMonths: z.number().int().min(1).max(120).optional().nullable(),
  nextRenewalAt: isoDateSchema.optional().nullable(),
  status: subscriptionStatusSchema.optional(),
  reviewFlag: reviewFlagSchema.optional(),
  lastUsedAt: isoDateSchema.optional().nullable(),
  tags: z
    .array(z.string().trim().min(1).max(SUBSCRIPTION_TAG_MAX_LENGTH))
    .max(SUBSCRIPTION_TAG_MAX_COUNT)
    .optional(),
  notes: z.string().trim().max(4000).optional().nullable(),
  renewalReminderDays: reminderDaysSchema,
  calendarEventId: z.string().trim().max(200).optional().nullable(),
  cancellationUrl: z.string().trim().url().max(1000).optional().nullable(),
  cancellationContact: z.string().trim().max(500).optional().nullable(),
  usageReviewState: z.enum(['not-reviewed', 'keep', 'cancel', 'snooze']).optional()
})

const analyticsFiltersSchema = z
  .object({
    search: z.string().trim().max(200).optional(),
    categories: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
    statuses: z.array(subscriptionStatusSchema).max(10).optional(),
    includeArchived: z.boolean().optional()
  })
  .optional()

export function registerSubscriptionsIpcHandlers(service: SubscriptionsService): void {
  handleIpc(SUBSCRIPTION_CHANNELS.list, () => service.list())
  handleIpc(SUBSCRIPTION_CHANNELS.get, (_event, id: unknown) =>
    service.get(z.string().min(1).max(200).parse(id))
  )
  handleIpc(SUBSCRIPTION_CHANNELS.create, (_event, input: unknown) =>
    service.create(createSubscriptionSchema.parse(input))
  )
  handleIpc(SUBSCRIPTION_CHANNELS.update, (_event, input: unknown) =>
    service.update(updateSubscriptionSchema.parse(input))
  )
  handleIpc(SUBSCRIPTION_CHANNELS.delete, (_event, id: unknown) =>
    service.delete(z.string().min(1).max(200).parse(id))
  )
  handleIpc(SUBSCRIPTION_CHANNELS.archive, (_event, id: unknown) =>
    service.archive(z.string().min(1).max(200).parse(id))
  )
  handleIpc(SUBSCRIPTION_CHANNELS.addPayment, (_event, input: unknown) =>
    service.addPayment(
      z
        .object({
          subscriptionId: z.string().min(1).max(200),
          paidAt: isoDateSchema,
          amount: z.number().finite().min(0),
          currency: z.string().trim().min(1).max(12).optional(),
          note: z.string().trim().max(1000).optional()
        })
        .parse(input)
    )
  )
  handleIpc(SUBSCRIPTION_CHANNELS.getAnalytics, (_event, filters: unknown) =>
    service.getAnalytics(analyticsFiltersSchema.parse(filters) ?? {})
  )
}
