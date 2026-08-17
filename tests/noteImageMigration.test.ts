import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { FileService } from '../src/main/fileService'
import {
  createStoredNoteDocumentFromText,
  parseStoredNoteDocument,
  serializeStoredNoteDocument
} from '../src/shared/noteDocument'

const tempRoots: string[] = []

afterEach(async () => {
  await Promise.all(
    tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))
  )
})

async function makeFixture(): Promise<{
  root: string
  notes: string
  attachments: string
  service: FileService
}> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-image-migration-'))
  tempRoots.push(root)
  const notes = path.join(root, 'notebooks')
  const attachments = path.join(root, 'attachments')
  await fs.mkdir(notes, { recursive: true })
  await fs.mkdir(attachments, { recursive: true })

  return {
    root,
    notes,
    attachments,
    service: new FileService(notes, attachments, () => {})
  }
}

async function writeNote(notes: string, markdown: string): Promise<void> {
  await fs.writeFile(
    path.join(notes, 'Idea image.md'),
    serializeStoredNoteDocument(createStoredNoteDocumentFromText(markdown)),
    'utf-8'
  )
}

describe('FileService note image path migration', () => {
  it('converts relative attachment links to current vault URLs', async () => {
    const fixture = await makeFixture()
    await fs.writeFile(path.join(fixture.attachments, 'idea.png'), 'image-data')
    await writeNote(fixture.notes, '![Idea](attachments/idea.png)')

    const result = await fixture.service.migrateNoteImagePaths()
    const document = parseStoredNoteDocument(
      await fs.readFile(path.join(fixture.notes, 'Idea image.md'), 'utf-8')
    )

    expect(result).toMatchObject({ converted: 1, imagesConverted: 1, attachmentsCopied: 0 })
    expect(document.markdown).toContain(
      `vault-file://${encodeURI(path.join(fixture.root, 'attachments', 'idea.png'))}`
    )
  })

  it('copies an existing image from an old vault and rewrites the note', async () => {
    const fixture = await makeFixture()
    const oldVault = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-old-vault-'))
    tempRoots.push(oldVault)
    const oldAttachments = path.join(oldVault, 'attachments')
    const oldImage = path.join(oldAttachments, 'idea.png')
    await fs.mkdir(oldAttachments, { recursive: true })
    await fs.writeFile(oldImage, 'old-image-data')
    await writeNote(fixture.notes, `![Idea](vault-file://${encodeURI(oldImage)})`)

    const result = await fixture.service.migrateNoteImagePaths()
    const document = parseStoredNoteDocument(
      await fs.readFile(path.join(fixture.notes, 'Idea image.md'), 'utf-8')
    )

    expect(result).toMatchObject({ converted: 1, imagesConverted: 1, attachmentsCopied: 1 })
    const migratedImage = path.join(fixture.attachments, 'idea.png')
    await expect(fs.readFile(migratedImage, 'utf-8')).resolves.toBe('old-image-data')
    expect(document.markdown).toContain(`vault-file://${encodeURI(migratedImage)}`)
  })
})
