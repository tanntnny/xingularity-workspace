import { z } from 'zod'
import type { ScriptAction } from '../shared/scheduleTypes'

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const timeSchema = z.string().regex(/^\d{2}:\d{2}$/)
const statusSchema = z.enum([
  'pending',
  'backlog',
  'in-progress',
  'blocked',
  'canceled',
  'completed'
])
const tagsSchema = z.array(z.string().trim().min(1).max(129)).max(50).optional()
const automationFields = {
  automationSource: z.string().trim().min(1).max(200),
  automationSourceKey: z.string().trim().min(1).max(200)
}

const taskCreateSchema = z.object({
  type: z.literal('task.create'),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(2000).optional(),
  projectId: z.string().trim().min(1).max(120).optional(),
  tags: tagsSchema,
  date: dateSchema.optional(),
  endDate: dateSchema.optional(),
  time: timeSchema.optional(),
  endTime: timeSchema.optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  taskType: z.string().trim().min(1).max(80).optional(),
  status: statusSchema.optional(),
  ...automationFields
})

const taskUpdateSchema = z.object({
  type: z.literal('task.update'),
  tags: tagsSchema,
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  projectId: z.string().trim().min(1).max(120).nullable().optional(),
  date: dateSchema.optional(),
  endDate: dateSchema.nullable().optional(),
  endTime: timeSchema.nullable().optional(),
  completed: z.boolean().optional(),
  status: statusSchema.optional(),
  ...automationFields
})

const noteCreateSchema = z.object({
  type: z.literal('note.create'),
  name: z.string().trim().min(1).max(120),
  body: z.string().max(2_000_000),
  tags: z.array(z.string().trim().min(1).max(100)).max(50).optional(),
  ...automationFields
})

const noteAppendSchema = z.object({
  type: z.literal('note.append'),
  name: z.string().trim().min(1).max(120),
  body: z.string().max(2_000_000)
})

const calendarEventCreateSchema = z.object({
  type: z.literal('calendar.event.create'),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(2000).optional(),
  date: dateSchema,
  endDate: dateSchema.optional(),
  time: timeSchema.optional(),
  taskType: z.string().trim().min(1).max(80).optional(),
  projectId: z.string().trim().min(1).max(120).optional(),
  tags: tagsSchema,
  status: statusSchema.optional(),
  ...automationFields
})

const scriptActionSchema = z.discriminatedUnion('type', [
  taskCreateSchema,
  taskUpdateSchema,
  noteCreateSchema,
  noteAppendSchema,
  calendarEventCreateSchema
])

export function parseScriptActions(input: unknown): {
  actions: ScriptAction[]
  error?: string
} {
  const parsed = z.array(scriptActionSchema).max(5000).safeParse(input)
  if (!parsed.success) {
    const details = parsed.error.issues
      .slice(0, 5)
      .map((issue) => `${issue.path.join('.') || 'action'}: ${issue.message}`)
      .join('; ')
    return {
      actions: [],
      error: `Invalid schedule actions${details ? `: ${details}` : ''}`
    }
  }

  return { actions: parsed.data as ScriptAction[] }
}
