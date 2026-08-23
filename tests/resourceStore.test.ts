import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ResourceStore } from '../src/main/resourceStore'

const temporaryRoots: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))
  )
})

describe('ResourceStore', () => {
  it('persists resources, relations, and device locators separately', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-resources-'))
    temporaryRoots.push(root)
    const store = new ResourceStore(root)
    const resource = await store.upsert({
      provider: 'filesystem',
      canonicalUri: '/tmp/brief.md',
      title: 'Brief'
    })

    await store.setLocator({
      resourceId: resource.id,
      deviceId: 'mac-test',
      provider: 'filesystem',
      path: '/tmp/brief.md',
      updatedAt: '2026-01-01T00:00:00.000Z'
    })
    await store.relate({
      id: 'relation-1',
      type: 'project_contains_resource',
      fromId: 'project-1',
      fromKind: 'project',
      toId: resource.id,
      toKind: 'resource',
      createdAt: '2026-01-01T00:00:00.000Z',
      createdBy: 'user',
      confidence: 'confirmed'
    })

    const snapshot = await store.read()
    expect(snapshot.resources).toHaveLength(1)
    expect(snapshot.locators[0].deviceId).toBe('mac-test')
    expect(snapshot.relations[0].toId).toBe(resource.id)
  })
})
