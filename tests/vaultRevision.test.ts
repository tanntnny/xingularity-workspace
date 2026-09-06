import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  compareAndSwapWriteFile,
  ExpectedWriteRegistry,
  readVaultFileRevision,
  VaultRevisionConflictError
} from '../src/main/vaultRevision'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })))
})

describe('vault file revisions', () => {
  it('returns a content-based revision for a file', async () => {
    const root = await makeRoot()
    const filePath = path.join(root, 'note.md')
    await fs.writeFile(filePath, 'first', 'utf8')

    const revision = await readVaultFileRevision(filePath)

    expect(revision).toMatchObject({
      contentHash: expect.any(String),
      size: 5,
      revision: expect.any(String)
    })
    expect(revision.revision).toBe(revision.contentHash)
  })

  it('rejects a stale compare-and-swap write without changing disk', async () => {
    const root = await makeRoot()
    const filePath = path.join(root, 'note.md')
    await fs.writeFile(filePath, 'first', 'utf8')
    const base = await readVaultFileRevision(filePath)
    await fs.writeFile(filePath, 'external', 'utf8')

    await expect(
      compareAndSwapWriteFile(filePath, 'local', base.contentHash)
    ).rejects.toBeInstanceOf(VaultRevisionConflictError)
    await expect(fs.readFile(filePath, 'utf8')).resolves.toBe('external')
  })

  it('requires a missing file when creating with a null base hash', async () => {
    const root = await makeRoot()
    const filePath = path.join(root, 'new-note.md')

    await expect(compareAndSwapWriteFile(filePath, 'first', null)).resolves.toMatchObject({
      size: 5
    })
    await expect(compareAndSwapWriteFile(filePath, 'second', null)).rejects.toBeInstanceOf(
      VaultRevisionConflictError
    )
    await expect(fs.readFile(filePath, 'utf8')).resolves.toBe('first')
  })

  it('acknowledges only the expected bytes for an internal write', () => {
    const registry = new ExpectedWriteRegistry()
    const entry = registry.register('/vault/note.md', 'expected', 'transaction-1')

    expect(registry.acknowledge(entry.path, 'different')).toBeNull()
    registry.register(entry.path, 'expected', entry.transactionId)
    expect(registry.acknowledge(entry.path, 'expected')).toMatchObject({
      transactionId: 'transaction-1'
    })

    const deleteEntry = registry.register('/vault/deleted.md', null, 'transaction-delete')
    expect(registry.acknowledge(deleteEntry.path, 'still-present')).toBeNull()
    registry.register(deleteEntry.path, null, deleteEntry.transactionId)
    expect(registry.acknowledge(deleteEntry.path, null)).toMatchObject({
      transactionId: 'transaction-delete'
    })
  })
})

async function makeRoot(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-vault-revision-'))
  roots.push(root)
  return root
}
