import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  getWorkspaceTransactionPath,
  readWorkspaceTransaction,
  withWorkspaceTransaction
} from '../src/main/workspaceTransaction'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })))
})

describe('workspace transaction journal', () => {
  it('records committed mutations without storing mutation input', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'x-workspace-transaction-'))
    roots.push(root)

    const result = await withWorkspaceTransaction(root, 'tx-1', 'note.create', async () => 'done')

    expect(result).toBe('done')
    await expect(readWorkspaceTransaction(root, 'tx-1')).resolves.toMatchObject({
      id: 'tx-1',
      operation: 'note.create',
      status: 'committed'
    })
    await expect(
      fs.readFile(getWorkspaceTransactionPath(root, 'tx-1'), 'utf8')
    ).resolves.not.toContain('markdown')
  })

  it('records failures and preserves the original error', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'x-workspace-transaction-'))
    roots.push(root)
    const failure = new Error('write failed')

    await expect(
      withWorkspaceTransaction(root, 'tx-2', 'project.update', async () => {
        throw failure
      })
    ).rejects.toBe(failure)

    await expect(readWorkspaceTransaction(root, 'tx-2')).resolves.toMatchObject({
      id: 'tx-2',
      operation: 'project.update',
      status: 'failed',
      error: 'write failed'
    })
  })
})
