import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  createVaultBackup,
  normalizePortableManifest,
  previewVaultRestore,
  restoreVault
} from '../src/main/vaultTransferService'
import { compareVaultSync } from '../src/main/vaultSyncService'

const tempRoots: string[] = []

describe('vault transfer service', () => {
  afterEach(async () => {
    await Promise.all(
      tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))
    )
  })

  it('creates a verified portable backup and restores it after a no-write preview', async () => {
    const workspace = await makeWorkspace()
    const source = path.join(workspace, 'vault')
    const backup = path.join(workspace, 'backup')
    const restore = path.join(workspace, 'restored')
    await fs.mkdir(path.join(source, 'notebooks'), { recursive: true })
    await fs.mkdir(path.join(source, 'attachments'), { recursive: true })
    await fs.writeFile(path.join(source, 'notebooks', 'note.md'), 'portable note', 'utf-8')
    await fs.writeFile(path.join(source, 'attachments', 'asset.bin'), Buffer.from([4, 5, 6]))
    await fs.writeFile(path.join(source, 'credentials.json'), '{"refreshToken":"private"}', 'utf-8')
    await fs.writeFile(
      path.join(source, 'settings.json'),
      '{"ai":{"mistralApiKey":"legacy-private"}}',
      'utf-8'
    )
    await fs.writeFile(path.join(source, 'index.sqlite'), 'rebuild-me', 'utf-8')

    const result = await createVaultBackup(source, backup)
    expect(result.fileCount).toBe(2)
    await expect(fs.readFile(path.join(backup, 'manifest.json'), 'utf-8')).resolves.toContain(
      'note.md'
    )
    await expect(fs.stat(restore)).rejects.toThrow()

    const preview = await previewVaultRestore(backup, restore)
    expect(preview.canRestore).toBe(true)
    expect(preview.conflicts).toEqual([])
    await expect(fs.stat(restore)).rejects.toThrow()

    const restored = await restoreVault(backup, restore)
    expect(restored.fileCount).toBe(2)
    await expect(fs.readFile(path.join(restore, 'notebooks', 'note.md'), 'utf-8')).resolves.toBe(
      'portable note'
    )
    await expect(fs.stat(path.join(restore, 'credentials.json'))).rejects.toThrow()
    await expect(fs.stat(path.join(restore, 'settings.json'))).rejects.toThrow()
    await expect(fs.stat(path.join(restore, 'index.sqlite'))).rejects.toThrow()
  })

  it('requires explicit overwrite for a restore conflict and rejects unsafe manifests', async () => {
    const workspace = await makeWorkspace()
    const source = path.join(workspace, 'vault')
    const backup = path.join(workspace, 'backup')
    const restore = path.join(workspace, 'restored')
    await fs.mkdir(path.join(source, 'notebooks'), { recursive: true })
    await fs.writeFile(path.join(source, 'notebooks', 'note.md'), 'original', 'utf-8')
    await createVaultBackup(source, backup)
    await fs.mkdir(path.join(restore, 'notebooks'), { recursive: true })
    await fs.writeFile(path.join(restore, 'notebooks', 'note.md'), 'changed', 'utf-8')

    const preview = await previewVaultRestore(backup, restore)
    expect(preview.canRestore).toBe(false)
    expect(preview.conflicts).toEqual(['notebooks/note.md'])
    await expect(restoreVault(backup, restore)).rejects.toThrow('overwrite')

    await restoreVault(backup, restore, { overwrite: true })
    await expect(fs.readFile(path.join(restore, 'notebooks', 'note.md'), 'utf-8')).resolves.toBe(
      'original'
    )

    expect(() =>
      normalizePortableManifest({
        version: 1,
        createdAt: new Date().toISOString(),
        schemaVersion: 1,
        files: [{ path: '../outside.txt', size: 1, checksum: 'a'.repeat(64) }],
        excludes: []
      })
    ).toThrow()
  })

  it('detects only concurrent three-way edits and returns paths deterministically', () => {
    const base = {
      'notebooks/shared.md': 'base',
      'notebooks/conflict.md': 'base',
      'notebooks/local.md': 'base',
      'notebooks/remote.md': 'base'
    }
    const local = {
      'notebooks/shared.md': 'base',
      'notebooks/conflict.md': 'local',
      'notebooks/local.md': 'local',
      'notebooks/remote.md': 'base'
    }
    const remote = {
      'notebooks/shared.md': 'base',
      'notebooks/conflict.md': 'remote',
      'notebooks/local.md': 'base',
      'notebooks/remote.md': 'remote'
    }

    const comparison = compareVaultSync(base, local, remote)

    expect(comparison.conflicts).toEqual([
      {
        path: 'notebooks/conflict.md',
        baseChecksum: 'base',
        localChecksum: 'local',
        remoteChecksum: 'remote',
        reason: 'concurrent-edit'
      }
    ])
    expect(comparison.localChanges).toEqual(['notebooks/local.md'])
    expect(comparison.remoteChanges).toEqual(['notebooks/remote.md'])
    expect(comparison.unchanged).toEqual(['notebooks/shared.md'])
  })
})

async function makeWorkspace(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-vault-transfer-'))
  tempRoots.push(root)
  return root
}
