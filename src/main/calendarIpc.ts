import { z } from 'zod'
import { CALENDAR_CHANNELS } from '../shared/ipc'
import type { CalendarEventDraft } from '../shared/calendarDomain'
import { handleIpc } from './errorReporting'
import type { CalendarService } from './calendarService'

const idSchema = z.string().trim().min(1).max(200)
const calendarEventDraftSchema = z.object({
  id: idSchema.optional(),
  title: z.string().trim().min(1).max(500),
  description: z.string().max(10_000).optional(),
  allDay: z.boolean(),
  start: z.string().trim().min(1).max(100),
  end: z.string().trim().min(1).max(100).optional(),
  timezone: z.string().trim().max(100).optional(),
  recurrence: z
    .object({
      frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']),
      interval: z.number().int().min(1).max(365).optional(),
      byDay: z.array(z.string().max(10)).max(7).optional(),
      count: z.number().int().min(1).max(1000).optional(),
      until: z.string().max(100).optional()
    })
    .optional(),
  location: z.string().max(1000).optional(),
  attendees: z
    .array(
      z.object({
        email: z.string().email().max(320),
        name: z.string().max(200).optional(),
        responseStatus: z.string().max(50).optional()
      })
    )
    .max(100)
    .optional(),
  organizer: z
    .object({ email: z.string().email().max(320), name: z.string().max(200).optional() })
    .optional(),
  source: z.string().trim().max(100).optional(),
  access: z.enum(['read-only', 'read-write']).optional(),
  status: z.enum(['confirmed', 'tentative', 'cancelled']).optional(),
  updatedAt: z.string().max(100).optional(),
  connectionId: idSchema.optional(),
  providerCalendarId: idSchema.optional(),
  externalId: idSchema.optional(),
  etag: z.string().max(500).optional(),
  iCalUid: z.string().max(500).optional(),
  recurringEventId: idSchema.optional(),
  taskId: idSchema.optional(),
  projectId: idSchema.optional()
})

const serviceOrError = (getService: () => CalendarService | null): CalendarService => {
  const service = getService()
  if (!service) throw new Error('No vault is open')
  return service
}

export function registerCalendarIpcHandlers(getService: () => CalendarService | null): void {
  handleIpc(CALENDAR_CHANNELS.getState, () => serviceOrError(getService).getState())
  handleIpc(CALENDAR_CHANNELS.startGoogleAuthorization, (_event, label: unknown) =>
    serviceOrError(getService).startGoogleAuthorization(
      label === undefined ? undefined : z.string().trim().max(200).parse(label)
    )
  )
  handleIpc(CALENDAR_CHANNELS.completeGoogleAuthorization, (_event, input: unknown) => {
    const parsed = z.object({ connectionId: idSchema, callback: z.string().max(2000) }).parse(input)
    return serviceOrError(getService).completeGoogleAuthorization(
      parsed.connectionId,
      parsed.callback
    )
  })
  handleIpc(CALENDAR_CHANNELS.cancelGoogleAuthorization, (_event, connectionId: unknown) =>
    serviceOrError(getService).cancelGoogleAuthorization(idSchema.parse(connectionId))
  )
  handleIpc(CALENDAR_CHANNELS.selectGoogleCalendars, (_event, input: unknown) => {
    const parsed = z
      .object({ connectionId: idSchema, calendarIds: z.array(idSchema).max(100) })
      .parse(input)
    return serviceOrError(getService).selectGoogleCalendars(parsed.connectionId, parsed.calendarIds)
  })
  handleIpc(CALENDAR_CHANNELS.syncGoogleConnection, (_event, connectionId: unknown) =>
    serviceOrError(getService).syncGoogleConnection(idSchema.parse(connectionId))
  )
  handleIpc(CALENDAR_CHANNELS.createLocalEvent, (_event, input: unknown) =>
    serviceOrError(getService).createLocalEvent(
      calendarEventDraftSchema.parse(input) as CalendarEventDraft
    )
  )
  handleIpc(CALENDAR_CHANNELS.updateLocalEvent, (_event, input: unknown) => {
    const parsed = z.object({ eventId: idSchema, draft: calendarEventDraftSchema }).parse(input)
    return serviceOrError(getService).updateLocalEvent(
      parsed.eventId,
      parsed.draft as CalendarEventDraft
    )
  })
  handleIpc(CALENDAR_CHANNELS.linkTaskToEvent, (_event, input: unknown) => {
    const parsed = z
      .object({
        taskId: idSchema,
        eventId: idSchema,
        id: idSchema.optional(),
        ownership: z.enum(['task', 'event', 'manual']).optional(),
        fieldOwnership: z
          .record(
            z.enum(['title', 'description', 'time', 'location', 'attendees', 'project']),
            z.enum(['task', 'event', 'manual'])
          )
          .optional()
      })
      .parse(input)
    return serviceOrError(getService).linkTaskToEvent(parsed)
  })
  handleIpc(CALENDAR_CHANNELS.unlinkTaskFromEvent, (_event, linkId: unknown) =>
    serviceOrError(getService).unlinkTaskFromEvent(idSchema.parse(linkId))
  )
  handleIpc(CALENDAR_CHANNELS.deleteLocalCache, (_event, connectionId: unknown) =>
    serviceOrError(getService).deleteLocalCache(idSchema.parse(connectionId))
  )
  handleIpc(CALENDAR_CHANNELS.disconnectGoogleConnection, (_event, input: unknown) => {
    const parsed = z
      .object({ connectionId: idSchema, deleteCache: z.boolean().optional() })
      .parse(input)
    return serviceOrError(getService).disconnectGoogleConnection(parsed.connectionId, {
      deleteCache: parsed.deleteCache
    })
  })
  handleIpc(CALENDAR_CHANNELS.revokeGoogleConnection, (_event, input: unknown) => {
    const parsed = z
      .object({ connectionId: idSchema, deleteCache: z.boolean().optional() })
      .parse(input)
    return serviceOrError(getService).revokeGoogleConnection(parsed.connectionId, {
      deleteCache: parsed.deleteCache
    })
  })
}
