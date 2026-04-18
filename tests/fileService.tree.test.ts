import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { FileService } from '../src/main/fileService'
import {
  createStoredNoteDocumentFromText,
  serializeStoredNoteDocument
} from '../src/shared/noteDocument'
import { noteMentionHref } from '../src/shared/noteMentions'

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
      path.join(notesDir, 'root-note.md'),
      serializeStoredNoteDocument(createStoredNoteDocumentFromText('# Root\n'))
    )
    await fs.writeFile(
      path.join(notesDir, 'alpha', 'nested', 'child-note.md'),
      serializeStoredNoteDocument(createStoredNoteDocumentFromText('# Child\n'))
    )
    await fs.writeFile(path.join(notesDir, 'ignored.txt'), 'ignore me')

    const tree = await service.listTree()

    expect(tree.map((node) => `${node.kind}:${node.name}`)).toEqual([
      'folder:alpha',
      'folder:empty-folder',
      'note:root-note.md'
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
      relPath: 'alpha/nested/child-note.md',
      name: 'child-note.md'
    })
  })

  it('creates, renames, and deletes folders and notes by path', async () => {
    const { notesDir, service } = await makeService()

    await service.createFolder('projects')
    const notePath = await service.createNoteAtPath('projects/today.md')
    expect(notePath).toBe('projects/today.md')

    await service.renamePath('projects', 'archive')
    await expect(fs.stat(path.join(notesDir, 'archive', 'today.md'))).resolves.toBeTruthy()

    await service.deletePath('archive')
    await expect(fs.stat(path.join(notesDir, 'archive'))).rejects.toThrow()
  })

  it('migrates legacy xnote JSON documents to markdown files', async () => {
    const { notesDir, service } = await makeService()
    await fs.writeFile(
      path.join(notesDir, 'legacy.xnote'),
      JSON.stringify({
        version: 1,
        tags: ['alpha'],
        blocks: [{ type: 'heading', props: { level: 1 }, content: 'Legacy title' }]
      }),
      'utf-8'
    )

    const migrated = await service.migrateLegacyMarkdownNotes()
    const markdown = await fs.readFile(path.join(notesDir, 'legacy.md'), 'utf-8')

    expect(migrated).toEqual({ 'legacy.xnote': 'legacy.md' })
    expect(markdown).toContain('tags: [alpha]')
    expect(markdown).toContain('# Legacy title')
    await expect(fs.stat(path.join(notesDir, 'legacy.xnote'))).rejects.toThrow()
  })

  it('migrates BlockNote JSON markdown files to markdown content on demand', async () => {
    const { notesDir, service } = await makeService()
    await fs.writeFile(
      path.join(notesDir, 'blocknote.md'),
      JSON.stringify({
        version: 1,
        tags: ['alpha'],
        blocks: [
          { type: 'heading', props: { level: 2 }, content: [{ type: 'text', text: 'Plan' }] },
          { type: 'bulletListItem', content: [{ type: 'text', text: 'First step' }] }
        ]
      }),
      'utf-8'
    )
    await fs.writeFile(
      path.join(notesDir, 'plain.md'),
      serializeStoredNoteDocument(createStoredNoteDocumentFromText('Already markdown')),
      'utf-8'
    )

    const result = await service.migrateBlockNoteMarkdownNotes()
    const migrated = await fs.readFile(path.join(notesDir, 'blocknote.md'), 'utf-8')
    const plain = await fs.readFile(path.join(notesDir, 'plain.md'), 'utf-8')

    expect(result).toEqual({ converted: 1, skipped: 1, failed: [] })
    expect(migrated).toContain('tags: [alpha]')
    expect(migrated).toContain('## Plan')
    expect(migrated).toContain('- First step')
    expect(plain).toContain('Already markdown')
  })

  it('normalizes tagged frontmatter that was embedded in note bodies', async () => {
    const { notesDir, service } = await makeService()
    await fs.writeFile(
      path.join(notesDir, 'tagged-body.md'),
      `---\ntitle: Sample\n---\n\n---\ntags: [alpha, beta]\n---\n\nBody text\n`,
      'utf-8'
    )

    const result = await service.migrateTaggedNoteBodyFrontmatter()
    const normalized = await fs.readFile(path.join(notesDir, 'tagged-body.md'), 'utf-8')

    expect(result.converted).toBe(1)
    expect(result.failed).toEqual([])
    expect(normalized).toContain('title: Sample')
    expect(normalized).toContain('tags: [alpha, beta]')
    expect(normalized.endsWith('Body text\n')).toBe(true)
    expect(normalized).not.toContain('\n---\ntags: [alpha, beta]\n---\n')
  })

  it('rejects moving a folder into its own descendant', async () => {
    const { service } = await makeService()

    await service.createFolder('projects')
    await service.createFolder('projects/subfolder')

    await expect(service.renamePath('projects', 'projects/subfolder/projects')).rejects.toThrow(
      /Cannot move a folder/
    )
  })

  it('rewrites internal note links when a note is renamed', async () => {
    const { notesDir, service } = await makeService()
    await fs.writeFile(
      path.join(notesDir, 'alpha.md'),
      serializeStoredNoteDocument(
        createStoredNoteDocumentFromText(
          `Link [Beta](${noteMentionHref('notes/beta')}) and [[notes/beta]].`
        )
      ),
      'utf-8'
    )
    await fs.mkdir(path.join(notesDir, 'notes'), { recursive: true })
    await fs.writeFile(
      path.join(notesDir, 'notes', 'beta.md'),
      serializeStoredNoteDocument(createStoredNoteDocumentFromText('Beta')),
      'utf-8'
    )

    await service.rename('notes/beta.md', 'notes/gamma.md')
    const alpha = await fs.readFile(path.join(notesDir, 'alpha.md'), 'utf-8')

    expect(alpha).toContain(noteMentionHref('notes/gamma'))
    expect(alpha).toContain('[[notes/gamma]]')
    expect(alpha).not.toContain(noteMentionHref('notes/beta'))
    expect(alpha).not.toContain('[[notes/beta]]')
  })
})
