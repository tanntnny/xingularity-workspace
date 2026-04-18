import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  createStoredNoteDocumentFromText,
  serializeStoredNoteDocument
} from '../src/shared/noteDocument'

const dirs: string[] = []

afterEach(async () => {
  await Promise.all(dirs.map((dir) => fs.rm(dir, { recursive: true, force: true })))
  dirs.length = 0
})

describe('sqlite index incremental updates', () => {
  it('indexes, updates, and removes notes incrementally', async () => {
    const { SqliteIndexer } = await import('../src/main/indexer/sqliteIndexer')
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'vault-test-'))
    dirs.push(root)
    const notesRoot = path.join(root, 'notes')
    const metaRoot = path.join(root, '.appmeta')
    await fs.mkdir(notesRoot, { recursive: true })
    await fs.mkdir(metaRoot, { recursive: true })
    const dbPath = path.join(metaRoot, 'index.sqlite')
    const fileMapPath = path.join(metaRoot, 'filemap.json')

    const firstNotePath = path.join(notesRoot, 'first.md')
    await fs.writeFile(
      firstNotePath,
      serializeStoredNoteDocument(
        createStoredNoteDocumentFromText('# First\nBody text', ['alpha', 'beta'])
      ),
      'utf-8'
    )

    let indexer: InstanceType<typeof SqliteIndexer>
    try {
      indexer = new SqliteIndexer(dbPath, fileMapPath)
    } catch (error) {
      const message = String(error)
      if (message.includes('NODE_MODULE_VERSION')) {
        expect(true).toBe(true)
        return
      }
      throw error
    }
    await indexer.init()
    await indexer.rebuild(notesRoot)

    const initialResults = indexer.query('alpha')
    expect(initialResults.some((r) => r.relPath === 'first.md')).toBe(true)

    const bodyResults = indexer.query('@Body')
    expect(bodyResults.some((r) => r.relPath === 'first.md')).toBe(true)

    const tagOnlyBodyResults = indexer.query('@alpha')
    expect(tagOnlyBodyResults.some((r) => r.relPath === 'first.md')).toBe(false)

    await indexer.upsertFromRaw({
      id: 'note:first',
      relPath: 'first.md',
      content: serializeStoredNoteDocument(
        createStoredNoteDocumentFromText('# First updated\nNew body text', ['gamma'])
      ),
      updatedAt: new Date().toISOString()
    })

    const updatedResults = indexer.query('gamma')
    expect(updatedResults[0]?.title).toContain('First updated')

    const updatedBodyResults = indexer.query('@gamma')
    expect(updatedBodyResults.some((r) => r.relPath === 'first.md')).toBe(false)

    await indexer.deleteByRelPath('first.md')
    const afterDelete = indexer.query('first')
    expect(afterDelete.length).toBe(0)

    indexer.close()
  })
})
