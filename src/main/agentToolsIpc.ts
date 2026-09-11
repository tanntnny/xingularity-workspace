import { z } from 'zod'
import { AGENT_TOOL_CHANNELS } from '../shared/ipc'
import { AgentToolName, AgentToolsService } from './agentToolsService'
import { handleIpc } from './errorReporting'

const agentToolNameSchema = z.enum([
  'workspace.context',
  'note.search',
  'note.read',
  'note.create',
  'note.update',
  'note.append',
  'project.create',
  'project.update',
  'calendarTask.create',
  'calendarTask.update',
  'task.create',
  'task.update',
  'weeklyPlan.createWeek',
  'weeklyPlan.createPriority',
  'weeklyPlan.upsertReview'
])

export function registerAgentToolIpcHandlers(service: AgentToolsService): void {
  handleIpc(AGENT_TOOL_CHANNELS.invoke, (_event, toolName: unknown, input: unknown) => {
    return service.invoke(agentToolNameSchema.parse(toolName) as AgentToolName, input)
  })
}
