import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { parseFleetingNote, serializeFleetingNote } from '../src/shared/fleetingNote'
import { FleetingNoteService } from '../src/main/fleetingNoteService'
import type { FleetingNote } from '../src/shared/types'

const tempRoots: string[] = []

afterEach(async () => {
  await Promise.all(
    tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))
  )
})

describe('fleeting notes', () => {
  it('round-trips metadata and captured content', () => {
    const note: FleetingNote = {
      type: 'fleeting',
      id: 'capture-1',
      relPath: 'capture-1.md',
      content: '# Remember this\n\nWith details',
      createdAt: '2026-08-02T00:00:00.000Z',
      updatedAt: '2026-08-02T00:00:01.000Z'
    }

    expect(parseFleetingNote(serializeFleetingNote(note), note.relPath)).toEqual(note)
  })

  it('creates and lists captures newest first', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-fleeting-'))
    tempRoots.push(root)
    const service = new FleetingNoteService(root)

    const created = await service.create('First thought')
    await fs.utimes(path.join(root, created.relPath), new Date(0), new Date(0))
    const newest = await service.create('Second thought')

    await expect(service.list()).resolves.toEqual([newest, created])
    await expect(fs.readFile(path.join(root, created.relPath), 'utf-8')).resolves.toContain(
      'type: fleeting'
    )
  })

  it('rejects unsafe or nested fleeting paths', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-fleeting-'))
    tempRoots.push(root)
    const service = new FleetingNoteService(root)

    await expect(service.read('../outside.md')).rejects.toThrow()
    await expect(service.read('nested/capture.md')).rejects.toThrow()
    await expect(service.read('capture.txt')).rejects.toThrow()
  })

  it('deletes a fleeting note by its safe relative path', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-fleeting-'))
    tempRoots.push(root)
    const service = new FleetingNoteService(root)
    const created = await service.create('Remove this capture')

    await service.delete(created.relPath)

    await expect(fs.access(path.join(root, created.relPath))).rejects.toThrow()
  })
})
