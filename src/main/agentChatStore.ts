import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { AgentChatSession } from '../shared/types'
import {
  deleteLegacyVaultPath,
  getLegacyPageVaultAgentChatsPath,
  getLegacyVaultAgentChatsPath,
  getVaultAgentChatsPath
} from './vaultData'

const MAX_AGENT_CHAT_SESSIONS = 100

export class AgentChatStore {
  private readonly vaultRoot: string
  private readonly sessionsPath: string
  private readonly legacyPageSessionsPath: string
  private readonly legacySessionsPath: string

  constructor(vaultRoot: string) {
    this.vaultRoot = vaultRoot
    this.sessionsPath = getVaultAgentChatsPath(vaultRoot)
    this.legacyPageSessionsPath = getLegacyPageVaultAgentChatsPath(vaultRoot)
    this.legacySessionsPath = getLegacyVaultAgentChatsPath(vaultRoot)
  }

  async listSessions(): Promise<AgentChatSession[]> {
    const sessions = await this.readJsonFile<AgentChatSession[]>(this.sessionsPath, [])
    return sessions
      .map((session) => ({
        ...session,
        titleMode: session.titleMode ?? 'auto'
      }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  async saveSession(session: AgentChatSession): Promise<AgentChatSession> {
    const sessions = await this.listSessions()
    const nextSessions = [session, ...sessions.filter((item) => item.id !== session.id)].slice(
      0,
      MAX_AGENT_CHAT_SESSIONS
    )
    await this.writeJsonFile(this.sessionsPath, nextSessions)
    return session
  }

  async deleteSession(sessionId: string): Promise<void> {
    const sessions = await this.listSessions()
    await this.writeJsonFile(
      this.sessionsPath,
      sessions.filter((item) => item.id !== sessionId)
    )
  }

  private async readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
    try {
      const raw = await fs.readFile(filePath, 'utf-8')
      return JSON.parse(raw) as T
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('Failed to read agent chat store:', error)
      }

      for (const legacyPath of [this.legacyPageSessionsPath, this.legacySessionsPath]) {
        try {
          const legacyRaw = await fs.readFile(legacyPath, 'utf-8')
          const parsed = JSON.parse(legacyRaw) as T
          await this.writeJsonFile(filePath, parsed)
          await this.cleanupLegacyFiles()
          return parsed
        } catch (legacyError) {
          if ((legacyError as NodeJS.ErrnoException).code !== 'ENOENT') {
            console.error('Failed to read legacy agent chat store:', legacyError)
          }
        }
      }

      return fallback
    }
  }

  private async writeJsonFile(filePath: string, data: unknown): Promise<void> {
    const dir = path.dirname(filePath)
    const tmp = `${filePath}.tmp-${process.pid}-${randomUUID()}`
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf-8')
    await fs.rename(tmp, filePath)
  }

  private async cleanupLegacyFiles(): Promise<void> {
    await Promise.all([
      deleteLegacyVaultPath(this.legacyPageSessionsPath, this.vaultRoot),
      deleteLegacyVaultPath(this.legacySessionsPath, this.vaultRoot)
    ])
  }
}
