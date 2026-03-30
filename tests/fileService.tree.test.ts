import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { FileService } from '../src/main/fileService'
import {
  createStoredNoteDocumentFromText,
  serializeStoredNoteDocument
} from '../src/shared/noteDocument'

const tempDirs: string[] = []

async function makeService(): Promise<{
  rootDir: string
  notesDir: string
  attachmentsDir: string
  service: FileService
}> {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-file-service-'))
  tempDirs.push(rootDir)
  const notesDir = path.join(rootDir, 'notes')
  const attachmentsDir = path.join(rootDir, 'attachments')
  await fs.mkdir(notesDir, { recursive: true })
  await fs.mkdir(attachmentsDir, { recursive: true })

  return {
    rootDir,
    notesDir,
    attachmentsDir,
    service: new FileService(notesDir, attachmentsDir, () => undefined)
  }
}

describe('FileService tree operations', () => {
  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })))
  })

  it('builds a nested tree with empty folders and note documents', async () => {
    const { notesDir, service } = await makeService()
    await fs.mkdir(path.join(notesDir, 'alpha', 'nested'), { recursive: true })
    await fs.mkdir(path.join(notesDir, 'empty-folder'))
    await fs.writeFile(
      path.join(notesDir, 'root-note.xnote'),
      serializeStoredNoteDocument(createStoredNoteDocumentFromText('# Root\n'))
    )
    await fs.writeFile(
      path.join(notesDir, 'alpha', 'nested', 'child-note.xnote'),
      serializeStoredNoteDocument(createStoredNoteDocumentFromText('# Child\n'))
    )
    await fs.writeFile(path.join(notesDir, 'ignored.txt'), 'ignore me')

    const tree = await service.listTree()

    expect(tree.map((node) => `${node.kind}:${node.name}`)).toEqual([
      'folder:alpha',
      'folder:empty-folder',
      'note:root-note.xnote'
    ])

    const alphaFolder = tree[0]
    expect(alphaFolder?.kind).toBe('folder')
    if (alphaFolder?.kind !== 'folder') {
      throw new Error('Expected folder node')
    }

    expect(alphaFolder.children[0]).toMatchObject({
      kind: 'folder',
      relPath: 'alpha/nested',
      name: 'nested'
    })
    const nestedFolder = alphaFolder.children[0]
    expect(nestedFolder?.kind).toBe('folder')
    if (nestedFolder?.kind !== 'folder') {
      throw new Error('Expected nested folder node')
    }
    expect(nestedFolder.children[0]).toMatchObject({
      kind: 'note',
      relPath: 'alpha/nested/child-note.xnote',
      name: 'child-note.xnote'
    })
  })

  it('creates, renames, and deletes folders and notes by path', async () => {
    const { notesDir, service } = await makeService()

    await service.createFolder('projects')
    const notePath = await service.createNoteAtPath('projects/today.xnote')
    expect(notePath).toBe('projects/today.xnote')

    await service.renamePath('projects', 'archive')
    await expect(fs.stat(path.join(notesDir, 'archive', 'today.xnote'))).resolves.toBeTruthy()

    await service.deletePath('archive')
    await expect(fs.stat(path.join(notesDir, 'archive'))).rejects.toThrow()
  })

  it('rejects moving a folder into its own descendant', async () => {
    const { service } = await makeService()

    await service.createFolder('projects')
    await service.createFolder('projects/subfolder')

    await expect(service.renamePath('projects', 'projects/subfolder/projects')).rejects.toThrow(
      /Cannot move a folder/
    )
  })
})
