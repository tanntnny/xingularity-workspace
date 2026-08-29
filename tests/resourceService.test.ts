import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ResourceService } from '../src/main/resourceService'

const temporaryRoots: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))
  )
})

describe('ResourceService', () => {
  it('tracks local health and only returns bounded text when enabled', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-resource-service-'))
    temporaryRoots.push(root)
    const folder = await serviceRootFolder(root)
    const sourcePath = path.join(root, 'brief.md')
    await fs.writeFile(sourcePath, '# Brief\n\nSelected context', 'utf8')
    const service = new ResourceService(root)
    const resource = await service.add({ canonicalUri: sourcePath })
    const folderResource = await service.add({ canonicalUri: folder })
    expect(folderResource.kind).toBe('local-folder')

    await expect(service.preview(resource.id, false)).resolves.toMatchObject({
      resourceId: resource.id,
      truncated: false
    })
    await expect(service.preview(resource.id, true)).resolves.toMatchObject({
      text: '# Brief\n\nSelected context'
    })
    await expect(service.refresh(resource.id)).resolves.toMatchObject({
      resourceId: resource.id,
      state: 'available'
    })
  })

  it('preserves a missing resource identity until it is located again', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-resource-service-'))
    temporaryRoots.push(root)
    const service = new ResourceService(root)
    const resource = await service.add({ canonicalUri: path.join(root, 'missing.md') })

    expect(resource.state).toBe('missing')
    const moved = await service.locate(resource.id, path.join(root, 'found.md'))
    expect(moved.id).toBe(resource.id)
    expect(moved.state).toBe('unindexed')
  })

  it('updates external metadata and detaches a resource without deleting it', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-resource-service-'))
    temporaryRoots.push(root)
    const service = new ResourceService(root)
    const resource = await service.add({
      type: 'external',
      canonicalUri: 'https://docs.google.com/document/d/brief/edit',
      title: 'Brief',
      projectId: 'project-1'
    })

    await service.relate({
      type: 'project_contains_resource',
      fromId: 'project-1',
      fromKind: 'project',
      toId: resource.id,
      toKind: 'resource'
    })

    const updated = await service.update(resource.id, { title: 'Project brief' })
    expect(updated.title).toBe('Project brief')
    expect(updated.externalProduct).toBe('google-docs')

    await service.detachFromProject('project-1', resource.id)
    const snapshot = await service.list()
    expect(snapshot.resources).toEqual([expect.objectContaining({ id: resource.id })])
    expect(snapshot.resources[0]?.projectIds).toBeUndefined()
    expect(snapshot.relations).toEqual([])
  })

  it('synchronizes global project links and removes resources with their relations', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-resource-service-'))
    temporaryRoots.push(root)
    const service = new ResourceService(root)
    const resource = await service.add({
      type: 'external',
      canonicalUri: 'https://example.com/linked'
    })

    const linked = await service.setProjectLinks({
      resourceId: resource.id,
      projectIds: ['project-1', 'project-2']
    })
    expect(linked.projectIds).toEqual(['project-1', 'project-2'])
    expect((await service.list()).relations).toHaveLength(2)

    const unassigned = await service.setProjectLinks({ resourceId: resource.id, projectIds: [] })
    expect(unassigned.projectIds).toBeUndefined()
    expect((await service.list()).relations).toEqual([])

    await service.relate({
      type: 'project_contains_resource',
      fromId: 'project-1',
      fromKind: 'project',
      toId: resource.id,
      toKind: 'resource'
    })
    await service.remove(resource.id)
    expect((await service.list()).resources).toEqual([])
    expect((await service.list()).relations).toEqual([])
  })
})

async function serviceRootFolder(root: string): Promise<string> {
  const folder = path.join(root, 'folder')
  await fs.mkdir(folder)
  return folder
}
