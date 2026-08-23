import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  createStructuredFileVersion,
  hashStructuredContent,
  StructuredFileWatcher,
  type StructuredConflict,
  type StructuredFileChange,
  type StructuredQuarantineRecord
} from '../src/main/structuredFileWatcher'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })))
})

async function createRoot(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'structured-watcher-'))
  roots.push(root)
  await fs.mkdir(path.join(root, 'tasks'), { recursive: true })
  return root
}

async function waitFor(predicate: () => boolean, timeoutMs = 2_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (!predicate() && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  expect(predicate()).toBe(true)
}

describe('structured file watcher', () => {
  it('hashes equivalent JSON consistently and extracts record versions', () => {
    expect(hashStructuredContent('{"b":2,"a":1}')).toBe(hashStructuredContent('{"a":1,"b":2}'))
    expect(
      createStructuredFileVersion({ version: 3, updatedAt: '2026-08-17T00:00:00.000Z' })
    ).toEqual({
      contentHash: expect.any(String),
      version: 3,
      updatedAt: '2026-08-17T00:00:00.000Z'
    })
  })

  it('watches canonical JSON roots, debounces updates, and reports deletes', async () => {
    const root = await createRoot()
    const changes: StructuredFileChange[] = []
    const watcher = new StructuredFileWatcher({
      roots: [{ name: 'tasks', path: path.join(root, 'tasks') }],
      debounceMs: 25,
      usePolling: true,
      onChange: (change) => changes.push(change)
    })
    const filePath = path.join(root, 'tasks', 'task-1.json')

    watcher.start()
    await watcher.waitForReady()
    await fs.writeFile(
      filePath,
      JSON.stringify({ id: 'task-1', title: 'First', version: 1 }),
      'utf-8'
    )
    await waitFor(() => changes.length === 1)
    expect(changes[0]).toMatchObject({
      event: 'add',
      root: 'tasks',
      relativePath: 'task-1.json',
      value: { id: 'task-1', title: 'First', version: 1 }
    })

    await fs.writeFile(
      filePath,
      JSON.stringify({ id: 'task-1', title: 'Second', version: 2 }),
      'utf-8'
    )
    await waitFor(() => changes.length === 2)
    expect(changes[1]?.value).toMatchObject({ title: 'Second', version: 2 })

    await fs.unlink(filePath)
    await waitFor(() => changes.length === 3)
    expect(changes[2]).toMatchObject({ event: 'unlink', version: null })
    await watcher.stop()
  })

  it('surfaces concurrent local and disk edits as a recoverable conflict', async () => {
    const root = await createRoot()
    const changes: StructuredFileChange[] = []
    const conflicts: StructuredConflict[] = []
    const watcher = new StructuredFileWatcher({
      roots: [{ name: 'tasks', path: path.join(root, 'tasks') }],
      debounceMs: 20,
      usePolling: true,
      onChange: (change) => changes.push(change),
      onConflict: ({ conflict }) => conflicts.push(conflict)
    })
    const filePath = path.join(root, 'tasks', 'task-1.json')

    watcher.start()
    await watcher.waitForReady()
    await fs.writeFile(
      filePath,
      JSON.stringify({ id: 'task-1', title: 'Base', version: 1 }),
      'utf-8'
    )
    await waitFor(() => changes.length === 1)
    const base = changes[0]?.version
    expect(base).toBeTruthy()

    const localContent = JSON.stringify({ id: 'task-1', title: 'Local edit', version: 2 })
    watcher.markLocalWrite(filePath, localContent, base)
    await fs.writeFile(
      filePath,
      JSON.stringify({ id: 'task-1', title: 'Disk edit', version: 2 }),
      'utf-8'
    )
    await waitFor(() => conflicts.length === 1)

    expect(changes).toHaveLength(1)
    expect(conflicts[0]).toMatchObject({
      relativePath: 'task-1.json',
      local: { contentHash: expect.any(String) },
      disk: { contentHash: expect.any(String) }
    })

    await watcher.resolveConflict(conflicts[0]!.id, 'keep-local')
    await expect(fs.readFile(filePath, 'utf-8')).resolves.toBe(localContent)
    expect(watcher.getConflicts()).toHaveLength(0)
    expect(changes.at(-1)).toMatchObject({
      type: 'reconciled-change',
      value: { title: 'Local edit' }
    })
    await watcher.stop()
  })

  it('quarantines malformed external files and reports their recovery path', async () => {
    const root = await createRoot()
    const quarantineRoot = path.join(root, 'recovery')
    const quarantined: StructuredQuarantineRecord[] = []
    const watcher = new StructuredFileWatcher({
      roots: [{ name: 'tasks', path: path.join(root, 'tasks') }],
      quarantineRoot,
      debounceMs: 20,
      usePolling: true,
      onQuarantine: (record) => quarantined.push(record)
    })
    const filePath = path.join(root, 'tasks', 'broken.json')

    watcher.start()
    await watcher.waitForReady()
    await fs.writeFile(filePath, '{ not valid json', 'utf-8')
    await waitFor(() => quarantined.length === 1)

    expect(quarantined[0]).toMatchObject({
      root: 'tasks',
      relativePath: 'broken.json',
      quarantinePath: expect.stringContaining('recovery'),
      reason: expect.stringMatching(/json|unexpected/i)
    })
    await expect(fs.access(filePath)).rejects.toThrow()
    await expect(fs.access(quarantined[0]!.quarantinePath)).resolves.toBeUndefined()
    await watcher.stop()
  })
})
