import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ProjectStore } from '../src/main/projectStore'
import type { Project } from '../src/shared/types'

const tempRoots: string[] = []

afterEach(async () => {
  await Promise.all(
    tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))
  )
})

function makeProject(id: string, name: string): Project {
  return {
    id,
    name,
    summary: '',
    state: 'active',
    status: 'on-track',
    updatedAt: '2026-07-29T00:00:00.000Z',
    progress: 0,
    milestones: [],
    icon: { shape: 'circle', variant: 'filled', color: '#000000' }
  }
}

describe('ProjectStore', () => {
  it('writes one stable project file per project and removes stale files', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-projects-'))
    tempRoots.push(root)
    const store = new ProjectStore(root)

    await store.writeAll([makeProject('project-1', 'Alpha'), makeProject('project-2', 'Beta')])
    const serializedProject = JSON.parse(
      await fs.readFile(path.join(root, 'projects', 'project-1.json'), 'utf-8')
    ) as Record<string, unknown>
    expect(serializedProject).toMatchObject({ name: 'Alpha', description: '', state: 'active' })
    expect(serializedProject).not.toHaveProperty('milestones')

    await store.writeAll([makeProject('project-2', 'Beta')])

    await expect(fs.access(path.join(root, 'projects', 'project-1.json'))).rejects.toThrow()
    await expect(fs.access(path.join(root, 'projects', 'project-2.json'))).resolves.toBeUndefined()
    await expect(store.read()).resolves.toMatchObject({
      canonicalFiles: true,
      projects: [
        expect.objectContaining({
          id: 'project-2',
          name: 'Beta',
          description: '',
          state: 'active',
          updatedAt: '2026-07-29T00:00:00.000Z'
        })
      ]
    })
  })
})
