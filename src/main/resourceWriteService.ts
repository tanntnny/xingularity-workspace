import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import type {
  ResourceWriteAuditRecord,
  ResourceWriteInput,
  ResourceWritePreview
} from '../shared/types'
import { buildResourceWritePreview, isPathWithinRoot } from '../shared/resourceActions'
import { getVaultResourcesDir } from './vaultData'

const AUDIT_FILE = 'write-audit.json'

export class ResourceWriteService {
  constructor(private readonly vaultRoot: string) {}

  async preview(input: ResourceWriteInput): Promise<ResourceWritePreview> {
    const targetPath = this.validateTarget(input)
    const existing = await readOptional(targetPath)
    return buildResourceWritePreview({ ...input, targetPath }, existing)
  }

  async apply(input: ResourceWriteInput, confirmation: boolean): Promise<ResourceWritePreview> {
    if (!confirmation) throw new Error('External writes require an explicit confirmation')
    const targetPath = this.validateTarget(input)
    const existing = await readOptional(targetPath)
    const preview = buildResourceWritePreview({ ...input, targetPath }, existing)
    const auditBase: Omit<ResourceWriteAuditRecord, 'result'> = {
      id: `write-${randomUUID()}`,
      createdAt: new Date().toISOString(),
      targetPath,
      operation: input.operation,
      ...(input.expectedHash ? { expectedHash: input.expectedHash } : {}),
      ...(preview.existingHash ? { previousHash: preview.existingHash } : {}),
      nextHash: preview.nextHash
    }

    try {
      if (input.operation === 'create' && existing !== null) {
        throw new Error('Create action refused because the target already exists')
      }
      if (existing !== null && input.operation !== 'create') {
        if (!input.expectedHash)
          throw new Error('An expected hash is required for an existing target')
        if (input.expectedHash !== preview.existingHash) {
          throw new Error('Target changed since preview; refresh before applying')
        }
      }
      const nextContent =
        input.operation === 'append' && existing !== null
          ? `${existing}${input.content}`
          : input.content
      await fs.mkdir(path.dirname(targetPath), { recursive: true })
      const tempPath = `${targetPath}.tmp-${process.pid}`
      await fs.writeFile(tempPath, nextContent, 'utf-8')
      await fs.rename(tempPath, targetPath)
      await this.appendAudit({ ...auditBase, result: 'applied' })
      return preview
    } catch (error) {
      await this.appendAudit({
        ...auditBase,
        result: 'rejected',
        reason: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
  }

  async audit(): Promise<ResourceWriteAuditRecord[]> {
    try {
      const value = JSON.parse(
        await fs.readFile(path.join(getVaultResourcesDir(this.vaultRoot), AUDIT_FILE), 'utf-8')
      )
      return Array.isArray(value) ? value.filter(isAuditRecord) : []
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('[ResourceWriteService] Failed to read audit log', error)
      }
      return []
    }
  }

  private validateTarget(input: ResourceWriteInput): string {
    const targetPath = path.resolve(input.targetPath)
    const authorizedRoot = path.resolve(input.authorizedRoot)
    if (!isPathWithinRoot(targetPath, authorizedRoot)) {
      throw new Error('Write target must be inside the authorized root')
    }
    if (!targetPath || targetPath === authorizedRoot) {
      throw new Error('Write target must be a file below the authorized root')
    }
    if (input.content.length > 2_000_000) throw new Error('Write content is too large')
    return targetPath
  }

  private async appendAudit(record: ResourceWriteAuditRecord): Promise<void> {
    const current = await this.audit()
    await fs.mkdir(getVaultResourcesDir(this.vaultRoot), { recursive: true })
    const targetPath = path.join(getVaultResourcesDir(this.vaultRoot), AUDIT_FILE)
    const tempPath = `${targetPath}.tmp-${process.pid}`
    await fs.writeFile(
      tempPath,
      JSON.stringify([record, ...current].slice(0, 500), null, 2),
      'utf-8'
    )
    await fs.rename(tempPath, targetPath)
  }
}

async function readOptional(targetPath: string): Promise<string | null> {
  try {
    return await fs.readFile(targetPath, 'utf-8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

function isAuditRecord(value: unknown): value is ResourceWriteAuditRecord {
  if (!value || typeof value !== 'object') return false
  const record = value as Partial<ResourceWriteAuditRecord>
  return (
    typeof record.id === 'string' &&
    typeof record.targetPath === 'string' &&
    typeof record.nextHash === 'string' &&
    (record.result === 'applied' || record.result === 'rejected')
  )
}
