import fs from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { createFileAtomically, writeFileAtomically } from './atomicFile'
import { createDirectoryAncestors, getDirectoryTraversal } from './directoryTraversal'
import {
  createEmptyExcalidrawFileDocument,
  EXCALIDRAW_FILE_EXTENSION,
  isExcalidrawPath,
  parseStoredExcalidrawFileDocument,
  serializeStoredExcalidrawFileDocument,
  stripNotebookFileExtension
} from '../shared/excalidrawFile'
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
  ExcalidrawFileReadResult,
  NoteImagePathMigrationResult,
  NoteListItem,
  NoteTreeExcalidrawFile,
  NoteTreeFile,
  NoteTreeFolder,
  NoteTreeNode,
  StoredExcalidrawFileDocument,
  StoredNoteDocument
} from '../shared/types'

const notePathSchema = z.string().min(1).max(512)
const genericPathSchema = z.string().min(1).max(512)
const noteNameSchema = z.string().min(1).max(120)
const EXCALIDRAW_BACKUP_SUFFIX = '.bak'
const EXCALIDRAW_READ_RETRY_COUNT = 3
const EXCALIDRAW_READ_RETRY_DELAY_MS = 30

type InternalWriteCallback = (relPath: string) => void

export interface FolderNoteDocumentsResult {
  notes: Array<{ relPath: string; document: StoredNoteDocument }>
  warnings: string[]
}

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
    return listTreeNodes(
      this.notesRoot,
      this.notesRoot,
      await createDirectoryAncestors(this.notesRoot)
    )
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

  async listNoteDocumentsInFolder(folderRelPathInput: string): Promise<FolderNoteDocumentsResult> {
    const folderRelPath = sanitizeEntryPath(folderRelPathInput)
    const folderPath = joinSafe(this.notesRoot, folderRelPath)
    const stats = await fs.stat(folderPath)

    if (!stats.isDirectory()) {
      throw new Error('Folder export requires a folder path')
    }

    const notePaths = await listNotePaths(folderPath)
    const results = await Promise.all(
      notePaths.map(async (absolutePath) => {
        const relPath = normalizeRelativePath(path.relative(this.notesRoot, absolutePath))
        try {
          const raw = await fs.readFile(absolutePath, 'utf-8')
          return {
            note: {
              relPath,
              document: parseStoredNoteDocument(raw)
            },
            warning: null
          }
        } catch (error) {
          return {
            note: null,
            warning: `Skipped unreadable Markdown note ${relPath}: ${describeError(error)}`
          }
        }
      })
    )

    return {
      notes: results.flatMap((result) => (result.note ? [result.note] : [])),
      warnings: results.flatMap((result) => (result.warning ? [result.warning] : []))
    }
  }

  async readExcalidrawFileDocument(relPathInput: string): Promise<ExcalidrawFileReadResult> {
    const relPath = sanitizeExcalidrawPath(relPathInput)
    const absolutePath = joinSafe(this.notesRoot, relPath)
    let primaryError: unknown

    for (let attempt = 0; attempt < EXCALIDRAW_READ_RETRY_COUNT; attempt += 1) {
      const raw = await fs.readFile(absolutePath, 'utf-8')
      try {
        return {
          document: parseStoredExcalidrawFileDocument(raw),
          recovered: false
        }
      } catch (error) {
        primaryError = error
        if (attempt + 1 < EXCALIDRAW_READ_RETRY_COUNT) {
          await delay(EXCALIDRAW_READ_RETRY_DELAY_MS)
        }
      }
    }

    const backupPath = getExcalidrawBackupPath(absolutePath)
    try {
      const backupRaw = await fs.readFile(backupPath, 'utf-8')
      const document = parseStoredExcalidrawFileDocument(backupRaw)
      await writeFileAtomically(absolutePath, serializeStoredExcalidrawFileDocument(document))
      this.onInternalWrite(relPath)
      console.warn('[FileService] Recovered Excalidraw file from backup', { relPath })
      return { document, recovered: true }
    } catch (backupError) {
      throw new Error(
        `Unable to read Excalidraw drawing ${relPath}: ${describeError(primaryError)}; backup unavailable or invalid: ${describeError(backupError)}`
      )
    }
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

  async writeExcalidrawFileDocument(
    relPathInput: string,
    document: StoredExcalidrawFileDocument
  ): Promise<void> {
    const relPath = sanitizeExcalidrawPath(relPathInput)
    const absolutePath = joinSafe(this.notesRoot, relPath)
    await fs.mkdir(path.dirname(absolutePath), { recursive: true })
    const serialized = serializeStoredExcalidrawFileDocument(document)
    parseStoredExcalidrawFileDocument(serialized)

    try {
      const existingRaw = await fs.readFile(absolutePath, 'utf-8')
      parseStoredExcalidrawFileDocument(existingRaw)
      await writeFileAtomically(getExcalidrawBackupPath(absolutePath), existingRaw)
    } catch (error) {
      if (!isMissingPathError(error) && !isInvalidExcalidrawFileError(error)) {
        throw error
      }
    }

    await writeFileAtomically(absolutePath, serialized)
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

  async createExcalidrawFileAtPath(relPathInput: string): Promise<string> {
    const relPath = sanitizeExcalidrawPath(relPathInput)
    const absolutePath = joinSafe(this.notesRoot, relPath)
    await fs.mkdir(path.dirname(absolutePath), { recursive: true })
    await createFileAtomically(
      absolutePath,
      serializeStoredExcalidrawFileDocument(createEmptyExcalidrawFileDocument())
    )
    await fs.rm(getExcalidrawBackupPath(absolutePath), { force: true })
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

  async createNoteWithMarkdown(nameInput: string, markdown: string): Promise<string> {
    const sanitizedName = sanitizeNoteName(nameInput.slice(0, 120)) || 'captured-thought'
    const relPath = await findAvailableNoteRelPath(
      this.notesRoot,
      `${sanitizedName}${NOTE_FILE_EXTENSION}`
    )
    const absolutePath = joinSafe(this.notesRoot, relPath)
    await fs.mkdir(path.dirname(absolutePath), { recursive: true })
    await fs.writeFile(
      absolutePath,
      serializeStoredNoteDocument(createStoredNoteDocumentFromMarkdown(markdown)),
      { flag: 'wx' }
    )
    this.onInternalWrite(relPath)
    return relPath
  }

  async createFolder(relPathInput: string): Promise<string> {
    const relPath = sanitizeEntryPath(relPathInput)
    const absolutePath = joinSafe(this.notesRoot, relPath)
    await fs.mkdir(absolutePath, { recursive: false })
    this.onInternalWrite(relPath)
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

  async migrateNoteImagePaths(): Promise<NoteImagePathMigrationResult> {
    const noteFiles = await listNotePaths(this.notesRoot)
    const result: NoteImagePathMigrationResult = {
      converted: 0,
      skipped: 0,
      imagesConverted: 0,
      attachmentsCopied: 0,
      failed: []
    }
    const attachmentFiles = await listFilesRecursively(this.attachmentsRoot)
    const attachmentByName = new Map<string, string[]>()

    for (const attachmentPath of attachmentFiles) {
      const name = path.basename(attachmentPath)
      const matches = attachmentByName.get(name) ?? []
      matches.push(attachmentPath)
      attachmentByName.set(name, matches)
    }

    for (const absolutePath of noteFiles) {
      const relPath = normalizeRelativePath(path.relative(this.notesRoot, absolutePath))
      try {
        const raw = await fs.readFile(absolutePath, 'utf-8')
        const document = parseStoredNoteDocument(raw)
        const migrated = await migrateMarkdownImagePaths(
          document.markdown,
          absolutePath,
          this.attachmentsRoot,
          attachmentByName
        )

        if (migrated.markdown === document.markdown) {
          result.skipped += 1
          continue
        }

        await fs.writeFile(
          absolutePath,
          serializeStoredNoteDocument({ ...document, markdown: migrated.markdown }),
          'utf-8'
        )
        this.onInternalWrite(relPath)
        result.converted += 1
        result.imagesConverted += migrated.imagesConverted
        result.attachmentsCopied += migrated.attachmentsCopied
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
    if (await fileExists(to)) {
      throw new Error(`A file or folder already exists at ${newRelPath}`)
    }
    await fs.mkdir(path.dirname(to), { recursive: true })
    await fs.rename(from, to)
    if (!fromStats.isDirectory() && isExcalidrawPath(oldRelPath)) {
      await moveExcalidrawBackup(from, to)
    }
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
      if (isExcalidrawPath(relPath)) {
        await fs.rm(getExcalidrawBackupPath(absolutePath), { force: true })
      }
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

export function sanitizeExcalidrawPath(input: string): string {
  const parsed = notePathSchema.parse(input)
  const normalized = sanitizeEntryPath(parsed)
  if (!isExcalidrawPath(normalized)) {
    throw new Error(`Only ${EXCALIDRAW_FILE_EXTENSION} drawings are supported`)
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

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function getExcalidrawBackupPath(absolutePath: string): string {
  return `${absolutePath}${EXCALIDRAW_BACKUP_SUFFIX}`
}

async function moveExcalidrawBackup(from: string, to: string): Promise<void> {
  const fromBackup = getExcalidrawBackupPath(from)
  const toBackup = getExcalidrawBackupPath(to)

  try {
    await fs.rm(toBackup, { force: true })
    await fs.rename(fromBackup, toBackup)
  } catch (error) {
    if (!isMissingPathError(error)) {
      console.warn('[FileService] Failed to move Excalidraw backup', { from, to, error })
    }
  }
}

function isMissingPathError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')
}

function isInvalidExcalidrawFileError(error: unknown): boolean {
  return error instanceof Error && error.message.toLowerCase().includes('excalidraw file')
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function listNotePaths(root: string, ancestors?: ReadonlySet<string>): Promise<string[]> {
  const currentAncestors = ancestors ?? (await createDirectoryAncestors(root))
  const entries = await fs.readdir(root, { withFileTypes: true })
  const results: string[] = []
  for (const entry of entries) {
    const absolutePath = path.join(root, entry.name)
    const directory = await getDirectoryTraversal(entry, absolutePath, currentAncestors)
    if (directory.nextAncestors) {
      results.push(...(await listNotePaths(absolutePath, directory.nextAncestors)))
      continue
    }
    if (entry.isFile() && isNotePath(entry.name)) {
      results.push(absolutePath)
    }
  }
  return results.sort((left, right) => left.localeCompare(right))
}

async function listLegacyNoteDocumentPaths(
  root: string,
  ancestors?: ReadonlySet<string>
): Promise<string[]> {
  const currentAncestors = ancestors ?? (await createDirectoryAncestors(root))
  const entries = await fs.readdir(root, { withFileTypes: true })
  const results: string[] = []
  for (const entry of entries) {
    const absolutePath = path.join(root, entry.name)
    const directory = await getDirectoryTraversal(entry, absolutePath, currentAncestors)
    if (directory.nextAncestors) {
      results.push(...(await listLegacyNoteDocumentPaths(absolutePath, directory.nextAncestors)))
      continue
    }
    if (entry.isFile() && isLegacyNotePath(entry.name)) {
      results.push(absolutePath)
    }
  }
  return results.sort((left, right) => left.localeCompare(right))
}

async function listTreeNodes(
  root: string,
  currentDir: string,
  ancestors: ReadonlySet<string>
): Promise<NoteTreeNode[]> {
  const entries = await fs.readdir(currentDir, { withFileTypes: true })
  const folders: NoteTreeFolder[] = []
  const notes: NoteTreeFile[] = []
  const drawings: NoteTreeExcalidrawFile[] = []

  for (const entry of entries) {
    const absolutePath = path.join(currentDir, entry.name)
    const relPath = normalizeRelativePath(path.relative(root, absolutePath))

    const directory = await getDirectoryTraversal(entry, absolutePath, ancestors)
    if (directory.isDirectory) {
      folders.push({
        id: `folder:${relPath}`,
        kind: 'folder',
        relPath,
        name: entry.name,
        isLinked: entry.isSymbolicLink(),
        children: directory.nextAncestors
          ? await listTreeNodes(root, absolutePath, directory.nextAncestors)
          : []
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
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
        note
      })
      continue
    }

    if (entry.isFile() && isExcalidrawPath(entry.name)) {
      const stats = await fs.stat(absolutePath)
      drawings.push({
        id: `excalidraw:${relPath}`,
        kind: 'excalidraw',
        relPath,
        name: entry.name,
        createdAt: stats.birthtime.toISOString(),
        updatedAt: stats.mtime.toISOString()
      })
    }
  }

  folders.sort((left, right) => left.name.localeCompare(right.name))
  notes.sort((left, right) => left.name.localeCompare(right.name))
  drawings.sort((left, right) => left.name.localeCompare(right.name))
  return [...folders, ...notes, ...drawings]
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

export async function findAvailableExcalidrawRelPath(
  root: string,
  preferredRelPath: string
): Promise<string> {
  const baseDir = path.dirname(preferredRelPath)
  const baseName = path.basename(stripNotebookFileExtension(preferredRelPath))
  let nextRelPath = normalizeRelativePath(
    `${baseDir === '.' ? '' : `${baseDir}/`}${baseName}${EXCALIDRAW_FILE_EXTENSION}`
  )
  let suffix = 2

  while (await fileExists(joinSafe(root, nextRelPath))) {
    nextRelPath = normalizeRelativePath(
      `${baseDir === '.' ? '' : `${baseDir}/`}${baseName}-${suffix}${EXCALIDRAW_FILE_EXTENSION}`
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

const MARKDOWN_IMAGE_TARGET_PATTERN = /(!\[[^\]]*\]\()(<[^>]*>|[^\s)]+)([^)]*\))/g

async function migrateMarkdownImagePaths(
  markdown: string,
  noteAbsolutePath: string,
  attachmentsRoot: string,
  attachmentByName: Map<string, string[]>
): Promise<{ markdown: string; imagesConverted: number; attachmentsCopied: number }> {
  const matches = Array.from(markdown.matchAll(MARKDOWN_IMAGE_TARGET_PATTERN))
  if (matches.length === 0) {
    return { markdown, imagesConverted: 0, attachmentsCopied: 0 }
  }

  const replacements = new Map<string, { target: string; copied: boolean }>()
  let imagesConverted = 0
  let attachmentsCopied = 0
  let nextMarkdown = markdown

  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const match = matches[index]
    const rawTarget = match[2]
    const target =
      rawTarget.startsWith('<') && rawTarget.endsWith('>') ? rawTarget.slice(1, -1) : rawTarget
    let replacement = replacements.get(target)

    if (!replacement) {
      const migrated = await migrateImageTarget(
        target,
        noteAbsolutePath,
        attachmentsRoot,
        attachmentByName
      )
      replacement = migrated ? migrated : { target, copied: false }
      replacements.set(target, replacement)
    }

    if (replacement.target === target) {
      continue
    }

    const replacementStart = match.index + match[1].length
    const replacementEnd = replacementStart + rawTarget.length
    nextMarkdown = `${nextMarkdown.slice(0, replacementStart)}${replacement.target}${nextMarkdown.slice(replacementEnd)}`
    imagesConverted += 1
    if (replacement.copied) {
      attachmentsCopied += 1
    }
  }

  return { markdown: nextMarkdown, imagesConverted, attachmentsCopied }
}

async function migrateImageTarget(
  target: string,
  noteAbsolutePath: string,
  attachmentsRoot: string,
  attachmentByName: Map<string, string[]>
): Promise<{ target: string; copied: boolean } | null> {
  const decodedTarget = decodeImageTarget(target)
  if (!decodedTarget || !isSupportedImagePath(decodedTarget)) {
    return null
  }

  const vaultRoot = path.dirname(attachmentsRoot)
  const sourcePath = getAbsoluteImagePath(target)
  if (sourcePath && isWithinRoot(sourcePath, attachmentsRoot) && (await isFile(sourcePath))) {
    return { target: toVaultFileUrl(sourcePath), copied: false }
  }

  const currentRelativePath = decodedTarget.replace(/^\.\//, '')
  const relativeCandidate = currentRelativePath.startsWith('attachments/')
    ? path.resolve(vaultRoot, currentRelativePath)
    : path.resolve(path.dirname(noteAbsolutePath), currentRelativePath)

  if (isWithinRoot(relativeCandidate, attachmentsRoot) && (await isFile(relativeCandidate))) {
    return { target: toVaultFileUrl(relativeCandidate), copied: false }
  }

  const sourceName = sourcePath ? path.basename(sourcePath) : path.basename(decodedTarget)
  const currentMatches = attachmentByName.get(sourceName) ?? []
  if (currentMatches.length === 1) {
    return { target: toVaultFileUrl(currentMatches[0]), copied: false }
  }

  if (!sourcePath || !isAttachmentPath(sourcePath) || !(await isFile(sourcePath))) {
    return null
  }

  const copiedPath = await copyMigratedAttachment(sourcePath, attachmentsRoot, attachmentByName)
  return { target: toVaultFileUrl(copiedPath), copied: true }
}

function decodeImageTarget(target: string): string | null {
  try {
    return decodeURIComponent(target).replace(/\\/g, '/')
  } catch {
    return null
  }
}

function getAbsoluteImagePath(target: string): string | null {
  try {
    if (/^(vault-file|file):\/\//i.test(target)) {
      const url = new URL(target)
      const rawPath = url.host ? `/${url.host}${url.pathname}` : url.pathname
      return path.normalize(decodeURIComponent(rawPath))
    }

    const decodedTarget = decodeImageTarget(target)
    if (decodedTarget && (path.isAbsolute(decodedTarget) || path.win32.isAbsolute(decodedTarget))) {
      return path.normalize(decodedTarget)
    }
  } catch {
    return null
  }

  return null
}

function isAttachmentPath(absolutePath: string): boolean {
  return path.basename(path.dirname(absolutePath)).toLowerCase() === 'attachments'
}

function isSupportedImagePath(absolutePath: string): boolean {
  return ['.bmp', '.gif', '.jpeg', '.jpg', '.png', '.svg', '.webp'].includes(
    path.extname(absolutePath).toLowerCase()
  )
}

function isWithinRoot(candidate: string, root: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(candidate))
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

function toVaultFileUrl(absolutePath: string): string {
  const normalizedPath = path.resolve(absolutePath).replace(/\\/g, '/')
  const urlPath = normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`
  return `vault-file://${encodeURI(urlPath)}`
}

async function copyMigratedAttachment(
  sourcePath: string,
  attachmentsRoot: string,
  attachmentByName: Map<string, string[]>
): Promise<string> {
  const originalName = path.basename(sourcePath)
  const extension = path.extname(originalName)
  const stem = path.basename(originalName, extension)
  let targetName = originalName
  let targetPath = path.join(attachmentsRoot, targetName)
  let suffix = 1

  while (await fileExists(targetPath)) {
    targetName = `${stem}-migrated-${suffix}${extension}`
    targetPath = path.join(attachmentsRoot, targetName)
    suffix += 1
  }

  await fs.mkdir(attachmentsRoot, { recursive: true })
  await fs.copyFile(sourcePath, targetPath)
  const matches = attachmentByName.get(targetName) ?? []
  matches.push(targetPath)
  attachmentByName.set(targetName, matches)
  return targetPath
}

async function listFilesRecursively(root: string): Promise<string[]> {
  if (!(await fileExists(root))) {
    return []
  }

  const entries = await fs.readdir(root, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const absolutePath = path.join(root, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursively(absolutePath)))
    } else if (entry.isFile()) {
      files.push(absolutePath)
    }
  }
  return files
}

async function isFile(absolutePath: string): Promise<boolean> {
  try {
    return (await fs.stat(absolutePath)).isFile()
  } catch {
    return false
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
