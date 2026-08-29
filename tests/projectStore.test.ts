import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ProjectStore } from '../src/main/projectStore'
import { normalizeResourceInput, notebookResourceUri } from '../src/shared/resourceDomain'
import type { Project } from '../src/shared/types'

const temporaryRoots: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))
  )
})

describe('ProjectStore', () => {
  it('round trips project updates through canonical files', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-project-store-'))
    temporaryRoots.push(root)
    const project: Project = {
      id: 'project-1',
      name: 'Launch',
      summary: 'Launch project',
      state: 'active',
      updatedAt: '2026-08-20T10:00:00.000Z',
      icon: { variant: 'filled', color: '#2563eb' },
      resourceRefs: [
        normalizeResourceInput({
          type: 'notebook',
          canonicalUri: notebookResourceUri('Projects/Launch'),
          title: 'Launch'
        })
      ],
      updates: [
        {
          id: 'update-1',
          projectId: 'project-1',
          markdown: 'Progress is on track.',
          status: 'on-track',
          createdAt: '2026-08-20T09:00:00.000Z',
          updatedAt: '2026-08-20T10:00:00.000Z'
        }
      ],
      milestones: [
        {
          id: 'milestone-1',
          title: 'First',
          endDate: '2026-08-31',
          createdAt: '2026-08-20T08:00:00.000Z',
          updatedAt: '2026-08-20T08:00:00.000Z'
        },
        {
          id: 'milestone-2',
          title: 'Second',
          createdAt: '2026-08-20T09:00:00.000Z',
          updatedAt: '2026-08-20T09:00:00.000Z'
        }
      ]
    }

    const store = new ProjectStore(root)
    await store.writeAll([project])

    const snapshot = await store.read()
    expect(snapshot.projects[0]?.resourceRefs?.[0]?.type).toBe('notebook')
    expect(snapshot.projects[0]).not.toHaveProperty('notebookPath')
    expect(snapshot.projects[0]).not.toHaveProperty('resources')
    expect(snapshot.projects[0]?.updates).toEqual(project.updates)
    expect(snapshot.projects[0]?.milestones?.map((milestone) => milestone.id)).toEqual([
      'milestone-1',
      'milestone-2'
    ])
    expect(snapshot.projects[0]?.milestones?.[0]?.endDate).toBe('2026-08-31')
    expect(snapshot.projects[0]).not.toHaveProperty('pulseEvents')
  })
})
