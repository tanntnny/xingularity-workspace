import { ipcMain } from 'electron'
import { z } from 'zod'
import { WEEKLY_PLAN_CHANNELS } from '../../shared/ipc'
import { WeeklyPlanService } from './weeklyPlanService'

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const createWeekSchema = z.object({
  startDate: isoDateSchema,
  endDate: isoDateSchema.optional(),
  focus: z.string().trim().max(500).optional()
})

const updateWeekSchema = z.object({
  id: z.string().min(1).max(200),
  startDate: isoDateSchema.optional(),
  endDate: isoDateSchema.optional(),
  focus: z.string().trim().max(500).optional().nullable()
})

const deleteWeekSchema = z.object({
  id: z.string().min(1).max(200)
})

const priorityCreateSchema = z.object({
  weekId: z.string().min(1).max(200),
  title: z.string().trim().min(1).max(300),
  linkedProjectId: z.string().min(1).max(200).optional(),
  linkedMilestoneId: z.string().min(1).max(200).optional(),
  linkedSubtaskId: z.string().min(1).max(200).optional(),
  linkedTaskId: z.string().min(1).max(200).optional()
})

const priorityUpdateSchema = z.object({
  id: z.string().min(1).max(200),
  title: z.string().trim().min(1).max(300).optional(),
  status: z.enum(['planned', 'in_progress', 'done']).optional(),
  linkedProjectId: z.string().min(1).max(200).optional().nullable(),
  linkedMilestoneId: z.string().min(1).max(200).optional().nullable(),
  linkedSubtaskId: z.string().min(1).max(200).optional().nullable(),
  linkedTaskId: z.string().min(1).max(200).optional().nullable()
})

const reorderSchema = z.object({
  weekId: z.string().min(1).max(200),
  priorityIds: z.array(z.string().min(1).max(200)).min(1).max(7)
})

const reviewSchema = z.object({
  weekId: z.string().min(1).max(200),
  reviewId: z.string().min(1).max(200).optional(),
  wins: z.string().trim().max(2000).optional().nullable(),
  misses: z.string().trim().max(2000).optional().nullable(),
  blockers: z.string().trim().max(2000).optional().nullable(),
  nextWeek: z.string().trim().max(2000).optional().nullable()
})

export function registerWeeklyPlanIpcHandlers(service: WeeklyPlanService): void {
  ipcMain.handle(WEEKLY_PLAN_CHANNELS.getState, () => {
    return service.getState()
  })

  ipcMain.handle(WEEKLY_PLAN_CHANNELS.createWeek, (_event, input: unknown) => {
    return service.createWeek(createWeekSchema.parse(input))
  })

  ipcMain.handle(WEEKLY_PLAN_CHANNELS.updateWeek, (_event, input: unknown) => {
    return service.updateWeek(updateWeekSchema.parse(input))
  })

  ipcMain.handle(WEEKLY_PLAN_CHANNELS.deleteWeek, (_event, input: unknown) => {
    return service.deleteWeek(deleteWeekSchema.parse(input))
  })

  ipcMain.handle(WEEKLY_PLAN_CHANNELS.addPriority, (_event, input: unknown) => {
    return service.addPriority(priorityCreateSchema.parse(input))
  })

  ipcMain.handle(WEEKLY_PLAN_CHANNELS.updatePriority, (_event, input: unknown) => {
    return service.updatePriority(priorityUpdateSchema.parse(input))
  })

  ipcMain.handle(WEEKLY_PLAN_CHANNELS.deletePriority, (_event, priorityId: unknown) => {
    return service.deletePriority(z.string().min(1).max(200).parse(priorityId))
  })

  ipcMain.handle(WEEKLY_PLAN_CHANNELS.reorderPriorities, (_event, input: unknown) => {
    return service.reorderPriorities(reorderSchema.parse(input))
  })

  ipcMain.handle(WEEKLY_PLAN_CHANNELS.upsertReview, (_event, input: unknown) => {
    return service.upsertReview(reviewSchema.parse(input))
  })
}
