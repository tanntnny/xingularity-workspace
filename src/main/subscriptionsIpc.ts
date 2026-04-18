import { ipcMain } from 'electron'
import { z } from 'zod'
import { SUBSCRIPTION_CHANNELS } from '../shared/ipc'
import { SubscriptionsService } from './subscriptionsService'

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}(T.*)?$/)
const subscriptionStatusSchema = z.enum(['active', 'paused', 'cancelled', 'archived'])
const billingCycleSchema = z.enum(['monthly', 'quarterly', 'yearly', 'custom'])
const reviewFlagSchema = z.enum(['none', 'review', 'unused', 'duplicate', 'expensive'])

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
  tags: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  notes: z.string().trim().max(4000).optional()
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
  tags: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  notes: z.string().trim().max(4000).optional().nullable()
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
  ipcMain.handle(SUBSCRIPTION_CHANNELS.list, () => service.list())
  ipcMain.handle(SUBSCRIPTION_CHANNELS.get, (_event, id: unknown) =>
    service.get(z.string().min(1).max(200).parse(id))
  )
  ipcMain.handle(SUBSCRIPTION_CHANNELS.create, (_event, input: unknown) =>
    service.create(createSubscriptionSchema.parse(input))
  )
  ipcMain.handle(SUBSCRIPTION_CHANNELS.update, (_event, input: unknown) =>
    service.update(updateSubscriptionSchema.parse(input))
  )
  ipcMain.handle(SUBSCRIPTION_CHANNELS.delete, (_event, id: unknown) =>
    service.delete(z.string().min(1).max(200).parse(id))
  )
  ipcMain.handle(SUBSCRIPTION_CHANNELS.archive, (_event, id: unknown) =>
    service.archive(z.string().min(1).max(200).parse(id))
  )
  ipcMain.handle(SUBSCRIPTION_CHANNELS.getAnalytics, (_event, filters: unknown) =>
    service.getAnalytics(analyticsFiltersSchema.parse(filters) ?? {})
  )
}
