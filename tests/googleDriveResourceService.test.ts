import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { GoogleDriveAdapter } from '../src/main/googleDriveAdapter'
import {
  GoogleDriveResourceService,
  type DriveCredentialStore
} from '../src/main/googleDriveResourceService'
import { ResourceStore } from '../src/main/resourceStore'

const temporaryRoots: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))
  )
})

class MemoryCredentials implements DriveCredentialStore {
  private value: string | null = null

  get(provider: string, vaultRoot: string): Promise<string | null> {
    void provider
    void vaultRoot
    return Promise.resolve(this.value)
  }

  set(_provider: string, _vaultRoot: string, value: string): Promise<void> {
    this.value = value
    return Promise.resolve()
  }

  delete(): Promise<void> {
    this.value = null
    return Promise.resolve()
  }
}

describe('GoogleDriveResourceService', () => {
  it('authorizes, attaches selected metadata, and disconnects without deleting links', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-drive-service-'))
    temporaryRoots.push(root)
    const credentials = new MemoryCredentials()
    const adapter = new GoogleDriveAdapter({
      clientId: 'client',
      redirectUri: 'http://localhost/callback',
      fetch: async (input) => {
        const url = String(input)
        if (url.includes('/token')) {
          return new Response(JSON.stringify({ access_token: 'access', expires_in: 3600 }), {
            status: 200
          })
        }
        return new Response(
          JSON.stringify({
            files: [
              {
                id: 'drive-file-1',
                name: 'Brief',
                mimeType: 'application/vnd.google-apps.document',
                webViewLink: 'https://docs.google.com/document/d/drive-file-1/edit'
              }
            ]
          }),
          { status: 200 }
        )
      }
    })
    const service = new GoogleDriveResourceService(root, adapter, credentials)
    const authorization = service.startAuthorization()

    await service.completeAuthorization(
      authorization.connectionId,
      'code',
      authorization.request.state
    )
    const attached = await service.listAndAttach(['drive-file-1'], 'project-1')

    expect(attached[0]).toMatchObject({
      provider: 'google-drive',
      kind: 'google-doc',
      externalId: 'drive-file-1'
    })
    const snapshot = await new ResourceStore(root).read()
    expect(snapshot.relations).toHaveLength(1)

    await service.disconnect()
    const disconnected = await new ResourceStore(root).read()
    expect(disconnected.resources[0]?.state).toBe('reauthorization-required')
    await expect(credentials.get('google-drive', root)).resolves.toBeNull()
  })

  it('previews an attached Google Doc as bounded Markdown', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-drive-preview-'))
    temporaryRoots.push(root)
    const credentials = new MemoryCredentials()
    const adapter = new GoogleDriveAdapter({
      clientId: 'client',
      redirectUri: 'http://localhost/callback',
      fetch: async (input) => {
        const url = String(input)
        if (url.includes('/token')) {
          return new Response(JSON.stringify({ access_token: 'access', expires_in: 3600 }), {
            status: 200
          })
        }
        if (url.includes('/export')) {
          expect(url).toContain('mimeType=text%2Fmarkdown')
          return new Response('# Brief\n\nSelected excerpt', { status: 200 })
        }
        return new Response(
          JSON.stringify({
            files: [
              {
                id: 'drive-file-1',
                name: 'Brief',
                mimeType: 'application/vnd.google-apps.document',
                webViewLink: 'https://docs.google.com/document/d/drive-file-1/edit'
              }
            ]
          }),
          { status: 200 }
        )
      }
    })
    const service = new GoogleDriveResourceService(root, adapter, credentials)
    const authorization = service.startAuthorization()

    await service.completeAuthorization(
      authorization.connectionId,
      'code',
      authorization.request.state
    )
    const [resource] = await service.listAndAttach(['drive-file-1'], 'project-1')

    await expect(service.preview(resource.id, true)).resolves.toMatchObject({
      text: '# Brief\n\nSelected excerpt',
      truncated: false
    })
  })
})
