import {
  BrowserWindow,
  dialog,
  Menu,
  type MenuItemConstructorOptions,
  type OpenDialogOptions
} from 'electron'
import { z } from 'zod'
import { IPC_CHANNELS } from '../shared/ipc'
import {
  CALENDAR_TASK_TYPE_VALUES,
  NOTE_VIM_MAPPING_ACTION_VALUES,
  NOTE_VIM_MAPPING_MODE_VALUES,
  WORKSPACE_VIEW_TASK_GROUP_BY_VALUES,
  WORKSPACE_VIEW_TASK_SCHEDULE_FILTER_VALUES
} from '../shared/types'
import { RESOURCE_PROVIDERS, RESOURCE_STATES, RESOURCE_TYPES } from '../shared/resourceDomain'
import { TASK_TAG_MAX_COUNT } from '../shared/taskTags'
import { MAX_RECENT_PAGE_TARGETS } from '../shared/recentPages'
import { isVaultRelativePath } from '../shared/projectFolders'
import { FOLDER_COLOR_PALETTE } from '../shared/folderColors'
import { handleIpc } from './errorReporting'
import { VaultRuntime } from './runtime'
import { loadMainWindowApp } from './window'
import { listCondaEnvironments, validateCondaExecutable } from './pythonEnvironmentService'

const notePathSchema = z.string().min(1).max(512)
const genericPathSchema = z.string().min(1).max(512)
const notebookPathSchema = z
  .string()
  .trim()
  .min(1)
  .max(512)
  .refine(isVaultRelativePath, 'Notebook path must be vault-relative')
const noteNameSchema = z.string().min(1).max(120)
const projectDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const projectValuesSchema = z.array(z.string().trim().min(1).max(100)).max(50)
const contentSchema = z.string().max(2_000_000)
const fleetingContentSchema = z.string().trim().min(1).max(2_000_000)
const fleetingConversionSchema = z.object({
  relPath: genericPathSchema,
  target: z.enum(['note', 'task'])
})
const fleetingUpdateSchema = z.object({
  relPath: genericPathSchema,
  content: z.string().trim().min(1).max(2_000_000).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  tags: z.array(z.string().trim().min(1).max(100)).max(50).optional(),
  dueDate: projectDateSchema.optional(),
  projectId: z.string().min(1).max(120).optional(),
  triageState: z.enum(['inbox', 'in-progress', 'converted', 'archived']).optional()
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
const folderMarkdownExportInputSchema = z.object({
  folderPath: z.string().min(1).max(512)
})
const projectContextMarkdownExportInputSchema = z.object({
  projectId: z.string().trim().min(1).max(120)
})
const querySchema = z.string().min(1).max(200)
const resourceLabelSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9][a-z0-9._-]*$/i),
  value: z.string().trim().min(1).max(500)
})
const resourceLabelsSchema = z.array(resourceLabelSchema).max(50)
const resourceInputSchema = z.object({
  type: z.enum(['notebook', 'external']).optional(),
  provider: z.enum(['xingularity', 'google-drive', 'filesystem', 'web']).optional(),
  kind: z
    .enum([
      'note',
      'notebook',
      'project',
      'task',
      'local-file',
      'local-folder',
      'google-doc',
      'google-sheet',
      'google-slide',
      'drive-file',
      'url'
    ])
    .optional(),
  title: z.string().trim().max(500).optional(),
  canonicalUri: z.string().trim().min(1).max(4000),
  externalProduct: z
    .enum(['google-docs', 'google-sheets', 'google-slides', 'google-drive', 'canva', 'generic'])
    .optional(),
  externalId: z.string().trim().max(500).optional(),
  mimeType: z.string().trim().max(200).optional(),
  sourceOfTruth: z.enum(['xingularity', 'external']).optional(),
  access: z.enum(['read-only', 'read-write', 'unknown']).optional(),
  metadata: z
    .record(z.string(), z.union([z.string().max(500), z.number(), z.boolean(), z.null()]))
    .optional(),
  labels: resourceLabelsSchema.optional(),
  projectId: z.string().min(1).max(120).optional(),
  projectIds: z.array(z.string().min(1).max(120)).max(50).optional()
})
const resourceIdSchema = z.string().min(1).max(200)
const resourceUpdateSchema = z.object({
  resourceId: resourceIdSchema,
  canonicalUri: z.string().trim().min(1).max(4000).optional(),
  title: z.string().trim().max(500).optional(),
  labels: resourceLabelsSchema.optional()
})
const resourceProjectLinksSchema = z.object({
  resourceId: resourceIdSchema,
  projectIds: z.array(z.string().min(1).max(120)).max(50)
})
const projectNotebookResourceSchema = z.object({
  projectId: z.string().min(1).max(120),
  notebookPath: notebookPathSchema
})
const resourceDetachSchema = z.object({
  projectId: z.string().min(1).max(120),
  resourceId: resourceIdSchema
})
const resourceRelationSchema = z.object({
  type: z.enum([
    'project_contains_resource',
    'task_derived_from_resource',
    'note_references_resource',
    'decision_supported_by_resource',
    'milestone_delivered_by_resource',
    'resource_related_to_resource',
    'resource_snapshot_of_external',
    'resource_supersedes_resource',
    'capture_came_from_resource'
  ]),
  fromId: z.string().min(1).max(200),
  fromKind: z.string().min(1).max(80),
  toId: z.string().min(1).max(200),
  toKind: z.string().min(1).max(80),
  confidence: z.enum(['suggested', 'confirmed']).optional()
})
const resourceWriteInputSchema = z.object({
  resourceId: z.string().min(1).max(200).optional(),
  targetPath: z.string().min(1).max(2048),
  operation: z.enum(['create', 'replace', 'append']),
  content: z.string().max(2_000_000),
  authorizedRoot: z.string().min(1).max(2048),
  expectedHash: z.string().max(200).optional(),
  label: z.string().max(200).optional()
})
const driveAuthorizationInputSchema = z.object({
  connectionId: z.string().min(1).max(200),
  code: z.string().min(1).max(4000),
  state: z.string().min(1).max(500)
})
const driveAttachInputSchema = z.object({
  fileIds: z.array(z.string().min(1).max(500)).min(1).max(100),
  projectId: z.string().min(1).max(120).optional()
})
const drivePageTokenSchema = z.string().min(1).max(4000)
const credentialProviderSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9][a-z0-9._-]{0,63}$/i)
const credentialValueSchema = z.string().max(5000)
const aiPromptSchema = z.string().trim().min(1).max(1000)
const sourcePathSchema = z.string().min(1).max(1024)
const directoryTitleSchema = z.string().trim().min(1).max(200)
const fileExtensionSchema = z.string().min(1).max(10)
const tagsArraySchema = z.array(z.string().min(1).max(100)).max(50)
const taskTagsSchema = z.array(z.string().trim().min(1).max(129)).max(TASK_TAG_MAX_COUNT)
const noteDocumentSchema = z.object({
  version: z.literal(1),
  tags: z.array(z.string()).max(200),
  markdown: z.string().max(2_000_000)
})
const noteDocumentWriteRequestSchema = z.object({
  path: notePathSchema,
  document: noteDocumentSchema,
  baseHash: z.string().min(1).max(256).nullable(),
  clientMutationId: z.string().min(1).max(200)
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
const taskRecurrenceSchema = z.object({
  seriesId: z.string().min(1).max(200),
  anchorTaskId: z.string().min(1).max(120),
  occurrenceKey: z.string().min(1).max(80),
  rrule: z.string().trim().min(1).max(500),
  horizon: z.number().int().min(1).max(52),
  timezone: z.string().trim().min(1).max(100),
  generated: z.boolean(),
  overridden: z.boolean().optional(),
  excludedOccurrenceKeys: z.array(z.string().min(1).max(80)).max(500).optional()
})
const taskRecurrenceDraftSchema = z.object({
  rrule: z.string().trim().min(1).max(500),
  horizon: z.number().int().min(1).max(52).optional(),
  timezone: z.string().trim().min(1).max(100).optional()
})
const calendarTaskSchema = z.object({
  id: z.string().min(1).max(120),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  projectId: z.string().min(1).max(120).optional(),
  milestoneId: z.string().min(1).max(120).optional(),
  tags: taskTagsSchema.default([]),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(), // Optional - undefined means unscheduled
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  completed: z.boolean(),
  status: z
    .enum(['pending', 'backlog', 'in-progress', 'blocked', 'canceled', 'completed'])
    .optional(),
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
  automationSourceKey: z.string().max(200).optional(),
  updatedAt: z.string().min(1).max(64).optional(),
  dependencyIds: z.array(z.string().min(1).max(120)).max(100).optional(),
  parentTaskId: z.string().min(1).max(120).optional(),
  estimateMinutes: z.number().int().min(0).max(10_000_000).optional(),
  recurrence: taskRecurrenceSchema.optional()
})
const taskCreateInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(2000).optional(),
  projectId: z.string().min(1).max(120).optional(),
  milestoneId: z.string().min(1).max(120).optional(),
  tags: taskTagsSchema.optional(),
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
  reminders: z.array(taskReminderSchema).max(10).optional(),
  dependencyIds: z.array(z.string().min(1).max(120)).max(100).optional(),
  parentTaskId: z.string().min(1).max(120).optional(),
  estimateMinutes: z.number().int().min(0).max(10_000_000).optional(),
  recurrence: taskRecurrenceDraftSchema.optional()
})
const taskScheduleOverrideSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable()
    .optional(),
  endTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable()
    .optional(),
  weeklyHeightMode: z.enum(['duration', 'content']).nullable().optional()
})
const taskDuplicateInputSchema = z.object({
  taskId: z.string().min(1).max(120),
  schedule: taskScheduleOverrideSchema.optional()
})
const taskRecurrenceConfigureInputSchema = z.object({
  taskId: z.string().min(1).max(120),
  recurrence: taskRecurrenceDraftSchema.nullable()
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
const workspaceViewIconSchema = projectIconSchema.extend({
  set: z.literal('tabler').optional(),
  variant: z.enum(['filled', 'outlined'])
})

const workspaceViewSortSchema = z.object({
  columnId: z.string().min(1).max(100),
  direction: z.enum(['asc', 'desc'])
})
const workspaceViewBaseSchema = z.object({
  id: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(160),
  icon: workspaceViewIconSchema,
  createdAt: z.string().min(1).max(100),
  updatedAt: z.string().min(1).max(100)
})
const workspaceViewTaskSchema = workspaceViewBaseSchema.extend({
  source: z.literal('tasks'),
  config: z.object({
    searchQuery: z.string().max(500),
    statuses: z
      .array(z.enum(['pending', 'backlog', 'in-progress', 'blocked', 'canceled', 'completed']))
      .max(20),
    taskTypes: z.array(z.enum(CALENDAR_TASK_TYPE_VALUES)).max(20),
    priorities: z.array(z.enum(['low', 'medium', 'high'])).max(20),
    projectIds: z.array(z.string().min(1).max(120)).max(500),
    milestoneIds: z.array(z.string().min(1).max(120)).max(500),
    scheduleStates: z.array(z.enum(WORKSPACE_VIEW_TASK_SCHEDULE_FILTER_VALUES)).max(10),
    tags: z.array(z.string().max(100)).max(500),
    groupBy: z.enum(WORKSPACE_VIEW_TASK_GROUP_BY_VALUES),
    sortState: workspaceViewSortSchema.nullable()
  })
})
const workspaceViewResourceSchema = workspaceViewBaseSchema.extend({
  source: z.literal('resources'),
  config: z.object({
    searchQuery: z.string().max(500),
    types: z.array(z.enum(RESOURCE_TYPES)).max(10),
    providers: z.array(z.enum(RESOURCE_PROVIDERS)).max(10),
    states: z.array(z.enum(RESOURCE_STATES)).max(20),
    labelFilters: z.record(
      z.string().min(1).max(64),
      z.array(z.string().max(500)).max(100)
    ),
    projectIds: z.array(z.string().min(1).max(120)).max(500),
    sortState: workspaceViewSortSchema.nullable()
  })
})
const workspaceViewSchema = z.discriminatedUnion('source', [
  workspaceViewTaskSchema,
  workspaceViewResourceSchema
])

const projectCreateInputSchema = z.object({
  name: z.string().trim().max(200).optional(),
  description: z.string().max(2000).optional(),
  icon: projectIconSchema.optional(),
  startDate: projectDateSchema.optional(),
  endDate: projectDateSchema.optional(),
  tags: projectValuesSchema.optional(),
  timeBudgetMinutes: z.number().int().min(0).max(10_000_000).optional()
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
  timeBudgetMinutes: z.number().int().min(0).max(10_000_000).nullable().optional()
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
const projectMilestoneCreateInputSchema = z.object({
  projectId: z.string().min(1).max(120),
  title: z.string().trim().min(1).max(200),
  endDate: projectDateSchema.optional()
})
const projectMilestoneUpdateInputSchema = z.object({
  projectId: z.string().min(1).max(120),
  milestoneId: z.string().min(1).max(120),
  title: z.string().trim().min(1).max(200),
  endDate: projectDateSchema.nullable().optional()
})
const projectMilestoneReorderInputSchema = z.object({
  projectId: z.string().min(1).max(120),
  milestoneIds: z.array(z.string().min(1).max(120))
})
const projectMilestoneDeleteInputSchema = z.object({
  projectId: z.string().min(1).max(120),
  milestoneId: z.string().min(1).max(120)
})
const projectUpdateCreateInputSchema = z.object({
  projectId: z.string().min(1).max(120),
  markdown: z.string().max(2_000_000),
  status: z.enum(['on-track', 'at-risk', 'off-track'])
})
const projectUpdateUpdateInputSchema = z.object({
  projectId: z.string().min(1).max(120),
  updateId: z.string().min(1).max(120),
  markdown: z.string().max(2_000_000),
  status: z.enum(['on-track', 'at-risk', 'off-track'])
})
const projectUpdateDeleteInputSchema = z.object({
  projectId: z.string().min(1).max(120),
  updateId: z.string().min(1).max(120)
})
const projectMeetingCreateInputSchema = z.object({
  projectId: z.string().min(1).max(120),
  markdown: z.string().max(2_000_000),
  type: z.enum(['stand-up', 'planning', 'review', 'client', 'one-on-one', 'other']),
  outcome: z.enum(['decisions-made', 'follow-up-needed', 'informational', 'blocked'])
})
const projectMeetingUpdateInputSchema = z.object({
  projectId: z.string().min(1).max(120),
  meetingId: z.string().min(1).max(120),
  markdown: z.string().max(2_000_000),
  type: z.enum(['stand-up', 'planning', 'review', 'client', 'one-on-one', 'other']),
  outcome: z.enum(['decisions-made', 'follow-up-needed', 'informational', 'blocked'])
})
const projectMeetingDeleteInputSchema = z.object({
  projectId: z.string().min(1).max(120),
  meetingId: z.string().min(1).max(120)
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

const stickyNoteBoardStateSchema = z.object({
  viewport: z.object({
    x: z.number(),
    y: z.number(),
    zoom: z.number().positive().max(4)
  }),
  notes: z
    .array(
      z.object({
        id: z.string().min(1).max(200),
        text: z.string().max(20_000),
        color: z.enum(['yellow', 'pink', 'blue', 'green', 'orange', 'purple']),
        position: z.object({
          x: z.number(),
          y: z.number()
        }),
        size: z.object({
          width: z.number().positive().min(180).max(10_000),
          height: z.number().positive().min(160).max(10_000)
        }),
        zIndex: z.number().int().min(0).max(10_000)
      })
    )
    .max(500)
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

const recentPageTargetSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('note'), path: z.string().min(1).max(512) }),
  z.object({ kind: z.literal('drawing'), path: z.string().min(1).max(512) }),
  z.object({ kind: z.literal('project'), projectId: z.string().min(1).max(120) }),
  z.object({ kind: z.literal('view'), viewId: z.string().min(1).max(120) })
])

const folderColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/)
  .refine(
    (value) => FOLDER_COLOR_PALETTE.some((color) => color.toLowerCase() === value.toLowerCase()),
    'Folder color must come from the supported palette'
  )
const folderColorsSchema = z
  .record(z.string().trim().min(1).max(512), folderColorSchema)
  .refine((value) => Object.keys(value).length <= 1000, 'Too many folder colors')

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
  codeFontFamily: z.string().min(1).max(200).optional(),
  editorVimModeEnabled: z.boolean().optional(),
  editorVimKeyMappings: z.array(noteVimKeyMappingSchema).max(20).optional(),
  calendarTasks: z.array(calendarTaskSchema).max(5000).optional(),
  tasks: z.array(calendarTaskSchema).max(5000).optional(),
  workspaceViews: z.array(workspaceViewSchema).max(100).optional(),
  folderColors: folderColorsSchema.optional(),
  gridBoard: gridBoardStateSchema.optional(),
  stickyNoteBoard: stickyNoteBoardStateSchema.optional(),
  lastOpenedNotePath: z.string().min(1).max(512).nullable().optional(),
  recentNotebookPaths: z.array(z.string().min(1).max(512)).max(5).optional(),
  recentPageTargets: z.array(recentPageTargetSchema).max(MAX_RECENT_PAGE_TARGETS).optional(),
  favoriteNotePaths: z.array(z.string().min(1).max(512)).max(1000).optional(),
  pythonCondaEnvironmentPath: z.string().trim().min(1).max(1024).nullable().optional(),
  pythonCondaExecutablePath: z.string().trim().min(1).max(1024).nullable().optional(),
  featureFlags: z
    .object({
      resources: z.boolean().optional(),
      filesystemResources: z.boolean().optional(),
      filesystemContentIndexing: z.boolean().optional(),
      googleDriveResources: z.boolean().optional(),
      googleDriveContentIndexing: z.boolean().optional(),
      captureReview: z.boolean().optional(),
      externalWrites: z.boolean().optional(),
      agentContextBundles: z.boolean().optional()
    })
    .optional()
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

  handleIpc(IPC_CHANNELS.vaultMigrationReport, async () => {
    return runtime.getVaultMigrationReport()
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

  handleIpc(IPC_CHANNELS.vaultSyncSnapshot, async () => {
    return runtime.getVaultSyncSnapshot()
  })

  handleIpc(IPC_CHANNELS.vaultReconcile, async () => {
    return runtime.reconcileVault()
  })

  handleIpc(IPC_CHANNELS.vaultCreateBackup, async () => {
    return runtime.createVaultBackup()
  })

  handleIpc(IPC_CHANNELS.desktopChooseDirectory, async (_event, title: unknown) => {
    return runtime.chooseDirectory(directoryTitleSchema.parse(title))
  })

  handleIpc(IPC_CHANNELS.desktopChoosePath, async (_event, title: unknown) => {
    return runtime.choosePath(directoryTitleSchema.parse(title))
  })

  handleIpc(IPC_CHANNELS.desktopOpenExternal, async (_event, url: unknown) => {
    await runtime.openExternal(z.string().url().parse(url))
  })

  handleIpc(IPC_CHANNELS.desktopOpenPath, async (_event, targetPath: unknown) => {
    await runtime.openPath(sourcePathSchema.parse(targetPath))
  })

  handleIpc(IPC_CHANNELS.desktopOpenTerminal, async () => {
    await runtime.openTerminal()
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

  handleIpc(IPC_CHANNELS.removeFleetingNote, async (_event, relPath: unknown) => {
    return runtime.removeFleetingNote(genericPathSchema.parse(relPath))
  })

  handleIpc(IPC_CHANNELS.updateFleetingNote, async (_event, input: unknown) => {
    const parsed = fleetingUpdateSchema.parse(input)
    return runtime.updateFleetingNote(parsed.relPath, parsed)
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

  handleIpc(IPC_CHANNELS.readNoteDocumentWithRevision, async (_event, relPath: unknown) => {
    return runtime.readNoteDocumentWithRevision(notePathSchema.parse(relPath))
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

  handleIpc(IPC_CHANNELS.writeNoteDocumentWithRevision, async (_event, request: unknown) => {
    return runtime.writeNoteDocumentWithRevision(noteDocumentWriteRequestSchema.parse(request))
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

  handleIpc(IPC_CHANNELS.migrateNoteImagePaths, async () => {
    return runtime.migrateNoteImagePaths()
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

  handleIpc(IPC_CHANNELS.exportFolderMarkdown, async (_event, input: unknown) => {
    return runtime.exportFolderMarkdown(folderMarkdownExportInputSchema.parse(input))
  })

  handleIpc(IPC_CHANNELS.exportProjectContext, async (_event, input: unknown) => {
    return runtime.exportProjectContext(projectContextMarkdownExportInputSchema.parse(input))
  })

  handleIpc(IPC_CHANNELS.searchQuery, (_event, query: unknown) => {
    return runtime.search(querySchema.parse(query))
  })

  handleIpc(IPC_CHANNELS.resourcesList, async () => runtime.listResources())

  handleIpc(IPC_CHANNELS.resourcesAdd, async (_event, input: unknown) => {
    return runtime.addResource(resourceInputSchema.parse(input))
  })

  handleIpc(IPC_CHANNELS.resourcesUpdate, async (_event, input: unknown) => {
    return runtime.updateResource(resourceUpdateSchema.parse(input))
  })

  handleIpc(IPC_CHANNELS.resourcesSetProjectLinks, async (_event, input: unknown) => {
    return runtime.setResourceProjectLinks(resourceProjectLinksSchema.parse(input))
  })

  handleIpc(IPC_CHANNELS.resourcesSetProjectNotebook, async (_event, input: unknown) => {
    return runtime.setProjectNotebook(projectNotebookResourceSchema.parse(input))
  })

  handleIpc(IPC_CHANNELS.resourcesDetachFromProject, async (_event, input: unknown) => {
    await runtime.detachResource(resourceDetachSchema.parse(input))
  })

  handleIpc(IPC_CHANNELS.resourcesRemove, async (_event, resourceId: unknown) => {
    await runtime.removeResource(resourceIdSchema.parse(resourceId))
  })

  handleIpc(IPC_CHANNELS.resourcesRefresh, async (_event, resourceId: unknown) => {
    return runtime.refreshResource(resourceIdSchema.parse(resourceId))
  })

  handleIpc(
    IPC_CHANNELS.resourcesLocate,
    async (_event, resourceId: unknown, nextPath: unknown) => {
      return runtime.locateResource(
        resourceIdSchema.parse(resourceId),
        sourcePathSchema.parse(nextPath)
      )
    }
  )

  handleIpc(
    IPC_CHANNELS.resourcesPreview,
    async (_event, resourceId: unknown, allowContent: unknown) => {
      return runtime.previewResource(
        resourceIdSchema.parse(resourceId),
        z.boolean().optional().parse(allowContent)
      )
    }
  )

  handleIpc(IPC_CHANNELS.resourcesRelate, async (_event, input: unknown) => {
    return runtime.relateResource(resourceRelationSchema.parse(input))
  })

  handleIpc(IPC_CHANNELS.resourcesProjectContext, async (_event, projectId: unknown) => {
    return runtime.getProjectResourceContext(resourceIdSchema.parse(projectId))
  })

  handleIpc(IPC_CHANNELS.resourcesOpen, async (_event, resourceId: unknown) => {
    await runtime.openResource(resourceIdSchema.parse(resourceId))
  })

  handleIpc(IPC_CHANNELS.resourcesReveal, async (_event, resourceId: unknown) => {
    await runtime.revealResource(resourceIdSchema.parse(resourceId))
  })

  handleIpc(IPC_CHANNELS.resourcesPreviewWrite, async (_event, input: unknown) => {
    return runtime.previewResourceWrite(resourceWriteInputSchema.parse(input))
  })

  handleIpc(
    IPC_CHANNELS.resourcesApplyWrite,
    async (_event, input: unknown, confirmation: unknown) => {
      return runtime.applyResourceWrite(
        resourceWriteInputSchema.parse(input),
        z.literal(true).parse(confirmation)
      )
    }
  )

  handleIpc(IPC_CHANNELS.resourcesWriteAudit, async () => runtime.listResourceWriteAudit())

  handleIpc(IPC_CHANNELS.resourcesDriveStartAuthorization, async () => {
    return runtime.startGoogleDriveAuthorization()
  })

  handleIpc(IPC_CHANNELS.resourcesDriveCompleteAuthorization, async (_event, input: unknown) => {
    await runtime.completeGoogleDriveAuthorization(driveAuthorizationInputSchema.parse(input))
  })

  handleIpc(IPC_CHANNELS.resourcesDriveListFiles, async () => runtime.listGoogleDriveFiles())

  handleIpc(IPC_CHANNELS.resourcesDriveAttach, async (_event, input: unknown) => {
    return runtime.attachGoogleDriveResources(driveAttachInputSchema.parse(input))
  })

  handleIpc(IPC_CHANNELS.resourcesDriveRefresh, async (_event, pageToken: unknown) => {
    return runtime.refreshGoogleDriveChanges(drivePageTokenSchema.parse(pageToken))
  })

  handleIpc(IPC_CHANNELS.resourcesDriveDisconnect, async () => {
    await runtime.disconnectGoogleDrive()
  })

  handleIpc(IPC_CHANNELS.aiCompleteNote, async (_event, input: unknown) => {
    return runtime.completeNoteWithAi(aiCompletionInputSchema.parse(input))
  })

  handleIpc(IPC_CHANNELS.agentChatSendMessage, async (_event, input: unknown) => {
    return runtime.chatWithAgent(agentChatInputSchema.parse(input))
  })

  handleIpc(IPC_CHANNELS.agentChatCancel, async (_event, requestId: unknown) => {
    return runtime.cancelAgentChat(z.string().min(1).max(200).parse(requestId))
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

  handleIpc(IPC_CHANNELS.credentialStatus, async (_event, provider: unknown) => {
    return runtime.getCredentialStatus(credentialProviderSchema.parse(provider))
  })

  handleIpc(IPC_CHANNELS.credentialSet, async (_event, provider: unknown, value: unknown) => {
    return runtime.setCredential(
      credentialProviderSchema.parse(provider),
      credentialValueSchema.parse(value)
    )
  })

  handleIpc(IPC_CHANNELS.credentialDelete, async (_event, provider: unknown) => {
    await runtime.deleteCredential(credentialProviderSchema.parse(provider))
  })

  handleIpc(IPC_CHANNELS.pythonListCondaEnvironments, async () => {
    const settings = await runtime.getSettings()
    return listCondaEnvironments(settings.pythonCondaExecutablePath)
  })

  handleIpc(IPC_CHANNELS.pythonChooseCondaExecutable, async (event) => {
    const parentWindow = BrowserWindow.fromWebContents(event.sender)
    const options: OpenDialogOptions = {
      title: 'Select Conda executable',
      properties: ['openFile']
    }
    const result = parentWindow
      ? await dialog.showOpenDialog(parentWindow, options)
      : await dialog.showOpenDialog(options)

    if (result.canceled || !result.filePaths[0]) {
      return { path: null, error: null }
    }

    return validateCondaExecutable(result.filePaths[0])
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

  handleIpc(IPC_CHANNELS.createProjectMilestone, async (_event, input: unknown) => {
    return runtime.createProjectMilestone(projectMilestoneCreateInputSchema.parse(input))
  })

  handleIpc(IPC_CHANNELS.updateProjectMilestone, async (_event, input: unknown) => {
    return runtime.updateProjectMilestone(projectMilestoneUpdateInputSchema.parse(input))
  })

  handleIpc(IPC_CHANNELS.reorderProjectMilestones, async (_event, input: unknown) => {
    return runtime.reorderProjectMilestones(projectMilestoneReorderInputSchema.parse(input))
  })

  handleIpc(IPC_CHANNELS.deleteProjectMilestone, async (_event, input: unknown) => {
    return runtime.deleteProjectMilestone(projectMilestoneDeleteInputSchema.parse(input))
  })

  handleIpc(IPC_CHANNELS.createProjectUpdate, async (_event, input: unknown) => {
    return runtime.createProjectUpdate(projectUpdateCreateInputSchema.parse(input))
  })

  handleIpc(IPC_CHANNELS.updateProjectUpdate, async (_event, input: unknown) => {
    return runtime.updateProjectUpdate(projectUpdateUpdateInputSchema.parse(input))
  })

  handleIpc(IPC_CHANNELS.deleteProjectUpdate, async (_event, input: unknown) => {
    return runtime.deleteProjectUpdate(projectUpdateDeleteInputSchema.parse(input))
  })

  handleIpc(IPC_CHANNELS.createProjectMeeting, async (_event, input: unknown) => {
    return runtime.createProjectMeeting(projectMeetingCreateInputSchema.parse(input))
  })

  handleIpc(IPC_CHANNELS.updateProjectMeeting, async (_event, input: unknown) => {
    return runtime.updateProjectMeeting(projectMeetingUpdateInputSchema.parse(input))
  })

  handleIpc(IPC_CHANNELS.deleteProjectMeeting, async (_event, input: unknown) => {
    return runtime.deleteProjectMeeting(projectMeetingDeleteInputSchema.parse(input))
  })

  handleIpc(IPC_CHANNELS.createTask, async (_event, input: unknown) => {
    return runtime.createTask(taskCreateInputSchema.parse(input))
  })

  handleIpc(IPC_CHANNELS.duplicateTask, async (_event, input: unknown) => {
    return runtime.duplicateTask(taskDuplicateInputSchema.parse(input))
  })

  handleIpc(IPC_CHANNELS.configureTaskRecurrence, async (_event, input: unknown) => {
    return runtime.configureTaskRecurrence(taskRecurrenceConfigureInputSchema.parse(input))
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
