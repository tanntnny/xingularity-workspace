import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { TaskStore } from '../src/main/taskStore'

const tempRoots: string[] = []

afterEach(async () => {
  await Promise.all(
    tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))
  )
})

describe('TaskStore', () => {
  it('stores tasks as individual files and removes stale task files', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-tasks-'))
    tempRoots.push(root)
    const store = new TaskStore(root)
    const task = {
      id: 'task/one',
      title: 'Plan release',
      projectId: 'project-1',
      completed: false,
      status: 'in-progress' as const,
      createdAt: '2026-07-29T00:00:00.000Z',
      priority: 'high' as const,
      reminders: []
    }

    await store.writeAll([task])

    await expect(fs.readFile(path.join(root, 'tasks', 'task%2Fone.json'), 'utf-8')).resolves.toContain(
      'Plan release'
    )
    await expect(store.read()).resolves.toEqual([task])

    await store.writeAll([])
    await expect(fs.access(path.join(root, 'tasks', 'task%2Fone.json'))).rejects.toThrow()
  })
})
