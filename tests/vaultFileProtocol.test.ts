import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  createVaultFileProtocolHandler,
  VAULT_FILE_MAX_SIZE_BYTES
} from '../src/main/vaultFileProtocol'

const tempRoots: string[] = []

function fileUrl(filePath: string): string {
  return `vault-file://${encodeURI(filePath)}`
}

async function createFixture(): Promise<{
  root: string
  attachments: string
  outside: string
}> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-vault-file-'))
  tempRoots.push(root)
  const attachments = path.join(root, 'attachments')
  const outside = path.join(root, 'outside.png')
  await fs.mkdir(attachments, { recursive: true })
  await fs.writeFile(path.join(attachments, 'image.png'), Buffer.from('png-data'))
  await fs.writeFile(outside, Buffer.from('outside-data'))
  return { root, attachments, outside }
}

afterEach(async () => {
  await Promise.all(
    tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))
  )
})

describe('vault-file protocol', () => {
  it('serves an image only from the active attachment root', async () => {
    const fixture = await createFixture()
    const handler = createVaultFileProtocolHandler(() => ({
      vaultRoot: fixture.root,
      attachmentRoots: [fixture.attachments]
    }))

    const response = await handler({ url: fileUrl(path.join(fixture.attachments, 'image.png')) })

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/png')
    expect(await response.text()).toBe('png-data')
  })

  it('denies sibling, parent, inactive-vault, and encoded traversal paths without leaking paths', async () => {
    const fixture = await createFixture()
    const inactiveRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-inactive-vault-'))
    tempRoots.push(inactiveRoot)
    const handler = createVaultFileProtocolHandler(() => ({
      vaultRoot: inactiveRoot,
      attachmentRoots: [path.join(inactiveRoot, 'attachments')]
    }))
    const activeHandler = createVaultFileProtocolHandler(() => ({
      vaultRoot: fixture.root,
      attachmentRoots: [fixture.attachments]
    }))

    const deniedResponses = await Promise.all([
      handler({ url: fileUrl(fixture.outside) }),
      handler({ url: fileUrl(path.join(fixture.root, 'attachments', '..', 'outside.png')) }),
      handler({
        url: `vault-file://${encodeURI(fixture.root)}/attachments/%2e%2e/outside.png`
      })
    ])
    const missingResponse = await activeHandler({
      url: fileUrl(path.join(fixture.attachments, 'missing.png'))
    })

    expect(deniedResponses.map((response) => response.status)).toEqual([403, 403, 400])
    expect(missingResponse.status).toBe(404)
    for (const response of [...deniedResponses, missingResponse]) {
      expect(await response.text()).not.toContain(fixture.root)
    }
  })

  it('denies symlink escapes and unsupported or oversized files', async () => {
    const fixture = await createFixture()
    await fs.symlink(fixture.outside, path.join(fixture.attachments, 'escape.png'))
    await fs.writeFile(path.join(fixture.attachments, 'notes.txt'), Buffer.from('not an image'))
    const handler = createVaultFileProtocolHandler(
      () => ({
        vaultRoot: fixture.root,
        attachmentRoots: [fixture.attachments]
      }),
      { maxBytes: 4 }
    )

    const symlinkResponse = await handler({
      url: fileUrl(path.join(fixture.attachments, 'escape.png'))
    })
    const mimeResponse = await handler({
      url: fileUrl(path.join(fixture.attachments, 'notes.txt'))
    })
    const sizeResponse = await handler({
      url: fileUrl(path.join(fixture.attachments, 'image.png'))
    })

    expect(symlinkResponse.status).toBe(403)
    expect(mimeResponse.status).toBe(415)
    expect(sizeResponse.status).toBe(413)
  })

  it('uses the default size limit when no override is provided', async () => {
    expect(VAULT_FILE_MAX_SIZE_BYTES).toBe(10 * 1024 * 1024)
  })
})
