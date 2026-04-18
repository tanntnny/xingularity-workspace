import fs from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import {
  createEmptyNoteDocument,
  createStoredNoteDocumentFromMarkdown,
  createStoredNoteDocumentFromText,
  getNoteDisplayName,
  isLegacyNotePath,
  isNotePath,
  LEGACY_NOTE_FILE_EXTENSION,
  NOTE_FILE_EXTENSION,
  parseStoredNoteDocument,
  parseBlockNoteJsonMarkdown,
  parseLegacyStoredNoteDocument,
  serializeStoredNoteDocument,
  stripNoteExtension,
  withNoteExtension
} from '../shared/noteDocument'
import {
  extractMentionTargetsFromMarkdown,
  rewriteNoteMentionTargets
} from '../shared/noteMentions'
import { splitNoteContent } from '../shared/noteContent'
import { listTagsFromMarkdown, upsertTagsInMarkdown } from '../shared/noteTags'
import { assertSafeRelativePath, joinSafe, normalizeRelativePath } from '../shared/pathSafety'
import {
  ImportedNoteResult,
  BlockNoteMigrationResult,
  NoteListItem,
  NoteTreeFile,
  NoteTreeFolder,
  NoteTreeNode,
  StoredNoteDocument
} from '../shared/types'

const notePathSchema = z.string().min(1).max(512)
const genericPathSchema = z.string().min(1).max(512)
const noteNameSchema = z.string().min(1).max(120)

type InternalWriteCallback = (relPath: string) => void

export class FileService {
  constructor(
    private readonly notesRoot: string,
    private readonly attachmentsRoot: string,
    private readonly onInternalWrite: InternalWriteCallback
  ) {}

  async listNotes(): Promise<NoteListItem[]> {
    const notes = await listNotePaths(this.notesRoot)
    return Promise.all(notes.map((absolutePath) => this.readNoteListItem(absolutePath)))
  }

  async listTree(): Promise<NoteTreeNode[]> {
    return listTreeNodes(this.notesRoot, this.notesRoot)
  }

  async readNote(relPathInput: string): Promise<string> {
    const document = await this.readNoteDocument(relPathInput)
    return document.markdown
  }

  async readNoteDocument(relPathInput: string): Promise<StoredNoteDocument> {
    const relPath = sanitizeNotePath(relPathInput)
    const absolutePath = joinSafe(this.notesRoot, relPath)
    const raw = await fs.readFile(absolutePath, 'utf-8')
    return parseStoredNoteDocument(raw)
  }

  async writeNote(relPathInput: string, content: string): Promise<void> {
    const relPath = sanitizeNotePath(relPathInput)
    const existing = await this.readNoteDocument(relPath)
    await this.writeNoteDocument(relPath, createStoredNoteDocumentFromText(content, existing.tags))
  }

  async writeNoteDocument(relPathInput: string, document: StoredNoteDocument): Promise<void> {
    const relPath = sanitizeNotePath(relPathInput)
    const absolutePath = joinSafe(this.notesRoot, relPath)
    await fs.mkdir(path.dirname(absolutePath), { recursive: true })
    await fs.writeFile(absolutePath, serializeStoredNoteDocument(document), 'utf-8')
    this.onInternalWrite(relPath)
  }

  async createNote(nameInput: string): Promise<string> {
    const sanitizedName = sanitizeNoteName(nameInput)
    return this.createNoteAtPath(`${sanitizedName}${NOTE_FILE_EXTENSION}`)
  }

  async createNoteAtPath(relPathInput: string): Promise<string> {
    const relPath = sanitizeNotePath(relPathInput)
    const absolutePath = joinSafe(this.notesRoot, relPath)
    await fs.mkdir(path.dirname(absolutePath), { recursive: true })
    await fs.writeFile(absolutePath, serializeStoredNoteDocument(createEmptyNoteDocument()), {
      flag: 'wx'
    })
    this.onInternalWrite(relPath)
    return relPath
  }

  async createNoteWithTags(nameInput: string, tags: string[]): Promise<string> {
    const sanitizedName = sanitizeNoteName(nameInput)
    const relPath = `${sanitizedName}${NOTE_FILE_EXTENSION}`
    const absolutePath = joinSafe(this.notesRoot, relPath)
    await fs.mkdir(path.dirname(absolutePath), { recursive: true })
    await fs.writeFile(absolutePath, serializeStoredNoteDocument(createEmptyNoteDocument(tags)), {
      flag: 'wx'
    })
    this.onInternalWrite(relPath)
    return relPath
  }

  async createFolder(relPathInput: string): Promise<string> {
    const relPath = sanitizeEntryPath(relPathInput)
    const absolutePath = joinSafe(this.notesRoot, relPath)
    await fs.mkdir(absolutePath, { recursive: false })
    return relPath
  }

  async importNotes(sourcePaths: string[]): Promise<ImportedNoteResult[]> {
    const imported: ImportedNoteResult[] = []

    for (const sourcePath of sourcePaths) {
      if (!sourcePath || typeof sourcePath !== 'string') {
        throw new Error('Note source path is required')
      }

      const sourceStats = await fs.stat(sourcePath)
      if (!sourceStats.isFile()) {
        throw new Error('Note source must be a file')
      }

      if (path.extname(sourcePath).toLowerCase() !== '.md') {
        throw new Error('Only markdown notes are supported')
      }

      imported.push(await this.importSingleNote(sourcePath))
    }

    return imported
  }

  async migrateLegacyMarkdownNotes(): Promise<Record<string, string>> {
    const legacyFiles = await listLegacyNoteDocumentPaths(this.notesRoot)
    const migrated: Record<string, string> = {}

    for (const legacyAbsolutePath of legacyFiles) {
      const legacyRelPath = normalizeRelativePath(path.relative(this.notesRoot, legacyAbsolutePath))
      const preferredRelPath = `${stripLegacyNoteExtension(legacyRelPath)}${NOTE_FILE_EXTENSION}`
      const nextRelPath = await findAvailableNoteRelPath(this.notesRoot, preferredRelPath)
      const nextAbsolutePath = joinSafe(this.notesRoot, nextRelPath)
      const raw = await fs.readFile(legacyAbsolutePath, 'utf-8')

      await fs.mkdir(path.dirname(nextAbsolutePath), { recursive: true })
      await fs.writeFile(
        nextAbsolutePath,
        serializeStoredNoteDocument(parseLegacyStoredNoteDocument(raw)),
        { flag: 'wx' }
      )
      await fs.rm(legacyAbsolutePath)

      migrated[legacyRelPath] = nextRelPath
      this.onInternalWrite(nextRelPath)
    }

    return migrated
  }

  async migrateBlockNoteMarkdownNotes(): Promise<BlockNoteMigrationResult> {
    const noteFiles = await listNotePaths(this.notesRoot)
    const result: BlockNoteMigrationResult = {
      converted: 0,
      skipped: 0,
      failed: []
    }

    for (const absolutePath of noteFiles) {
      const relPath = normalizeRelativePath(path.relative(this.notesRoot, absolutePath))
      try {
        const raw = await fs.readFile(absolutePath, 'utf-8')
        const converted = parseBlockNoteJsonMarkdown(raw)
        if (!converted) {
          result.skipped += 1
          continue
        }

        await fs.writeFile(absolutePath, serializeStoredNoteDocument(converted), 'utf-8')
        this.onInternalWrite(relPath)
        result.converted += 1
      } catch (error) {
        result.failed.push({
          relPath,
          error: String(error)
        })
      }
    }

    return result
  }

  async migrateTaggedNoteBodyFrontmatter(): Promise<{
    converted: number
    skipped: number
    failed: Array<{
      relPath: string
      error: string
    }>
  }> {
    const noteFiles = await listNotePaths(this.notesRoot)
    const result = {
      converted: 0,
      skipped: 0,
      failed: [] as Array<{
        relPath: string
        error: string
      }>
    }

    for (const absolutePath of noteFiles) {
      const relPath = normalizeRelativePath(path.relative(this.notesRoot, absolutePath))
      try {
        const raw = await fs.readFile(absolutePath, 'utf-8')
        const normalized = normalizeTaggedNoteBodyFrontmatter(raw)
        if (normalized === raw) {
          result.skipped += 1
          continue
        }

        await fs.writeFile(absolutePath, normalized, 'utf-8')
        this.onInternalWrite(relPath)
        result.converted += 1
      } catch (error) {
        result.failed.push({
          relPath,
          error: String(error)
        })
      }
    }

    return result
  }

  async rename(oldRelPathInput: string, newRelPathInput: string): Promise<void> {
    const oldRelPath = sanitizeNotePath(oldRelPathInput)
    const newRelPath = sanitizeNotePath(newRelPathInput)
    await this.renamePath(oldRelPath, newRelPath)
  }

  async renamePath(oldRelPathInput: string, newRelPathInput: string): Promise<void> {
    const oldRelPath = sanitizeEntryPath(oldRelPathInput)
    const newRelPath = sanitizeEntryPath(newRelPathInput)
    const from = joinSafe(this.notesRoot, oldRelPath)
    const to = joinSafe(this.notesRoot, newRelPath)
    const fromStats = await fs.stat(from)
    assertMoveTargetIsValid(oldRelPath, newRelPath, fromStats.isDirectory())
    await fs.mkdir(path.dirname(to), { recursive: true })
    await fs.rename(from, to)
    await rewriteNoteMentionTargetsForRename(
      this.notesRoot,
      oldRelPath,
      newRelPath,
      fromStats.isDirectory()
    )
    this.onInternalWrite(oldRelPath)
    this.onInternalWrite(newRelPath)
  }

  async delete(relPathInput: string): Promise<void> {
    const relPath = sanitizeNotePath(relPathInput)
    await this.deletePath(relPath)
  }

  async deletePath(relPathInput: string): Promise<void> {
    const relPath = sanitizeEntryPath(relPathInput)
    const absolutePath = joinSafe(this.notesRoot, relPath)
    const stats = await fs.stat(absolutePath)
    if (stats.isDirectory()) {
      await fs.rm(absolutePath, { recursive: true })
    } else {
      await fs.rm(absolutePath)
    }
    this.onInternalWrite(relPath)
  }

  async importAttachment(sourcePath: string): Promise<string> {
    if (!sourcePath || typeof sourcePath !== 'string') {
      throw new Error('Attachment source path is required')
    }

    const sourceStats = await fs.stat(sourcePath)
    if (!sourceStats.isFile()) {
      throw new Error('Attachment source must be a file')
    }

    const ext = path.extname(sourcePath)
    const baseName = path
      .basename(sourcePath, ext)
      .trim()
      .replace(/[^a-zA-Z0-9-_]/g, '-')
      .slice(0, 80)

    const fileName = `${Date.now()}-${baseName || 'attachment'}${ext.toLowerCase()}`
    const absoluteTarget = joinSafe(this.attachmentsRoot, fileName)
    await fs.copyFile(sourcePath, absoluteTarget)
    return `attachments/${fileName}`
  }

  async importAttachmentFromBuffer(buffer: Uint8Array, fileExtension: string): Promise<string> {
    if (!buffer || buffer.length === 0) {
      throw new Error('Buffer is required')
    }

    if (!fileExtension || typeof fileExtension !== 'string') {
      throw new Error('File extension is required')
    }

    const ext = fileExtension.startsWith('.') ? fileExtension : `.${fileExtension}`
    const fileName = `${Date.now()}-pasted${ext.toLowerCase()}`
    const absoluteTarget = joinSafe(this.attachmentsRoot, fileName)

    await fs.writeFile(absoluteTarget, Buffer.from(buffer))
    return `attachments/${fileName}`
  }

  private async importSingleNote(sourcePath: string): Promise<ImportedNoteResult> {
    const sourceName = path.basename(sourcePath)
    const sanitizedName = sanitizeNoteName(path.basename(sourcePath, path.extname(sourcePath)))
    const relPath = await findAvailableNoteRelPath(
      this.notesRoot,
      `${sanitizedName || 'imported-note'}${NOTE_FILE_EXTENSION}`
    )
    const absolutePath = joinSafe(this.notesRoot, relPath)
    const content = await fs.readFile(sourcePath, 'utf-8')
    await fs.writeFile(
      absolutePath,
      serializeStoredNoteDocument(createStoredNoteDocumentFromMarkdown(content)),
      { flag: 'wx' }
    )
    this.onInternalWrite(relPath)

    return {
      sourceName,
      relPath,
      renamed: relPath !== `${sanitizedName || 'imported-note'}${NOTE_FILE_EXTENSION}`
    }
  }

  private async readNoteListItem(absolutePath: string): Promise<NoteListItem> {
    const stats = await fs.stat(absolutePath)
    const raw = await fs.readFile(absolutePath, 'utf-8')
    const relPath = normalizeRelativePath(path.relative(this.notesRoot, absolutePath))
    const document = parseStoredNoteDocument(raw)
    const { body } = splitNoteContent(document.markdown)

    return {
      relPath,
      name: path.basename(relPath),
      dir: path.dirname(relPath) === '.' ? '' : path.dirname(relPath),
      createdAt: stats.birthtime.toISOString(),
      updatedAt: stats.mtime.toISOString(),
      tags: document.tags,
      bodyPreview: body.replace(/\s+/g, ' ').trim(),
      mentionTargets: extractMentionTargetsFromMarkdown(document.markdown)
    }
  }
}

export function sanitizeNotePath(input: string): string {
  const parsed = notePathSchema.parse(input)
  const normalized = sanitizeEntryPath(parsed)
  if (!isNotePath(normalized)) {
    throw new Error(`Only ${NOTE_FILE_EXTENSION} notes are supported`)
  }
  return normalized
}

export function sanitizeEntryPath(input: string): string {
  const parsed = genericPathSchema.parse(input)
  return assertSafeRelativePath(parsed)
}

function sanitizeNoteName(input: string): string {
  const parsed = noteNameSchema.parse(input)
  return stripLegacyNoteExtension(
    withNoteExtension(parsed).replace(
      new RegExp(`${NOTE_FILE_EXTENSION.replace('.', '\\.')}$`, 'i'),
      ''
    )
  )
    .trim()
    .replace(/[^a-zA-Z0-9-_ ]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase()
}

function stripLegacyNoteExtension(input: string): string {
  return input
    .replace(new RegExp(`${LEGACY_NOTE_FILE_EXTENSION.replace('.', '\\.')}$`, 'i'), '')
    .replace(/\.md$/i, '')
}

async function rewriteNoteMentionTargetsForRename(
  notesRoot: string,
  oldRelPath: string,
  newRelPath: string,
  isDirectory: boolean
): Promise<void> {
  const noteFiles = await listNotePaths(notesRoot)
  const oldTarget = stripNoteExtension(oldRelPath)
  const newTarget = stripNoteExtension(newRelPath)

  const rewriteTarget = (target: string): string | null => {
    if (isDirectory) {
      if (target === oldTarget) {
        return newTarget
      }

      if (target.startsWith(`${oldTarget}/`)) {
        return `${newTarget}${target.slice(oldTarget.length)}`
      }

      return null
    }

    return target === oldTarget ? newTarget : null
  }

  await Promise.all(
    noteFiles.map(async (absolutePath) => {
      const raw = await fs.readFile(absolutePath, 'utf-8')
      const document = parseStoredNoteDocument(raw)
      const nextMarkdown = rewriteNoteMentionTargets(document.markdown, rewriteTarget)
      if (nextMarkdown === document.markdown) {
        return
      }

      await fs.writeFile(
        absolutePath,
        serializeStoredNoteDocument({
          ...document,
          markdown: nextMarkdown
        }),
        'utf-8'
      )
    })
  )
}

async function listNotePaths(root: string): Promise<string[]> {
  const entries = await fs.readdir(root, { withFileTypes: true })
  const results: string[] = []
  for (const entry of entries) {
    const absolutePath = path.join(root, entry.name)
    if (entry.isDirectory()) {
      results.push(...(await listNotePaths(absolutePath)))
      continue
    }
    if (entry.isFile() && isNotePath(entry.name)) {
      results.push(absolutePath)
    }
  }
  return results.sort((left, right) => left.localeCompare(right))
}

async function listLegacyNoteDocumentPaths(root: string): Promise<string[]> {
  const entries = await fs.readdir(root, { withFileTypes: true })
  const results: string[] = []
  for (const entry of entries) {
    const absolutePath = path.join(root, entry.name)
    if (entry.isDirectory()) {
      results.push(...(await listLegacyNoteDocumentPaths(absolutePath)))
      continue
    }
    if (entry.isFile() && isLegacyNotePath(entry.name)) {
      results.push(absolutePath)
    }
  }
  return results.sort((left, right) => left.localeCompare(right))
}

async function listTreeNodes(root: string, currentDir: string): Promise<NoteTreeNode[]> {
  const entries = await fs.readdir(currentDir, { withFileTypes: true })
  const folders: NoteTreeFolder[] = []
  const notes: NoteTreeFile[] = []

  for (const entry of entries) {
    const absolutePath = path.join(currentDir, entry.name)
    const relPath = normalizeRelativePath(path.relative(root, absolutePath))

    if (entry.isDirectory()) {
      folders.push({
        id: `folder:${relPath}`,
        kind: 'folder',
        relPath,
        name: entry.name,
        children: await listTreeNodes(root, absolutePath)
      })
      continue
    }

    if (entry.isFile() && isNotePath(entry.name)) {
      const note = await readNoteTreeFile(root, absolutePath)
      notes.push({
        id: `note:${note.relPath}`,
        kind: 'note',
        relPath: note.relPath,
        name: note.name,
        note
      })
    }
  }

  folders.sort((left, right) => left.name.localeCompare(right.name))
  notes.sort((left, right) => left.name.localeCompare(right.name))
  return [...folders, ...notes]
}

async function readNoteTreeFile(root: string, absolutePath: string): Promise<NoteListItem> {
  const stats = await fs.stat(absolutePath)
  const raw = await fs.readFile(absolutePath, 'utf-8')
  const relPath = normalizeRelativePath(path.relative(root, absolutePath))
  const document = parseStoredNoteDocument(raw)
  const { body } = splitNoteContent(document.markdown)
  return {
    relPath,
    name: path.basename(relPath),
    dir: path.dirname(relPath) === '.' ? '' : path.dirname(relPath),
    createdAt: stats.birthtime.toISOString(),
    updatedAt: stats.mtime.toISOString(),
    tags: document.tags,
    bodyPreview: body.replace(/\s+/g, ' ').trim()
  }
}

async function findAvailableNoteRelPath(root: string, preferredRelPath: string): Promise<string> {
  const baseDir = path.dirname(preferredRelPath)
  const baseName = getNoteDisplayName(preferredRelPath)
  let nextRelPath = normalizeRelativePath(
    `${baseDir === '.' ? '' : `${baseDir}/`}${baseName}${NOTE_FILE_EXTENSION}`
  )
  let suffix = 2

  while (await fileExists(joinSafe(root, nextRelPath))) {
    nextRelPath = normalizeRelativePath(
      `${baseDir === '.' ? '' : `${baseDir}/`}${baseName}-${suffix}${NOTE_FILE_EXTENSION}`
    )
    suffix += 1
  }

  return nextRelPath
}

function normalizeTaggedNoteBodyFrontmatter(raw: string): string {
  const outer = splitNoteContent(raw)
  const bodyParts = splitNoteContent(outer.body)

  if (!bodyParts.frontmatter) {
    return raw
  }

  const liftedTags = listTagsFromMarkdown(`---\n${bodyParts.frontmatter}\n---\n`)
  if (liftedTags.length === 0) {
    return raw
  }

  const body = bodyParts.body.replace(/^(?:\r?\n)+/, '')
  const candidateMarkdown = outer.frontmatter
    ? ['---', outer.frontmatter, '---', '', body].join(outer.lineEnding)
    : body
  const existingTags = listTagsFromMarkdown(raw)
  const mergedTags = Array.from(new Set([...existingTags, ...liftedTags]))

  return upsertTagsInMarkdown(candidateMarkdown, mergedTags)
}

function assertMoveTargetIsValid(
  oldRelPath: string,
  newRelPath: string,
  isDirectory: boolean
): void {
  if (oldRelPath === newRelPath) {
    throw new Error('Source and destination paths must be different')
  }

  if (!isDirectory) {
    return
  }

  if (newRelPath === oldRelPath || newRelPath.startsWith(`${oldRelPath}/`)) {
    throw new Error('Cannot move a folder into itself or one of its descendants')
  }
}

async function fileExists(absolutePath: string): Promise<boolean> {
  try {
    await fs.access(absolutePath)
    return true
  } catch {
    return false
  }
}
