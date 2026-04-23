import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ExcalidrawSessionStore } from '../src/main/excalidrawSessionStore'
import type { ExcalidrawSession } from '../src/shared/types'

const tempRoots: string[] = []

async function makeStore(): Promise<{
  root: string
  store: ExcalidrawSessionStore
}> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-excalidraw-'))
  tempRoots.push(root)
  return {
    root,
    store: new ExcalidrawSessionStore(root)
  }
}

function makeSession(id: string, title: string, updatedAt: string): ExcalidrawSession {
  return {
    id,
    title,
    createdAt: '2026-04-19T00:00:00.000Z',
    updatedAt,
    scene: {
      type: 'excalidraw',
      version: 2,
      source: 'https://excalidraw.com',
      elements: [],
      appState: {},
      files: {}
    }
  }
}

afterEach(async () => {
  await Promise.all(
    tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))
  )
})

describe('ExcalidrawSessionStore', () => {
  it('returns an empty list when the store file is missing', async () => {
    const { store } = await makeStore()

    await expect(store.listSessions()).resolves.toEqual([])
  })

  it('saves and lists sessions by most recent update', async () => {
    const { store } = await makeStore()

    await store.saveSession(makeSession('older', 'Older', '2026-04-19T01:00:00.000Z'))
    await store.saveSession(makeSession('newer', 'Newer', '2026-04-19T02:00:00.000Z'))

    const sessions = await store.listSessions()

    expect(sessions.map((session) => session.id)).toEqual(['newer', 'older'])
  })

  it('updates an existing session id instead of duplicating it', async () => {
    const { store } = await makeStore()

    await store.saveSession(makeSession('drawing', 'Draft', '2026-04-19T01:00:00.000Z'))
    await store.saveSession(makeSession('drawing', 'Renamed', '2026-04-19T03:00:00.000Z'))

    const sessions = await store.listSessions()

    expect(sessions).toHaveLength(1)
    expect(sessions[0]?.title).toBe('Renamed')
  })

  it('deletes only the requested session', async () => {
    const { store } = await makeStore()

    await store.saveSession(makeSession('keep', 'Keep', '2026-04-19T02:00:00.000Z'))
    await store.saveSession(makeSession('delete', 'Delete', '2026-04-19T03:00:00.000Z'))

    await store.deleteSession('delete')

    expect((await store.listSessions()).map((session) => session.id)).toEqual(['keep'])
  })

  it('falls back to an empty list for invalid JSON', async () => {
    const { root, store } = await makeStore()
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const filePath = path.join(root, '.xingularity', 'excalidraw-sessions.json')
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, '{ invalid', 'utf-8')

    try {
      await expect(store.listSessions()).resolves.toEqual([])
    } finally {
      errorSpy.mockRestore()
    }
  })
})
