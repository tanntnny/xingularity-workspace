import { ipcMain } from 'electron'
import { z } from 'zod'
import { IPC_CHANNELS } from '../shared/ipc'
import { VaultRuntime } from './runtime'

const notePathSchema = z.string().min(1).max(512)
const noteNameSchema = z.string().min(1).max(120)
const contentSchema = z.string().max(2_000_000)
const querySchema = z.string().min(1).max(200)
const sourcePathSchema = z.string().min(1).max(1024)
const fileExtensionSchema = z.string().min(1).max(10)
const tagsArraySchema = z.array(z.string().min(1).max(100)).max(50)
const taskReminderSchema = z.object({
  id: z.string().min(1).max(120),
  type: z.enum(['minutes', 'hours', 'days']),
  value: z.number().int().min(1).max(365),
  enabled: z.boolean()
})

const calendarTaskSchema = z.object({
  id: z.string().min(1).max(120),
  title: z.string().min(1).max(200),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(), // Optional - undefined means unscheduled
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  completed: z.boolean(),
  createdAt: z.string().min(1).max(64),
  priority: z.enum(['low', 'medium', 'high']),
  taskType: z.enum(['meeting', 'assignment', 'review', 'personal', 'other']).optional(),
  reminders: z.array(taskReminderSchema).max(10),
  time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  automationSource: z.string().max(200).optional(),
  automationSourceKey: z.string().max(200).optional()
})

const projectIconSchema = z.object({
  shape: z.enum(['circle', 'square', 'triangle', 'diamond', 'hex']),
  variant: z.enum(['filled', 'outlined']),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/)
})

const projectSubtaskSchema = z.object({
  id: z.string().min(1).max(120),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  completed: z.boolean(),
  createdAt: z.string().min(1).max(64),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
})

const projectMilestoneSchema = z.object({
  id: z.string().min(1).max(120),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  collapsed: z.boolean().optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(['pending', 'in-progress', 'completed', 'blocked']),
  subtasks: z.array(projectSubtaskSchema).max(100)
})

const projectSchema = z.object({
  id: z.string().min(1).max(120),
  name: z.string().min(1).max(200),
  summary: z.string().max(2000),
  status: z.enum(['on-track', 'at-risk', 'blocked', 'completed']),
  updatedAt: z.string().min(1).max(64),
  progress: z.number().min(0).max(100),
  milestones: z.array(projectMilestoneSchema).max(50),
  icon: projectIconSchema
})

const settingsUpdateSchema = z.object({
  profile: z
    .object({
      name: z.string().trim().min(1).max(100)
    })
    .optional(),
  fontFamily: z.string().min(1).max(200).optional(),
  calendarTasks: z.array(calendarTaskSchema).max(1000).optional(),
  projectIcons: z.record(z.string().min(1).max(120), projectIconSchema).optional(),
  projects: z.array(projectSchema).max(100).optional()
})

export function registerIpcHandlers(runtime: VaultRuntime): void {
  ipcMain.handle(IPC_CHANNELS.vaultOpen, async () => {
    return runtime.openWithDialog()
  })

  ipcMain.handle(IPC_CHANNELS.vaultCreate, async () => {
    return runtime.createWithDialog()
  })

  ipcMain.handle(IPC_CHANNELS.vaultRestoreLast, async () => {
    return runtime.restoreLast()
  })

  ipcMain.handle(IPC_CHANNELS.listNotes, async () => {
    return runtime.listNotes()
  })

  ipcMain.handle(IPC_CHANNELS.readNote, async (_event, relPath: unknown) => {
    return runtime.readNote(notePathSchema.parse(relPath))
  })

  ipcMain.handle(IPC_CHANNELS.writeNote, async (_event, relPath: unknown, content: unknown) => {
    await runtime.writeNote(notePathSchema.parse(relPath), contentSchema.parse(content))
  })

  ipcMain.handle(IPC_CHANNELS.createNote, async (_event, name: unknown) => {
    return runtime.createNote(noteNameSchema.parse(name))
  })

  ipcMain.handle(IPC_CHANNELS.createNoteWithTags, async (_event, name: unknown, tags: unknown) => {
    return runtime.createNoteWithTags(noteNameSchema.parse(name), tagsArraySchema.parse(tags))
  })

  ipcMain.handle(
    IPC_CHANNELS.renameNote,
    async (_event, oldRelPath: unknown, newRelPath: unknown) => {
      await runtime.renameNote(notePathSchema.parse(oldRelPath), notePathSchema.parse(newRelPath))
    }
  )

  ipcMain.handle(IPC_CHANNELS.deleteNote, async (_event, relPath: unknown) => {
    await runtime.deleteNote(notePathSchema.parse(relPath))
  })

  ipcMain.handle(IPC_CHANNELS.exportNote, async (_event, relPath: unknown, content: unknown) => {
    return runtime.exportNote(notePathSchema.parse(relPath), contentSchema.parse(content))
  })

  ipcMain.handle(IPC_CHANNELS.searchQuery, (_event, query: unknown) => {
    return runtime.search(querySchema.parse(query))
  })

  ipcMain.handle(IPC_CHANNELS.importAttachment, async (_event, sourcePath: unknown) => {
    return runtime.importAttachment(sourcePathSchema.parse(sourcePath))
  })

  ipcMain.handle(
    IPC_CHANNELS.importAttachmentFromBuffer,
    async (_event, buffer: unknown, fileExtension: unknown) => {
      if (!(buffer instanceof Uint8Array)) {
        throw new Error('Buffer must be a Uint8Array')
      }
      return runtime.importAttachmentFromBuffer(buffer, fileExtensionSchema.parse(fileExtension))
    }
  )

  ipcMain.handle(IPC_CHANNELS.settingsGet, async () => {
    return runtime.getSettings()
  })

  ipcMain.handle(IPC_CHANNELS.settingsUpdate, async (_event, next: unknown) => {
    return runtime.updateSettings(settingsUpdateSchema.parse(next))
  })
}
