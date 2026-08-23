import { randomUUID } from 'node:crypto'
import type {
  GoogleDriveFileCandidate,
  ResourceInput,
  ResourcePreview,
  ResourceRef
} from '../shared/types'
import { ResourceStore } from './resourceStore'
import {
  GoogleDriveAdapter,
  type GoogleDriveFile,
  type GoogleDrivePkceRequest,
  type GoogleDriveTokenSet
} from './googleDriveAdapter'

export const GOOGLE_DRIVE_CONTENT_MAX_CHARS = 100_000

export interface DriveCredentialStore {
  get(provider: string, vaultRoot: string): Promise<string | null>
  set(provider: string, vaultRoot: string, value: string): Promise<unknown>
  delete(provider: string, vaultRoot: string): Promise<void>
}

export interface StartedDriveAuthorization {
  connectionId: string
  request: Pick<GoogleDrivePkceRequest, 'url' | 'state' | 'scopes'>
}

export class GoogleDriveResourceService {
  private readonly pending = new Map<string, GoogleDrivePkceRequest>()
  private readonly store: ResourceStore

  constructor(
    private readonly vaultRoot: string,
    private readonly adapter: GoogleDriveAdapter,
    private readonly credentials: DriveCredentialStore
  ) {
    this.store = new ResourceStore(vaultRoot)
  }

  startAuthorization(): StartedDriveAuthorization {
    const request = this.adapter.createAuthorizationRequest()
    const connectionId = `drive-${randomUUID()}`
    this.pending.set(connectionId, request)
    return {
      connectionId,
      request: { url: request.url, state: request.state, scopes: request.scopes }
    }
  }

  async completeAuthorization(connectionId: string, code: string, state: string): Promise<void> {
    const request = this.pending.get(connectionId)
    if (!request) throw new Error(`No pending Google Drive authorization: ${connectionId}`)
    if (state !== request.state) throw new Error('Google Drive authorization state did not match')
    try {
      const tokenSet = await this.adapter.exchangeCode(code, request.codeVerifier)
      await this.saveToken(tokenSet)
    } finally {
      this.pending.delete(connectionId)
    }
  }

  async listAndAttach(fileIds: string[], projectId?: string): Promise<ResourceRef[]> {
    const token = await this.getAccessToken()
    const files = await this.adapter.listFiles(token.accessToken)
    const selected = new Set(fileIds.map((id) => id.trim()).filter(Boolean))
    const resources: ResourceRef[] = []
    for (const file of files.filter((candidate) => selected.has(candidate.id))) {
      const resource = await this.store.upsert(this.toResourceInput(file, projectId))
      if (projectId) {
        await this.store.relate({
          id: `project_contains_resource:${projectId}:${resource.id}`,
          type: 'project_contains_resource',
          fromId: projectId,
          fromKind: 'project',
          toId: resource.id,
          toKind: 'resource',
          createdAt: new Date().toISOString(),
          createdBy: 'user',
          confidence: 'confirmed'
        })
      }
      resources.push(resource)
    }
    return resources
  }

  async listFiles(): Promise<GoogleDriveFileCandidate[]> {
    const token = await this.getAccessToken()
    const files = await this.adapter.listFiles(token.accessToken)
    return files.map((file) => ({
      id: file.id,
      name: file.name,
      ...(file.mimeType ? { mimeType: file.mimeType } : {}),
      ...(file.modifiedTime ? { modifiedTime: file.modifiedTime } : {}),
      ...(file.webViewLink ? { webViewLink: file.webViewLink } : {})
    }))
  }

  async refreshChanges(
    pageToken: string
  ): Promise<{ resources: ResourceRef[]; nextPageToken?: string; newStartPageToken?: string }> {
    const token = await this.getAccessToken()
    const page = await this.adapter.listChanges(token.accessToken, pageToken)
    const current = await this.store.read()
    const resources: ResourceRef[] = []
    for (const change of page.changes) {
      if (change.removed || !change.file) {
        if (change.fileId) {
          const existing = current.resources.find(
            (resource) => resource.externalId === change.fileId
          )
          if (existing) {
            resources.push(
              await this.store.update(existing.id, {
                state: 'missing',
                lastSeenAt: new Date().toISOString()
              })
            )
          }
        }
        continue
      }
      resources.push(await this.store.upsert(this.toResourceInput(change.file)))
    }
    return {
      resources,
      nextPageToken: page.nextPageToken,
      newStartPageToken: page.newStartPageToken
    }
  }

  async preview(resourceId: string, allowContent: boolean): Promise<ResourcePreview> {
    const snapshot = await this.store.read()
    const resource = snapshot.resources.find((candidate) => candidate.id === resourceId)
    if (!resource) throw new Error(`Resource not found: ${resourceId}`)
    const preview: ResourcePreview = {
      resourceId,
      kind: resource.kind,
      mimeType: resource.mimeType,
      truncated: false
    }
    if (!allowContent || !resource.externalId) return preview
    const exportMimeType =
      resource.kind === 'google-sheet'
        ? 'text/csv'
        : resource.kind === 'google-doc'
          ? 'text/markdown'
          : resource.kind === 'google-slide'
            ? 'text/plain'
            : null
    if (!exportMimeType) return preview
    try {
      const token = await this.getAccessToken()
      const text = await this.adapter.exportText(
        token.accessToken,
        resource.externalId,
        exportMimeType
      )
      preview.text = text.slice(0, GOOGLE_DRIVE_CONTENT_MAX_CHARS)
      preview.truncated = text.length > GOOGLE_DRIVE_CONTENT_MAX_CHARS
      return preview
    } catch (error) {
      return {
        ...preview,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  async disconnect(): Promise<void> {
    await this.credentials.delete('google-drive', this.vaultRoot)
    const snapshot = await this.store.read()
    for (const resource of snapshot.resources.filter(
      (candidate) => candidate.provider === 'google-drive'
    )) {
      await this.store.update(resource.id, { state: 'reauthorization-required' })
    }
  }

  private async getAccessToken(): Promise<GoogleDriveTokenSet> {
    const raw = await this.credentials.get('google-drive', this.vaultRoot)
    if (!raw) throw new Error('Google Drive is not connected')
    let token: GoogleDriveTokenSet
    try {
      token = JSON.parse(raw) as GoogleDriveTokenSet
    } catch {
      throw new Error('Stored Google Drive credential is invalid')
    }
    if (token.expiresAt > Date.now() + 60_000) return token
    if (!token.refreshToken) throw new Error('Google Drive requires reauthorization')
    const refreshed = await this.adapter.refresh(token.refreshToken)
    await this.saveToken(refreshed)
    return refreshed
  }

  private async saveToken(token: GoogleDriveTokenSet): Promise<void> {
    await this.credentials.set('google-drive', this.vaultRoot, JSON.stringify(token))
  }

  private toResourceInput(file: GoogleDriveFile, projectId?: string): ResourceInput {
    const canonicalUri =
      file.webViewLink ?? `https://drive.google.com/open?id=${encodeURIComponent(file.id)}`
    return {
      provider: 'google-drive' as const,
      kind: undefined,
      title: file.name,
      canonicalUri,
      externalId: file.id,
      mimeType: file.mimeType,
      projectId,
      metadata: {
        modifiedTime: file.modifiedTime ?? null,
        size: file.size ? Number(file.size) : null,
        md5Checksum: file.md5Checksum ?? null,
        trashed: file.trashed ?? false
      }
    }
  }
}
