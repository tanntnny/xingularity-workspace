import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { parseFleetingNote, serializeFleetingNote } from '../shared/fleetingNote'
import type { FleetingNote } from '../shared/types'
import { assertSafeRelativePath, joinSafe } from '../shared/pathSafety'

const FLEETING_NOTE_EXTENSION = '.md'

export class FleetingNoteService {
  constructor(private readonly rootPath: string) {}

  async list(): Promise<FleetingNote[]> {
    await fs.mkdir(this.rootPath, { recursive: true })
    const entries = await fs.readdir(this.rootPath, { withFileTypes: true })
    const notes = await Promise.all(
      entries
        .filter(
          (entry) => entry.isFile() && entry.name.toLowerCase().endsWith(FLEETING_NOTE_EXTENSION)
        )
        .map((entry) => this.read(entry.name))
    )

    return notes.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  }

  async create(contentInput: string): Promise<FleetingNote> {
    const content = contentInput.trim()
    if (!content) {
      throw new Error('Fleeting note content is required')
    }

    await fs.mkdir(this.rootPath, { recursive: true })
    const id = randomUUID()
    const now = new Date().toISOString()
    const relPath = `${id}${FLEETING_NOTE_EXTENSION}`
    const note: FleetingNote = {
      type: 'fleeting',
      id,
      relPath,
      content,
      createdAt: now,
      updatedAt: now,
      source: 'manual',
      triageState: 'inbox'
    }

    await fs.writeFile(joinSafe(this.rootPath, relPath), serializeFleetingNote(note), {
      flag: 'wx'
    })
    return note
  }

  async read(relPathInput: string): Promise<FleetingNote> {
    const relPath = sanitizeFleetingPath(relPathInput)
    const raw = await fs.readFile(joinSafe(this.rootPath, relPath), 'utf-8')
    return parseFleetingNote(raw, relPath)
  }

  async delete(relPathInput: string): Promise<void> {
    const relPath = sanitizeFleetingPath(relPathInput)
    await fs.rm(joinSafe(this.rootPath, relPath))
  }

  async update(
    relPathInput: string,
    patch: Partial<
      Pick<FleetingNote, 'content' | 'priority' | 'tags' | 'dueDate' | 'projectId' | 'triageState'>
    >
  ): Promise<FleetingNote> {
    const current = await this.read(relPathInput)
    const content = patch.content?.trim() ?? current.content
    if (!content) {
      throw new Error('Fleeting note content is required')
    }
    const updated: FleetingNote = {
      ...current,
      ...patch,
      content,
      tags: patch.tags
        ? Array.from(new Set(patch.tags.map((tag) => tag.trim()).filter(Boolean))).slice(0, 50)
        : current.tags,
      updatedAt: new Date().toISOString()
    }
    await fs.writeFile(
      joinSafe(this.rootPath, sanitizeFleetingPath(relPathInput)),
      serializeFleetingNote(updated),
      'utf-8'
    )
    return updated
  }
}

export function sanitizeFleetingPath(input: string): string {
  const normalized = assertSafeRelativePath(input)
  if (
    path.posix.dirname(normalized) !== '.' ||
    !normalized.toLowerCase().endsWith(FLEETING_NOTE_EXTENSION)
  ) {
    throw new Error('Only top-level Markdown fleeting notes are supported')
  }
  return normalized
}
