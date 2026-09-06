import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { VaultChangeCoordinator } from '../src/main/vaultChangeCoordinator'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })))
})

describe('VaultChangeCoordinator', () => {
  it('reconciles canonical files and emits deterministic change events', async () => {
    const root = await makeRoot()
    await fs.mkdir(path.join(root, 'notebooks'), { recursive: true })
    await fs.writeFile(path.join(root, 'notebooks', 'one.md'), '# One\n', 'utf8')

    const coordinator = new VaultChangeCoordinator({ rootPath: root, vaultId: 'vault-test' })
    const first = await coordinator.reconcile()

    expect(first.scannedFiles).toBe(1)
    expect(first.changes).toMatchObject([
      { domain: 'notes', kind: 'add', path: 'notebooks/one.md', source: 'reconcile', sequence: 1 }
    ])

    await fs.writeFile(path.join(root, 'notebooks', 'one.md'), '# Updated\n', 'utf8')
    const second = await coordinator.reconcile()
    expect(second.changes).toMatchObject([
      { kind: 'change', baseHash: expect.any(String), contentHash: expect.any(String), sequence: 2 }
    ])
  })

  it('keeps external event history and reports issue counts', () => {
    const events: string[] = []
    const coordinator = new VaultChangeCoordinator({
      rootPath: '/tmp/vault-test',
      vaultId: 'vault-test',
      onEvent: (event) => events.push(`${event.sequence}:${event.path}`)
    })

    coordinator.recordChange({ kind: 'change', path: 'notebooks/one.md', source: 'external' })
    coordinator.recordConflict({
      id: 'conflict-1',
      vaultId: 'vault-test',
      domain: 'notes',
      path: 'notebooks/one.md',
      kind: 'compare-and-swap',
      detectedAt: new Date(0).toISOString(),
      base: null,
      local: null,
      external: null
    })

    expect(events).toEqual(['1:notebooks/one.md'])
    expect(coordinator.getStatus()).toMatchObject({
      state: 'conflict',
      externalChangeCount: 1,
      conflictCount: 1
    })
  })

  it('uses live file events as the baseline for the next reconcile', async () => {
    const root = await makeRoot()
    await fs.mkdir(path.join(root, 'notebooks'), { recursive: true })
    const notePath = path.join(root, 'notebooks', 'live.md')
    await fs.writeFile(notePath, '# Live\n', 'utf8')

    const coordinator = new VaultChangeCoordinator({ rootPath: root, vaultId: 'vault-live' })
    const revision = await import('../src/main/vaultRevision').then(({ readVaultFileRevision }) =>
      readVaultFileRevision(notePath)
    )
    coordinator.recordChange({
      kind: 'add',
      path: 'notebooks/live.md',
      source: 'external',
      contentHash: revision.contentHash,
      revision: revision.contentHash
    })

    await expect(coordinator.reconcile()).resolves.toMatchObject({ changes: [] })

    await fs.unlink(notePath)
    coordinator.recordChange({
      kind: 'delete',
      path: 'notebooks/live.md',
      source: 'external',
      baseHash: revision.contentHash
    })
    await expect(coordinator.reconcile()).resolves.toMatchObject({ changes: [] })
  })

  it('does not treat derived compatibility files as canonical changes', async () => {
    const root = await makeRoot()
    await fs.mkdir(path.join(root, 'projects'), { recursive: true })
    await fs.mkdir(path.join(root, 'resources'), { recursive: true })
    await fs.writeFile(path.join(root, 'projects', 'index.json'), '{}', 'utf8')
    await fs.writeFile(path.join(root, 'resources', 'locators.json'), '{}', 'utf8')
    await fs.writeFile(path.join(root, 'projects', 'one.json'), '{}', 'utf8')

    const coordinator = new VaultChangeCoordinator({ rootPath: root, vaultId: 'vault-derived' })
    const result = await coordinator.reconcile()

    expect(result.scannedFiles).toBe(1)
    expect(result.changes).toMatchObject([{ path: 'projects/one.json', domain: 'projects' }])
  })
})

async function makeRoot(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-coordinator-'))
  roots.push(root)
  return root
}
