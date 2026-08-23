import { createHash, randomBytes } from 'node:crypto'
import {
  localDateTimeToInstant,
  normalizeCalendarEvent,
  normalizeExternalCalendar,
  redactSensitiveText,
  resolveDefaultCalendarTimezone,
  type CalendarEventRecord,
  type CalendarRecurrence,
  type ExternalCalendarRecord
} from '../shared/calendarDomain'
import {
  isDateOnly,
  isIanaTimezone,
  isLocalTime,
  isValidInstant,
  normalizeRecurrenceRule
} from '../shared/timeSemantics'

export const GOOGLE_CALENDAR_READONLY_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly'
export const GOOGLE_OAUTH_AUTHORIZATION_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
export const GOOGLE_OAUTH_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
export const GOOGLE_OAUTH_REVOCATION_ENDPOINT = 'https://oauth2.googleapis.com/revoke'
export const GOOGLE_CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3'

const GOOGLE_IDENTITY_SCOPES = new Set(['openid', 'email'])
const GOOGLE_ALLOWED_SCOPES = new Set([GOOGLE_CALENDAR_READONLY_SCOPE, ...GOOGLE_IDENTITY_SCOPES])

export type FetchImplementation = (input: string | URL, init?: RequestInit) => Promise<Response>

export interface GoogleOAuthConfig {
  clientId: string
  redirectUri: string
  scopes?: string[]
  authorizationEndpoint?: string
  tokenEndpoint?: string
}

export interface GooglePkceAuthorizationRequest {
  url: string
  state: string
  codeVerifier: string
  codeChallenge: string
  scopes: string[]
}

export interface GoogleOAuthCallback {
  code: string
  state: string
}

export interface GoogleTokenSet {
  accessToken: string
  expiresAt: number
  refreshToken?: string
  scopes: string[]
}

export interface GoogleAuthorizationResult {
  expiresAt: number
  scopes: string[]
  refreshTokenStored: boolean
}

export interface GoogleRefreshTokenStore {
  get(provider: string, vaultRoot: string): Promise<string | null>
  set(provider: string, vaultRoot: string, value: string): Promise<unknown>
  delete(provider: string, vaultRoot: string): Promise<void>
}

export type GoogleCalendarErrorCode =
  | 'cancelled'
  | 'offline'
  | 'reauthorization-required'
  | 'revoked'
  | 'rate-limited'
  | 'invalid-response'
  | 'http'

export class GoogleCalendarError extends Error {
  readonly code: GoogleCalendarErrorCode
  readonly status?: number
  readonly retryAt?: string

  constructor(
    code: GoogleCalendarErrorCode,
    message: string,
    options: { status?: number; retryAt?: string } = {}
  ) {
    super(redactSensitiveText(message))
    this.name = 'GoogleCalendarError'
    this.code = code
    this.status = options.status
    this.retryAt = options.retryAt
  }
}

export interface GoogleCalendarEventDate {
  date?: string
  dateTime?: string
  timeZone?: string
}

export interface GoogleCalendarAttendee {
  email?: string
  displayName?: string
  responseStatus?: string
}

export interface GoogleCalendarPerson {
  email?: string
  displayName?: string
}

export interface GoogleCalendarApiEvent {
  id?: string
  iCalUID?: string
  recurringEventId?: string
  status?: string
  summary?: string
  description?: string
  location?: string
  start?: GoogleCalendarEventDate
  end?: GoogleCalendarEventDate
  recurrence?: string[]
  attendees?: GoogleCalendarAttendee[]
  organizer?: GoogleCalendarPerson
  updated?: string
  etag?: string
}

export interface GoogleCalendarEventChange {
  externalId: string
  deleted: boolean
  event?: CalendarEventRecord
  etag?: string
}

export interface GoogleCalendarSyncResult {
  calendarId: string
  changes: GoogleCalendarEventChange[]
  nextCursor?: string
  etag?: string
  notModified: boolean
  fullSyncRequired?: boolean
}

export interface GoogleSyncEventsOptions {
  calendarId: string
  connectionId?: string
  cursor?: string
  etag?: string
  fullSync?: boolean
  signal?: AbortSignal
}

export interface GoogleListCalendarsOptions {
  connectionId?: string
  etag?: string
  signal?: AbortSignal
}

export interface GoogleCalendarAdapterOptions extends GoogleOAuthConfig {
  fetch?: FetchImplementation
  credentialStore?: GoogleRefreshTokenStore
  vaultRoot?: string
  credentialProvider?: string
  defaultTimezone?: string
  now?: () => Date
  randomBytes?: (size: number) => Uint8Array
}

export interface GoogleCalendarListResult {
  calendars: ExternalCalendarRecord[]
  etag?: string
  notModified: boolean
}

export function assertGoogleReadOnlyScopes(scopes: string[]): string[] {
  const normalized = [...new Set(scopes.map((scope) => scope.trim()).filter(Boolean))]
  const invalid = normalized.filter((scope) => !GOOGLE_ALLOWED_SCOPES.has(scope))
  if (invalid.length > 0) {
    throw new GoogleCalendarError(
      'invalid-response',
      `Google Calendar read-only adapter rejected non-read-only scopes: ${invalid.join(', ')}`
    )
  }
  if (!normalized.includes(GOOGLE_CALENDAR_READONLY_SCOPE)) {
    throw new GoogleCalendarError(
      'invalid-response',
      'Google Calendar authorization must include the calendar.readonly scope'
    )
  }
  return normalized
}

export function createGooglePkceAuthorizationRequest(
  config: GoogleOAuthConfig,
  dependencies: {
    randomBytes?: (size: number) => Uint8Array
  } = {}
): GooglePkceAuthorizationRequest {
  const clientId = requireText(config.clientId, 'Google OAuth client ID')
  const redirectUri = requireText(config.redirectUri, 'Google OAuth redirect URI')
  const scopes = assertGoogleReadOnlyScopes(config.scopes ?? [GOOGLE_CALENDAR_READONLY_SCOPE])
  const bytes = dependencies.randomBytes ?? ((size: number) => randomBytes(size))
  const codeVerifier = toBase64Url(bytes(32))
  const state = toBase64Url(bytes(24))
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url')
  const endpoint = config.authorizationEndpoint ?? GOOGLE_OAUTH_AUTHORIZATION_ENDPOINT
  const url = new URL(endpoint)
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256'
  }).toString()

  return { url: url.toString(), state, codeVerifier, codeChallenge, scopes }
}

export const createPkceAuthorizationRequest = createGooglePkceAuthorizationRequest

export function parseGoogleOAuthCallback(
  callback: string | URL,
  expectedState?: string
): GoogleOAuthCallback {
  let url: URL
  try {
    url =
      callback instanceof URL
        ? callback
        : new URL(callback, callback.startsWith('?') ? 'http://localhost/callback' : undefined)
  } catch {
    throw new GoogleCalendarError('invalid-response', 'Google OAuth callback was not a valid URL')
  }

  const state = url.searchParams.get('state')
  if (expectedState && (!state || !constantTimeEqual(state, expectedState))) {
    throw new GoogleCalendarError(
      'invalid-response',
      'Google OAuth state did not match the pending request'
    )
  }

  const error = url.searchParams.get('error')
  if (error) {
    const description = url.searchParams.get('error_description')
    if (error === 'access_denied') {
      throw new GoogleCalendarError(
        'cancelled',
        description ?? 'Google authorization was cancelled'
      )
    }
    throw new GoogleCalendarError(
      'invalid-response',
      description
        ? `Google authorization failed: ${description}`
        : `Google authorization failed: ${error}`
    )
  }

  const code = url.searchParams.get('code')
  if (!code || !state) {
    throw new GoogleCalendarError(
      'invalid-response',
      'Google OAuth callback did not include code and state'
    )
  }
  return { code, state }
}

export async function exchangeGoogleAuthorizationCode(
  config: GoogleOAuthConfig,
  code: string,
  codeVerifier: string,
  options: { fetch?: FetchImplementation; now?: () => Date } = {}
): Promise<GoogleTokenSet> {
  const endpoint = config.tokenEndpoint ?? GOOGLE_OAUTH_TOKEN_ENDPOINT
  const fetchImpl = options.fetch ?? fetch
  const body = new URLSearchParams({
    client_id: requireText(config.clientId, 'Google OAuth client ID'),
    code: requireText(code, 'Google OAuth authorization code'),
    code_verifier: requireText(codeVerifier, 'Google OAuth PKCE verifier'),
    grant_type: 'authorization_code',
    redirect_uri: requireText(config.redirectUri, 'Google OAuth redirect URI')
  })
  const response = await fetchTokenEndpoint(fetchImpl, endpoint, body)
  return normalizeGoogleTokenSet(
    response,
    config.scopes ?? [GOOGLE_CALENDAR_READONLY_SCOPE],
    options.now ?? (() => new Date())
  )
}

export async function refreshGoogleAccessToken(
  config: GoogleOAuthConfig,
  refreshToken: string,
  options: { fetch?: FetchImplementation; now?: () => Date } = {}
): Promise<GoogleTokenSet> {
  const endpoint = config.tokenEndpoint ?? GOOGLE_OAUTH_TOKEN_ENDPOINT
  const fetchImpl = options.fetch ?? fetch
  const body = new URLSearchParams({
    client_id: requireText(config.clientId, 'Google OAuth client ID'),
    refresh_token: requireText(refreshToken, 'Google OAuth refresh token'),
    grant_type: 'refresh_token'
  })
  const response = await fetchTokenEndpoint(fetchImpl, endpoint, body)
  return normalizeGoogleTokenSet(
    { ...response, refresh_token: refreshToken },
    config.scopes ?? [GOOGLE_CALENDAR_READONLY_SCOPE],
    options.now ?? (() => new Date())
  )
}

export class GoogleCalendarAdapter {
  readonly provider = 'google' as const

  private readonly config: GoogleOAuthConfig
  private readonly fetchImpl: FetchImplementation
  private readonly credentialStore?: GoogleRefreshTokenStore
  private readonly vaultRoot?: string
  private readonly credentialProvider: string
  private readonly defaultTimezone: string
  private readonly now: () => Date
  private readonly randomBytes: (size: number) => Uint8Array
  private tokenSet: GoogleTokenSet | null = null

  constructor(options: GoogleCalendarAdapterOptions) {
    this.config = {
      clientId: requireText(options.clientId, 'Google OAuth client ID'),
      redirectUri: requireText(options.redirectUri, 'Google OAuth redirect URI'),
      scopes: assertGoogleReadOnlyScopes(options.scopes ?? [GOOGLE_CALENDAR_READONLY_SCOPE]),
      authorizationEndpoint: options.authorizationEndpoint,
      tokenEndpoint: options.tokenEndpoint
    }
    this.fetchImpl = options.fetch ?? fetch
    this.credentialStore = options.credentialStore
    this.vaultRoot = options.vaultRoot
    this.credentialProvider = options.credentialProvider ?? 'google-calendar'
    this.defaultTimezone = options.defaultTimezone ?? resolveDefaultCalendarTimezone()
    if (!isIanaTimezone(this.defaultTimezone)) {
      throw new Error(`Invalid Google Calendar default timezone: ${this.defaultTimezone}`)
    }
    this.now = options.now ?? (() => new Date())
    this.randomBytes = options.randomBytes ?? ((size: number) => randomBytes(size))
  }

  createAuthorizationRequest(): GooglePkceAuthorizationRequest {
    return createGooglePkceAuthorizationRequest(this.config, { randomBytes: this.randomBytes })
  }

  async completeAuthorization(
    callback: string | URL,
    expectedState: string,
    request: Pick<GooglePkceAuthorizationRequest, 'codeVerifier'>
  ): Promise<GoogleAuthorizationResult> {
    const parsed = parseGoogleOAuthCallback(callback, expectedState)
    const tokenSet = await exchangeGoogleAuthorizationCode(
      this.config,
      parsed.code,
      request.codeVerifier,
      { fetch: this.fetchImpl, now: this.now }
    )
    this.tokenSet = tokenSet

    let refreshTokenStored = false
    if (tokenSet.refreshToken && this.credentialStore && this.vaultRoot) {
      await this.credentialStore.set(this.credentialProvider, this.vaultRoot, tokenSet.refreshToken)
      refreshTokenStored = true
      this.tokenSet = { ...tokenSet, refreshToken: undefined }
    }

    return {
      expiresAt: tokenSet.expiresAt,
      scopes: tokenSet.scopes,
      refreshTokenStored
    }
  }

  setAccessToken(accessToken: string, expiresAt: number, scopes?: string[]): void {
    const normalizedScopes = assertGoogleReadOnlyScopes(scopes ?? [GOOGLE_CALENDAR_READONLY_SCOPE])
    this.tokenSet = {
      accessToken: requireText(accessToken, 'Google access token'),
      expiresAt,
      scopes: normalizedScopes
    }
  }

  async listCalendars(options: GoogleListCalendarsOptions = {}): Promise<GoogleCalendarListResult> {
    let pageToken: string | undefined
    const calendars: ExternalCalendarRecord[] = []
    let responseEtag: string | undefined

    do {
      const url = new URL(`${GOOGLE_CALENDAR_API_BASE}/users/me/calendarList`)
      url.searchParams.set('maxResults', '250')
      if (pageToken) {
        url.searchParams.set('pageToken', pageToken)
      }
      const response = await this.requestJson(url, {
        signal: options.signal,
        headers: !pageToken && options.etag ? { 'If-None-Match': options.etag } : undefined
      })
      if (response.notModified) {
        return { calendars: [], etag: options.etag, notModified: true }
      }
      responseEtag = response.headers.get('etag') ?? stringValue(response.body.etag) ?? responseEtag
      const items = Array.isArray(response.body.items) ? response.body.items : []
      for (const item of items) {
        const normalized = normalizeGoogleCalendar(item, options.connectionId ?? 'google')
        if (normalized) {
          calendars.push(normalized)
        }
      }
      pageToken =
        typeof response.body.nextPageToken === 'string' ? response.body.nextPageToken : undefined
    } while (pageToken)

    return { calendars, etag: responseEtag, notModified: false }
  }

  async syncEvents(options: GoogleSyncEventsOptions): Promise<GoogleCalendarSyncResult> {
    const calendarId = requireText(options.calendarId, 'Google calendar ID')
    const changes: GoogleCalendarEventChange[] = []
    let pageToken: string | undefined
    let nextCursor: string | undefined
    let responseEtag: string | undefined
    const cursor = options.fullSync ? undefined : options.cursor

    do {
      const url = new URL(
        `${GOOGLE_CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events`
      )
      url.searchParams.set('showDeleted', 'true')
      url.searchParams.set('singleEvents', 'false')
      url.searchParams.set('maxResults', '2500')
      if (cursor) {
        url.searchParams.set('syncToken', cursor)
      }
      if (pageToken) {
        url.searchParams.set('pageToken', pageToken)
      }

      let response: Awaited<ReturnType<GoogleCalendarAdapter['requestJson']>>
      try {
        response = await this.requestJson(url, {
          signal: options.signal,
          headers:
            !pageToken && options.etag && !cursor ? { 'If-None-Match': options.etag } : undefined
        })
      } catch (error) {
        if (error instanceof GoogleCalendarError && error.status === 410 && cursor) {
          return {
            calendarId,
            changes: [],
            etag: options.etag,
            notModified: false,
            fullSyncRequired: true
          }
        }
        throw error
      }

      if (response.notModified) {
        return {
          calendarId,
          changes: [],
          nextCursor: cursor,
          etag: options.etag,
          notModified: true
        }
      }

      responseEtag = response.headers.get('etag') ?? stringValue(response.body.etag) ?? responseEtag
      const items = Array.isArray(response.body.items) ? response.body.items : []
      for (const item of items) {
        const change = normalizeGoogleEventChange(item, {
          calendarId,
          connectionId: options.connectionId,
          defaultTimezone: this.defaultTimezone,
          now: this.now
        })
        changes.push(change)
      }
      if (typeof response.body.nextSyncToken === 'string') {
        nextCursor = response.body.nextSyncToken
      }
      pageToken =
        typeof response.body.nextPageToken === 'string' ? response.body.nextPageToken : undefined
    } while (pageToken)

    return {
      calendarId,
      changes,
      nextCursor,
      etag: responseEtag,
      notModified: false
    }
  }

  async revoke(): Promise<void> {
    const refreshToken = await this.readRefreshToken()
    const token = this.tokenSet?.accessToken ?? refreshToken
    try {
      if (token) {
        let response: Response
        try {
          response = await this.fetchImpl(GOOGLE_OAUTH_REVOCATION_ENDPOINT, {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ token })
          })
        } catch (error) {
          throw mapNetworkError(error)
        }
        if (!response.ok && response.status !== 400) {
          throw await this.responseError(response, 'Google token revocation failed')
        }
      }
    } finally {
      await this.clearRefreshToken()
      this.tokenSet = null
    }
  }

  async disconnect(): Promise<void> {
    await this.clearRefreshToken()
    this.tokenSet = null
  }

  private async requestJson(
    url: URL,
    options: { signal?: AbortSignal; headers?: Record<string, string> } = {}
  ): Promise<{
    body: Record<string, unknown>
    headers: Headers
    notModified: boolean
  }> {
    const accessToken = await this.ensureAccessToken(options.signal)
    let response: Response
    try {
      response = await this.fetchImpl(url.toString(), {
        method: 'GET',
        signal: options.signal,
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${accessToken}`,
          ...options.headers
        }
      })
    } catch (error) {
      throw mapNetworkError(error, options.signal)
    }

    if (response.status === 304) {
      return { body: {}, headers: response.headers, notModified: true }
    }
    if (!response.ok) {
      throw await this.responseError(response, 'Google Calendar request failed')
    }

    const body = await readJsonObject(response)
    return { body, headers: response.headers, notModified: false }
  }

  private async ensureAccessToken(signal?: AbortSignal): Promise<string> {
    if (signal?.aborted) {
      throw new GoogleCalendarError('cancelled', 'Google Calendar operation was cancelled')
    }
    const now = this.now().getTime()
    if (this.tokenSet && this.tokenSet.expiresAt > now + 60_000) {
      return this.tokenSet.accessToken
    }

    const refreshToken = this.tokenSet?.refreshToken ?? (await this.readRefreshToken())
    if (!refreshToken) {
      throw new GoogleCalendarError(
        'reauthorization-required',
        'Google Calendar authorization has expired; reconnect the account'
      )
    }

    try {
      const refreshed = await refreshGoogleAccessToken(this.config, refreshToken, {
        fetch: this.fetchImpl,
        now: this.now
      })
      this.tokenSet = refreshed
      return refreshed.accessToken
    } catch (error) {
      if (error instanceof GoogleCalendarError && error.status === 400) {
        await this.clearRefreshToken()
        this.tokenSet = null
        throw new GoogleCalendarError(
          'revoked',
          'Google Calendar authorization was revoked; reconnect the account',
          { status: 400 }
        )
      }
      throw error
    }
  }

  private async readRefreshToken(): Promise<string | null> {
    if (!this.credentialStore || !this.vaultRoot) {
      return null
    }
    return this.credentialStore.get(this.credentialProvider, this.vaultRoot)
  }

  private async clearRefreshToken(): Promise<void> {
    if (this.credentialStore && this.vaultRoot) {
      await this.credentialStore.delete(this.credentialProvider, this.vaultRoot)
    }
  }

  private async responseError(response: Response, fallback: string): Promise<GoogleCalendarError> {
    const body = await readJsonObject(response).catch(() => ({}))
    const message = extractGoogleErrorMessage(body) ?? `${fallback} (${response.status})`
    const reason = extractGoogleErrorReason(body)
    const retryAt = retryAtFromHeader(response.headers.get('retry-after'), this.now)
    if (response.status === 401) {
      return new GoogleCalendarError('reauthorization-required', message, {
        status: response.status
      })
    }
    if (
      response.status === 429 ||
      reason === 'rateLimitExceeded' ||
      reason === 'userRateLimitExceeded' ||
      reason === 'quotaExceeded'
    ) {
      return new GoogleCalendarError('rate-limited', message, {
        status: response.status,
        retryAt
      })
    }
    if (response.status === 403 && /revok|invalid credential|insufficient/i.test(message)) {
      return new GoogleCalendarError('revoked', message, { status: response.status })
    }
    return new GoogleCalendarError('http', message, { status: response.status, retryAt })
  }
}

export function normalizeGoogleEventChange(
  input: GoogleCalendarApiEvent,
  options: {
    calendarId: string
    connectionId?: string
    defaultTimezone?: string
    now?: () => Date
  }
): GoogleCalendarEventChange {
  const externalId = requireText(input.id ?? '', 'Google event ID')
  const etag = input.etag
  const hasDateRange = Boolean(input.start && input.end)
  if (input.status === 'cancelled' && !hasDateRange) {
    return { externalId, deleted: true, ...(etag ? { etag } : {}) }
  }
  if (!hasDateRange) {
    throw new GoogleCalendarError(
      'invalid-response',
      `Google event ${externalId} did not include a start and end value`
    )
  }

  const start = normalizeGoogleEventDate(input.start as GoogleCalendarEventDate, options)
  const end = normalizeGoogleEventDate(input.end as GoogleCalendarEventDate, options)
  if (start.allDay !== end.allDay) {
    throw new GoogleCalendarError(
      'invalid-response',
      `Google event ${externalId} mixed all-day and timed boundaries`
    )
  }

  const timezone = start.allDay
    ? undefined
    : (start.timezone ??
      end.timezone ??
      options.defaultTimezone ??
      resolveDefaultCalendarTimezone())
  const recurrence = normalizeGoogleRecurrence(input.recurrence, start.allDay, timezone)
  const event = normalizeCalendarEvent(
    {
      id: makeGoogleEventId(options.connectionId ?? 'google', options.calendarId, externalId),
      title: input.summary?.trim() || '(Untitled event)',
      description: input.description,
      allDay: start.allDay,
      start: start.value,
      end: end.value,
      timezone,
      recurrence,
      location: input.location,
      attendees: (input.attendees ?? []).flatMap((attendee) => {
        const person = normalizeGooglePerson(attendee)
        return person ? [person] : []
      }),
      organizer: input.organizer
        ? (normalizeGooglePerson(input.organizer) ?? undefined)
        : undefined,
      source: 'google',
      access: 'read-only',
      status: normalizeGoogleStatus(input.status),
      updatedAt: input.updated ?? options.now?.().toISOString() ?? new Date().toISOString(),
      connectionId: options.connectionId,
      providerCalendarId: options.calendarId,
      externalId,
      etag,
      iCalUid: input.iCalUID,
      recurringEventId: input.recurringEventId
    },
    { defaultTimezone: timezone, now: options.now?.().toISOString() }
  )
  return { externalId, deleted: false, event, ...(etag ? { etag } : {}) }
}

export function normalizeGoogleEvent(
  input: GoogleCalendarApiEvent,
  options: {
    calendarId: string
    connectionId?: string
    defaultTimezone?: string
    now?: () => Date
  }
): CalendarEventRecord {
  const change = normalizeGoogleEventChange(input, options)
  if (change.deleted || !change.event) {
    throw new GoogleCalendarError(
      'invalid-response',
      `Google event ${change.externalId} is a cancellation tombstone without event data`
    )
  }
  return change.event
}

function normalizeGoogleCalendar(
  input: Record<string, unknown>,
  connectionId: string
): ExternalCalendarRecord | null {
  const id = typeof input.id === 'string' ? input.id : ''
  if (!id) {
    return null
  }
  const timezone =
    typeof input.timeZone === 'string' && isIanaTimezone(input.timeZone)
      ? input.timeZone
      : undefined
  return normalizeExternalCalendar({
    id,
    connectionId,
    provider: 'google',
    externalId: id,
    name: typeof input.summary === 'string' && input.summary.trim() ? input.summary : id,
    color: typeof input.backgroundColor === 'string' ? input.backgroundColor : undefined,
    selected: false,
    access: 'read-only',
    timezone,
    capabilities: { canReadEvents: true, canWriteEvents: false },
    ...(typeof input.etag === 'string' ? { etag: input.etag } : {})
  })
}

function normalizeGoogleEventDate(
  value: GoogleCalendarEventDate,
  options: { defaultTimezone?: string }
): { allDay: boolean; value: string; timezone?: string } {
  if (value.date) {
    if (!isDateOnly(value.date)) {
      throw new GoogleCalendarError(
        'invalid-response',
        `Google all-day boundary was invalid: ${value.date}`
      )
    }
    return { allDay: true, value: value.date }
  }
  if (!value.dateTime) {
    throw new GoogleCalendarError(
      'invalid-response',
      'Google event boundary was missing date or dateTime'
    )
  }

  const timezone = value.timeZone ?? options.defaultTimezone ?? resolveDefaultCalendarTimezone()
  if (!isIanaTimezone(timezone)) {
    throw new GoogleCalendarError(
      'invalid-response',
      `Google event used an invalid timezone: ${timezone}`
    )
  }

  if (isValidInstant(value.dateTime)) {
    return { allDay: false, value: new Date(value.dateTime).toISOString(), timezone }
  }

  const localMatch = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::(\d{2})(?:\.\d+)?)?$/.exec(
    value.dateTime
  )
  if (!localMatch || !isLocalTime(localMatch[2])) {
    throw new GoogleCalendarError(
      'invalid-response',
      `Google timed boundary was invalid: ${value.dateTime}`
    )
  }
  const instant = localDateTimeToInstant(localMatch[1], localMatch[2], timezone)
  const seconds = localMatch[3] ? Number(localMatch[3]) : 0
  const withSeconds = seconds
    ? new Date(Date.parse(instant) + seconds * 1000).toISOString()
    : instant
  return { allDay: false, value: withSeconds, timezone }
}

function normalizeGoogleRecurrence(
  entries: string[] | undefined,
  allDay: boolean,
  timezone: string | undefined
): CalendarRecurrence | undefined {
  if (!entries || entries.length === 0) {
    return undefined
  }
  const ruleEntry = entries.find((entry) => /^RRULE:/i.test(entry.trim()))
  if (!ruleEntry) {
    return undefined
  }
  const rrule = normalizeRecurrenceRule(ruleEntry.trim().replace(/^RRULE:/i, ''))
  const exceptions = entries
    .filter((entry) => /^(EXDATE|RDATE)/i.test(entry.trim()))
    .map((entry) => entry.trim())
  return {
    rrule,
    ...(allDay ? {} : { timezone }),
    ...(exceptions.length ? { exceptions } : {})
  }
}

function normalizeGooglePerson(
  person: GoogleCalendarAttendee | GoogleCalendarPerson
): { email: string; name?: string; responseStatus?: string } | null {
  const email = typeof person.email === 'string' ? person.email.trim() : ''
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return null
  }
  return {
    email,
    ...(person.displayName?.trim() ? { name: person.displayName.trim() } : {}),
    ...('responseStatus' in person && person.responseStatus?.trim()
      ? { responseStatus: person.responseStatus.trim() }
      : {})
  }
}

function normalizeGoogleStatus(
  status: string | undefined
): 'confirmed' | 'tentative' | 'cancelled' {
  if (status === 'cancelled') {
    return 'cancelled'
  }
  if (status === 'tentative') {
    return 'tentative'
  }
  return 'confirmed'
}

async function fetchTokenEndpoint(
  fetchImpl: FetchImplementation,
  endpoint: string,
  body: URLSearchParams
): Promise<Record<string, unknown>> {
  let response: Response
  try {
    response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' },
      body
    })
  } catch (error) {
    throw mapNetworkError(error)
  }
  if (!response.ok) {
    const bodyValue: Record<string, unknown> = await readJsonObject(response).catch(
      (): Record<string, unknown> => ({})
    )
    const errorCode = typeof bodyValue.error === 'string' ? bodyValue.error : 'oauth_error'
    const message =
      typeof bodyValue.error_description === 'string'
        ? bodyValue.error_description
        : `Google OAuth token exchange failed: ${errorCode}`
    throw new GoogleCalendarError(errorCode === 'invalid_grant' ? 'revoked' : 'http', message, {
      status: response.status
    })
  }
  return readJsonObject(response)
}

function normalizeGoogleTokenSet(
  value: Record<string, unknown>,
  requestedScopes: string[],
  now: () => Date
): GoogleTokenSet {
  const scopes = assertGoogleReadOnlyScopes(
    typeof value.scope === 'string' ? value.scope.split(/\s+/) : requestedScopes
  )
  const accessToken = typeof value.access_token === 'string' ? value.access_token : ''
  const expiresIn = Number(value.expires_in)
  if (!accessToken || !Number.isFinite(expiresIn) || expiresIn <= 0) {
    throw new GoogleCalendarError('invalid-response', 'Google OAuth token response was incomplete')
  }
  return {
    accessToken,
    expiresAt: now().getTime() + expiresIn * 1000,
    ...(typeof value.refresh_token === 'string' && value.refresh_token
      ? { refreshToken: value.refresh_token }
      : {}),
    scopes
  }
}

async function readJsonObject(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text()
  if (!text.trim()) {
    return {}
  }
  try {
    const parsed: unknown = JSON.parse(text)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {}
  } catch {
    throw new GoogleCalendarError('invalid-response', 'Google Calendar returned malformed JSON')
  }
}

function extractGoogleErrorMessage(body: Record<string, unknown>): string | undefined {
  if (typeof body.error_description === 'string') {
    return body.error_description
  }
  if (isRecord(body.error) && typeof body.error.message === 'string') {
    return body.error.message
  }
  if (typeof body.error === 'string') {
    return body.error
  }
  return undefined
}

function extractGoogleErrorReason(body: Record<string, unknown>): string | undefined {
  const errors = isRecord(body.error) && Array.isArray(body.error.errors) ? body.error.errors : []
  const reason = errors.find(
    (entry: unknown) => entry && typeof entry === 'object' && 'reason' in entry
  )
  return isRecord(reason) && typeof reason.reason === 'string' ? reason.reason : undefined
}

function retryAtFromHeader(value: string | null, now: () => Date): string | undefined {
  if (!value) {
    return undefined
  }
  const seconds = Number(value)
  if (Number.isFinite(seconds)) {
    return new Date(now().getTime() + seconds * 1000).toISOString()
  }
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined
}

function mapNetworkError(error: unknown, signal?: AbortSignal): GoogleCalendarError {
  if (signal?.aborted || (error instanceof Error && error.name === 'AbortError')) {
    return new GoogleCalendarError('cancelled', 'Google Calendar operation was cancelled')
  }
  return new GoogleCalendarError('offline', 'Google Calendar could not be reached')
}

function makeGoogleEventId(connectionId: string, calendarId: string, externalId: string): string {
  return `google:${encodeURIComponent(connectionId)}:${encodeURIComponent(calendarId)}:${encodeURIComponent(externalId)}`
}

function toBase64Url(value: Uint8Array): string {
  return Buffer.from(value).toString('base64url')
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  if (leftBuffer.length !== rightBuffer.length) {
    return false
  }
  let difference = 0
  for (let index = 0; index < leftBuffer.length; index += 1) {
    difference |= leftBuffer[index] ^ rightBuffer[index]
  }
  return difference === 0
}

function requireText(value: string, label: string): string {
  const normalized = value.trim()
  if (!normalized) {
    throw new Error(`${label} cannot be empty`)
  }
  return normalized
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}
