import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  calendarEventFromTask,
  createCalendarConnection,
  createCalendarLink,
  localDateTimeToInstant,
  normalizeCalendarEvent,
  type CalendarDomainState
} from '../src/shared/calendarDomain'
import { CalendarStore } from '../src/main/calendarStore'
import { CalendarService } from '../src/main/calendarService'
import { GOOGLE_CALENDAR_READONLY_SCOPE } from '../src/main/googleCalendarAdapter'

describe('calendar domain semantics', () => {
  it('normalizes all-day events as date-only ranges with an exclusive end', () => {
    const event = normalizeCalendarEvent({
      title: 'Release day',
      allDay: true,
      start: '2026-08-17'
    })

    expect(event).toMatchObject({
      allDay: true,
      start: '2026-08-17',
      end: '2026-08-18',
      source: 'local',
      access: 'read-write'
    })
    expect(event.timezone).toBeUndefined()
  })

  it('requires ordered ISO instants and an IANA timezone for timed events', () => {
    const event = normalizeCalendarEvent({
      title: 'Design review',
      allDay: false,
      start: '2026-08-17T09:00:00+07:00',
      end: '2026-08-17T10:00:00+07:00',
      timezone: 'Asia/Bangkok',
      recurrence: { rrule: 'freq=weekly;byday=MO' }
    })

    expect(event).toMatchObject({
      start: '2026-08-17T02:00:00.000Z',
      end: '2026-08-17T03:00:00.000Z',
      timezone: 'Asia/Bangkok',
      recurrence: { rrule: 'FREQ=WEEKLY;BYDAY=MO', timezone: 'Asia/Bangkok' }
    })
    expect(() =>
      normalizeCalendarEvent({
        title: 'Invalid',
        allDay: false,
        start: '2026-08-17T09:00',
        end: '2026-08-17T10:00',
        timezone: 'Asia/Bangkok'
      })
    ).toThrow(/ISO instants/)
  })

  it('rejects nonexistent and ambiguous local times at DST boundaries', () => {
    expect(() => localDateTimeToInstant('2026-03-08', '02:30', 'America/New_York')).toThrow(
      /does not exist/
    )
    expect(() => localDateTimeToInstant('2026-11-01', '01:30', 'America/New_York')).toThrow(
      /ambiguous/
    )
  })

  it('projects legacy CalendarTask records without changing task identity', () => {
    const event = calendarEventFromTask(
      {
        id: 'task-1',
        title: 'Prepare launch notes',
        tags: ['release'],
        date: '2026-08-17',
        endDate: '2026-08-18',
        completed: false,
        status: 'pending',
        createdAt: '2026-08-01T00:00:00.000Z',
        priority: 'high',
        reminders: [],
        projectId: 'project-1'
      },
      { defaultTimezone: 'UTC' }
    )

    expect(event).toMatchObject({
      id: 'local-task:task-1',
      taskId: 'task-1',
      projectId: 'project-1',
      allDay: true,
      start: '2026-08-17',
      end: '2026-08-19'
    })
  })
})

describe('CalendarStore canonical persistence', () => {
  it('reads legacy tasks, persists canonical records, and never writes token fields', async () => {
    const vaultRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-calendar-'))
    const legacyTask = {
      id: 'legacy-task',
      title: 'Legacy task',
      tags: [],
      date: '2026-08-17',
      completed: false,
      status: 'pending',
      createdAt: '2026-08-01T00:00:00.000Z',
      priority: 'medium',
      reminders: []
    }
    await fs.mkdir(path.join(vaultRoot, 'calendar'), { recursive: true })
    await fs.writeFile(
      path.join(vaultRoot, 'calendar', 'tasks.json'),
      JSON.stringify([legacyTask]),
      'utf8'
    )

    const store = new CalendarStore(vaultRoot)
    const projected = await store.readState()
    expect(projected.events).toHaveLength(1)
    expect(projected.events[0]).toMatchObject({ id: 'local-task:legacy-task' })

    const event = normalizeCalendarEvent({
      id: 'local-event',
      title: 'Local event',
      allDay: true,
      start: '2026-08-20',
      end: '2026-08-21'
    })
    const connection = createCalendarConnection('connection-1', 'Google account')
    const link = createCalendarLink({ taskId: 'legacy-task', eventId: event.id })
    const state: CalendarDomainState = {
      schemaVersion: 1,
      events: [event],
      links: [link],
      connections: [connection],
      calendars: []
    }

    await store.writeState(state)
    const raw = await fs.readFile(store.paths.connections, 'utf8')
    expect(raw).not.toContain('refreshToken')
    expect(raw).not.toContain('accessToken')
    const snapshotBeforeRejectedWrite = await fs.readFile(store.paths.state, 'utf8')
    await expect(
      store.writeState({
        ...state,
        connections: [{ ...connection, refreshToken: 'must-not-persist' } as never]
      })
    ).rejects.toThrow(/credential material/)
    expect(await fs.readFile(store.paths.state, 'utf8')).toBe(snapshotBeforeRejectedWrite)

    await store.migrateLegacyTasks()
    const migrated = await store.readState()
    expect(migrated.events.map((candidate) => candidate.id)).toEqual(
      expect.arrayContaining(['local-event', 'local-task:legacy-task'])
    )
    expect(migrated.links).toEqual(
      expect.arrayContaining([expect.objectContaining({ taskId: 'legacy-task' })])
    )
  })

  it('reads one committed aggregate instead of mixing compatibility mirrors', async () => {
    const vaultRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-calendar-snapshot-'))
    const store = new CalendarStore(vaultRoot)
    const event = normalizeCalendarEvent({
      id: 'committed-event',
      title: 'Committed event',
      allDay: true,
      start: '2026-08-20',
      end: '2026-08-21'
    })
    const connection = createCalendarConnection('committed-connection', 'Committed account')

    await store.writeState({
      schemaVersion: 1,
      events: [event],
      links: [],
      connections: [connection],
      calendars: []
    })

    expect(JSON.parse(await fs.readFile(store.paths.state, 'utf8'))).toMatchObject({
      kind: 'xingularity.calendar.state',
      version: 1,
      state: {
        events: [expect.objectContaining({ id: 'committed-event' })],
        connections: [expect.objectContaining({ id: 'committed-connection' })]
      }
    })

    // Simulate a crash while the compatibility mirrors are being refreshed.
    // The committed aggregate must remain the only generation visible to reads.
    await fs.writeFile(store.paths.events, JSON.stringify({ version: 1, records: [] }), 'utf8')
    await fs.writeFile(store.paths.connections, JSON.stringify({ version: 1, records: [] }), 'utf8')

    await expect(store.readState()).resolves.toMatchObject({
      events: [expect.objectContaining({ id: 'committed-event' })],
      connections: [expect.objectContaining({ id: 'committed-connection' })]
    })
  })

  it('falls back to legacy collection files when no aggregate snapshot exists', async () => {
    const vaultRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-calendar-legacy-'))
    const calendarDir = path.join(vaultRoot, 'calendar')
    await fs.mkdir(calendarDir, { recursive: true })
    const event = normalizeCalendarEvent({
      id: 'legacy-collection-event',
      title: 'Legacy collection event',
      allDay: true,
      start: '2026-08-22',
      end: '2026-08-23'
    })
    await fs.writeFile(
      path.join(calendarDir, 'events.json'),
      JSON.stringify({ version: 1, records: [event] }),
      'utf8'
    )

    const store = new CalendarStore(vaultRoot)
    await expect(store.readState()).resolves.toMatchObject({
      events: [expect.objectContaining({ id: 'legacy-collection-event' })],
      links: [],
      connections: [],
      calendars: []
    })
  })
})

describe('CalendarService integration boundary', () => {
  it('keeps the PKCE verifier in main state and persists a read-only sync checkpoint', async () => {
    const vaultRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-calendar-service-'))
    const store = new CalendarStore(vaultRoot)
    const nowValue = new Date('2026-08-17T00:00:00.000Z')
    const importedEvent = normalizeCalendarEvent({
      id: 'provider-event',
      title: 'Imported meeting',
      allDay: true,
      start: '2026-08-17',
      end: '2026-08-18',
      source: 'google',
      access: 'read-only',
      externalId: 'provider-event',
      providerCalendarId: 'primary',
      updatedAt: nowValue.toISOString()
    })
    const adapter = {
      createAuthorizationRequest: () => ({
        url: 'https://accounts.google.com/o/oauth2/v2/auth?state=state',
        state: 'state',
        codeVerifier: 'verifier-stays-in-main',
        codeChallenge: 'challenge',
        scopes: [GOOGLE_CALENDAR_READONLY_SCOPE]
      }),
      async completeAuthorization(
        _callback: string | URL,
        _state: string,
        request: { codeVerifier: string }
      ) {
        expect(request.codeVerifier).toBe('verifier-stays-in-main')
        return {
          expiresAt: nowValue.getTime() + 3600_000,
          scopes: [GOOGLE_CALENDAR_READONLY_SCOPE],
          refreshTokenStored: true
        }
      },
      async listCalendars() {
        return {
          calendars: [
            {
              id: 'primary',
              connectionId: 'pending',
              provider: 'google' as const,
              name: 'Primary',
              selected: false,
              access: 'read-only' as const,
              capabilities: { canReadEvents: true as const, canWriteEvents: false as const }
            }
          ],
          notModified: false
        }
      },
      async syncEvents() {
        return {
          calendarId: 'primary',
          changes: [{ externalId: 'provider-event', deleted: false, event: importedEvent }],
          nextCursor: 'cursor-1',
          etag: 'etag-1',
          notModified: false
        }
      },
      async disconnect() {
        return undefined
      },
      async revoke() {
        return undefined
      }
    }
    const service = new CalendarService(store, adapter, {
      defaultTimezone: 'UTC',
      now: () => nowValue
    })

    const started = await service.startGoogleAuthorization('Account')
    expect('codeVerifier' in started.request).toBe(false)
    const connected = await service.completeGoogleAuthorization(
      started.connectionId,
      'xingularity://oauth/google?code=code&state=state'
    )
    expect(connected.status).toBe('connected')
    await service.selectGoogleCalendars(started.connectionId, ['primary'])
    const sync = await service.syncGoogleConnection(started.connectionId)

    expect(sync).toMatchObject({ imported: 1, nextCursor: 'cursor-1' })
    const state = await service.getState()
    expect(state.events).toEqual([
      expect.objectContaining({ source: 'google', access: 'read-only' })
    ])
    expect(state.connections[0]).toMatchObject({
      status: 'connected',
      syncCursor: 'cursor-1',
      etag: 'etag-1'
    })

    const link = await service.linkTaskToEvent({ taskId: 'task-1', eventId: 'provider-event' })
    expect(link.fieldOwnership).toMatchObject({ title: 'manual', time: 'manual' })
    await expect(
      service.updateLocalEvent('provider-event', {
        title: 'Do not mutate import',
        allDay: true,
        start: '2026-08-17',
        end: '2026-08-18'
      })
    ).rejects.toThrow(/read-only/)
  })
})
