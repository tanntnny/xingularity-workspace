import fs from 'node:fs/promises'
import path from 'node:path'
import type { CalendarTask } from '../shared/types'
import {
  CALENDAR_DOMAIN_SCHEMA_VERSION,
  calendarEventFromTask,
  createCalendarLink,
  normalizeCalendarConnection,
  normalizeCalendarEvent,
  normalizeCalendarLink,
  normalizeExternalCalendar,
  type CalendarConnectionRecord,
  type CalendarDomainState,
  type CalendarEventRecord,
  type CalendarLinkRecord,
  type ExternalCalendarRecord
} from '../shared/calendarDomain'
import {
  getLegacyPageVaultCalendarTasksPath,
  getLegacyRootVaultCalendarTasksPath,
  getLegacySystemVaultCalendarTasksPath,
  getVaultCalendarDir,
  getVaultCalendarTasksPath,
  getVaultSettingsPath,
  getLegacyVaultSettingsPath,
  getVaultTasksDir
} from './vaultData'
import { writeFileAtomically } from './atomicFile'

const EVENTS_FILE_NAME = 'events.json'
const LINKS_FILE_NAME = 'links.json'
const CONNECTIONS_FILE_NAME = 'connections.json'
const CALENDARS_FILE_NAME = 'calendars.json'
const STATE_FILE_NAME = 'state.json'
const CALENDAR_STATE_SNAPSHOT_KIND = 'xingularity.calendar.state'

export interface CalendarStorePaths {
  directory: string
  state: string
  events: string
  links: string
  connections: string
  calendars: string
}

export interface ImportedEventChangeApplication {
  connectionId: string
  calendarId: string
  events: CalendarEventRecord[]
  deletedExternalIds: string[]
  fullSync: boolean
}

export interface ImportedEventChangeResult {
  imported: number
  updated: number
  deleted: number
}

interface CollectionEnvelope<T> {
  version: typeof CALENDAR_DOMAIN_SCHEMA_VERSION
  records: T[]
}

interface CalendarStateSnapshot {
  kind: typeof CALENDAR_STATE_SNAPSHOT_KIND
  version: typeof CALENDAR_DOMAIN_SCHEMA_VERSION
  state: CalendarDomainState
}

export class CalendarStore {
  private readonly rootPath: string
  private readonly pathsValue: CalendarStorePaths
  private writeQueue: Promise<void> = Promise.resolve()

  constructor(vaultRoot: string) {
    this.rootPath = path.resolve(vaultRoot)
    const directory = getVaultCalendarDir(this.rootPath)
    this.pathsValue = {
      directory,
      state: path.join(directory, STATE_FILE_NAME),
      events: path.join(directory, EVENTS_FILE_NAME),
      links: path.join(directory, LINKS_FILE_NAME),
      connections: path.join(directory, CONNECTIONS_FILE_NAME),
      calendars: path.join(directory, CALENDARS_FILE_NAME)
    }
  }

  get paths(): CalendarStorePaths {
    return { ...this.pathsValue }
  }

  async read(): Promise<CalendarDomainState> {
    return this.readState()
  }

  async write(state: CalendarDomainState): Promise<void> {
    return this.writeState(state)
  }

  async readState(): Promise<CalendarDomainState> {
    // The aggregate is the commit point. It is replaced with one atomic rename,
    // so readers observe either the previous complete state or the next one.
    // Collection files remain compatibility mirrors for existing callers and
    // are used as the fallback for vaults created before the aggregate existed.
    const snapshot = await this.readStateSnapshot()
    const events = snapshot
      ? [...snapshot.events]
      : await this.readCollection<CalendarEventRecord>(this.pathsValue.events)
    const links = snapshot
      ? [...snapshot.links]
      : await this.readCollection<CalendarLinkRecord>(this.pathsValue.links)
    const connections = snapshot
      ? [...snapshot.connections]
      : await this.readCollection<CalendarConnectionRecord>(this.pathsValue.connections)
    const calendars = snapshot
      ? [...snapshot.calendars]
      : await this.readCollection<ExternalCalendarRecord>(this.pathsValue.calendars)

    const legacy = await this.readLegacyTaskProjection()
    const eventIds = new Set(events.map((event) => event.id))
    const linkIds = new Set(links.map((link) => link.id))

    for (const event of legacy.events) {
      if (!eventIds.has(event.id)) {
        events.push(event)
        eventIds.add(event.id)
      }
    }
    for (const link of legacy.links) {
      if (!linkIds.has(link.id)) {
        links.push(link)
        linkIds.add(link.id)
      }
    }

    return {
      schemaVersion: CALENDAR_DOMAIN_SCHEMA_VERSION,
      events: events.map((event) => normalizeStoredEvent(event)),
      links: links.map((link) => normalizeCalendarLink(link)),
      connections: connections.map((connection) => normalizeCalendarConnection(connection)),
      calendars: calendars.map((calendar) => normalizeExternalCalendar(calendar))
    }
  }

  async writeState(state: CalendarDomainState): Promise<void> {
    await this.enqueueWrite(() => this.writeStateUnlocked(state))
  }

  async readEvents(): Promise<CalendarEventRecord[]> {
    return (await this.readState()).events
  }

  async readLinks(): Promise<CalendarLinkRecord[]> {
    return (await this.readState()).links
  }

  async readConnections(): Promise<CalendarConnectionRecord[]> {
    return (await this.readState()).connections
  }

  async readCalendars(): Promise<ExternalCalendarRecord[]> {
    return (await this.readState()).calendars
  }

  async upsertEvent(event: CalendarEventRecord): Promise<CalendarEventRecord> {
    const normalized = normalizeStoredEvent(event)
    await this.enqueueWrite(async () => {
      const state = await this.readState()
      const index = state.events.findIndex(
        (candidate) =>
          candidate.id === normalized.id ||
          (normalized.externalId &&
            candidate.connectionId === normalized.connectionId &&
            candidate.calendarId === normalized.calendarId &&
            candidate.externalId === normalized.externalId)
      )
      if (index >= 0) {
        state.events[index] = normalized
      } else {
        state.events.push(normalized)
      }
      await this.writeStateUnlocked(state)
    })
    return normalized
  }

  async removeEvent(eventId: string): Promise<boolean> {
    let removed = false
    await this.enqueueWrite(async () => {
      const state = await this.readState()
      const nextEvents = state.events.filter((event) => {
        const matches = event.id === eventId
        removed ||= matches
        return !matches
      })
      if (!removed) {
        return
      }
      state.events = nextEvents
      state.links = state.links.filter((link) => link.eventId !== eventId)
      await this.writeStateUnlocked(state)
    })
    return removed
  }

  async upsertLink(link: CalendarLinkRecord): Promise<CalendarLinkRecord> {
    const normalized = normalizeCalendarLink(link)
    await this.enqueueWrite(async () => {
      const state = await this.readState()
      const index = state.links.findIndex((candidate) => candidate.id === normalized.id)
      if (index >= 0) {
        state.links[index] = normalized
      } else {
        state.links.push(normalized)
      }
      await this.writeStateUnlocked(state)
    })
    return normalized
  }

  async removeLink(linkId: string): Promise<boolean> {
    let removed = false
    await this.enqueueWrite(async () => {
      const state = await this.readState()
      const nextLinks = state.links.filter((link) => {
        const matches = link.id === linkId
        removed ||= matches
        return !matches
      })
      if (!removed) {
        return
      }
      state.links = nextLinks
      await this.writeStateUnlocked(state)
    })
    return removed
  }

  async upsertConnection(connection: CalendarConnectionRecord): Promise<CalendarConnectionRecord> {
    const normalized = normalizeCalendarConnection(connection)
    await this.enqueueWrite(async () => {
      const state = await this.readState()
      const index = state.connections.findIndex((candidate) => candidate.id === normalized.id)
      if (index >= 0) {
        state.connections[index] = normalized
      } else {
        state.connections.push(normalized)
      }
      await this.writeStateUnlocked(state)
    })
    return normalized
  }

  async removeConnection(connectionId: string): Promise<boolean> {
    let removed = false
    await this.enqueueWrite(async () => {
      const state = await this.readState()
      const nextConnections = state.connections.filter((connection) => {
        const matches = connection.id === connectionId
        removed ||= matches
        return !matches
      })
      if (!removed) {
        return
      }
      state.connections = nextConnections
      state.calendars = state.calendars.filter((calendar) => calendar.connectionId !== connectionId)
      state.events = state.events.filter((event) => event.connectionId !== connectionId)
      const eventIds = new Set(state.events.map((event) => event.id))
      state.links = state.links.filter((link) => eventIds.has(link.eventId))
      await this.writeStateUnlocked(state)
    })
    return removed
  }

  async upsertCalendar(calendar: ExternalCalendarRecord): Promise<ExternalCalendarRecord> {
    const normalized = normalizeExternalCalendar(calendar)
    await this.enqueueWrite(async () => {
      const state = await this.readState()
      const index = state.calendars.findIndex((candidate) => candidate.id === normalized.id)
      if (index >= 0) {
        state.calendars[index] = normalized
      } else {
        state.calendars.push(normalized)
      }
      await this.writeStateUnlocked(state)
    })
    return normalized
  }

  async deleteImportedCache(connectionId: string, calendarId?: string): Promise<number> {
    let deleted = 0
    await this.enqueueWrite(async () => {
      const state = await this.readState()
      const removedEventIds = new Set<string>()
      state.events = state.events.filter((event) => {
        const matches =
          event.source === 'google' &&
          event.connectionId === connectionId &&
          (!calendarId || event.calendarId === calendarId)
        if (matches) {
          deleted += 1
          removedEventIds.add(event.id)
        }
        return !matches
      })
      if (deleted === 0) {
        return
      }
      state.links = state.links.filter((link) => !removedEventIds.has(link.eventId))
      await this.writeStateUnlocked(state)
    })
    return deleted
  }

  async applyImportedEventChanges(
    input: ImportedEventChangeApplication
  ): Promise<ImportedEventChangeResult> {
    const result: ImportedEventChangeResult = { imported: 0, updated: 0, deleted: 0 }
    await this.enqueueWrite(async () => {
      const state = await this.readState()
      const deletedIds = new Set<string>()
      const current = state.events.filter(
        (event) =>
          event.source === 'google' &&
          event.connectionId === input.connectionId &&
          event.calendarId === input.calendarId
      )

      if (input.fullSync) {
        const seen = new Set(input.events.map((event) => event.externalId).filter(Boolean))
        state.events = state.events.filter((event) => {
          const belongs = current.some((candidate) => candidate.id === event.id)
          const keep = !belongs || (event.externalId ? seen.has(event.externalId) : false)
          if (belongs && !keep) {
            deletedIds.add(event.id)
            result.deleted += 1
          }
          return keep
        })
      }

      for (const event of input.events) {
        const normalized = normalizeStoredEvent({
          ...event,
          source: 'google',
          access: 'read-only',
          connectionId: input.connectionId,
          providerCalendarId: input.calendarId,
          calendarId: input.calendarId
        })
        const index = state.events.findIndex(
          (candidate) =>
            candidate.id === normalized.id ||
            (normalized.externalId &&
              candidate.source === 'google' &&
              candidate.connectionId === input.connectionId &&
              candidate.calendarId === input.calendarId &&
              candidate.externalId === normalized.externalId)
        )
        if (index >= 0) {
          state.events[index] = normalized
          result.updated += 1
        } else {
          state.events.push(normalized)
          result.imported += 1
        }
      }

      if (input.deletedExternalIds.length > 0) {
        const deletedExternalIds = new Set(input.deletedExternalIds)
        state.events = state.events.filter((event) => {
          const matches =
            event.source === 'google' &&
            event.connectionId === input.connectionId &&
            event.calendarId === input.calendarId &&
            Boolean(event.externalId && deletedExternalIds.has(event.externalId))
          if (matches) {
            deletedIds.add(event.id)
            result.deleted += 1
          }
          return !matches
        })
      }

      if (deletedIds.size > 0) {
        state.links = state.links.filter((link) => !deletedIds.has(link.eventId))
      }
      await this.writeStateUnlocked(state)
    })
    return result
  }

  async migrateLegacyTasks(
    options: { defaultTimezone?: string; now?: string } = {}
  ): Promise<number> {
    const legacy = await this.readLegacyTaskProjection(options)
    if (legacy.events.length === 0) {
      return 0
    }

    await this.enqueueWrite(async () => {
      const state = await this.readState()
      const eventIds = new Set(state.events.map((event) => event.id))
      const linkIds = new Set(state.links.map((link) => link.id))
      for (const event of legacy.events) {
        if (!eventIds.has(event.id)) {
          state.events.push(event)
          eventIds.add(event.id)
        }
      }
      for (const link of legacy.links) {
        if (!linkIds.has(link.id)) {
          state.links.push(link)
          linkIds.add(link.id)
        }
      }
      await this.writeStateUnlocked(state)
    })
    return legacy.events.length
  }

  private async writeStateUnlocked(state: CalendarDomainState): Promise<void> {
    const normalized: CalendarDomainState = {
      schemaVersion: CALENDAR_DOMAIN_SCHEMA_VERSION,
      events: state.events.map((event) => normalizeStoredEvent(event)),
      links: state.links.map((link) => normalizeCalendarLink(link)),
      connections: state.connections.map((connection) => normalizeCalendarConnection(connection)),
      calendars: state.calendars.map((calendar) => normalizeExternalCalendar(calendar))
    }
    assertNoCredentialMaterial(normalized)

    // Commit the complete domain first. If the process stops while compatibility
    // mirrors are being refreshed, readState still has one coherent generation
    // to read from after restart.
    const snapshot: CalendarStateSnapshot = {
      kind: CALENDAR_STATE_SNAPSHOT_KIND,
      version: CALENDAR_DOMAIN_SCHEMA_VERSION,
      state: normalized
    }
    await writeFileAtomically(this.pathsValue.state, JSON.stringify(snapshot, null, 2))

    await Promise.all([
      this.writeCollection(this.pathsValue.events, normalized.events),
      this.writeCollection(this.pathsValue.links, normalized.links),
      this.writeCollection(this.pathsValue.connections, normalized.connections),
      this.writeCollection(this.pathsValue.calendars, normalized.calendars)
    ])
  }

  private async enqueueWrite(action: () => Promise<void>): Promise<void> {
    const next = this.writeQueue.then(action, action)
    this.writeQueue = next.catch(() => undefined)
    await next
  }

  private async readCollection<T>(filePath: string): Promise<T[]> {
    try {
      const raw = await fs.readFile(filePath, 'utf-8')
      const parsed: unknown = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        return parsed as T[]
      }
      if (
        parsed &&
        typeof parsed === 'object' &&
        Array.isArray((parsed as Partial<CollectionEnvelope<T>>).records)
      ) {
        return (parsed as CollectionEnvelope<T>).records
      }
      throw new Error(`Calendar collection must contain a records array: ${filePath}`)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return []
      }
      throw error
    }
  }

  private async readStateSnapshot(): Promise<CalendarDomainState | null> {
    try {
      const raw = await fs.readFile(this.pathsValue.state, 'utf-8')
      const parsed: unknown = JSON.parse(raw)
      if (!isCalendarStateSnapshot(parsed)) {
        throw new Error(`Calendar state snapshot is invalid: ${this.pathsValue.state}`)
      }
      return parsed.state
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null
      }
      throw error
    }
  }

  private async writeCollection<T>(filePath: string, records: T[]): Promise<void> {
    const envelope: CollectionEnvelope<T> = {
      version: CALENDAR_DOMAIN_SCHEMA_VERSION,
      records
    }
    await writeFileAtomically(filePath, JSON.stringify(envelope, null, 2))
  }

  private async readLegacyTaskProjection(
    options: { defaultTimezone?: string; now?: string } = {}
  ): Promise<{ events: CalendarEventRecord[]; links: CalendarLinkRecord[] }> {
    const tasks = await this.readLegacyTasks()
    const events: CalendarEventRecord[] = []
    const links: CalendarLinkRecord[] = []
    for (const task of tasks) {
      const event = calendarEventFromTask(task, options)
      if (!event) {
        continue
      }
      events.push(event)
      links.push(
        createCalendarLink({
          id: `legacy-task-link:${task.id}`,
          taskId: task.id,
          eventId: event.id,
          ownership: 'task',
          updatedAt: task.updatedAt ?? task.createdAt ?? options.now
        })
      )
    }
    return { events, links }
  }

  private async readLegacyTasks(): Promise<CalendarTask[]> {
    const byId = new Map<string, CalendarTask>()
    const candidateFiles = [
      getVaultCalendarTasksPath(this.rootPath),
      getLegacyRootVaultCalendarTasksPath(this.rootPath),
      getLegacyPageVaultCalendarTasksPath(this.rootPath),
      getLegacySystemVaultCalendarTasksPath(this.rootPath),
      getVaultSettingsPath(this.rootPath),
      getLegacyVaultSettingsPath(this.rootPath)
    ]

    for (const filePath of candidateFiles) {
      const tasks = await readTaskFile(filePath)
      for (const task of tasks) {
        byId.set(task.id, task)
      }
    }

    try {
      const entries = await fs.readdir(getVaultTasksDir(this.rootPath), { withFileTypes: true })
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith('.json')) {
          continue
        }
        const tasks = await readTaskFile(path.join(getVaultTasksDir(this.rootPath), entry.name))
        for (const task of tasks) {
          byId.set(task.id, task)
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error
      }
    }

    return [...byId.values()]
  }
}

function normalizeStoredEvent(event: CalendarEventRecord): CalendarEventRecord {
  return normalizeCalendarEvent(
    {
      ...event,
      providerCalendarId: event.providerCalendarId ?? event.calendarId,
      access: event.source === 'google' ? 'read-only' : event.access
    },
    { now: event.updatedAt, defaultTimezone: event.timezone }
  )
}

function isCalendarStateSnapshot(value: unknown): value is CalendarStateSnapshot {
  if (!value || typeof value !== 'object') {
    return false
  }
  const candidate = value as Partial<CalendarStateSnapshot>
  const state = candidate.state
  return Boolean(
    candidate.kind === CALENDAR_STATE_SNAPSHOT_KIND &&
    candidate.version === CALENDAR_DOMAIN_SCHEMA_VERSION &&
    state &&
    state.schemaVersion === CALENDAR_DOMAIN_SCHEMA_VERSION &&
    Array.isArray(state.events) &&
    Array.isArray(state.links) &&
    Array.isArray(state.connections) &&
    Array.isArray(state.calendars)
  )
}

async function readTaskFile(filePath: string): Promise<CalendarTask[]> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8')
    const parsed: unknown = JSON.parse(raw)
    const candidates = isCalendarTask(parsed)
      ? [parsed]
      : Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === 'object'
          ? ((parsed as { calendarTasks?: unknown; tasks?: unknown }).calendarTasks ??
            (parsed as { tasks?: unknown }).tasks ??
            [])
          : []
    if (!Array.isArray(candidates)) {
      return []
    }
    return candidates.filter(isCalendarTask)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return []
    }
    throw error
  }
}

function isCalendarTask(value: unknown): value is CalendarTask {
  if (!value || typeof value !== 'object') {
    return false
  }
  const candidate = value as Partial<CalendarTask>
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.title === 'string' &&
    typeof candidate.createdAt === 'string' &&
    typeof candidate.priority === 'string' &&
    Array.isArray(candidate.reminders)
  )
}

function assertNoCredentialMaterial(value: unknown, pathValue = 'calendar'): void {
  if (!value || typeof value !== 'object') {
    return
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoCredentialMaterial(item, `${pathValue}[${index}]`))
    return
  }

  for (const [key, child] of Object.entries(value)) {
    if (
      new Set([
        'accessToken',
        'refreshToken',
        'clientSecret',
        'codeVerifier',
        'authorizationCode',
        'idToken',
        'token',
        'oauthToken',
        'apiKey'
      ]).has(key)
    ) {
      throw new Error(
        `Calendar vault records cannot persist credential material at ${pathValue}.${key}`
      )
    }
    assertNoCredentialMaterial(child, `${pathValue}.${key}`)
  }
}
