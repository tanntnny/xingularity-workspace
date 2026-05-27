import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { ExcalidrawSession, ExcalidrawSessionScene } from '../shared/types'
import { getVaultExcalidrawSessionsPath } from './vaultData'

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizeScene(value: unknown): ExcalidrawSessionScene | null {
  if (!isRecord(value) || !Array.isArray(value.elements)) {
    return null
  }

  const scene: ExcalidrawSessionScene = {
    elements: value.elements
  }

  if (typeof value.type === 'string') {
    scene.type = value.type
  }
  if (typeof value.version === 'number') {
    scene.version = value.version
  }
  if (typeof value.source === 'string') {
    scene.source = value.source
  }
  if (isRecord(value.appState) || value.appState === null) {
    scene.appState = value.appState
  }
  if (isRecord(value.files)) {
    scene.files = value.files
  }

  return scene
}

function normalizeSessions(value: unknown): ExcalidrawSession[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .flatMap((item) => {
      if (!isRecord(item)) {
        return []
      }

      const scene = normalizeScene(item.scene)
      if (
        typeof item.id !== 'string' ||
        typeof item.title !== 'string' ||
        typeof item.createdAt !== 'string' ||
        typeof item.updatedAt !== 'string' ||
        !scene
      ) {
        return []
      }

      return [
        {
          id: item.id,
          title: item.title,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          scene
        }
      ]
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export class ExcalidrawSessionStore {
  private readonly filePath: string

  constructor(vaultRoot: string) {
    this.filePath = getVaultExcalidrawSessionsPath(vaultRoot)
  }

  async listSessions(): Promise<ExcalidrawSession[]> {
    try {
      const raw = await fs.readFile(this.filePath, 'utf-8')
      return normalizeSessions(JSON.parse(raw))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('[ExcalidrawSessionStore] Failed to read sessions', error)
      }
      return []
    }
  }

  async saveSession(session: ExcalidrawSession): Promise<ExcalidrawSession> {
    const sessions = await this.listSessions()
    const nextSessions = [session, ...sessions.filter((item) => item.id !== session.id)].sort(
      (a, b) => b.updatedAt.localeCompare(a.updatedAt)
    )
    await this.writeSessions(nextSessions)
    return session
  }

  async deleteSession(sessionId: string): Promise<void> {
    const sessions = await this.listSessions()
    await this.writeSessions(sessions.filter((session) => session.id !== sessionId))
  }

  private async writeSessions(sessions: ExcalidrawSession[]): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true })
    const tempPath = `${this.filePath}.tmp-${process.pid}-${randomUUID()}`
    await fs.writeFile(tempPath, JSON.stringify(sessions, null, 2), 'utf-8')
    await fs.rename(tempPath, this.filePath)
  }
}
