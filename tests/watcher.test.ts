import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { hashVaultBytes } from '../src/main/vaultRevision'
import { isWatchedVaultPath, VaultWatcher, type VaultEvent } from '../src/main/watcher'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })))
})

describe('VaultWatcher path filtering', () => {
  it('watches notes, drawings, and directory changes', () => {
    expect(isWatchedVaultPath('today.md', 'add')).toBe(true)
    expect(isWatchedVaultPath('projects/diagram.excalidraw', 'change')).toBe(true)
    expect(isWatchedVaultPath('projects', 'addDir')).toBe(true)
    expect(isWatchedVaultPath('projects', 'unlinkDir')).toBe(true)
  })

  it('ignores unrelated files and the notebook root directory', () => {
    expect(isWatchedVaultPath('archive/readme.txt', 'add')).toBe(false)
    expect(isWatchedVaultPath('archive/data.json', 'unlink')).toBe(false)
    expect(isWatchedVaultPath('', 'addDir')).toBe(false)
  })

  it('suppresses only hash-matched internal add, change, and delete events', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-watcher-'))
    roots.push(root)
    const watcher = new VaultWatcher(root, async () => undefined)
    const shouldSkip = (absolutePath: string, event: VaultEvent): Promise<boolean> =>
      (
        watcher as unknown as {
          shouldSkip: (filePath: string, fileEvent: VaultEvent) => Promise<boolean>
        }
      ).shouldSkip(absolutePath, event)

    const matchingEvents: Array<{ relativePath: string; event: VaultEvent; content: string }> = [
      { relativePath: 'added.md', event: 'add', content: '# Added\n' },
      { relativePath: 'changed.md', event: 'change', content: '# Changed internally\n' },
      { relativePath: 'deleted.md', event: 'unlink', content: '# Deleted internally\n' }
    ]

    for (const { relativePath, event, content } of matchingEvents) {
      const absolutePath = path.join(root, relativePath)
      await fs.writeFile(absolutePath, content, 'utf8')
      if (event === 'unlink') {
        watcher.markInternalDelete(relativePath, `transaction-${event}`)
        await fs.unlink(absolutePath)
      } else {
        watcher.markInternalWrite(relativePath, hashVaultBytes(content), `transaction-${event}`)
      }

      await expect(shouldSkip(absolutePath, event)).resolves.toBe(true)
      await expect(shouldSkip(absolutePath, event)).resolves.toBe(false)
    }

    const externallyChangedPath = path.join(root, 'mismatch.md')
    await fs.writeFile(externallyChangedPath, '# External bytes\n', 'utf8')
    watcher.markInternalWrite(
      'mismatch.md',
      hashVaultBytes('# Expected bytes\n'),
      'transaction-mismatch'
    )

    await expect(shouldSkip(externallyChangedPath, 'change')).resolves.toBe(false)
  })
})
