import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ResourceWriteService } from '../src/main/resourceWriteService'
import { hashResourceContent } from '../src/shared/resourceActions'

const temporaryRoots: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))
  )
})

describe('ResourceWriteService', () => {
  it('requires confirmation and applies an authorized create atomically', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-resource-write-'))
    temporaryRoots.push(root)
    const service = new ResourceWriteService(root)
    const input = {
      targetPath: path.join(root, 'notes', 'status.md'),
      authorizedRoot: root,
      operation: 'create' as const,
      content: 'Status: ready'
    }

    await expect(service.apply(input, false)).rejects.toThrow('explicit confirmation')
    const preview = await service.preview(input)
    expect(preview.existing).toBe(false)
    await service.apply(input, true)
    await expect(fs.readFile(input.targetPath, 'utf8')).resolves.toBe('Status: ready')
    await expect(service.audit()).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ result: 'applied' })])
    )
  })

  it('rejects targets outside the authorized root and stale replacements', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-resource-write-'))
    temporaryRoots.push(root)
    const service = new ResourceWriteService(root)
    const targetPath = path.join(root, 'notes.md')
    await fs.writeFile(targetPath, 'old', 'utf8')

    await expect(
      service.preview({
        targetPath: path.join(root, '..', 'outside.md'),
        authorizedRoot: root,
        operation: 'create',
        content: 'blocked'
      })
    ).rejects.toThrow('inside the authorized root')

    await expect(
      service.apply(
        {
          targetPath,
          authorizedRoot: root,
          operation: 'replace',
          content: 'new',
          expectedHash: hashResourceContent('not-current')
        },
        true
      )
    ).rejects.toThrow('Target changed since preview')
    await expect(fs.readFile(targetPath, 'utf8')).resolves.toBe('old')
  })
})
