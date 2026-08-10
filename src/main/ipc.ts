import { BrowserWindow, Menu, type MenuItemConstructorOptions } from 'electron'
import { z } from 'zod'
import { IPC_CHANNELS } from '../shared/ipc'
import {
  CALENDAR_TASK_TYPE_VALUES,
  NOTE_VIM_MAPPING_ACTION_VALUES,
  NOTE_VIM_MAPPING_MODE_VALUES
} from '../shared/types'
import { handleIpc } from './errorReporting'
import { VaultRuntime } from './runtime'
import { loadMainWindowApp } from './window'

const notePathSchema = z.string().min(1).max(512)
const genericPathSchema = z.string().min(1).max(512)
const noteNameSchema = z.string().min(1).max(120)
const projectNameSchema = z.string().min(1).max(200)
const projectDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const projectValuesSchema = z.array(z.string().trim().min(1).max(100)).max(50)
const contentSchema = z.string().max(2_000_000)
const fleetingContentSchema = z.string().trim().min(1).max(2_000_000)
const fleetingConversionSchema = z.object({
  relPath: genericPathSchema,
  target: z.enum(['note', 'task'])
})
const notePdfExportInputSchema = z.object({
  relPath: notePathSchema,
  title: z.string().trim().min(1).max(512),
  html: z.string().min(1).max(5_000_000),
  images: z
    .array(
      z.object({
        id: z
          .string()
          .regex(/^[a-z0-9-]+$/i)
          .max(120),
        src: z.string().min(1).max(4096)
      })
    )
    .max(200)
})
const folderPdfExportInputSchema = z.object({
  folderPath: z.string().min(1).max(512)
})
const querySchema = z.string().min(1).max(200)
const aiPromptSchema = z.string().trim().min(1).max(1000)
const sourcePathSchema = z.string().min(1).max(1024)
const directoryTitleSchema = z.string().trim().min(1).max(200)
const fileExtensionSchema = z.string().min(1).max(10)
const tagsArraySchema = z.array(z.string().min(1).max(100)).max(50)
const noteDocumentSchema = z.object({
  version: z.literal(1),
  tags: z.array(z.string()).max(200),
  markdown: z.string().max(2_000_000)
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
const excalidrawSceneSchema = z.object({
  type: z.string().optional(),
  version: z.number().optional(),
  source: z.string().optional(),
  elements: z.array(z.unknown()),
  appState: z.record(z.string(), z.unknown()).nullable().optional(),
  files: z.record(z.string(), z.unknown()).optional()
})
const excalidrawFileDocumentSchema = z.object({
  version: z.literal(1),
  scene: excalidrawSceneSchema
})
const excalidrawSessionSchema = z.object({
  id: z.string().min(1).max(200),
  title: z.string().min(1).max(200),
  createdAt: z.string().min(1).max(100),
  updatedAt: z.string().min(1).max(100),
  scene: excalidrawSceneSchema
})
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
  description: z.string().max(2000).optional(),
  projectId: z.string().min(1).max(120).optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(), // Optional - undefined means unscheduled
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  completed: z.boolean(),
  status: z.enum(['pending', 'backlog', 'in-progress', 'blocked', 'completed']).optional(),
  createdAt: z.string().min(1).max(64),
  priority: z.enum(['low', 'medium', 'high']),
  taskType: z.enum(CALENDAR_TASK_TYPE_VALUES).optional(),
  reminders: z.array(taskReminderSchema).max(10),
  time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  endTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  weeklyHeightMode: z.enum(['duration', 'content']).optional(),
  automationSource: z.string().max(200).optional(),
  automationSourceKey: z.string().max(200).optional()
})
const taskCreateInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  projectId: z.string().min(1).max(120).optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  endTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  taskType: z.enum(CALENDAR_TASK_TYPE_VALUES).optional(),
  reminders: z.array(taskReminderSchema).max(10).optional()
})

const projectIconSchema = z.object({
  set: z.enum(['tabler', 'shape', 'lucide']).optional(),
  glyph: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  shape: z.enum(['circle', 'square', 'triangle', 'diamond', 'hex']).optional(),
  variant: z.enum(['filled', 'outlined']).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/)
})

const projectCreateInputSchema = z.object({
  name: z.string().trim().max(200).optional(),
  description: z.string().max(2000).optional(),
  icon: projectIconSchema.optional(),
  startDate: projectDateSchema.optional(),
  endDate: projectDateSchema.optional(),
  tags: projectValuesSchema.optional(),
  resources: projectValuesSchema.optional()
})
const projectSelectInputSchema = z.object({
  projectId: z.string().min(1).max(120).nullable()
})
const projectUpdateInputSchema = z.object({
  projectId: z.string().min(1).max(120),
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  icon: projectIconSchema.optional(),
  startDate: projectDateSchema.nullable().optional(),
  endDate: projectDateSchema.nullable().optional(),
  tags: projectValuesSchema.optional(),
  resources: projectValuesSchema.optional()
})
const projectStateInputSchema = z.object({
  projectId: z.string().min(1).max(120),
  state: z.enum(['active', 'archived'])
})
const projectFavoriteInputSchema = z.object({
  projectId: z.string().min(1).max(120),
  favorite: z.boolean()
})
const projectDeleteInputSchema = z.object({
  projectId: z.string().min(1).max(120),
  linkedTasks: z.enum(['delete', 'unassign'])
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

const noteVimKeyMappingSchema = z.object({
  id: z.string().min(1).max(120),
  mode: z.enum(NOTE_VIM_MAPPING_MODE_VALUES),
  sequence: z
    .string()
    .min(1)
    .max(8)
    .regex(/^(?=.*\S)[\x20-\x7E]+$/),
  action: z.enum(NOTE_VIM_MAPPING_ACTION_VALUES)
})

const settingsUpdateSchema = z.object({
  isSidebarCollapsed: z.boolean().optional(),
  profile: z
    .object({
      name: z.string().trim().min(1).max(100).optional()
    })
    .optional(),
  ai: z
    .object({
      mistralApiKey: z.string().max(500)
    })
    .optional(),
  fontFamily: z.string().min(1).max(200).optional(),
  editorVimModeEnabled: z.boolean().optional(),
  editorVimKeyMappings: z.array(noteVimKeyMappingSchema).max(20).optional(),
  calendarTasks: z.array(calendarTaskSchema).max(5000).optional(),
  tasks: z.array(calendarTaskSchema).max(5000).optional(),
  gridBoard: gridBoardStateSchema.optional(),
  lastOpenedNotePath: z.string().min(1).max(512).nullable().optional(),
  recentNotebookPaths: z.array(z.string().min(1).max(512)).max(5).optional(),
  favoriteNotePaths: z.array(z.string().min(1).max(512)).max(1000).optional()
})

const settingsUpdateOptionsSchema = z
  .object({
    history: z.boolean().optional()
  })
  .optional()

export function registerIpcHandlers(runtime: VaultRuntime): void {
  handleIpc(IPC_CHANNELS.uiShowNativeMenu, async (event, request: unknown) => {
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

  handleIpc(IPC_CHANNELS.uiReloadApp, async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) {
      return
    }

    await loadMainWindowApp(window)
  })

  handleIpc(IPC_CHANNELS.vaultOpen, async () => {
    return runtime.openWithDialog()
  })

  handleIpc(IPC_CHANNELS.vaultCreate, async () => {
    return runtime.createWithDialog()
  })

  handleIpc(IPC_CHANNELS.vaultRestoreLast, async () => {
    return runtime.restoreLast()
  })

  handleIpc(IPC_CHANNELS.vaultRunMigration, async () => {
    return runtime.runVaultMigration()
  })

  handleIpc(IPC_CHANNELS.vaultListSaved, async () => {
    return runtime.listSavedVaults()
  })

  handleIpc(IPC_CHANNELS.vaultSwitchSaved, async (_event, rootPath: unknown) => {
    return runtime.switchSavedVault(genericPathSchema.parse(rootPath))
  })

  handleIpc(IPC_CHANNELS.vaultToggleFavoriteSaved, async (_event, rootPath: unknown) => {
    return runtime.toggleFavoriteSavedVault(genericPathSchema.parse(rootPath))
  })

  handleIpc(IPC_CHANNELS.vaultRemoveSaved, async (_event, rootPath: unknown) => {
    return runtime.removeSavedVault(genericPathSchema.parse(rootPath))
  })

  handleIpc(IPC_CHANNELS.desktopChooseDirectory, async (_event, title: unknown) => {
    return runtime.chooseDirectory(directoryTitleSchema.parse(title))
  })

  handleIpc(IPC_CHANNELS.desktopOpenPath, async (_event, targetPath: unknown) => {
    await runtime.openPath(sourcePathSchema.parse(targetPath))
  })

  handleIpc(IPC_CHANNELS.desktopOpenWarpAtNotePath, async (_event, relPath: unknown) => {
    await runtime.openWarpAtNotePath(notePathSchema.parse(relPath))
  })

  handleIpc(IPC_CHANNELS.listNotes, async () => {
    return runtime.listNotes()
  })

  handleIpc(IPC_CHANNELS.listNoteTree, async () => {
    return runtime.listNoteTree()
  })

  handleIpc(IPC_CHANNELS.listFleetingNotes, async () => {
    return runtime.listFleetingNotes()
  })

  handleIpc(IPC_CHANNELS.createFleetingNote, async (_event, content: unknown) => {
    return runtime.createFleetingNote(fleetingContentSchema.parse(content))
  })

  handleIpc(IPC_CHANNELS.convertFleetingNote, async (_event, input: unknown) => {
    const parsed = fleetingConversionSchema.parse(input)
    return runtime.convertFleetingNote(parsed.relPath, parsed.target)
  })

  handleIpc(IPC_CHANNELS.readNote, async (_event, relPath: unknown) => {
    return runtime.readNote(notePathSchema.parse(relPath))
  })

  handleIpc(IPC_CHANNELS.readNoteDocument, async (_event, relPath: unknown) => {
    return runtime.readNoteDocument(notePathSchema.parse(relPath))
  })

  handleIpc(IPC_CHANNELS.readExcalidrawFileDocument, async (_event, relPath: unknown) => {
    return runtime.readExcalidrawFileDocument(notePathSchema.parse(relPath))
  })

  handleIpc(IPC_CHANNELS.writeNote, async (_event, relPath: unknown, content: unknown) => {
    await runtime.writeNote(notePathSchema.parse(relPath), contentSchema.parse(content))
  })

  handleIpc(IPC_CHANNELS.writeNoteDocument, async (_event, relPath: unknown, document: unknown) => {
    await runtime.writeNoteDocument(
      notePathSchema.parse(relPath),
      noteDocumentSchema.parse(document)
    )
  })

  handleIpc(
    IPC_CHANNELS.writeExcalidrawFileDocument,
    async (_event, relPath: unknown, document: unknown) => {
      await runtime.writeExcalidrawFileDocument(
        notePathSchema.parse(relPath),
        excalidrawFileDocumentSchema.parse(document)
      )
    }
  )

  handleIpc(IPC_CHANNELS.createNote, async (_event, name: unknown) => {
    return runtime.createNote(noteNameSchema.parse(name))
  })

  handleIpc(IPC_CHANNELS.createNoteAtPath, async (_event, relPath: unknown) => {
    return runtime.createNoteAtPath(notePathSchema.parse(relPath))
  })

  handleIpc(IPC_CHANNELS.createExcalidrawFileAtPath, async (_event, relPath: unknown) => {
    return runtime.createExcalidrawFileAtPath(notePathSchema.parse(relPath))
  })

  handleIpc(IPC_CHANNELS.createNoteWithTags, async (_event, name: unknown, tags: unknown) => {
    return runtime.createNoteWithTags(noteNameSchema.parse(name), tagsArraySchema.parse(tags))
  })

  handleIpc(IPC_CHANNELS.createFolder, async (_event, relPath: unknown) => {
    return runtime.createFolder(genericPathSchema.parse(relPath))
  })

  handleIpc(IPC_CHANNELS.importNotes, async () => {
    return runtime.importNotes()
  })

  handleIpc(IPC_CHANNELS.migrateBlockNoteNotes, async () => {
    return runtime.migrateBlockNoteNotes()
  })

  handleIpc(IPC_CHANNELS.migrateTaggedNoteBodyFrontmatter, async () => {
    return runtime.migrateTaggedNoteBodyFrontmatter()
  })

  handleIpc(IPC_CHANNELS.renameNote, async (_event, oldRelPath: unknown, newRelPath: unknown) => {
    await runtime.renameNote(notePathSchema.parse(oldRelPath), notePathSchema.parse(newRelPath))
  })

  handleIpc(IPC_CHANNELS.renamePath, async (_event, oldRelPath: unknown, newRelPath: unknown) => {
    await runtime.renamePath(
      genericPathSchema.parse(oldRelPath),
      genericPathSchema.parse(newRelPath)
    )
  })

  handleIpc(IPC_CHANNELS.deleteNote, async (_event, relPath: unknown) => {
    await runtime.deleteNote(notePathSchema.parse(relPath))
  })

  handleIpc(IPC_CHANNELS.deletePath, async (_event, relPath: unknown) => {
    await runtime.deletePath(genericPathSchema.parse(relPath))
  })

  handleIpc(IPC_CHANNELS.deletePaths, async (_event, relPaths: unknown) => {
    await runtime.deletePaths(z.array(genericPathSchema).min(1).max(100).parse(relPaths))
  })

  handleIpc(IPC_CHANNELS.exportNote, async (_event, relPath: unknown, content: unknown) => {
    return runtime.exportNote(notePathSchema.parse(relPath), contentSchema.parse(content))
  })

  handleIpc(IPC_CHANNELS.exportNotePdf, async (_event, input: unknown) => {
    return runtime.exportNotePdf(notePdfExportInputSchema.parse(input))
  })

  handleIpc(IPC_CHANNELS.exportFolderPdf, async (_event, input: unknown) => {
    return runtime.exportFolderPdf(folderPdfExportInputSchema.parse(input))
  })

  handleIpc(IPC_CHANNELS.exportProject, async (_event, projectName: unknown, content: unknown) => {
    return runtime.exportProject(projectNameSchema.parse(projectName), contentSchema.parse(content))
  })

  handleIpc(IPC_CHANNELS.searchQuery, (_event, query: unknown) => {
    return runtime.search(querySchema.parse(query))
  })

  handleIpc(IPC_CHANNELS.aiCompleteNote, async (_event, input: unknown) => {
    return runtime.completeNoteWithAi(aiCompletionInputSchema.parse(input))
  })

  handleIpc(IPC_CHANNELS.agentChatSendMessage, async (_event, input: unknown) => {
    return runtime.chatWithAgent(agentChatInputSchema.parse(input))
  })

  handleIpc(IPC_CHANNELS.agentChatListSessions, async () => {
    return runtime.listAgentChatSessions()
  })

  handleIpc(IPC_CHANNELS.agentChatSaveSession, async (_event, session: unknown) => {
    return runtime.saveAgentChatSession(agentChatSessionSchema.parse(session))
  })

  handleIpc(IPC_CHANNELS.agentChatDeleteSession, async (_event, sessionId: unknown) => {
    return runtime.deleteAgentChatSession(sessionIdSchema.parse(sessionId))
  })

  handleIpc(IPC_CHANNELS.excalidrawListSessions, async () => {
    return runtime.listExcalidrawSessions()
  })

  handleIpc(IPC_CHANNELS.excalidrawSaveSession, async (_event, session: unknown) => {
    return runtime.saveExcalidrawSession(excalidrawSessionSchema.parse(session))
  })

  handleIpc(IPC_CHANNELS.excalidrawDeleteSession, async (_event, sessionId: unknown) => {
    return runtime.deleteExcalidrawSession(sessionIdSchema.parse(sessionId))
  })

  handleIpc(IPC_CHANNELS.excalidrawImportLegacySessions, async () => {
    return runtime.importLegacyExcalidrawSessions()
  })

  handleIpc(IPC_CHANNELS.agentChatApproveTool, async (_event, input: unknown) => {
    return runtime.approveAgentChatTool(approveToolInputSchema.parse(input))
  })

  handleIpc(IPC_CHANNELS.agentHistoryListRuns, async () => {
    return runtime.listAgentRuns()
  })

  handleIpc(IPC_CHANNELS.importAttachment, async (_event, sourcePath: unknown) => {
    return runtime.importAttachment(sourcePathSchema.parse(sourcePath))
  })

  handleIpc(
    IPC_CHANNELS.importAttachmentFromBuffer,
    async (_event, buffer: unknown, fileExtension: unknown) => {
      if (!(buffer instanceof Uint8Array)) {
        throw new Error('Buffer must be a Uint8Array')
      }
      return runtime.importAttachmentFromBuffer(buffer, fileExtensionSchema.parse(fileExtension))
    }
  )

  handleIpc(IPC_CHANNELS.settingsGet, async () => {
    return runtime.getSettings()
  })

  handleIpc(IPC_CHANNELS.settingsUpdate, async (_event, next: unknown, options: unknown) => {
    const parsedNext = settingsUpdateSchema.parse(next)
    return runtime.updateSettings(parsedNext, settingsUpdateOptionsSchema.parse(options))
  })

  handleIpc(IPC_CHANNELS.createProject, async (_event, input: unknown) => {
    return runtime.createProject(projectCreateInputSchema.parse(input))
  })

  handleIpc(IPC_CHANNELS.selectProject, async (_event, input: unknown) => {
    const parsed = projectSelectInputSchema.parse(input)
    return runtime.selectProject(parsed.projectId)
  })

  handleIpc(IPC_CHANNELS.updateProject, async (_event, input: unknown) => {
    return runtime.updateProject(projectUpdateInputSchema.parse(input))
  })

  handleIpc(IPC_CHANNELS.setProjectState, async (_event, input: unknown) => {
    const parsed = projectStateInputSchema.parse(input)
    return runtime.setProjectState(parsed.projectId, parsed.state)
  })

  handleIpc(IPC_CHANNELS.setProjectFavorite, async (_event, input: unknown) => {
    const parsed = projectFavoriteInputSchema.parse(input)
    return runtime.setProjectFavorite(parsed.projectId, parsed.favorite)
  })

  handleIpc(IPC_CHANNELS.deleteProject, async (_event, input: unknown) => {
    return runtime.deleteProject(projectDeleteInputSchema.parse(input))
  })

  handleIpc(IPC_CHANNELS.createTask, async (_event, input: unknown) => {
    return runtime.createTask(taskCreateInputSchema.parse(input))
  })

  handleIpc(IPC_CHANNELS.historyUndo, async () => {
    return runtime.undoHistory()
  })

  handleIpc(IPC_CHANNELS.historyRedo, async () => {
    return runtime.redoHistory()
  })

  handleIpc(IPC_CHANNELS.historyStatus, () => {
    return runtime.historyStatus()
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
