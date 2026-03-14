import { ipcMain } from 'electron'
import { z } from 'zod'
import { SCHEDULE_CHANNELS } from '../shared/ipc'
import type { ScheduleService } from './scheduleService'

const jobIdSchema = z.string().min(1).max(120)
const runIdSchema = z.string().min(1).max(120)

const triggerConfigSchema = z.object({
  type: z.enum(['manual', 'daily', 'every', 'cron', 'on_app_start']),
  time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  timezone: z.string().max(100).optional(),
  intervalMinutes: z.number().int().min(1).max(10080).optional(),
  expression: z.string().max(200).optional()
})

const permissionsSchema = z.array(
  z.enum([
    'network',
    'readNotes',
    'createNotes',
    'updateNotes',
    'createTasks',
    'updateTasks',
    'createCalendarItems',
    'updateProjects',
    'useSecrets'
  ])
)

const jobInputSchema = z.object({
  id: z.string().min(1).max(120).optional(),
  name: z.string().min(1).max(200),
  enabled: z.boolean(),
  trigger: triggerConfigSchema,
  runtime: z.enum(['javascript', 'python']),
  code: z.string().max(500_000),
  permissions: permissionsSchema,
  outputMode: z.enum(['auto_apply', 'review_before_apply'])
})

export function registerScheduleIpcHandlers(service: ScheduleService): void {
  ipcMain.handle(SCHEDULE_CHANNELS.listJobs, async () => {
    return service.listJobs()
  })

  ipcMain.handle(SCHEDULE_CHANNELS.saveJob, async (_event, input: unknown) => {
    return service.saveJob(jobInputSchema.parse(input))
  })

  ipcMain.handle(SCHEDULE_CHANNELS.deleteJob, async (_event, id: unknown) => {
    await service.deleteJob(jobIdSchema.parse(id))
  })

  ipcMain.handle(SCHEDULE_CHANNELS.runNow, async (_event, id: unknown) => {
    return service.runNow(jobIdSchema.parse(id))
  })

  ipcMain.handle(SCHEDULE_CHANNELS.listRuns, async (_event, jobId: unknown) => {
    return service.listRuns(jobIdSchema.parse(jobId))
  })

  ipcMain.handle(SCHEDULE_CHANNELS.applyActions, async (_event, runId: unknown) => {
    await service.applyActions(runIdSchema.parse(runId))
  })

  ipcMain.handle(SCHEDULE_CHANNELS.dismissRun, async (_event, runId: unknown) => {
    await service.dismissRun(runIdSchema.parse(runId))
  })
}
