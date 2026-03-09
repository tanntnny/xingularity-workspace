import fs from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { listPreviewTagsFromMarkdown, upsertTagsInMarkdown } from '../shared/noteTags'
import { joinSafe, normalizeRelativePath } from '../shared/pathSafety'
import { NoteListItem } from '../shared/types'

const notePathSchema = z.string().min(1).max(512)
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
    return Promise.all(
      notes.map(async (absolutePath) => {
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
      })
    )
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
    const absolutePath = joinSafe(this.notesRoot, relPath)
    const initial = ''
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

  async rename(oldRelPathInput: string, newRelPathInput: string): Promise<void> {
    const oldRelPath = sanitizeNotePath(oldRelPathInput)
    const newRelPath = sanitizeNotePath(newRelPathInput)
    const from = joinSafe(this.notesRoot, oldRelPath)
    const to = joinSafe(this.notesRoot, newRelPath)
    await fs.mkdir(path.dirname(to), { recursive: true })
    await fs.rename(from, to)
    this.onInternalWrite(oldRelPath)
    this.onInternalWrite(newRelPath)
  }

  async delete(relPathInput: string): Promise<void> {
    const relPath = sanitizeNotePath(relPathInput)
    const absolutePath = joinSafe(this.notesRoot, relPath)
    await fs.rm(absolutePath)
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
}

export function sanitizeNotePath(input: string): string {
  const parsed = notePathSchema.parse(input)
  const normalized = normalizeRelativePath(parsed)
  if (!normalized.toLowerCase().endsWith('.md')) {
    throw new Error('Only markdown notes are supported')
  }
  return normalized
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
