import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: {
    getPath: () => os.tmpdir()
  }
}))

import { SettingsStore } from '../src/main/settingsStore'
import { getWorkspaceLockPath } from '../src/main/workspaceMutationLock'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })))
})

describe('settings persistence mutation lock', () => {
  it('does not write settings while another process owns the vault lock', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'x-workspace-settings-lock-'))
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
      new SettingsStore({ lockWaitMs: 5 }).updateVault(root, { codeFontFamily: 'fira-code' })
    ).rejects.toMatchObject({ code: 'vault-busy' })
  })
})
