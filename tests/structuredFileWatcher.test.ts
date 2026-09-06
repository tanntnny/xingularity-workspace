import { EventEmitter } from 'node:events'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import type { FSWatcher } from 'chokidar'
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

function createFakeWatcher(): EventEmitter & { close: () => Promise<void> } {
  const watcher = new EventEmitter() as EventEmitter & { close: () => Promise<void> }
  watcher.close = async () => undefined
  return watcher
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
    await expect(fs.readFile(quarantined[0]!.quarantinePath, 'utf-8')).resolves.toBe(
      '{ not valid json'
    )
    await watcher.stop()
  })

  it('does not acknowledge a local write when disk bytes differ despite equivalent JSON', async () => {
    const root = await createRoot()
    const changes: StructuredFileChange[] = []
    const conflicts: StructuredConflict[] = []
    const fakeWatcher = createFakeWatcher()
    const watcher = new StructuredFileWatcher({
      roots: [{ name: 'tasks', path: path.join(root, 'tasks') }],
      debounceMs: 0,
      watchFactory: () => fakeWatcher as unknown as FSWatcher,
      onChange: (change) => changes.push(change),
      onConflict: ({ conflict }) => conflicts.push(conflict)
    })
    const filePath = path.join(root, 'tasks', 'task-1.json')
    const baseContent = '{"id":"task-1","title":"Base","version":1}'

    watcher.start()
    fakeWatcher.emit('ready')
    await watcher.waitForReady()
    await fs.writeFile(filePath, baseContent, 'utf-8')
    fakeWatcher.emit('add', filePath)
    await watcher.flushPending()

    const localContent = '{\n  "id": "task-1",\n  "title": "Local",\n  "version": 2\n}\n'
    const diskContent = '{"version":2,"title":"Local","id":"task-1"}'
    watcher.markLocalWrite(filePath, localContent, changes[0]?.version)
    await fs.writeFile(filePath, diskContent, 'utf-8')
    fakeWatcher.emit('change', filePath)
    await watcher.flushPending()

    expect(changes).toHaveLength(1)
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0]).toMatchObject({
      relativePath: 'task-1.json',
      local: { contentHash: expect.any(String) },
      disk: { contentHash: expect.any(String) }
    })
    await watcher.stop()
  })

  it('orders rescans, suppresses duplicate events, and filters ignored paths', async () => {
    const root = await createRoot()
    const recoveryRoot = path.join(root, 'tasks', 'recovery')
    const changes: StructuredFileChange[] = []
    const fakeWatcher = createFakeWatcher()
    const watcher = new StructuredFileWatcher({
      roots: [{ name: 'tasks', path: path.join(root, 'tasks') }],
      quarantineRoot: recoveryRoot,
      debounceMs: 0,
      watchFactory: () => fakeWatcher as unknown as FSWatcher,
      onChange: (change) => changes.push(change)
    })
    const aPath = path.join(root, 'tasks', 'a.json')
    const bPath = path.join(root, 'tasks', 'b.json')

    watcher.start()
    fakeWatcher.emit('ready')
    await watcher.waitForReady()
    await fs.writeFile(aPath, '{"id":"a"}', 'utf-8')
    await fs.writeFile(bPath, '{"id":"b"}', 'utf-8')
    fakeWatcher.emit('add', bPath)
    fakeWatcher.emit('add', bPath)
    fakeWatcher.emit('change', bPath)
    fakeWatcher.emit('add', aPath)
    await watcher.flushPending()

    expect(changes.map((change) => `${change.relativePath}:${change.event}`)).toEqual([
      'a.json:add',
      'b.json:change'
    ])

    fakeWatcher.emit('change', aPath)
    fakeWatcher.emit('change', aPath)
    await watcher.flushPending()
    expect(changes).toHaveLength(2)

    await fs.mkdir(recoveryRoot, { recursive: true })
    await fs.writeFile(path.join(recoveryRoot, 'ignored.json'), '{"ignored":true}', 'utf-8')
    await fs.writeFile(
      path.join(root, 'tasks', 'ignored.tmp-123.json'),
      '{"ignored":true}',
      'utf-8'
    )
    await fs.writeFile(path.join(root, 'tasks', 'ignored.txt'), '{"ignored":true}', 'utf-8')
    const cPath = path.join(root, 'tasks', 'c.json')
    await fs.writeFile(cPath, '{"id":"c"}', 'utf-8')
    fakeWatcher.emit('add', path.join(recoveryRoot, 'ignored.json'))
    fakeWatcher.emit('add', path.join(root, 'tasks', 'ignored.tmp-123.json'))
    fakeWatcher.emit('add', path.join(root, 'tasks', 'ignored.txt'))
    fakeWatcher.emit('add', path.join(root, 'ignored.json'))
    await watcher.flushPending()
    await watcher.rescan()

    expect(changes.map((change) => change.relativePath)).toEqual(['a.json', 'b.json', 'c.json'])
    await watcher.rescan()
    expect(changes.map((change) => change.relativePath)).toEqual(['a.json', 'b.json', 'c.json'])

    fakeWatcher.emit('unlink', bPath)
    fakeWatcher.emit('unlink', bPath)
    await watcher.flushPending()
    expect(changes.map((change) => `${change.relativePath}:${change.event}`)).toEqual([
      'a.json:add',
      'b.json:change',
      'c.json:change',
      'b.json:unlink'
    ])
    fakeWatcher.emit('unlink', bPath)
    await watcher.flushPending()
    expect(changes).toHaveLength(4)
    await watcher.stop()
  })

  it('uses a quiet rescan as a baseline and emits only later disk changes', async () => {
    const root = await createRoot()
    const changes: StructuredFileChange[] = []
    const fakeWatcher = createFakeWatcher()
    const watcher = new StructuredFileWatcher({
      roots: [{ name: 'tasks', path: path.join(root, 'tasks') }],
      debounceMs: 0,
      watchFactory: () => fakeWatcher as unknown as FSWatcher,
      onChange: (change) => changes.push(change)
    })
    const filePath = path.join(root, 'tasks', 'baseline.json')
    await fs.writeFile(filePath, '{"id":"baseline","version":1}', 'utf8')

    watcher.start()
    fakeWatcher.emit('ready')
    await watcher.waitForReady()
    await watcher.rescan(undefined, { emitChanges: false })
    expect(changes).toEqual([])

    await watcher.rescan()
    expect(changes).toEqual([])

    await fs.writeFile(filePath, '{"id":"baseline","version":2}', 'utf8')
    await watcher.rescan()
    expect(changes).toHaveLength(1)
    expect(changes[0]).toMatchObject({
      event: 'change',
      relativePath: 'baseline.json',
      value: { id: 'baseline', version: 2 }
    })

    await watcher.rescan()
    expect(changes).toHaveLength(1)
    await watcher.stop()
  })

  it('suppresses a marked local delete and does not hide a later external re-add', async () => {
    const root = await createRoot()
    const changes: StructuredFileChange[] = []
    const conflicts: StructuredConflict[] = []
    const fakeWatcher = createFakeWatcher()
    const watcher = new StructuredFileWatcher({
      roots: [{ name: 'tasks', path: path.join(root, 'tasks') }],
      debounceMs: 0,
      watchFactory: () => fakeWatcher as unknown as FSWatcher,
      onChange: (change) => changes.push(change),
      onConflict: ({ conflict }) => conflicts.push(conflict)
    })
    const filePath = path.join(root, 'tasks', 'local-delete.json')

    await fs.writeFile(filePath, '{"id":"local-delete","version":1}', 'utf8')
    watcher.start()
    fakeWatcher.emit('ready')
    await watcher.waitForReady()
    await watcher.rescan(undefined, { emitChanges: false })

    watcher.markLocalWrite(filePath, '{"id":"local-delete","version":2}')
    watcher.markLocalDelete(filePath)
    await fs.unlink(filePath)
    fakeWatcher.emit('unlink', filePath)
    await watcher.flushPending()

    expect(changes).toEqual([])
    expect(conflicts).toEqual([])
    await watcher.rescan()
    expect(changes).toEqual([])

    await fs.writeFile(filePath, '{"id":"local-delete","version":3}', 'utf8')
    fakeWatcher.emit('add', filePath)
    await watcher.flushPending()

    expect(changes).toHaveLength(1)
    expect(changes[0]).toMatchObject({
      event: 'add',
      relativePath: 'local-delete.json',
      value: { id: 'local-delete', version: 3 }
    })
    await watcher.stop()
  })
})
