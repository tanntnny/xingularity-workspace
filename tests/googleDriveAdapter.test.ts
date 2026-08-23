import { describe, expect, it } from 'vitest'
import {
  assertGoogleDriveReadOnlyScopes,
  createGoogleDrivePkceRequest,
  GOOGLE_DRIVE_FILE_SCOPE,
  GoogleDriveAdapter,
  GoogleDriveError
} from '../src/main/googleDriveAdapter'

describe('GoogleDriveAdapter', () => {
  it('creates a PKCE request with the narrow selected-file scope', () => {
    const request = createGoogleDrivePkceRequest(
      { clientId: 'client', redirectUri: 'http://localhost/callback' },
      { randomBytes: (size) => new Uint8Array(size).fill(7) }
    )
    expect(request.scopes).toEqual([GOOGLE_DRIVE_FILE_SCOPE])
    expect(request.url).toContain('code_challenge_method=S256')
    expect(request.url).toContain(encodeURIComponent(GOOGLE_DRIVE_FILE_SCOPE))
  })

  it('rejects broad or write scopes', () => {
    expect(() =>
      assertGoogleDriveReadOnlyScopes(['https://www.googleapis.com/auth/drive'])
    ).toThrow(GoogleDriveError)
  })

  it('maps selected Drive metadata into a typed list', async () => {
    const adapter = new GoogleDriveAdapter({
      clientId: 'client',
      redirectUri: 'http://localhost/callback',
      fetch: async () =>
        new Response(JSON.stringify({ files: [{ id: 'file-1', name: 'Brief' }] }), { status: 200 })
    })
    await expect(adapter.listFiles('token')).resolves.toEqual([{ id: 'file-1', name: 'Brief' }])
  })

  it('retrieves Markdown source text through the Drive export endpoint', async () => {
    const adapter = new GoogleDriveAdapter({
      clientId: 'client',
      redirectUri: 'http://localhost/callback',
      fetch: async (input) => {
        expect(String(input)).toContain('/files/file-1/export')
        expect(String(input)).toContain('mimeType=text%2Fmarkdown')
        return new Response('Selected excerpt', { status: 200 })
      }
    })
    await expect(adapter.exportText('token', 'file-1', 'text/markdown')).resolves.toBe(
      'Selected excerpt'
    )
  })
})
