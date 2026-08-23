import { createHash, randomBytes } from 'node:crypto'
import { redactSensitiveText } from '../shared/searchDomain'

export const GOOGLE_DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file'
export const GOOGLE_DRIVE_METADATA_SCOPE = 'https://www.googleapis.com/auth/drive.metadata.readonly'
export const GOOGLE_DRIVE_AUTHORIZATION_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
export const GOOGLE_DRIVE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
export const GOOGLE_DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3'

export type DriveFetchImplementation = (
  input: string | URL,
  init?: RequestInit
) => Promise<Response>

export interface GoogleDriveOAuthConfig {
  clientId: string
  redirectUri: string
  scopes?: string[]
}

export interface GoogleDrivePkceRequest {
  url: string
  state: string
  codeVerifier: string
  codeChallenge: string
  scopes: string[]
}

export interface GoogleDriveTokenSet {
  accessToken: string
  expiresAt: number
  refreshToken?: string
  scopes: string[]
}

export interface GoogleDriveFile {
  id: string
  name: string
  mimeType?: string
  modifiedTime?: string
  webViewLink?: string
  size?: string
  md5Checksum?: string
  parents?: string[]
  trashed?: boolean
}

export interface GoogleDriveChangePage {
  changes: Array<{ fileId?: string; removed?: boolean; file?: GoogleDriveFile }>
  nextPageToken?: string
  newStartPageToken?: string
}

export class GoogleDriveError extends Error {
  readonly code: 'invalid-response' | 'offline' | 'reauthorization-required' | 'http'
  readonly status?: number

  constructor(code: GoogleDriveError['code'], message: string, status?: number) {
    super(redactSensitiveText(message))
    this.name = 'GoogleDriveError'
    this.code = code
    this.status = status
  }
}

export function assertGoogleDriveReadOnlyScopes(scopes: string[]): string[] {
  const normalized = Array.from(new Set(scopes.map((scope) => scope.trim()).filter(Boolean)))
  const allowed = new Set([GOOGLE_DRIVE_FILE_SCOPE, GOOGLE_DRIVE_METADATA_SCOPE, 'openid', 'email'])
  const invalid = normalized.filter((scope) => !allowed.has(scope))
  if (invalid.length)
    throw new GoogleDriveError(
      'invalid-response',
      `Unsupported Drive scopes: ${invalid.join(', ')}`
    )
  if (!normalized.includes(GOOGLE_DRIVE_FILE_SCOPE)) {
    throw new GoogleDriveError(
      'invalid-response',
      'Drive authorization must include the drive.file scope'
    )
  }
  return normalized
}

export function createGoogleDrivePkceRequest(
  config: GoogleDriveOAuthConfig,
  dependencies: { randomBytes?: (size: number) => Uint8Array } = {}
): GoogleDrivePkceRequest {
  if (!config.clientId.trim() || !config.redirectUri.trim()) {
    throw new GoogleDriveError(
      'invalid-response',
      'Drive OAuth requires a client id and redirect URI'
    )
  }
  const scopes = assertGoogleDriveReadOnlyScopes(config.scopes ?? [GOOGLE_DRIVE_FILE_SCOPE])
  const bytes = dependencies.randomBytes ?? ((size: number) => randomBytes(size))
  const codeVerifier = toBase64Url(bytes(32))
  const state = toBase64Url(bytes(24))
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url')
  const url = new URL(GOOGLE_DRIVE_AUTHORIZATION_ENDPOINT)
  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
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

export class GoogleDriveAdapter {
  private readonly fetchImpl: DriveFetchImplementation
  private readonly config: GoogleDriveOAuthConfig

  constructor(options: GoogleDriveOAuthConfig & { fetch?: DriveFetchImplementation }) {
    this.config = options
    this.fetchImpl = options.fetch ?? fetch
  }

  createAuthorizationRequest(): GoogleDrivePkceRequest {
    return createGoogleDrivePkceRequest(this.config)
  }

  async exchangeCode(code: string, codeVerifier: string): Promise<GoogleDriveTokenSet> {
    const response = await this.fetchImpl(GOOGLE_DRIVE_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        code,
        code_verifier: codeVerifier,
        grant_type: 'authorization_code',
        redirect_uri: this.config.redirectUri
      }).toString()
    })
    return parseTokenResponse(response, this.config.scopes ?? [GOOGLE_DRIVE_FILE_SCOPE])
  }

  async refresh(refreshToken: string): Promise<GoogleDriveTokenSet> {
    const response = await this.fetchImpl(GOOGLE_DRIVE_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      }).toString()
    })
    return parseTokenResponse(
      response,
      this.config.scopes ?? [GOOGLE_DRIVE_FILE_SCOPE],
      refreshToken
    )
  }

  async listFiles(accessToken: string, query = 'trashed = false'): Promise<GoogleDriveFile[]> {
    const url = new URL(`${GOOGLE_DRIVE_API_BASE}/files`)
    url.search = new URLSearchParams({
      q: query,
      spaces: 'drive',
      pageSize: '100',
      orderBy: 'modifiedTime desc',
      fields:
        'files(id,name,mimeType,modifiedTime,webViewLink,size,md5Checksum,parents,trashed),nextPageToken'
    }).toString()
    const payload = await this.requestJson<{ files?: GoogleDriveFile[] }>(url, accessToken)
    return Array.isArray(payload.files) ? payload.files : []
  }

  async listChanges(accessToken: string, pageToken: string): Promise<GoogleDriveChangePage> {
    const url = new URL(`${GOOGLE_DRIVE_API_BASE}/changes`)
    url.search = new URLSearchParams({
      pageToken,
      spaces: 'drive',
      pageSize: '100',
      fields:
        'changes(fileId,removed,file(id,name,mimeType,modifiedTime,webViewLink,size,md5Checksum,parents,trashed)),nextPageToken,newStartPageToken'
    }).toString()
    return this.requestJson<GoogleDriveChangePage>(url, accessToken)
  }

  async exportText(
    accessToken: string,
    fileId: string,
    mimeType: 'text/plain' | 'text/markdown' | 'text/csv'
  ): Promise<string> {
    const url = new URL(`${GOOGLE_DRIVE_API_BASE}/files/${encodeURIComponent(fileId)}/export`)
    url.search = new URLSearchParams({ mimeType }).toString()
    return this.requestText(url, accessToken)
  }

  private async requestJson<T>(url: URL, accessToken: string): Promise<T> {
    let response: Response
    try {
      response = await this.fetchImpl(url, {
        headers: { authorization: `Bearer ${accessToken}` }
      })
    } catch (error) {
      throw new GoogleDriveError('offline', error instanceof Error ? error.message : String(error))
    }
    if (response.status === 401 || response.status === 403) {
      throw new GoogleDriveError(
        'reauthorization-required',
        'Drive authorization is no longer valid',
        response.status
      )
    }
    if (!response.ok) {
      throw new GoogleDriveError(
        'http',
        `Drive request failed with ${response.status}`,
        response.status
      )
    }
    try {
      return (await response.json()) as T
    } catch {
      throw new GoogleDriveError('invalid-response', 'Drive returned an invalid JSON response')
    }
  }

  private async requestText(url: URL, accessToken: string): Promise<string> {
    let response: Response
    try {
      response = await this.fetchImpl(url, {
        headers: { authorization: `Bearer ${accessToken}` }
      })
    } catch (error) {
      throw new GoogleDriveError('offline', error instanceof Error ? error.message : String(error))
    }
    if (response.status === 401 || response.status === 403) {
      throw new GoogleDriveError(
        'reauthorization-required',
        'Drive authorization is no longer valid',
        response.status
      )
    }
    if (!response.ok) {
      throw new GoogleDriveError(
        'http',
        `Drive request failed with ${response.status}`,
        response.status
      )
    }
    try {
      return await response.text()
    } catch {
      throw new GoogleDriveError('invalid-response', 'Drive returned an invalid text response')
    }
  }
}

async function parseTokenResponse(
  response: Response,
  scopes: string[],
  refreshToken?: string
): Promise<GoogleDriveTokenSet> {
  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new GoogleDriveError('invalid-response', 'Drive token response was not valid JSON')
  }
  if (!response.ok || !payload || typeof payload !== 'object') {
    throw new GoogleDriveError(
      'http',
      `Drive token exchange failed with ${response.status}`,
      response.status
    )
  }
  const data = payload as Record<string, unknown>
  if (typeof data.access_token !== 'string') {
    throw new GoogleDriveError(
      'invalid-response',
      'Drive token response did not include an access token'
    )
  }
  const expiresIn = typeof data.expires_in === 'number' ? data.expires_in : 3600
  return {
    accessToken: data.access_token,
    expiresAt: Date.now() + expiresIn * 1000,
    refreshToken: typeof data.refresh_token === 'string' ? data.refresh_token : refreshToken,
    scopes: assertGoogleDriveReadOnlyScopes(scopes)
  }
}

function toBase64Url(value: Uint8Array): string {
  return Buffer.from(value).toString('base64url')
}
