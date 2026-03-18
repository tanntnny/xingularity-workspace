import fs from 'node:fs/promises'
import path from 'node:path'
import type { AgentChatSession } from '../shared/types'
import { ensureVaultAppDir, getVaultAppDir } from './vaultData'

const MAX_AGENT_CHAT_SESSIONS = 100

export class AgentChatStore {
  private readonly sessionsPath: string

  constructor(vaultRoot: string) {
    void ensureVaultAppDir(vaultRoot)
    const baseDir = getVaultAppDir(vaultRoot)
    this.sessionsPath = path.join(baseDir, 'agent-chats.json')
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
      return fallback
    }
  }

  private async writeJsonFile(filePath: string, data: unknown): Promise<void> {
    const dir = path.dirname(filePath)
    const tmp = `${filePath}.tmp-${process.pid}-${Date.now()}`
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf-8')
    await fs.rename(tmp, filePath)
  }
}
