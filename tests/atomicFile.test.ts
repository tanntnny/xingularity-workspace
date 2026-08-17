import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { writeFileAtomically } from '../src/main/atomicFile'

const tempRoots: string[] = []

describe('atomic file writes', () => {
  afterEach(async () => {
    vi.restoreAllMocks()
    await Promise.all(
      tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))
    )
  })

  it('keeps the previous target visible until the replacement is committed', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-atomic-file-'))
    tempRoots.push(root)
    const filePath = path.join(root, 'document.json')
    await fs.writeFile(filePath, '{"version":1}', 'utf-8')

    let releaseRename!: () => void
    let signalRenameStarted!: () => void
    const renameStarted = new Promise<void>((resolve) => {
      signalRenameStarted = resolve
    })
    const renameReleased = new Promise<void>((resolve) => {
      releaseRename = resolve
    })
    const originalRename = fs.rename
    vi.spyOn(fs, 'rename').mockImplementation(async (...args) => {
      signalRenameStarted()
      await renameReleased
      return originalRename(...args)
    })

    const writePromise = writeFileAtomically(filePath, '{"version":2}')
    await renameStarted
    await expect(fs.readFile(filePath, 'utf-8')).resolves.toBe('{"version":1}')

    releaseRename()
    await writePromise
    await expect(fs.readFile(filePath, 'utf-8')).resolves.toBe('{"version":2}')
  })
})
