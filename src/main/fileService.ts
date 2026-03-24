import fs from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { listPreviewTagsFromMarkdown, upsertTagsInMarkdown } from '../shared/noteTags'
import { assertSafeRelativePath, joinSafe, normalizeRelativePath } from '../shared/pathSafety'
import { ImportedNoteResult, NoteListItem, NoteTreeFile, NoteTreeFolder, NoteTreeNode } from '../shared/types'

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
    const notes = await listMarkdownNotePaths(this.notesRoot)
    return Promise.all(notes.map((absolutePath) => this.readNoteListItem(absolutePath)))
  }

  async listTree(): Promise<NoteTreeNode[]> {
    return listTreeNodes(this.notesRoot, this.notesRoot)
  }

  async readNote(relPathInput: string): Promise<string> {
    const relPath = sanitizeNotePath(relPathInput)
    const absolutePath = joinSafe(this.notesRoot, relPath)
    return fs.readFile(absolutePath, 'utf-8')
  }

  async writeNote(relPathInput: string, content: string): Promise<void> {
    const relPath = sanitizeNotePath(relPathInput)
    const absolutePath = joinSafe(this.notesRoot, relPath)
    await fs.mkdir(path.dirname(absolutePath), { recursive: true })
    await fs.writeFile(absolutePath, content, 'utf-8')
    this.onInternalWrite(relPath)
  }

  async createNote(nameInput: string): Promise<string> {
    const sanitizedName = sanitizeNoteName(nameInput)
    const relPath = `${sanitizedName}.md`
    return this.createNoteAtPath(relPath)
  }

  async createNoteAtPath(relPathInput: string): Promise<string> {
    const relPath = sanitizeNotePath(relPathInput)
    const absolutePath = joinSafe(this.notesRoot, relPath)
    const initial = ''
    await fs.mkdir(path.dirname(absolutePath), { recursive: true })
    await fs.writeFile(absolutePath, initial, { flag: 'wx' })
    this.onInternalWrite(relPath)
    return relPath
  }

  async createNoteWithTags(nameInput: string, tags: string[]): Promise<string> {
    const sanitizedName = sanitizeNoteName(nameInput)
    const relPath = `${sanitizedName}.md`
    const absolutePath = joinSafe(this.notesRoot, relPath)
    const initial = upsertTagsInMarkdown('', tags)
    await fs.writeFile(absolutePath, initial, { flag: 'wx' })
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

      const importedNote = await this.importSingleNote(sourcePath)
      imported.push(importedNote)
    }

    return imported
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

    // Ensure extension starts with a dot
    const ext = fileExtension.startsWith('.') ? fileExtension : `.${fileExtension}`

    const fileName = `${Date.now()}-pasted${ext.toLowerCase()}`
    const absoluteTarget = joinSafe(this.attachmentsRoot, fileName)

    await fs.writeFile(absoluteTarget, Buffer.from(buffer))
    return `attachments/${fileName}`
  }

  private async importSingleNote(sourcePath: string): Promise<ImportedNoteResult> {
    const ext = path.extname(sourcePath)
    const sourceName = path.basename(sourcePath)
    const sanitizedName = sanitizeNoteName(path.basename(sourcePath, ext))

    let relPath = `${sanitizedName || 'imported-note'}.md`
    let absolutePath = joinSafe(this.notesRoot, relPath)
    let suffix = 2

    while (await fileExists(absolutePath)) {
      relPath = `${sanitizedName || 'imported-note'}-${suffix}.md`
      absolutePath = joinSafe(this.notesRoot, relPath)
      suffix += 1
    }

    const content = await fs.readFile(sourcePath, 'utf-8')
    await fs.writeFile(absolutePath, content, { flag: 'wx' })
    this.onInternalWrite(relPath)

    return {
      sourceName,
      relPath,
      renamed: relPath !== `${sanitizedName || 'imported-note'}.md`
    }
  }

  private async readNoteListItem(absolutePath: string): Promise<NoteListItem> {
    const stats = await fs.stat(absolutePath)
    const content = await fs.readFile(absolutePath, 'utf-8')
    const relPath = normalizeRelativePath(path.relative(this.notesRoot, absolutePath))
    return {
      relPath,
      name: path.basename(relPath),
      dir: path.dirname(relPath) === '.' ? '' : path.dirname(relPath),
      createdAt: stats.birthtime.toISOString(),
      updatedAt: stats.mtime.toISOString(),
      tags: listPreviewTagsFromMarkdown(content)
    }
  }
}

export function sanitizeNotePath(input: string): string {
  const parsed = notePathSchema.parse(input)
  const normalized = sanitizeEntryPath(parsed)
  if (!normalized.toLowerCase().endsWith('.md')) {
    throw new Error('Only markdown notes are supported')
  }
  return normalized
}

export function sanitizeEntryPath(input: string): string {
  const parsed = genericPathSchema.parse(input)
  return assertSafeRelativePath(parsed)
}

function sanitizeNoteName(input: string): string {
  const parsed = noteNameSchema.parse(input)
  return parsed
    .trim()
    .replace(/\.md$/i, '')
    .replace(/[^a-zA-Z0-9-_ ]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase()
}

async function listMarkdownNotePaths(root: string): Promise<string[]> {
  const entries = await fs.readdir(root, { withFileTypes: true })
  const results: string[] = []
  for (const entry of entries) {
    const absolutePath = path.join(root, entry.name)
    if (entry.isDirectory()) {
      results.push(...(await listMarkdownNotePaths(absolutePath)))
      continue
    }
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      results.push(absolutePath)
    }
  }
  return results.sort((a, b) => a.localeCompare(b))
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

    if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
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
  const content = await fs.readFile(absolutePath, 'utf-8')
  const relPath = normalizeRelativePath(path.relative(root, absolutePath))
  return {
    relPath,
    name: path.basename(relPath),
    dir: path.dirname(relPath) === '.' ? '' : path.dirname(relPath),
    createdAt: stats.birthtime.toISOString(),
    updatedAt: stats.mtime.toISOString(),
    tags: listPreviewTagsFromMarkdown(content)
  }
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
