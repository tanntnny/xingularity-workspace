import { createHash, randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { writeFileAtomically } from './atomicFile'
import type { VaultFileRevision } from '../shared/vaultProtocol'

export interface VaultRevisionConflictDetails {
  code: 'compare-and-swap-conflict'
  path: string
  expectedBaseHash: string | null
  actual: VaultFileRevision | null
}

export class VaultRevisionConflictError extends Error {
  readonly code = 'compare-and-swap-conflict' as const
  readonly details: VaultRevisionConflictDetails

  constructor(details: Omit<VaultRevisionConflictDetails, 'code'>) {
    super(`Vault file changed before it could be saved: ${details.path}`)
    this.name = 'VaultRevisionConflictError'
    this.details = { code: 'compare-and-swap-conflict', ...details }
  }
}

export interface ExpectedWrite {
  path: string
  contentHash: string | null
  transactionId: string
  expiresAt: number
}

export class ExpectedWriteRegistry {
  private readonly entries = new Map<string, ExpectedWrite>()

  constructor(private readonly ttlMs = 10_000) {}

  register(
    filePath: string,
    contentHash: string | null,
    transactionId: string = randomUUID()
  ): ExpectedWrite {
    const entry: ExpectedWrite = {
      path: path.resolve(filePath),
      contentHash,
      transactionId,
      expiresAt: Date.now() + this.ttlMs
    }
    this.entries.set(entry.path, entry)
    return { ...entry }
  }

  acknowledge(filePath: string, observedHash: string | null): ExpectedWrite | null {
    const key = path.resolve(filePath)
    const entry = this.entries.get(key)
    if (!entry) {
      return null
    }

    this.entries.delete(key)
    if (entry.expiresAt < Date.now() || entry.contentHash !== observedHash) {
      return null
    }

    return { ...entry }
  }

  clear(filePath: string): void {
    this.entries.delete(path.resolve(filePath))
  }

  clearExpired(now = Date.now()): void {
    for (const [filePath, entry] of this.entries) {
      if (entry.expiresAt < now) {
        this.entries.delete(filePath)
      }
    }
  }
}

export async function readVaultFileRevision(filePath: string): Promise<VaultFileRevision> {
  const absolutePath = path.resolve(filePath)
  const [content, stats] = await Promise.all([fs.readFile(absolutePath), fs.stat(absolutePath)])
  return createRevision(content, stats.size, stats.mtimeMs)
}

export async function readVaultFileWithRevision(
  filePath: string
): Promise<{ content: Buffer; revision: VaultFileRevision }> {
  const absolutePath = path.resolve(filePath)
  const content = await fs.readFile(absolutePath)
  const stats = await fs.stat(absolutePath)
  return {
    content,
    revision: createRevision(content, stats.size, stats.mtimeMs)
  }
}

export async function compareAndSwapWriteFile(
  filePath: string,
  content: string | Uint8Array,
  expectedHash: string | null,
  registry?: ExpectedWriteRegistry,
  transactionId?: string
): Promise<VaultFileRevision> {
  const absolutePath = path.resolve(filePath)
  const current = await readRevisionIfPresent(absolutePath)
  if (
    (expectedHash === null && current !== null) ||
    (expectedHash !== null && current?.contentHash !== expectedHash)
  ) {
    throw new VaultRevisionConflictError({
      path: absolutePath,
      expectedBaseHash: expectedHash,
      actual: current
    })
  }

  const bytes = typeof content === 'string' ? Buffer.from(content, 'utf8') : Buffer.from(content)
  const contentHash = hashBytes(bytes)
  registry?.register(absolutePath, contentHash, transactionId)
  await writeFileAtomically(absolutePath, bytes)
  return readVaultFileRevision(absolutePath)
}

export function hashVaultBytes(content: string | Uint8Array): string {
  return hashBytes(
    typeof content === 'string' ? Buffer.from(content, 'utf8') : Buffer.from(content)
  )
}

async function readRevisionIfPresent(filePath: string): Promise<VaultFileRevision | null> {
  try {
    return await readVaultFileRevision(filePath)
  } catch (error) {
    if (isMissingPathError(error)) {
      return null
    }
    throw error
  }
}

function hashBytes(content: Uint8Array): string {
  return createHash('sha256').update(content).digest('hex')
}

function createRevision(content: Uint8Array, size: number, mtimeMs: number): VaultFileRevision {
  const contentHash = hashBytes(content)
  return {
    contentHash,
    size,
    mtimeMs,
    revision: contentHash
  }
}

function isMissingPathError(error: unknown): boolean {
  return Boolean(
    error && typeof error === 'object' && (error as NodeJS.ErrnoException).code === 'ENOENT'
  )
}
