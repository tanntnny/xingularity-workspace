import type {
  CalendarConnection as SharedCalendarConnection,
  CalendarEvent as SharedCalendarEvent,
  CalendarEventAccess,
  CalendarLink as SharedCalendarLink,
  CalendarRecurrence,
  CalendarSource,
  CalendarTask,
  ExternalCalendar as SharedExternalCalendar
} from './types'
import {
  isDateOnly,
  isIanaTimezone,
  isLocalTime,
  isValidInstant,
  normalizeDateOnlyRange,
  normalizeRecurrenceRule
} from './timeSemantics'

export type { CalendarEventAccess, CalendarRecurrence, CalendarSource, CalendarTask }

export const CALENDAR_DOMAIN_SCHEMA_VERSION = 1 as const
export const CALENDAR_END_SEMANTICS = 'exclusive' as const
export const GOOGLE_CALENDAR_PROVIDER = 'google' as const

// The core records accept providers beyond Google. The current adapter only implements
// Google, but another provider must not change local event or time semantics.
export type CalendarProvider = 'local' | 'google' | (string & {})

export type CalendarEventStatus = 'confirmed' | 'tentative' | 'cancelled'

export interface CalendarEventRecord extends Omit<SharedCalendarEvent, 'source'> {
  source: CalendarProvider
  connectionId?: string
  providerCalendarId?: string
  iCalUid?: string
  recurringEventId?: string
  taskId?: string
  projectId?: string
}

export type CalendarEvent = CalendarEventRecord

export type CalendarLinkField =
  | 'title'
  | 'description'
  | 'time'
  | 'location'
  | 'attendees'
  | 'project'

export type CalendarFieldOwner = 'task' | 'event' | 'manual'

export type CalendarFieldOwnership = Partial<Record<CalendarLinkField, CalendarFieldOwner>>

export interface CalendarLinkRecord extends SharedCalendarLink {
  fieldOwnership: CalendarFieldOwnership
}

export type CalendarLink = CalendarLinkRecord

export interface CalendarCapabilities {
  canReadCalendars: true
  canReadEvents: true
  canWriteEvents: false
  canDeleteEvents: false
  supportsIncrementalSync: boolean
  supportsPush: boolean
}

export type CalendarConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'authorization-cancelled'
  | 'sync-cancelled'
  | 'reauthorization-required'
  | 'revoked'
  | 'offline'
  | 'error'
  | 'disconnected'

export type CalendarErrorCode =
  | 'cancelled'
  | 'offline'
  | 'reauthorization-required'
  | 'revoked'
  | 'rate-limited'
  | 'invalid-response'
  | 'conflict'
  | 'unknown'

export interface CalendarErrorState {
  code: CalendarErrorCode
  message: string
  occurredAt: string
  retryAt?: string
  status?: number
}

export interface CalendarSyncCheckpoint {
  cursor?: string
  etag?: string
  lastSyncedAt?: string
}

export interface CalendarConnectionRecord extends Omit<
  SharedCalendarConnection,
  'provider' | 'status' | 'lastError' | 'syncCursor'
> {
  provider: CalendarProvider
  status: CalendarConnectionStatus
  capabilities: CalendarCapabilities
  syncStates: Record<string, CalendarSyncCheckpoint>
  // Compatibility summary for callers that only manage one selected calendar.
  syncCursor?: string
  etag?: string
  lastSyncAt?: string
  lastError?: CalendarErrorState
}

export type CalendarConnection = CalendarConnectionRecord

export interface ExternalCalendarRecord extends Omit<SharedExternalCalendar, 'provider'> {
  provider: CalendarProvider
  externalId?: string
  etag?: string
  capabilities: Pick<CalendarCapabilities, 'canReadEvents' | 'canWriteEvents'>
}

export type ExternalCalendar = ExternalCalendarRecord

export interface CalendarDomainState {
  schemaVersion: typeof CALENDAR_DOMAIN_SCHEMA_VERSION
  events: CalendarEventRecord[]
  links: CalendarLinkRecord[]
  connections: CalendarConnectionRecord[]
  calendars: ExternalCalendarRecord[]
}

export type CalendarState = CalendarDomainState

export interface CalendarEventDraft {
  id?: string
  title: string
  description?: string
  allDay: boolean
  start: string
  end?: string
  timezone?: string
  recurrence?: CalendarRecurrence
  location?: string
  attendees?: Array<{ email: string; name?: string; responseStatus?: string }>
  organizer?: { email: string; name?: string }
  source?: CalendarProvider
  access?: CalendarEventAccess
  status?: CalendarEventStatus
  updatedAt?: string
  connectionId?: string
  providerCalendarId?: string
  externalId?: string
  etag?: string
  iCalUid?: string
  recurringEventId?: string
  taskId?: string
  projectId?: string
}

export type CalendarEventInput = CalendarEventDraft

export interface NormalizeCalendarEventOptions {
  now?: string
  defaultTimezone?: string
}

export function createReadOnlyCalendarCapabilities(): CalendarCapabilities {
  return {
    canReadCalendars: true,
    canReadEvents: true,
    canWriteEvents: false,
    canDeleteEvents: false,
    supportsIncrementalSync: true,
    supportsPush: false
  }
}

export function resolveDefaultCalendarTimezone(): string {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  return timezone && isIanaTimezone(timezone) ? timezone : 'UTC'
}

export function normalizeCalendarEvent(
  input: CalendarEventDraft,
  options: NormalizeCalendarEventOptions = {}
): CalendarEventRecord {
  const title = requireText(input.title, 'Calendar event title')
  const id = input.id?.trim() || createOpaqueId('event')
  const source = input.source ?? 'local'
  const access = input.access ?? (source === 'google' ? 'read-only' : 'read-write')
  const updatedAt = input.updatedAt ?? options.now ?? new Date().toISOString()

  if (source === 'google' && access !== 'read-only') {
    throw new Error('Google calendar events are read-only in the import adapter')
  }

  let start = input.start
  let end = input.end
  let timezone = input.timezone

  if (input.allDay) {
    if (!isDateOnly(start)) {
      throw new Error(`All-day calendar events require a date-only start: ${start}`)
    }
    const defaultEnd = addDateOnlyDays(start, 1)
    end = end ?? defaultEnd
    const range = normalizeDateOnlyRange(start, end)
    if (range.end <= range.start) {
      throw new Error('All-day calendar event end must be after start (end is exclusive)')
    }
    start = range.start
    end = range.end
    timezone = undefined
  } else {
    timezone = timezone ?? options.defaultTimezone ?? resolveDefaultCalendarTimezone()
    if (!isIanaTimezone(timezone)) {
      throw new Error(`Timed calendar events require an IANA timezone: ${timezone}`)
    }
    if (!isValidInstant(start) || !isValidInstant(end)) {
      throw new Error(
        'Timed calendar events require ISO instants with an explicit UTC offset or Z suffix'
      )
    }
    if (Date.parse(end) <= Date.parse(start)) {
      throw new Error('Timed calendar event end must be after start (end is exclusive)')
    }
    start = new Date(start).toISOString()
    end = new Date(end).toISOString()
  }

  const recurrence = normalizeRecurrence(input.recurrence, input.allDay, timezone)

  return {
    id,
    title,
    ...(input.description ? { description: input.description } : {}),
    allDay: input.allDay,
    start,
    end: end as string,
    ...(timezone ? { timezone } : {}),
    ...(recurrence ? { recurrence } : {}),
    ...(input.location ? { location: input.location } : {}),
    attendees: normalizeAttendees(input.attendees),
    ...(input.organizer ? { organizer: normalizePerson(input.organizer, 'organizer') } : {}),
    source,
    ...(input.providerCalendarId ? { calendarId: input.providerCalendarId } : {}),
    ...(input.externalId ? { externalId: input.externalId } : {}),
    ...(input.etag ? { etag: input.etag } : {}),
    access,
    status: input.status ?? 'confirmed',
    updatedAt,
    ...(input.connectionId ? { connectionId: input.connectionId } : {}),
    ...(input.providerCalendarId ? { providerCalendarId: input.providerCalendarId } : {}),
    ...(input.iCalUid ? { iCalUid: input.iCalUid } : {}),
    ...(input.recurringEventId ? { recurringEventId: input.recurringEventId } : {}),
    ...(input.taskId ? { taskId: input.taskId } : {}),
    ...(input.projectId ? { projectId: input.projectId } : {})
  }
}

export function normalizeCalendarConnection(
  input: CalendarConnectionRecord
): CalendarConnectionRecord {
  const selectedCalendarIds = [...new Set(input.selectedCalendarIds.map((id) => id.trim()))].filter(
    Boolean
  )
  const syncStates = Object.fromEntries(
    Object.entries(input.syncStates ?? {}).map(([calendarId, checkpoint]) => [
      calendarId,
      {
        ...(checkpoint.cursor ? { cursor: checkpoint.cursor } : {}),
        ...(checkpoint.etag ? { etag: checkpoint.etag } : {}),
        ...(checkpoint.lastSyncedAt ? { lastSyncedAt: checkpoint.lastSyncedAt } : {})
      }
    ])
  )

  return {
    ...input,
    accountLabel: requireText(input.accountLabel, 'Calendar account label'),
    selectedCalendarIds,
    capabilities: {
      ...createReadOnlyCalendarCapabilities(),
      ...input.capabilities,
      canWriteEvents: false,
      canDeleteEvents: false
    },
    syncStates,
    ...(input.lastError
      ? { lastError: normalizeCalendarError(input.lastError) }
      : { lastError: undefined })
  }
}

export function normalizeExternalCalendar(input: ExternalCalendarRecord): ExternalCalendarRecord {
  return {
    ...input,
    name: requireText(input.name, 'External calendar name'),
    selected: Boolean(input.selected),
    access: 'read-only',
    capabilities: {
      canReadEvents: true,
      canWriteEvents: false
    }
  }
}

export function normalizeCalendarLink(input: CalendarLinkRecord): CalendarLinkRecord {
  const fieldOwnership = Object.fromEntries(
    Object.entries(input.fieldOwnership ?? {}).filter(
      ([field, owner]) => isCalendarLinkField(field) && isCalendarFieldOwner(owner)
    )
  ) as CalendarFieldOwnership

  return {
    ...input,
    fieldOwnership,
    ownership: input.ownership ?? 'manual',
    syncState: input.syncState ?? 'linked'
  }
}

export function normalizeCalendarError(error: CalendarErrorState): CalendarErrorState {
  return {
    ...error,
    message: redactSensitiveText(requireText(error.message, 'Calendar error message')),
    ...(error.retryAt ? { retryAt: error.retryAt } : {})
  }
}

export function createCalendarConnection(
  id: string,
  accountLabel: string,
  now = new Date().toISOString()
): CalendarConnectionRecord {
  return normalizeCalendarConnection({
    id,
    provider: GOOGLE_CALENDAR_PROVIDER,
    accountLabel,
    status: 'connecting',
    selectedCalendarIds: [],
    capabilities: createReadOnlyCalendarCapabilities(),
    syncStates: {},
    createdAt: now,
    updatedAt: now
  })
}

export function createCalendarLink(input: {
  id?: string
  taskId: string
  eventId: string
  ownership?: CalendarFieldOwner
  fieldOwnership?: CalendarFieldOwnership
  syncState?: SharedCalendarLink['syncState']
  updatedAt?: string
}): CalendarLinkRecord {
  const ownership = input.ownership ?? 'manual'
  const fieldOwnership = input.fieldOwnership ?? {
    title: ownership,
    description: ownership,
    time: ownership,
    location: ownership,
    attendees: ownership,
    project: ownership
  }

  return normalizeCalendarLink({
    id: input.id ?? createOpaqueId('link'),
    taskId: requireText(input.taskId, 'Calendar link task ID'),
    eventId: requireText(input.eventId, 'Calendar link event ID'),
    ownership,
    fieldOwnership,
    syncState: input.syncState ?? 'linked',
    updatedAt: input.updatedAt ?? new Date().toISOString()
  })
}

export function makeGoogleEventId(
  connectionId: string,
  calendarId: string,
  externalId: string
): string {
  return `google:${encodeURIComponent(connectionId)}:${encodeURIComponent(calendarId)}:${encodeURIComponent(externalId)}`
}

export function addDateOnlyDays(value: string, days: number): string {
  if (!isDateOnly(value)) {
    throw new Error(`Invalid date-only value: ${value}`)
  }
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days))
  return date.toISOString().slice(0, 10)
}

export function localDateTimeToInstant(date: string, time: string, timezone: string): string {
  if (!isDateOnly(date)) {
    throw new Error(`Invalid local calendar date: ${date}`)
  }
  if (!isLocalTime(time)) {
    throw new Error(`Invalid local calendar time: ${time}`)
  }
  if (!isIanaTimezone(timezone)) {
    throw new Error(`Invalid IANA timezone: ${timezone}`)
  }

  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  const target = Date.UTC(year, month - 1, day, hour, minute, 0, 0)
  const offsets = new Set<number>()

  for (let offset = -36 * 60; offset <= 36 * 60; offset += 30) {
    offsets.add(getTimezoneOffsetMinutes(new Date(target + offset * 60_000), timezone))
  }

  const candidates = [...offsets]
    .map((offset) => target - offset * 60_000)
    .filter((candidate) => {
      const parts = formatInstantParts(new Date(candidate), timezone)
      return (
        parts.year === year &&
        parts.month === month &&
        parts.day === day &&
        parts.hour === hour &&
        parts.minute === minute
      )
    })

  if (candidates.length === 0) {
    throw new Error(`Local calendar time does not exist in ${timezone}: ${date}T${time}`)
  }
  if (candidates.length > 1) {
    throw new Error(`Local calendar time is ambiguous in ${timezone}: ${date}T${time}`)
  }
  return new Date(candidates[0]).toISOString()
}

export function formatInstantInTimezone(instant: string, timezone: string): string {
  if (!isValidInstant(instant)) {
    throw new Error(`Invalid ISO instant: ${instant}`)
  }
  if (!isIanaTimezone(timezone)) {
    throw new Error(`Invalid IANA timezone: ${timezone}`)
  }
  const parts = formatInstantParts(new Date(instant), timezone)
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`
}

export function calendarEventFromTask(
  task: CalendarTask,
  options: { defaultTimezone?: string; now?: string } = {}
): CalendarEventRecord | null {
  const taskDate = task.date ?? task.endDate
  if (!taskDate) {
    return null
  }

  const now = options.now ?? new Date().toISOString()
  if (!task.time) {
    const inclusiveEnd = task.endDate ?? task.date ?? taskDate
    return normalizeCalendarEvent(
      {
        id: `local-task:${task.id}`,
        title: task.title,
        description: task.description,
        allDay: true,
        start: taskDate,
        end: addDateOnlyDays(inclusiveEnd, 1),
        source: 'local',
        access: 'read-write',
        status: task.completed || task.status === 'completed' ? 'confirmed' : 'confirmed',
        updatedAt: task.updatedAt ?? task.createdAt ?? now,
        taskId: task.id,
        projectId: task.projectId
      },
      options
    )
  }

  const timezone = options.defaultTimezone ?? resolveDefaultCalendarTimezone()
  const start = localDateTimeToInstant(taskDate, task.time, timezone)
  let end: string
  if (task.endTime) {
    let endDate = task.endDate ?? taskDate
    try {
      end = localDateTimeToInstant(endDate, task.endTime, timezone)
    } catch (error) {
      if (error instanceof Error && !task.endDate) {
        endDate = addDateOnlyDays(endDate, 1)
        end = localDateTimeToInstant(endDate, task.endTime, timezone)
      } else {
        throw error
      }
    }
  } else {
    end = new Date(Date.parse(start) + 60 * 60_000).toISOString()
  }

  if (Date.parse(end) <= Date.parse(start)) {
    end = new Date(Date.parse(start) + 60 * 60_000).toISOString()
  }

  return normalizeCalendarEvent(
    {
      id: `local-task:${task.id}`,
      title: task.title,
      description: task.description,
      allDay: false,
      start,
      end,
      timezone,
      source: 'local',
      access: 'read-write',
      updatedAt: task.updatedAt ?? task.createdAt ?? now,
      taskId: task.id,
      projectId: task.projectId
    },
    options
  )
}

export function redactSensitiveText(value: string): string {
  return value
    .replace(/Bearer\s+[^\s,;]+/gi, 'Bearer [redacted]')
    .replace(
      /(access_token|refresh_token|client_secret|code_verifier|authorization|token|secret)=([^&\s]+)/gi,
      '$1=[redacted]'
    )
}

function normalizeRecurrence(
  recurrence: CalendarRecurrence | undefined,
  allDay: boolean,
  timezone: string | undefined
): CalendarRecurrence | undefined {
  if (!recurrence) {
    return undefined
  }

  const rrule = normalizeRecurrenceRule(recurrence.rrule)
  if (recurrence.until) {
    const validUntil = allDay ? isDateOnly(recurrence.until) : isValidInstant(recurrence.until)
    if (!validUntil) {
      throw new Error(
        allDay
          ? 'All-day recurrence UNTIL must be a date-only value'
          : 'Timed recurrence UNTIL must be an ISO instant'
      )
    }
  }

  const normalizedUntil = recurrence.until
    ? allDay
      ? recurrence.until
      : new Date(recurrence.until).toISOString()
    : undefined

  return {
    rrule,
    ...(allDay ? {} : { timezone: recurrence.timezone ?? timezone }),
    ...(normalizedUntil ? { until: normalizedUntil } : {}),
    ...(recurrence.exceptions?.length
      ? { exceptions: recurrence.exceptions.map((exception) => exception.trim()).filter(Boolean) }
      : {})
  }
}

function normalizeAttendees(
  attendees: Array<{ email: string; name?: string; responseStatus?: string }> | undefined
): Array<{ email: string; name?: string; responseStatus?: string }> {
  const seen = new Set<string>()
  return (attendees ?? []).map((attendee) => {
    const normalized = normalizePerson(attendee, 'attendee')
    const key = normalized.email.toLowerCase()
    if (seen.has(key)) {
      throw new Error(`Duplicate calendar attendee: ${normalized.email}`)
    }
    seen.add(key)
    return normalized
  })
}

function normalizePerson(
  person: { email: string; name?: string; responseStatus?: string },
  label: string
): { email: string; name?: string; responseStatus?: string } {
  const email = requireText(person.email, `${label} email`)
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    throw new Error(`Invalid ${label} email: ${email}`)
  }
  return {
    email,
    ...(person.name?.trim() ? { name: person.name.trim() } : {}),
    ...(person.responseStatus?.trim() ? { responseStatus: person.responseStatus.trim() } : {})
  }
}

function isCalendarLinkField(value: string): value is CalendarLinkField {
  return ['title', 'description', 'time', 'location', 'attendees', 'project'].includes(value)
}

function isCalendarFieldOwner(value: unknown): value is CalendarFieldOwner {
  return value === 'task' || value === 'event' || value === 'manual'
}

function requireText(value: string, label: string): string {
  const normalized = value.trim()
  if (!normalized) {
    throw new Error(`${label} cannot be empty`)
  }
  return normalized
}

function createOpaqueId(prefix: string): string {
  const uuid = globalThis.crypto?.randomUUID?.()
  return uuid
    ? `${prefix}:${uuid}`
    : `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2)}`
}

interface ZonedParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

function formatInstantParts(instant: Date, timezone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(instant)
  const values = Object.fromEntries(
    parts.filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)])
  ) as Record<string, number>
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second
  }
}

function getTimezoneOffsetMinutes(instant: Date, timezone: string): number {
  const parts = formatInstantParts(instant, timezone)
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  )
  return Math.round((asUtc - instant.getTime()) / 60_000)
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}
