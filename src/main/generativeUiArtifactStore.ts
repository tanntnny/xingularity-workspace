import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import {
  GenerativeUiArtifactSchema,
  SavedGenerativeUiArtifactSchema,
  type GenerativeUiArtifact,
  type SavedGenerativeUiArtifact
} from '../shared/generativeUi'
import {
  getLegacyVaultGenerativeUiArtifactsPath,
  getVaultGenerativeUiArtifactsPath
} from './vaultData'

function normalizeArtifacts(value: unknown): SavedGenerativeUiArtifact[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .flatMap((item) => {
      const parsed = SavedGenerativeUiArtifactSchema.safeParse(item)
      return parsed.success ? [parsed.data] : []
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export class GenerativeUiArtifactStore {
  private readonly filePath: string
  private readonly legacyFilePath: string

  constructor(vaultRoot: string) {
    this.filePath = getVaultGenerativeUiArtifactsPath(vaultRoot)
    this.legacyFilePath = getLegacyVaultGenerativeUiArtifactsPath(vaultRoot)
  }

  async listArtifacts(): Promise<SavedGenerativeUiArtifact[]> {
    const current = await this.readJsonFile(this.filePath)
    if (current) {
      return normalizeArtifacts(current)
    }

    const legacy = await this.readJsonFile(this.legacyFilePath)
    if (legacy) {
      const normalized = normalizeArtifacts(legacy)
      await this.writeArtifacts(normalized)
      return normalized
    }

    return []
  }

  async saveArtifact(input: {
    artifact: GenerativeUiArtifact
    id?: string
  }): Promise<SavedGenerativeUiArtifact> {
    const artifact = GenerativeUiArtifactSchema.parse(input.artifact)
    const artifacts = await this.listArtifacts()
    const existing = input.id ? artifacts.find((item) => item.id === input.id) : undefined
    const now = new Date().toISOString()
    const saved: SavedGenerativeUiArtifact = {
      id: existing?.id ?? `gen-ui-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      artifact,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    }

    const nextArtifacts = [saved, ...artifacts.filter((item) => item.id !== saved.id)].sort(
      (a, b) => b.updatedAt.localeCompare(a.updatedAt)
    )
    await this.writeArtifacts(nextArtifacts)
    return saved
  }

  async deleteArtifact(id: string): Promise<void> {
    const artifacts = await this.listArtifacts()
    await this.writeArtifacts(artifacts.filter((artifact) => artifact.id !== id))
  }

  private async writeArtifacts(artifacts: SavedGenerativeUiArtifact[]): Promise<void> {
    const tempPath = `${this.filePath}.tmp-${process.pid}-${randomUUID()}`
    await fs.mkdir(path.dirname(this.filePath), { recursive: true })
    await fs.writeFile(tempPath, JSON.stringify(artifacts, null, 2), 'utf-8')
    await fs.rename(tempPath, this.filePath)
  }

  private async readJsonFile(filePath: string): Promise<unknown[] | null> {
    try {
      const raw = await fs.readFile(filePath, 'utf-8')
      return JSON.parse(raw) as unknown[]
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('[GenerativeUiArtifactStore] Failed to read artifacts', error)
      }
      return null
    }
  }
}
