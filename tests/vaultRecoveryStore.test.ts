import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  VaultRecoveryStore,
  type VaultConflictRecord,
  type VaultQuarantineRecord
} from '../src/main/vaultRecoveryStore'

const tempRoots: string[] = []

afterEach(async () => {
  await Promise.all(
    tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))
  )
})

describe('VaultRecoveryStore', () => {
  it('persists conflict and quarantine records across store instances', async () => {
    const recoveryRoot = await makeRecoveryRoot()
    const conflict: VaultConflictRecord = {
      id: 'conflict-1',
      path: 'notebooks/meeting.md',
      detectedAt: '2026-08-29T08:00:00.000Z',
      payloads: {
        base: { path: 'conflicts/conflict-1/base.md', contentHash: 'base-hash' },
        local: { path: 'conflicts/conflict-1/local.md', contentHash: 'local-hash' },
        external: { path: 'conflicts/conflict-1/external.md', contentHash: 'external-hash' }
      },
      reason: 'concurrent edit',
      metadata: { domain: 'notes', source: 'external' }
    }
    const quarantine: VaultQuarantineRecord = {
      id: 'quarantine-1',
      path: 'tasks/task-1.json',
      quarantinedAt: '2026-08-29T08:01:00.000Z',
      reason: 'invalid JSON',
      payload: {
        path: 'quarantine/quarantine-1.invalid.json',
        contentHash: 'invalid-hash',
        size: 18,
        mediaType: 'application/json'
      },
      metadata: { parser: 'json' }
    }

    const firstStore = new VaultRecoveryStore(recoveryRoot)
    await expect(firstStore.upsertConflict(conflict)).resolves.toEqual(conflict)
    await expect(firstStore.upsertQuarantine(quarantine)).resolves.toEqual(quarantine)

    const secondStore = new VaultRecoveryStore(recoveryRoot)
    await expect(secondStore.listConflicts()).resolves.toEqual([conflict])
    await expect(secondStore.listQuarantine()).resolves.toEqual([quarantine])
    await expect(
      fs.readFile(path.join(recoveryRoot, 'conflicts', 'conflict-1.json'), 'utf-8')
    ).resolves.toContain('"formatVersion": 1')
    await expect(
      fs.readFile(path.join(recoveryRoot, 'quarantine', 'quarantine-1.json'), 'utf-8')
    ).resolves.toContain('"formatVersion": 1')
  })

  it('upserts by id and resolves records without affecting the other collection', async () => {
    const recoveryRoot = await makeRecoveryRoot()
    const store = new VaultRecoveryStore(recoveryRoot)

    await store.upsertConflict(makeConflict('conflict-1', 'First'))
    await store.upsertConflict(makeConflict('conflict-1', 'Updated'))
    await store.upsertConflict(makeConflict('conflict-2', 'Second'))
    await store.upsertQuarantine(makeQuarantine('quarantine-1'))

    await expect(store.listConflicts()).resolves.toEqual([
      makeConflict('conflict-1', 'Updated'),
      makeConflict('conflict-2', 'Second')
    ])
    await expect(store.resolveConflict('conflict-1')).resolves.toBe(true)
    await expect(store.removeConflict('missing-conflict')).resolves.toBe(false)
    await expect(store.listConflicts()).resolves.toEqual([makeConflict('conflict-2', 'Second')])
    await expect(store.listQuarantine()).resolves.toEqual([makeQuarantine('quarantine-1')])

    await expect(store.resolveQuarantine('quarantine-1')).resolves.toBe(true)
    await expect(store.listQuarantine()).resolves.toEqual([])
  })

  it('writes hashed payload bytes before metadata references them', async () => {
    const recoveryRoot = await makeRecoveryRoot()
    const store = new VaultRecoveryStore(recoveryRoot)

    const reference = await store.writePayload(
      { path: 'conflicts/conflict-payload.local', mediaType: 'text/markdown' },
      '# Local\n'
    )

    expect(reference).toMatchObject({
      path: 'conflicts/conflict-payload.local',
      contentHash: expect.any(String),
      size: 8,
      mediaType: 'text/markdown'
    })
    await expect(fs.readFile(path.join(recoveryRoot, reference.path), 'utf8')).resolves.toBe(
      '# Local\n'
    )
  })

  it('round-trips durable payload references with their bytes across store instances', async () => {
    const recoveryRoot = await makeRecoveryRoot()
    const store = new VaultRecoveryStore(recoveryRoot)
    const payload = new Uint8Array([0, 1, 2, 255])

    const reference = await store.writePayload(
      { path: 'conflicts/conflict-1/local.bin', mediaType: 'application/octet-stream' },
      payload
    )
    const conflict: VaultConflictRecord = {
      id: 'conflict-1',
      path: 'notebooks/binary.md',
      detectedAt: '2026-08-29T08:02:00.000Z',
      payloads: { local: reference, external: null },
      reason: 'durable payload test'
    }

    await expect(store.upsertConflict(conflict)).resolves.toEqual(conflict)

    const restartedStore = new VaultRecoveryStore(recoveryRoot)
    await expect(restartedStore.listConflicts()).resolves.toEqual([conflict])
    await expect(fs.readFile(path.join(recoveryRoot, reference.path))).resolves.toEqual(
      Buffer.from(payload)
    )
  })

  it('rejects payload references whose declared hash or size does not match the bytes', async () => {
    const recoveryRoot = await makeRecoveryRoot()
    const store = new VaultRecoveryStore(recoveryRoot)

    await expect(
      store.writePayload(
        { path: 'conflicts/mismatched-hash.bin', contentHash: 'not-the-payload-hash' },
        'payload'
      )
    ).rejects.toThrow('content hash does not match')
    await expect(
      store.writePayload({ path: 'conflicts/mismatched-size.bin', size: 99 }, 'payload')
    ).rejects.toThrow('size does not match')
    await expect(fs.access(path.join(recoveryRoot, 'conflicts'))).rejects.toThrow()
  })

  it('rejects traversal, absolute, drive-qualified, and symlinked recovery paths', async () => {
    const recoveryRoot = await makeRecoveryRoot()
    const store = new VaultRecoveryStore(recoveryRoot)

    await expect(
      store.upsertConflict({
        ...makeConflict('unsafe-1', 'Unsafe'),
        payloads: { local: { path: '../outside.txt' } }
      })
    ).rejects.toThrow('safe relative path')
    await expect(
      store.upsertQuarantine({
        ...makeQuarantine('unsafe-2'),
        path: '/outside.json'
      })
    ).rejects.toThrow('safe relative path')
    await expect(
      store.upsertQuarantine({
        ...makeQuarantine('unsafe-3'),
        payload: { path: 'C:/outside.json' }
      })
    ).rejects.toThrow('safe relative path')
    await expect(store.resolveConflict('../outside')).rejects.toThrow('Recovery record ids')

    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-recovery-outside-'))
    tempRoots.push(outside)
    const conflictsPath = path.join(recoveryRoot, 'conflicts')
    await fs.rm(conflictsPath, { recursive: true, force: true })
    try {
      await fs.symlink(outside, conflictsPath, 'dir')
    } catch {
      return
    }

    await expect(store.upsertConflict(makeConflict('symlink-1', 'Blocked'))).rejects.toThrow(
      'symbolic link'
    )
    await expect(fs.readdir(outside)).resolves.toEqual([])
  })

  it('does not follow symlinked payload directories or payload files', async () => {
    const recoveryRoot = await makeRecoveryRoot()
    const store = new VaultRecoveryStore(recoveryRoot)
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-payload-outside-'))
    tempRoots.push(outside)

    const conflictsPath = path.join(recoveryRoot, 'conflicts')
    await fs.mkdir(recoveryRoot, { recursive: true })
    try {
      await fs.symlink(outside, conflictsPath, 'dir')
    } catch {
      return
    }

    await expect(store.writePayload('conflicts/unsafe.local', 'blocked')).rejects.toThrow(
      'symbolic link'
    )
    await expect(fs.readdir(outside)).resolves.toEqual([])
  })
})

async function makeRecoveryRoot(): Promise<string> {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-recovery-store-'))
  tempRoots.push(workspace)
  return path.join(workspace, '.xingularity')
}

function makeConflict(id: string, title: string): VaultConflictRecord {
  return {
    id,
    path: `notebooks/${id}.md`,
    detectedAt: `2026-08-29T08:00:0${id.endsWith('2') ? '2' : '1'}.000Z`,
    payloads: {
      local: { path: `conflicts/${id}/local.md` },
      disk: { path: `conflicts/${id}/disk.md` }
    },
    reason: title
  }
}

function makeQuarantine(id: string): VaultQuarantineRecord {
  return {
    id,
    path: `tasks/${id}.json`,
    quarantinedAt: '2026-08-29T08:03:00.000Z',
    reason: 'invalid JSON',
    payload: { path: `quarantine/${id}.invalid.json` }
  }
}
