import { BrowserWindow, ipcMain, Menu, type MenuItemConstructorOptions } from 'electron'
import { z } from 'zod'
import { IPC_CHANNELS } from '../shared/ipc'
import { VaultRuntime } from './runtime'

const notePathSchema = z.string().min(1).max(512)
const genericPathSchema = z.string().min(1).max(512)
const noteNameSchema = z.string().min(1).max(120)
const projectNameSchema = z.string().min(1).max(200)
const contentSchema = z.string().max(2_000_000)
const querySchema = z.string().min(1).max(200)
const aiPromptSchema = z.string().trim().min(1).max(1000)
const sourcePathSchema = z.string().min(1).max(1024)
const directoryTitleSchema = z.string().trim().min(1).max(200)
const fileExtensionSchema = z.string().min(1).max(10)
const tagsArraySchema = z.array(z.string().min(1).max(100)).max(50)
const noteDocumentSchema = z.object({
  version: z.literal(1),
  tags: z.array(z.string()).max(200),
  blocks: z.array(z.unknown()).max(20_000)
})
const aiCompletionInputSchema = z.object({
  notePath: z.string().min(1).max(512),
  noteContent: z.string().max(2_000_000),
  prompt: aiPromptSchema
})
const agentChatMentionSchema = z.object({
  id: z.string().min(1).max(200),
  kind: z.enum(['note', 'project']),
  label: z.string().min(1).max(200),
  notePath: z.string().min(1).max(512).optional(),
  projectId: z.string().min(1).max(120).optional()
})
const agentChatInputSchema = z.object({
  requestId: z.string().min(1).max(200).optional(),
  message: z.string().trim().min(1).max(10_000),
  mentions: z.array(agentChatMentionSchema).max(20)
})
const agentChatToolStepSchema = z.object({
  id: z.string().min(1).max(200),
  toolName: z.string().min(1).max(200),
  status: z.enum(['completed', 'error', 'approval-required', 'rejected']),
  inputSummary: z.string().max(10_000),
  outputSummary: z.string().max(20_000),
  approvalRequest: z
    .object({
      requestId: z.string().min(1).max(200).optional(),
      stepId: z.string().min(1).max(200).optional(),
      toolName: z.string().min(1).max(200),
      input: z.unknown()
    })
    .optional()
})
const agentChatMessageRecordSchema = z.object({
  id: z.string().min(1).max(200),
  role: z.enum(['user', 'assistant']),
  content: z.string().max(200_000),
  createdAt: z.string().min(1).max(100),
  mentions: z.array(agentChatMentionSchema).max(20).optional(),
  contexts: z
    .array(
      z.object({
        id: z.string().min(1).max(200),
        kind: z.enum(['note', 'project']),
        label: z.string().min(1).max(200),
        detail: z.string().max(5000)
      })
    )
    .max(20)
    .optional(),
  toolSteps: z.array(agentChatToolStepSchema).max(50).optional(),
  model: z.string().max(200).optional()
})
const agentChatSessionSchema = z.object({
  id: z.string().min(1).max(200),
  title: z.string().max(200),
  titleMode: z.enum(['auto', 'manual']).optional(),
  createdAt: z.string().min(1).max(100),
  updatedAt: z.string().min(1).max(100),
  messages: z.array(agentChatMessageRecordSchema).max(500)
})
const sessionIdSchema = z.string().min(1).max(200)
const approveToolInputSchema = z.object({
  requestId: z.string().min(1).max(200).optional(),
  stepId: z.string().min(1).max(200),
  toolName: z.string().min(1).max(200),
  input: z.unknown(),
  sessionMessages: z.array(agentChatMessageRecordSchema).max(500).optional()
})
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

const nativeMenuItemSchema: z.ZodType<{
  id?: string
  type?: 'normal' | 'separator' | 'submenu' | 'checkbox'
  label?: string
  enabled?: boolean
  checked?: boolean
  accelerator?: string
  submenu?: unknown
}> = z.lazy(() =>
  z.object({
    id: z.string().min(1).max(200).optional(),
    type: z.enum(['normal', 'separator', 'submenu', 'checkbox']).optional(),
    label: z.string().min(1).max(200).optional(),
    enabled: z.boolean().optional(),
    checked: z.boolean().optional(),
    accelerator: z.string().min(1).max(80).optional(),
    submenu: z.array(nativeMenuItemSchema).optional()
  })
)

const nativeMenuRequestSchema = z.object({
  items: z.array(nativeMenuItemSchema).max(100),
  position: z.object({
    x: z.number().int().min(0).max(10000),
    y: z.number().int().min(0).max(10000)
  })
})

const projectSubtaskSchema = z.object({
  id: z.string().min(1).max(120),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  completed: z.boolean(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
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
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  status: z.enum(['pending', 'in-progress', 'completed', 'blocked']),
  subtasks: z.array(projectSubtaskSchema).max(100)
})

const projectSchema = z.object({
  id: z.string().min(1).max(120),
  name: z.string().min(1).max(200),
  summary: z.string().max(2000),
  folderPath: z.string().min(1).max(1024).optional(),
  status: z.enum(['on-track', 'at-risk', 'blocked', 'completed']),
  updatedAt: z.string().min(1).max(64),
  progress: z.number().min(0).max(100),
  milestones: z.array(projectMilestoneSchema).max(50),
  icon: projectIconSchema
})

const gridBoardViewportSchema = z.object({
  x: z.number(),
  y: z.number(),
  zoom: z.number().positive().max(4)
})

const gridTextStyleSchema = z.object({
  fontSize: z.enum(['sm', 'md', 'lg']).optional(),
  isBold: z.boolean().optional(),
  isItalic: z.boolean().optional(),
  isUnderline: z.boolean().optional(),
  textAlign: z.enum(['left', 'center', 'right']).optional(),
  color: z.enum(['default', 'accent', 'muted']).optional()
})

const gridBoardItemSchema = z.object({
  id: z.string().min(1).max(200),
  kind: z.enum(['note', 'project', 'text']),
  noteRelPath: z.string().min(1).max(512).optional(),
  projectId: z.string().min(1).max(120).optional(),
  textContent: z.string().max(20_000).optional(),
  textStyle: gridTextStyleSchema.optional(),
  position: z.object({
    x: z.number(),
    y: z.number()
  }),
  size: z
    .object({
      width: z.number().positive().max(10_000),
      height: z.number().positive().max(10_000)
    })
    .optional(),
  zIndex: z.number().int().min(0).max(10_000)
})

const gridBoardStateSchema = z.object({
  viewport: gridBoardViewportSchema,
  items: z.array(gridBoardItemSchema).max(500)
})

const settingsUpdateSchema = z.object({
  isSidebarCollapsed: z.boolean().optional(),
  profile: z
    .object({
      name: z.string().trim().min(1).max(100)
    })
    .optional(),
  ai: z
    .object({
      mistralApiKey: z.string().max(500)
    })
    .optional(),
  fontFamily: z.string().min(1).max(200).optional(),
  calendarTasks: z.array(calendarTaskSchema).max(1000).optional(),
  projectIcons: z.record(z.string().min(1).max(120), projectIconSchema).optional(),
  projects: z.array(projectSchema).max(100).optional(),
  gridBoard: gridBoardStateSchema.optional(),
  lastOpenedNotePath: z.string().min(1).max(512).nullable().optional(),
  lastOpenedProjectId: z.string().min(1).max(120).nullable().optional(),
  favoriteNotePaths: z.array(z.string().min(1).max(512)).max(1000).optional(),
  favoriteProjectIds: z.array(z.string().min(1).max(120)).max(1000).optional()
})

export function registerIpcHandlers(runtime: VaultRuntime): void {
  ipcMain.handle(IPC_CHANNELS.uiShowNativeMenu, async (event, request: unknown) => {
    const parsed = nativeMenuRequestSchema.parse(request)
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) {
      return null
    }

    let selectedActionId: string | null = null
    const menu = Menu.buildFromTemplate(
      buildNativeMenuTemplate(parsed.items, (actionId) => {
        selectedActionId = actionId
      })
    )

    await new Promise<void>((resolve) => {
      menu.popup({
        window,
        x: parsed.position.x,
        y: parsed.position.y,
        callback: () => resolve()
      })
    })

    return selectedActionId
  })

  ipcMain.handle(IPC_CHANNELS.vaultOpen, async () => {
    return runtime.openWithDialog()
  })

  ipcMain.handle(IPC_CHANNELS.vaultCreate, async () => {
    return runtime.createWithDialog()
  })

  ipcMain.handle(IPC_CHANNELS.vaultRestoreLast, async () => {
    return runtime.restoreLast()
  })

  ipcMain.handle(IPC_CHANNELS.desktopChooseDirectory, async (_event, title: unknown) => {
    return runtime.chooseDirectory(directoryTitleSchema.parse(title))
  })

  ipcMain.handle(IPC_CHANNELS.desktopOpenPath, async (_event, targetPath: unknown) => {
    await runtime.openPath(sourcePathSchema.parse(targetPath))
  })

  ipcMain.handle(IPC_CHANNELS.listNotes, async () => {
    return runtime.listNotes()
  })

  ipcMain.handle(IPC_CHANNELS.listNoteTree, async () => {
    return runtime.listNoteTree()
  })

  ipcMain.handle(IPC_CHANNELS.readNote, async (_event, relPath: unknown) => {
    return runtime.readNote(notePathSchema.parse(relPath))
  })

  ipcMain.handle(IPC_CHANNELS.readNoteDocument, async (_event, relPath: unknown) => {
    return runtime.readNoteDocument(notePathSchema.parse(relPath))
  })

  ipcMain.handle(IPC_CHANNELS.writeNote, async (_event, relPath: unknown, content: unknown) => {
    await runtime.writeNote(notePathSchema.parse(relPath), contentSchema.parse(content))
  })

  ipcMain.handle(
    IPC_CHANNELS.writeNoteDocument,
    async (_event, relPath: unknown, document: unknown) => {
      await runtime.writeNoteDocument(notePathSchema.parse(relPath), noteDocumentSchema.parse(document))
    }
  )

  ipcMain.handle(IPC_CHANNELS.createNote, async (_event, name: unknown) => {
    return runtime.createNote(noteNameSchema.parse(name))
  })

  ipcMain.handle(IPC_CHANNELS.createNoteAtPath, async (_event, relPath: unknown) => {
    return runtime.createNoteAtPath(notePathSchema.parse(relPath))
  })

  ipcMain.handle(IPC_CHANNELS.createNoteWithTags, async (_event, name: unknown, tags: unknown) => {
    return runtime.createNoteWithTags(noteNameSchema.parse(name), tagsArraySchema.parse(tags))
  })

  ipcMain.handle(IPC_CHANNELS.createFolder, async (_event, relPath: unknown) => {
    return runtime.createFolder(genericPathSchema.parse(relPath))
  })

  ipcMain.handle(IPC_CHANNELS.importNotes, async () => {
    return runtime.importNotes()
  })

  ipcMain.handle(
    IPC_CHANNELS.renameNote,
    async (_event, oldRelPath: unknown, newRelPath: unknown) => {
      await runtime.renameNote(notePathSchema.parse(oldRelPath), notePathSchema.parse(newRelPath))
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.renamePath,
    async (_event, oldRelPath: unknown, newRelPath: unknown) => {
      await runtime.renamePath(
        genericPathSchema.parse(oldRelPath),
        genericPathSchema.parse(newRelPath)
      )
    }
  )

  ipcMain.handle(IPC_CHANNELS.deleteNote, async (_event, relPath: unknown) => {
    await runtime.deleteNote(notePathSchema.parse(relPath))
  })

  ipcMain.handle(IPC_CHANNELS.deletePath, async (_event, relPath: unknown) => {
    await runtime.deletePath(genericPathSchema.parse(relPath))
  })

  ipcMain.handle(IPC_CHANNELS.exportNote, async (_event, relPath: unknown, content: unknown) => {
    return runtime.exportNote(notePathSchema.parse(relPath), contentSchema.parse(content))
  })

  ipcMain.handle(
    IPC_CHANNELS.exportProject,
    async (_event, projectName: unknown, content: unknown) => {
      return runtime.exportProject(
        projectNameSchema.parse(projectName),
        contentSchema.parse(content)
      )
    }
  )

  ipcMain.handle(IPC_CHANNELS.searchQuery, (_event, query: unknown) => {
    return runtime.search(querySchema.parse(query))
  })

  ipcMain.handle(IPC_CHANNELS.aiCompleteNote, async (_event, input: unknown) => {
    return runtime.completeNoteWithAi(aiCompletionInputSchema.parse(input))
  })

  ipcMain.handle(IPC_CHANNELS.agentChatSendMessage, async (_event, input: unknown) => {
    return runtime.chatWithAgent(agentChatInputSchema.parse(input))
  })

  ipcMain.handle(IPC_CHANNELS.agentChatListSessions, async () => {
    return runtime.listAgentChatSessions()
  })

  ipcMain.handle(IPC_CHANNELS.agentChatSaveSession, async (_event, session: unknown) => {
    return runtime.saveAgentChatSession(agentChatSessionSchema.parse(session))
  })

  ipcMain.handle(IPC_CHANNELS.agentChatDeleteSession, async (_event, sessionId: unknown) => {
    return runtime.deleteAgentChatSession(sessionIdSchema.parse(sessionId))
  })

  ipcMain.handle(IPC_CHANNELS.agentChatApproveTool, async (_event, input: unknown) => {
    return runtime.approveAgentChatTool(approveToolInputSchema.parse(input))
  })

  ipcMain.handle(IPC_CHANNELS.agentHistoryListRuns, async () => {
    return runtime.listAgentRuns()
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

function buildNativeMenuTemplate(
  items: Array<z.infer<typeof nativeMenuItemSchema>>,
  onSelect: (actionId: string) => void
): MenuItemConstructorOptions[] {
  return items.map((item) => {
    if (item.type === 'separator') {
      return { type: 'separator' }
    }

    if (item.type === 'submenu') {
      return {
        type: 'submenu',
        label: item.label ?? '',
        enabled: item.enabled ?? true,
        submenu: buildNativeMenuTemplate(
          (item.submenu as Array<z.infer<typeof nativeMenuItemSchema>>) ?? [],
          onSelect
        )
      }
    }

    if (item.type === 'checkbox') {
      return {
        type: 'checkbox',
        label: item.label ?? '',
        enabled: item.enabled ?? true,
        checked: item.checked ?? false,
        accelerator: item.accelerator,
        click: () => {
          if (item.id) {
            onSelect(item.id)
          }
        }
      }
    }

    return {
      type: 'normal',
      label: item.label ?? '',
      enabled: item.enabled ?? true,
      accelerator: item.accelerator,
      click: () => {
        if (item.id) {
          onSelect(item.id)
        }
      }
    }
  })
}
