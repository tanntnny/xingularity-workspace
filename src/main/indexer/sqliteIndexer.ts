import Database from 'better-sqlite3'
import fs from 'node:fs/promises'
import path from 'node:path'
import { sha256 } from '../../shared/hash'
import { FileMap, SearchResult } from '../../shared/types'
import { ParsedNote, parseNoteContent } from './noteParser'

interface IndexableNote {
  id: string
  relPath: string
  content: string
  updatedAt: string
}

interface SqliteRow {
  id: string
  rel_path: string
  title: string
  tags_json: string
  tags_text: string
  updated_at: string
  body_text: string
}

export class SqliteIndexer {
  private readonly dbPath: string
  private readonly fileMapPath: string
  private db: Database.Database
  private fileMap: FileMap = {}

  constructor(dbPath: string, fileMapPath: string) {
    this.dbPath = dbPath
    this.fileMapPath = fileMapPath
    this.db = new Database(dbPath)
    this.setup()
  }

  async init(): Promise<void> {
    await fs.mkdir(path.dirname(this.dbPath), { recursive: true })
    await this.loadFileMap()
  }

  close(): void {
    this.db.close()
  }

  async rebuild(notesRoot: string): Promise<void> {
    await this.resetIndexTables()

    this.fileMap = {}

    const files = await listMarkdownFiles(notesRoot)
    for (const absolutePath of files) {
      const relPath = path.relative(notesRoot, absolutePath).replace(/\\/g, '/')
      const content = await fs.readFile(absolutePath, 'utf-8')
      await this.upsertFromRaw({
        id: cryptoId(),
        relPath,
        content,
        updatedAt: new Date().toISOString()
      })
    }
    await this.saveFileMap()
  }

  async upsertFromRaw(note: IndexableNote): Promise<void> {
    const contentHash = sha256(note.content)
    const existing = this.fileMap[note.relPath]
    if (existing && existing.hash === contentHash) {
      return
    }

    const parsed = parseNoteContent(note.content, note.relPath)
    const id = existing?.id ?? note.id
    this.upsertParsed({
      id,
      relPath: note.relPath,
      parsed,
      updatedAt: note.updatedAt
    })

    this.fileMap[note.relPath] = {
      id,
      hash: contentHash,
      lastIndexedAt: new Date().toISOString()
    }
    await this.saveFileMap()
  }

  async deleteByRelPath(relPath: string): Promise<void> {
    const existing = this.fileMap[relPath]
    if (!existing) {
      return
    }

    this.db
      .prepare(
        `
        DELETE FROM notes
        WHERE id = ?
      `
      )
      .run(existing.id)

    delete this.fileMap[relPath]
    await this.saveFileMap()
  }

  query(queryText: string, limit = 50): SearchResult[] {
    const safeQuery = toFtsQuery(queryText)
    if (!safeQuery) {
      return []
    }

    const rows = this.db
      .prepare(
        `
        SELECT
          notes.id,
          notes.rel_path,
          notes.title,
          notes.tags_json,
          notes.updated_at,
          snippet(notes_fts, 1, '', '', ' ... ', 16) AS snippet
        FROM notes_fts
        JOIN notes ON notes_fts.rowid = notes.rowid
        WHERE notes_fts MATCH ?
        ORDER BY bm25(notes_fts)
        LIMIT ?
      `
      )
      .all(safeQuery, limit) as Array<{
      id: string
      rel_path: string
      title: string
      tags_json: string
      updated_at: string
      snippet: string
    }>

    return rows.map((row) => ({
      id: row.id,
      relPath: row.rel_path,
      title: row.title,
      tags: JSON.parse(row.tags_json) as string[],
      updated: row.updated_at,
      snippet: row.snippet
    }))
  }

  private setup(): void {
    this.db.pragma('journal_mode = WAL')
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS notes (
        rowid INTEGER PRIMARY KEY AUTOINCREMENT,
        id TEXT UNIQUE NOT NULL,
        rel_path TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        tags_json TEXT NOT NULL,
        tags_text TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        body_text TEXT NOT NULL
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
        title,
        body_text,
        tags_text,
        content='notes',
        content_rowid='rowid'
      );

      CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
        INSERT INTO notes_fts(rowid, title, body_text, tags_text)
        VALUES (new.rowid, new.title, new.body_text, new.tags_text);
      END;

      CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
        INSERT INTO notes_fts(notes_fts, rowid, title, body_text, tags_text)
        VALUES('delete', old.rowid, old.title, old.body_text, old.tags_text);
      END;

      CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes BEGIN
        INSERT INTO notes_fts(notes_fts, rowid, title, body_text, tags_text)
        VALUES('delete', old.rowid, old.title, old.body_text, old.tags_text);
        INSERT INTO notes_fts(rowid, title, body_text, tags_text)
        VALUES (new.rowid, new.title, new.body_text, new.tags_text);
      END;
    `)
  }

  private upsertParsed(input: {
    id: string
    relPath: string
    parsed: ParsedNote
    updatedAt: string
  }): void {
    this.db
      .prepare(
        `
        INSERT INTO notes (id, rel_path, title, tags_json, tags_text, updated_at, body_text)
        VALUES (@id, @rel_path, @title, @tags_json, @tags_text, @updated_at, @body_text)
        ON CONFLICT(rel_path)
        DO UPDATE SET
          title = excluded.title,
          tags_json = excluded.tags_json,
          tags_text = excluded.tags_text,
          updated_at = excluded.updated_at,
          body_text = excluded.body_text
      `
      )
      .run({
        id: input.id,
        rel_path: input.relPath,
        title: input.parsed.metadata.title,
        tags_json: JSON.stringify(input.parsed.metadata.tags),
        tags_text: input.parsed.metadata.tags.join(' '),
        updated_at: input.updatedAt,
        body_text: input.parsed.bodyText
      } satisfies SqliteRow)
  }

  private async loadFileMap(): Promise<void> {
    try {
      const raw = await fs.readFile(this.fileMapPath, 'utf-8')
      this.fileMap = JSON.parse(raw) as FileMap
    } catch {
      this.fileMap = {}
    }
  }

  private async saveFileMap(): Promise<void> {
    await fs.writeFile(this.fileMapPath, JSON.stringify(this.fileMap, null, 2), 'utf-8')
  }

  private async resetIndexTables(): Promise<void> {
    try {
      this.db.exec('DELETE FROM notes_fts; DELETE FROM notes;')
      return
    } catch (error) {
      if (!isCorruptionError(error)) {
        throw error
      }
    }

    await this.recoverFromCorruption()
  }

  private async recoverFromCorruption(): Promise<void> {
    try {
      this.db.close()
    } catch {}

    await fs.mkdir(path.dirname(this.dbPath), { recursive: true })
    await removeSqliteArtifacts(this.dbPath)
    this.db = new Database(this.dbPath)
    this.setup()
  }
}

function isCorruptionError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }

  const sqliteCode = (error as Error & { code?: string }).code
  if (typeof sqliteCode === 'string' && sqliteCode.startsWith('SQLITE_CORRUPT')) {
    return true
  }

  return /database disk image is malformed/i.test(error.message)
}

async function removeSqliteArtifacts(dbPath: string): Promise<void> {
  const files = [dbPath, `${dbPath}-wal`, `${dbPath}-shm`, `${dbPath}-journal`]
  for (const file of files) {
    await fs.rm(file, { force: true })
  }
}

function toFtsQuery(input: string): string {
  const terms = input
    .trim()
    .split(/\s+/)
    .map((term) => term.replace(/[^a-zA-Z0-9_-]/g, ''))
    .filter((term) => term.length > 1)
    .map((term) => `${term}*`)

  return terms.join(' AND ')
}

async function listMarkdownFiles(root: string): Promise<string[]> {
  const entries = await fs.readdir(root, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const absolutePath = path.join(root, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await listMarkdownFiles(absolutePath)))
      continue
    }
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      files.push(absolutePath)
    }
  }
  return files
}

function cryptoId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
