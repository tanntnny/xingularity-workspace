import fs from 'node:fs/promises'
import path from 'node:path'
import {
  GenerativeUiArtifactSchema,
  SavedGenerativeUiArtifactSchema,
  type GenerativeUiArtifact,
  type SavedGenerativeUiArtifact
} from '../shared/generativeUi'
import { ensureVaultAppDir, getVaultAppDir } from './vaultData'

const FILE_NAME = 'generative-ui-artifacts.json'

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
  private readonly vaultRoot: string
  private readonly filePath: string

  constructor(vaultRoot: string) {
    this.vaultRoot = vaultRoot
    this.filePath = path.join(getVaultAppDir(vaultRoot), FILE_NAME)
  }

  async listArtifacts(): Promise<SavedGenerativeUiArtifact[]> {
    await ensureVaultAppDir(this.vaultRoot)
    try {
      const raw = await fs.readFile(this.filePath, 'utf-8')
      return normalizeArtifacts(JSON.parse(raw))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('[GenerativeUiArtifactStore] Failed to read artifacts', error)
      }
      return []
    }
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
    await ensureVaultAppDir(this.vaultRoot)
    const tempPath = `${this.filePath}.tmp-${process.pid}-${Date.now()}`
    await fs.writeFile(tempPath, JSON.stringify(artifacts, null, 2), 'utf-8')
    await fs.rename(tempPath, this.filePath)
  }
}
