import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { getWorkspaceLockPath, withWorkspaceMutationLock } from '../src/main/workspaceMutationLock'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })))
})

describe('workspace mutation lock', () => {
  it('fails safely after the bounded wait when another writer owns the lock', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'x-workspace-lock-'))
    roots.push(root)
    await fs.mkdir(path.dirname(getWorkspaceLockPath(root)), { recursive: true })
    await fs.writeFile(
      getWorkspaceLockPath(root),
      JSON.stringify({
        id: 'other-process',
        pid: 999999,
        hostname: 'other-host',
        startedAt: new Date().toISOString()
      }),
      'utf8'
    )

    await expect(
      withWorkspaceMutationLock(root, async () => undefined, { waitMs: 5, pollMs: 1 })
    ).rejects.toMatchObject({ code: 'vault-busy' })
  })

  it('does not reinterpret an EEXIST from the mutation body as lock contention', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'x-workspace-lock-'))
    roots.push(root)
    const failure = Object.assign(new Error('target already exists'), { code: 'EEXIST' })

    await expect(
      withWorkspaceMutationLock(
        root,
        async () => {
          throw failure
        },
        { waitMs: 5, pollMs: 1 }
      )
    ).rejects.toBe(failure)

    await expect(fs.stat(getWorkspaceLockPath(root))).rejects.toMatchObject({ code: 'ENOENT' })
  })
})
