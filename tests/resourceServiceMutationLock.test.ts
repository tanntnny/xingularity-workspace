import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ResourceService } from '../src/main/resourceService'
import { getWorkspaceLockPath } from '../src/main/workspaceMutationLock'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })))
})

describe('resource service mutation lock', () => {
  it('does not write resources while another vault writer owns the lock', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'x-workspace-resource-lock-'))
    roots.push(root)
    const lockPath = getWorkspaceLockPath(root)
    await fs.mkdir(path.dirname(lockPath), { recursive: true })
    await fs.writeFile(
      lockPath,
      JSON.stringify({
        id: 'other-writer',
        pid: process.pid + 1,
        hostname: os.hostname(),
        startedAt: new Date().toISOString()
      })
    )

    await expect(
      new ResourceService(root, { lockWaitMs: 5 }).add({
        canonicalUri: 'https://example.com/reference'
      })
    ).rejects.toMatchObject({ code: 'vault-busy' })
  })
})
