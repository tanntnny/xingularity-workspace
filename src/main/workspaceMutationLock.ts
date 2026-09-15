import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { XWorkspaceError } from '../cli/xWorkspaceErrors'

export interface WorkspaceLockInfo {
  id: string
  pid: number
  hostname: string
  startedAt: string
  transactionId?: string
}

export interface WorkspaceMutationLockOptions {
  waitMs?: number
  pollMs?: number
  transactionId?: string
}

const DEFAULT_WAIT_MS = 5_000
const DEFAULT_POLL_MS = 50

export function getWorkspaceLockPath(rootPath: string): string {
  return path.join(path.resolve(rootPath), '.xingularity', 'locks', 'mutation.lock')
}

export async function readWorkspaceLock(rootPath: string): Promise<WorkspaceLockInfo | null> {
  try {
    const raw = await fs.readFile(getWorkspaceLockPath(rootPath), 'utf8')
    const parsed = JSON.parse(raw) as Partial<WorkspaceLockInfo>
    if (
      typeof parsed.id !== 'string' ||
      typeof parsed.pid !== 'number' ||
      typeof parsed.hostname !== 'string' ||
      typeof parsed.startedAt !== 'string'
    ) {
      return null
    }
    return {
      id: parsed.id,
      pid: parsed.pid,
      hostname: parsed.hostname,
      startedAt: parsed.startedAt,
      ...(typeof parsed.transactionId === 'string' ? { transactionId: parsed.transactionId } : {})
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null
    }
    return null
  }
}

export async function repairWorkspaceLock(rootPath: string, confirm = false): Promise<void> {
  if (!confirm) {
    throw new XWorkspaceError(
      'invalid-input',
      'Lock repair requires explicit confirmation with --confirm'
    )
  }

  const lockPath = getWorkspaceLockPath(rootPath)
  const lock = await readWorkspaceLock(rootPath)
  if (!lock) {
    await fs.rm(lockPath, { force: true })
    return
  }

  if (lock.hostname === os.hostname() && isProcessAlive(lock.pid)) {
    throw new XWorkspaceError(
      'lock-not-stale',
      `Mutation lock is still owned by process ${lock.pid}`,
      lock
    )
  }

  await fs.rm(lockPath, { force: true })
}

export async function withWorkspaceMutationLock<T>(
  rootPath: string,
  action: (lock: WorkspaceLockInfo) => Promise<T>,
  options: WorkspaceMutationLockOptions = {}
): Promise<T> {
  const lockPath = getWorkspaceLockPath(rootPath)
  await fs.mkdir(path.dirname(lockPath), { recursive: true })
  const lock: WorkspaceLockInfo = {
    id: randomUUID(),
    pid: process.pid,
    hostname: os.hostname(),
    startedAt: new Date().toISOString(),
    ...(options.transactionId ? { transactionId: options.transactionId } : {})
  }
  const payload = `${JSON.stringify(lock, null, 2)}\n`
  const waitMs = options.waitMs ?? DEFAULT_WAIT_MS
  const pollMs = options.pollMs ?? DEFAULT_POLL_MS
  const startedWaiting = Date.now()

  while (true) {
    let handle: Awaited<ReturnType<typeof fs.open>>
    try {
      handle = await fs.open(lockPath, 'wx', 0o600)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
        if (Date.now() - startedWaiting >= waitMs) {
          throw new XWorkspaceError(
            'vault-busy',
            `Vault mutation lock is busy: ${lockPath}`,
            await readWorkspaceLock(rootPath)
          )
        }
        await new Promise((resolve) => setTimeout(resolve, pollMs))
        continue
      }
      throw error
    }

    try {
      await handle.writeFile(payload, 'utf8')
      await handle.sync()
    } catch (error) {
      await handle.close().catch(() => undefined)
      await fs.rm(lockPath, { force: true }).catch(() => undefined)
      throw error
    }
    await handle.close()

    try {
      return await action(lock)
    } finally {
      const current = await readWorkspaceLock(rootPath)
      if (current?.id === lock.id) {
        await fs.rm(lockPath, { force: true })
      }
    }
  }
}

function isProcessAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM'
  }
}
