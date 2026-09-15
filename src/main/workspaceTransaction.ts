import fs from 'node:fs/promises'
import path from 'node:path'
import { writeFileAtomically } from './atomicFile'

export type WorkspaceTransactionStatus = 'started' | 'committed' | 'failed'

export interface WorkspaceTransactionRecord {
  version: 1
  id: string
  operation: string
  status: WorkspaceTransactionStatus
  startedAt: string
  completedAt?: string
  error?: string
}

export function getWorkspaceTransactionsDir(rootPath: string): string {
  return path.join(path.resolve(rootPath), '.xingularity', 'transactions')
}

export function getWorkspaceTransactionPath(rootPath: string, transactionId: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(transactionId)) {
    throw new Error('Invalid workspace transaction ID')
  }
  return path.join(getWorkspaceTransactionsDir(rootPath), `${transactionId}.json`)
}

export async function readWorkspaceTransaction(
  rootPath: string,
  transactionId: string
): Promise<WorkspaceTransactionRecord | null> {
  try {
    const parsed = JSON.parse(
      await fs.readFile(getWorkspaceTransactionPath(rootPath, transactionId), 'utf8')
    ) as Partial<WorkspaceTransactionRecord>
    if (
      parsed.version !== 1 ||
      parsed.id !== transactionId ||
      typeof parsed.operation !== 'string' ||
      !isTransactionStatus(parsed.status) ||
      typeof parsed.startedAt !== 'string'
    ) {
      throw new Error('Invalid workspace transaction record')
    }
    return parsed as WorkspaceTransactionRecord
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

export async function withWorkspaceTransaction<T>(
  rootPath: string,
  transactionId: string,
  operation: string,
  action: () => Promise<T>
): Promise<T> {
  const startedAt = new Date().toISOString()
  const started: WorkspaceTransactionRecord = {
    version: 1,
    id: transactionId,
    operation,
    status: 'started',
    startedAt
  }
  await writeWorkspaceTransaction(rootPath, started)

  try {
    const result = await action()
    await writeWorkspaceTransactionBestEffort(rootPath, {
      ...started,
      status: 'committed',
      completedAt: new Date().toISOString()
    })
    return result
  } catch (error) {
    await writeWorkspaceTransactionBestEffort(rootPath, {
      ...started,
      status: 'failed',
      completedAt: new Date().toISOString(),
      error: describeError(error)
    })
    throw error
  }
}

async function writeWorkspaceTransaction(
  rootPath: string,
  record: WorkspaceTransactionRecord
): Promise<void> {
  const targetPath = getWorkspaceTransactionPath(rootPath, record.id)
  await fs.mkdir(path.dirname(targetPath), { recursive: true, mode: 0o700 })
  await writeFileAtomically(targetPath, `${JSON.stringify(record, null, 2)}\n`)
  await fs.chmod(targetPath, 0o600).catch(() => undefined)
}

async function writeWorkspaceTransactionBestEffort(
  rootPath: string,
  record: WorkspaceTransactionRecord
): Promise<void> {
  try {
    await writeWorkspaceTransaction(rootPath, record)
  } catch {
    // The canonical mutation result must not be replaced by a journal I/O error.
  }
}

function isTransactionStatus(value: unknown): value is WorkspaceTransactionStatus {
  return value === 'started' || value === 'committed' || value === 'failed'
}

function describeError(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 500)
}
