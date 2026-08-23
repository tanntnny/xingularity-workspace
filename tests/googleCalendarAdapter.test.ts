import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  GOOGLE_CALENDAR_READONLY_SCOPE,
  GoogleCalendarAdapter,
  assertGoogleReadOnlyScopes,
  createGooglePkceAuthorizationRequest,
  exchangeGoogleAuthorizationCode,
  normalizeGoogleEventChange,
  parseGoogleOAuthCallback,
  type FetchImplementation
} from '../src/main/googleCalendarAdapter'

const now = new Date('2026-08-17T00:00:00.000Z')

function response(body: unknown, status = 200, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers }
  })
}

describe('Google Calendar OAuth safety', () => {
  it('creates a PKCE request with read-only scopes and no client secret', () => {
    const request = createGooglePkceAuthorizationRequest(
      {
        clientId: 'client-id',
        redirectUri: 'xingularity://oauth/google',
        scopes: [GOOGLE_CALENDAR_READONLY_SCOPE]
      },
      { randomBytes: (size) => new Uint8Array(size).fill(7) }
    )
    const url = new URL(request.url)

    expect(url.searchParams.get('scope')).toBe(GOOGLE_CALENDAR_READONLY_SCOPE)
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(url.searchParams.get('client_secret')).toBeNull()
    expect(url.searchParams.get('code_challenge')).toBe(
      createHash('sha256').update(request.codeVerifier).digest('base64url')
    )
    expect(() => assertGoogleReadOnlyScopes(['https://www.googleapis.com/auth/calendar'])).toThrow(
      /non-read-only/
    )
  })

  it('validates OAuth state and represents provider cancellation explicitly', () => {
    expect(
      parseGoogleOAuthCallback('https://localhost/callback?code=abc&state=state', 'state')
    ).toEqual({
      code: 'abc',
      state: 'state'
    })
    expect(() =>
      parseGoogleOAuthCallback('https://localhost/callback?code=abc&state=wrong', 'state')
    ).toThrow(/state did not match/)
    expect(() =>
      parseGoogleOAuthCallback(
        'https://localhost/callback?error=access_denied&state=state',
        'state'
      )
    ).toThrowError(expect.objectContaining({ code: 'cancelled' }))
  })

  it('exchanges a code without sending a client secret or requesting write access', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    const fetchImpl: FetchImplementation = async (input, init) => {
      calls.push({ url: String(input), init })
      return response({
        access_token: 'access-token',
        expires_in: 3600,
        refresh_token: 'refresh-token',
        scope: GOOGLE_CALENDAR_READONLY_SCOPE
      })
    }

    const token = await exchangeGoogleAuthorizationCode(
      {
        clientId: 'client-id',
        redirectUri: 'xingularity://oauth/google'
      },
      'authorization-code',
      'verifier',
      { fetch: fetchImpl, now: () => now }
    )
    const body = calls[0].init?.body as URLSearchParams

    expect(token).toMatchObject({ accessToken: 'access-token', refreshToken: 'refresh-token' })
    expect(body.get('client_id')).toBe('client-id')
    expect(body.get('code_verifier')).toBe('verifier')
    expect(body.get('client_secret')).toBeNull()
    expect(body.get('scope')).toBeNull()
  })
})

describe('Google Calendar event normalization and incremental sync', () => {
  it('normalizes all-day, recurring, attendee, and cancelled event shapes', () => {
    const event = normalizeGoogleEventChange(
      {
        id: 'event-1',
        summary: 'Team offsite',
        status: 'confirmed',
        start: { date: '2026-08-17' },
        end: { date: '2026-08-19' },
        recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=MO'],
        attendees: [
          { email: 'person@example.com', displayName: 'Person', responseStatus: 'accepted' },
          { email: 'not-an-email' }
        ],
        etag: 'event-etag'
      },
      { calendarId: 'primary', connectionId: 'connection-1', now: () => now }
    )

    expect(event).toMatchObject({
      externalId: 'event-1',
      deleted: false,
      etag: 'event-etag',
      event: {
        allDay: true,
        start: '2026-08-17',
        end: '2026-08-19',
        access: 'read-only',
        recurrence: { rrule: 'FREQ=WEEKLY;BYDAY=MO' },
        attendees: [{ email: 'person@example.com', responseStatus: 'accepted' }]
      }
    })
    expect(
      normalizeGoogleEventChange(
        { id: 'cancelled-1', status: 'cancelled', etag: 'deleted-etag' },
        { calendarId: 'primary' }
      )
    ).toEqual({ externalId: 'cancelled-1', deleted: true, etag: 'deleted-etag' })
  })

  it('uses sync cursors and ETags, and requests a full sync after cursor expiry', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    let mode: 'first' | 'not-modified' | 'expired' = 'first'
    const fetchImpl: FetchImplementation = async (input, init) => {
      const url = String(input)
      calls.push({ url, init })
      if (mode === 'not-modified') {
        return new Response(null, { status: 304, headers: { etag: 'collection-etag' } })
      }
      if (mode === 'expired') {
        return response({ error: { message: 'Sync token expired' } }, 410)
      }
      return response(
        {
          etag: 'collection-etag',
          items: [
            {
              id: 'event-1',
              summary: 'Timed meeting',
              start: { dateTime: '2026-08-17T09:00:00+07:00', timeZone: 'Asia/Bangkok' },
              end: { dateTime: '2026-08-17T10:00:00+07:00', timeZone: 'Asia/Bangkok' },
              updated: '2026-08-16T00:00:00Z',
              etag: 'event-etag'
            }
          ],
          nextSyncToken: 'cursor-2'
        },
        200,
        { etag: 'collection-etag' }
      )
    }
    const adapter = new GoogleCalendarAdapter({
      clientId: 'client-id',
      redirectUri: 'xingularity://oauth/google',
      fetch: fetchImpl,
      now: () => now,
      defaultTimezone: 'Asia/Bangkok'
    })
    adapter.setAccessToken('access-token', now.getTime() + 3600_000)

    const first = await adapter.syncEvents({ calendarId: 'primary', connectionId: 'connection-1' })
    expect(first).toMatchObject({ nextCursor: 'cursor-2', etag: 'collection-etag' })
    expect(first.changes[0].event).toMatchObject({
      start: '2026-08-17T02:00:00.000Z',
      end: '2026-08-17T03:00:00.000Z',
      timezone: 'Asia/Bangkok',
      access: 'read-only'
    })

    mode = 'not-modified'
    const unchanged = await adapter.syncEvents({
      calendarId: 'primary',
      connectionId: 'connection-1',
      cursor: 'cursor-2',
      etag: 'collection-etag'
    })
    expect(unchanged).toMatchObject({ notModified: true, nextCursor: 'cursor-2' })

    mode = 'expired'
    const expired = await adapter.syncEvents({
      calendarId: 'primary',
      connectionId: 'connection-1',
      cursor: 'expired-cursor'
    })
    expect(expired).toMatchObject({ fullSyncRequired: true, calendarId: 'primary' })
    expect(calls[1].init?.headers).toMatchObject({ authorization: 'Bearer access-token' })
  })
})

describe('GoogleCalendarAdapter credential boundary', () => {
  it('stores only the refresh token through the injected credential store', async () => {
    const stored: string[] = []
    const credentialStore = {
      async get(): Promise<string | null> {
        return stored[0] ?? null
      },
      async set(_provider: string, _vaultRoot: string, value: string): Promise<void> {
        stored[0] = value
      },
      async delete(): Promise<void> {
        stored.length = 0
      }
    }
    const request = createGooglePkceAuthorizationRequest(
      {
        clientId: 'client-id',
        redirectUri: 'xingularity://oauth/google'
      },
      { randomBytes: (size) => new Uint8Array(size).fill(3) }
    )
    const adapter = new GoogleCalendarAdapter({
      clientId: 'client-id',
      redirectUri: 'xingularity://oauth/google',
      fetch: async () =>
        response({
          access_token: 'access-token',
          expires_in: 3600,
          refresh_token: 'refresh-token',
          scope: GOOGLE_CALENDAR_READONLY_SCOPE
        }),
      credentialStore,
      vaultRoot: '/vault',
      now: () => now,
      randomBytes: (size) => new Uint8Array(size).fill(3)
    })

    const result = await adapter.completeAuthorization(
      `xingularity://oauth/google?code=code&state=${request.state}`,
      request.state,
      request
    )

    expect(result.refreshTokenStored).toBe(true)
    expect(stored).toEqual(['refresh-token'])
    expect(JSON.stringify(result)).not.toContain('access-token')
  })
})
