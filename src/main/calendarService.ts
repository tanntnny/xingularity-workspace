import { randomUUID } from 'node:crypto'
import type { CalendarSyncResult as SharedCalendarSyncResult } from '../shared/types'
import {
  createCalendarConnection,
  createCalendarLink,
  normalizeCalendarConnection,
  normalizeCalendarEvent,
  type CalendarConnectionRecord,
  type CalendarDomainState,
  type CalendarEventDraft,
  type CalendarEventRecord,
  type CalendarFieldOwnership,
  type CalendarLinkRecord,
  type CalendarErrorCode
} from '../shared/calendarDomain'
import { CalendarStore } from './calendarStore'
import {
  GoogleCalendarError,
  type GoogleAuthorizationResult,
  type GoogleCalendarListResult,
  type GoogleCalendarSyncResult,
  type GooglePkceAuthorizationRequest,
  type GoogleSyncEventsOptions
} from './googleCalendarAdapter'

export interface CalendarGoogleAdapter {
  createAuthorizationRequest(): GooglePkceAuthorizationRequest
  completeAuthorization(
    callback: string | URL,
    expectedState: string,
    request: Pick<GooglePkceAuthorizationRequest, 'codeVerifier'>
  ): Promise<GoogleAuthorizationResult>
  listCalendars(options?: {
    connectionId?: string
    etag?: string
    signal?: AbortSignal
  }): Promise<GoogleCalendarListResult>
  syncEvents(options: GoogleSyncEventsOptions): Promise<GoogleCalendarSyncResult>
  disconnect(): Promise<void>
  revoke(): Promise<void>
}

export interface CalendarServiceOptions {
  defaultTimezone?: string
  now?: () => Date
}

export interface StartedGoogleAuthorization {
  connectionId: string
  // The verifier stays in the main-process pending map and is never returned to a renderer.
  request: Pick<GooglePkceAuthorizationRequest, 'url' | 'state' | 'scopes'>
  connection: CalendarConnectionRecord
}

export interface CalendarSyncServiceResult extends SharedCalendarSyncResult {
  connection: CalendarConnectionRecord
}

export interface DisconnectCalendarOptions {
  deleteCache?: boolean
}

export class CalendarService {
  private readonly pendingAuthorizations = new Map<
    string,
    { state: string; request: GooglePkceAuthorizationRequest }
  >()
  private readonly defaultTimezone?: string
  private readonly now: () => Date

  constructor(
    private readonly store: CalendarStore,
    private readonly googleAdapter: CalendarGoogleAdapter,
    options: CalendarServiceOptions = {}
  ) {
    this.defaultTimezone = options.defaultTimezone
    this.now = options.now ?? (() => new Date())
  }

  async getState(): Promise<CalendarDomainState> {
    return this.store.readState()
  }

  async startGoogleAuthorization(
    accountLabel = 'Google Calendar'
  ): Promise<StartedGoogleAuthorization> {
    const request = this.googleAdapter.createAuthorizationRequest()
    const now = this.now().toISOString()
    const connection = createCalendarConnection(randomUUID(), accountLabel, now)
    this.pendingAuthorizations.set(connection.id, { state: request.state, request })
    await this.store.upsertConnection(connection)
    return {
      connectionId: connection.id,
      request: { url: request.url, state: request.state, scopes: request.scopes },
      connection
    }
  }

  async completeGoogleAuthorization(
    connectionId: string,
    callback: string | URL
  ): Promise<CalendarConnectionRecord> {
    const pending = this.pendingAuthorizations.get(connectionId)
    const connection = await this.requireConnection(connectionId)
    if (!pending) {
      throw new Error(`No pending Google authorization for connection ${connectionId}`)
    }

    try {
      await this.googleAdapter.completeAuthorization(callback, pending.state, pending.request)
      const calendars = await this.googleAdapter.listCalendars({ connectionId })
      const nextConnection = normalizeCalendarConnection({
        ...connection,
        status: 'connected',
        lastError: undefined,
        updatedAt: this.now().toISOString()
      })
      await this.store.upsertConnection(nextConnection)
      for (const calendar of calendars.calendars) {
        await this.store.upsertCalendar({ ...calendar, connectionId })
      }
      return nextConnection
    } catch (error) {
      const errorState = this.toCalendarError(error)
      const status =
        errorState.code === 'cancelled'
          ? 'authorization-cancelled'
          : this.statusForError(errorState.code)
      await this.store.upsertConnection(
        normalizeCalendarConnection({
          ...connection,
          status,
          lastError: errorState,
          updatedAt: this.now().toISOString()
        })
      )
      throw error
    } finally {
      this.pendingAuthorizations.delete(connectionId)
    }
  }

  async cancelGoogleAuthorization(connectionId: string): Promise<CalendarConnectionRecord> {
    this.pendingAuthorizations.delete(connectionId)
    const connection = await this.requireConnection(connectionId)
    const next = normalizeCalendarConnection({
      ...connection,
      status: 'authorization-cancelled',
      lastError: {
        code: 'cancelled',
        message: 'Google Calendar authorization was cancelled',
        occurredAt: this.now().toISOString()
      },
      updatedAt: this.now().toISOString()
    })
    return this.store.upsertConnection(next)
  }

  async selectGoogleCalendars(
    connectionId: string,
    calendarIds: string[]
  ): Promise<CalendarConnectionRecord> {
    const state = await this.store.readState()
    const connection = requireConnection(state, connectionId)
    const available = new Set(
      state.calendars
        .filter((calendar) => calendar.connectionId === connectionId)
        .map((calendar) => calendar.id)
    )
    const selectedCalendarIds = [...new Set(calendarIds.map((id) => id.trim()).filter(Boolean))]
    const unknown = selectedCalendarIds.filter((id) => !available.has(id))
    if (unknown.length > 0) {
      throw new Error(
        `Cannot select calendars that were not returned by Google: ${unknown.join(', ')}`
      )
    }

    const next = normalizeCalendarConnection({
      ...connection,
      selectedCalendarIds,
      updatedAt: this.now().toISOString()
    })
    await this.store.upsertConnection(next)
    for (const calendar of state.calendars.filter(
      (candidate) => candidate.connectionId === connectionId
    )) {
      await this.store.upsertCalendar({
        ...calendar,
        selected: selectedCalendarIds.includes(calendar.id)
      })
    }
    return next
  }

  async createLocalEvent(draft: CalendarEventDraft): Promise<CalendarEventRecord> {
    const event = normalizeCalendarEvent(
      { ...draft, source: 'local', access: 'read-write' },
      { defaultTimezone: this.defaultTimezone, now: this.now().toISOString() }
    )
    return this.store.upsertEvent(event)
  }

  async updateLocalEvent(eventId: string, draft: CalendarEventDraft): Promise<CalendarEventRecord> {
    const state = await this.store.readState()
    const current = state.events.find((event) => event.id === eventId)
    if (!current) {
      throw new Error(`Calendar event not found: ${eventId}`)
    }
    if (current.source !== 'local' || current.access !== 'read-write') {
      throw new Error('Imported Google calendar events are read-only')
    }
    const event = normalizeCalendarEvent(
      {
        ...draft,
        id: eventId,
        source: 'local',
        access: 'read-write',
        taskId: current.taskId,
        projectId: current.projectId
      },
      { defaultTimezone: this.defaultTimezone, now: this.now().toISOString() }
    )
    return this.store.upsertEvent(event)
  }

  async linkTaskToEvent(input: {
    taskId: string
    eventId: string
    id?: string
    ownership?: 'task' | 'event' | 'manual'
    fieldOwnership?: CalendarFieldOwnership
  }): Promise<CalendarLinkRecord> {
    const state = await this.store.readState()
    if (!state.events.some((event) => event.id === input.eventId)) {
      throw new Error(`Cannot link to missing calendar event: ${input.eventId}`)
    }
    const link = createCalendarLink({
      ...input,
      updatedAt: this.now().toISOString()
    })
    return this.store.upsertLink(link)
  }

  async unlinkTaskFromEvent(linkId: string): Promise<boolean> {
    return this.store.removeLink(linkId)
  }

  async syncGoogleConnection(
    connectionId: string,
    options: { signal?: AbortSignal } = {}
  ): Promise<CalendarSyncServiceResult> {
    let connection = await this.requireConnection(connectionId)
    if (connection.status === 'disconnected' || connection.status === 'revoked') {
      throw new Error(`Google calendar connection is ${connection.status}`)
    }

    const result: Omit<SharedCalendarSyncResult, 'connectionId'> = {
      imported: 0,
      updated: 0,
      deleted: 0,
      skipped: 0,
      warnings: []
    }

    try {
      for (const calendarId of connection.selectedCalendarIds) {
        const checkpoint = connection.syncStates[calendarId] ?? {}
        let syncResult = await this.googleAdapter.syncEvents({
          calendarId,
          connectionId,
          cursor: checkpoint.cursor,
          etag: checkpoint.etag,
          signal: options.signal
        })
        let fullSync = false
        if (syncResult.fullSyncRequired) {
          fullSync = true
          syncResult = await this.googleAdapter.syncEvents({
            calendarId,
            connectionId,
            fullSync: true,
            signal: options.signal
          })
        }

        const events = syncResult.changes.flatMap((change) => (change.event ? [change.event] : []))
        const deletedExternalIds = syncResult.changes
          .filter((change) => change.deleted)
          .map((change) => change.externalId)
        const applied = await this.store.applyImportedEventChanges({
          connectionId,
          calendarId,
          events,
          deletedExternalIds,
          fullSync
        })
        result.imported += applied.imported
        result.updated += applied.updated
        result.deleted += applied.deleted
        result.warnings.push(...this.syncWarnings(syncResult))

        connection = normalizeCalendarConnection({
          ...connection,
          status: 'connected',
          syncStates: {
            ...connection.syncStates,
            [calendarId]: {
              ...(syncResult.nextCursor
                ? { cursor: syncResult.nextCursor }
                : fullSync
                  ? {}
                  : checkpoint.cursor
                    ? { cursor: checkpoint.cursor }
                    : {}),
              ...(syncResult.etag
                ? { etag: syncResult.etag }
                : checkpoint.etag
                  ? { etag: checkpoint.etag }
                  : {}),
              lastSyncedAt: this.now().toISOString()
            }
          },
          syncCursor: fullSync
            ? syncResult.nextCursor
            : (syncResult.nextCursor ?? connection.syncCursor),
          etag: fullSync ? syncResult.etag : (syncResult.etag ?? connection.etag),
          lastSyncAt: this.now().toISOString(),
          lastError: undefined,
          updatedAt: this.now().toISOString()
        })
        await this.store.upsertConnection(connection)
        if (syncResult.nextCursor) {
          result.nextCursor = syncResult.nextCursor
        }
      }

      connection = normalizeCalendarConnection({
        ...connection,
        status: 'connected',
        lastSyncAt: this.now().toISOString(),
        lastError: undefined,
        updatedAt: this.now().toISOString()
      })
      await this.store.upsertConnection(connection)
      return { connectionId, ...result, connection }
    } catch (error) {
      const errorState = this.toCalendarError(error)
      connection = normalizeCalendarConnection({
        ...connection,
        status: this.statusForError(errorState.code),
        lastError: errorState,
        updatedAt: this.now().toISOString()
      })
      await this.store.upsertConnection(connection)
      throw error
    }
  }

  async deleteLocalCache(connectionId: string): Promise<number> {
    const connection = await this.requireConnection(connectionId)
    const deleted = await this.store.deleteImportedCache(connectionId)
    const next = normalizeCalendarConnection({
      ...connection,
      syncStates: {},
      syncCursor: undefined,
      etag: undefined,
      lastSyncAt: undefined,
      updatedAt: this.now().toISOString()
    })
    await this.store.upsertConnection(next)
    return deleted
  }

  async disconnectGoogleConnection(
    connectionId: string,
    options: DisconnectCalendarOptions = {}
  ): Promise<CalendarConnectionRecord> {
    const connection = await this.requireConnection(connectionId)
    await this.googleAdapter.disconnect()
    if (options.deleteCache ?? true) {
      await this.store.deleteImportedCache(connectionId)
    }
    const next = normalizeCalendarConnection({
      ...connection,
      status: 'disconnected',
      selectedCalendarIds: [],
      syncStates: {},
      syncCursor: undefined,
      etag: undefined,
      lastSyncAt: undefined,
      updatedAt: this.now().toISOString()
    })
    return this.store.upsertConnection(next)
  }

  async revokeGoogleConnection(
    connectionId: string,
    options: DisconnectCalendarOptions = {}
  ): Promise<CalendarConnectionRecord> {
    const connection = await this.requireConnection(connectionId)
    try {
      await this.googleAdapter.revoke()
    } catch (error) {
      const errorState = this.toCalendarError(error)
      await this.store.upsertConnection(
        normalizeCalendarConnection({
          ...connection,
          status: this.statusForError(errorState.code),
          lastError: errorState,
          updatedAt: this.now().toISOString()
        })
      )
      throw error
    }
    if (options.deleteCache ?? true) {
      await this.store.deleteImportedCache(connectionId)
    }
    return this.store.upsertConnection(
      normalizeCalendarConnection({
        ...connection,
        status: 'revoked',
        selectedCalendarIds: [],
        syncStates: {},
        syncCursor: undefined,
        etag: undefined,
        lastSyncAt: undefined,
        updatedAt: this.now().toISOString()
      })
    )
  }

  private async requireConnection(connectionId: string): Promise<CalendarConnectionRecord> {
    return requireConnection(await this.store.readState(), connectionId)
  }

  private toCalendarError(error: unknown): {
    code: CalendarErrorCode
    message: string
    occurredAt: string
    retryAt?: string
    status?: number
  } {
    const occurredAt = this.now().toISOString()
    if (error instanceof GoogleCalendarError) {
      const code: CalendarErrorCode =
        error.code === 'http'
          ? 'unknown'
          : error.code === 'invalid-response'
            ? 'invalid-response'
            : error.code
      return {
        code,
        message: error.message,
        occurredAt,
        ...(error.retryAt ? { retryAt: error.retryAt } : {}),
        ...(error.status ? { status: error.status } : {})
      }
    }
    return {
      code: 'unknown',
      message: error instanceof Error ? error.message : 'Google Calendar operation failed',
      occurredAt
    }
  }

  private statusForError(code: CalendarErrorCode): CalendarConnectionRecord['status'] {
    if (code === 'cancelled') {
      return 'sync-cancelled'
    }
    if (code === 'reauthorization-required') {
      return 'reauthorization-required'
    }
    if (code === 'revoked') {
      return 'revoked'
    }
    if (code === 'offline') {
      return 'offline'
    }
    return 'error'
  }

  private syncWarnings(syncResult: GoogleCalendarSyncResult): string[] {
    return syncResult.notModified
      ? ['Google calendar returned not modified; cached events were retained']
      : []
  }
}

function requireConnection(
  state: CalendarDomainState,
  connectionId: string
): CalendarConnectionRecord {
  const connection = state.connections.find((candidate) => candidate.id === connectionId)
  if (!connection) {
    throw new Error(`Calendar connection not found: ${connectionId}`)
  }
  return connection
}
