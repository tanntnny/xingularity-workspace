import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { validateVault } from '../src/main/vaultManager'

const tempRoots: string[] = []

function trackTempRoot(root: string): string {
  tempRoots.push(root)
  return root
}

afterEach(async () => {
  await Promise.all(
    tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))
  )
})

describe('vaultManager', () => {
  it('migrates legacy notes and app metadata into the canonical vault layout', async () => {
    const root = trackTempRoot(await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-vault-')))
    await fs.mkdir(path.join(root, 'notes'), { recursive: true })
    await fs.mkdir(path.join(root, '.appmeta'), { recursive: true })
    await fs.writeFile(path.join(root, 'notes', 'legacy.md'), '# Legacy', 'utf-8')
    await fs.writeFile(
      path.join(root, '.appmeta', 'vault.json'),
      JSON.stringify({ version: 1, createdAt: '2026-05-01T00:00:00.000Z' }, null, 2),
      'utf-8'
    )

    const paths = await validateVault(root)

    await expect(
      fs.readFile(path.join(root, 'notebooks', 'legacy.md'), 'utf-8')
    ).resolves.toContain('# Legacy')
    await expect(
      fs.readFile(path.join(root, '.xingularity', 'vault.json'), 'utf-8')
    ).resolves.toContain('"version": 1')

    const migrations = JSON.parse(
      await fs.readFile(path.join(root, '.xingularity', 'migrations.json'), 'utf-8')
    ) as {
      copiedFromLegacyNotesAt?: string
      copiedFromLegacySystemAt?: string
    }

    expect(migrations.copiedFromLegacyNotesAt).toBeTruthy()
    expect(migrations.copiedFromLegacySystemAt).toBeTruthy()
    expect(paths.notebooksPath).toBe(path.join(root, 'notebooks'))
    expect(paths.notesPath).toBe(paths.notebooksPath)
  })

  it('rejects unresolved dual-root notebook conflicts', async () => {
    const root = trackTempRoot(await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-vault-')))
    await fs.mkdir(path.join(root, 'notes'), { recursive: true })
    await fs.mkdir(path.join(root, 'notebooks'), { recursive: true })

    await expect(validateVault(root)).rejects.toThrow(
      /both legacy notes\/ and canonical notebooks\//i
    )
  })
})
