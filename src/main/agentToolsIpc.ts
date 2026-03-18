import { ipcMain } from 'electron'
import { z } from 'zod'
import { AGENT_TOOL_CHANNELS } from '../shared/ipc'
import { AgentToolName, AgentToolsService } from './agentToolsService'

const agentToolNameSchema = z.enum([
  'note.search',
  'note.read',
  'note.create',
  'note.update',
  'note.append',
  'project.create',
  'project.update',
  'milestone.create',
  'milestone.update',
  'subtask.create',
  'subtask.update',
  'calendarTask.create',
  'calendarTask.update',
  'weeklyPlan.createWeek',
  'weeklyPlan.createPriority',
  'weeklyPlan.upsertReview'
])

export function registerAgentToolIpcHandlers(service: AgentToolsService): void {
  ipcMain.handle(AGENT_TOOL_CHANNELS.invoke, (_event, toolName: unknown, input: unknown) => {
    return service.invoke(agentToolNameSchema.parse(toolName) as AgentToolName, input)
  })
}
