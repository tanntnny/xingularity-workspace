import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

function makeTemporaryPath(filePath: string): string {
  return `${filePath}.tmp-${process.pid}-${randomUUID()}`
}

async function writeTemporaryFile(filePath: string, content: string | Uint8Array): Promise<string> {
  const temporaryPath = makeTemporaryPath(filePath)
  await fs.mkdir(path.dirname(filePath), { recursive: true })

  let handle: Awaited<ReturnType<typeof fs.open>> | null = null
  try {
    handle = await fs.open(temporaryPath, 'w')
    if (typeof content === 'string') {
      await handle.writeFile(content, 'utf8')
    } else {
      await handle.writeFile(content)
    }
    await handle.sync()
    await handle.close()
    handle = null
    return temporaryPath
  } catch (error) {
    if (handle) {
      await handle.close().catch(() => undefined)
    }
    await fs.rm(temporaryPath, { force: true }).catch(() => undefined)
    throw error
  }
}

export async function writeFileAtomically(
  filePath: string,
  content: string | Uint8Array
): Promise<void> {
  const temporaryPath = await writeTemporaryFile(filePath, content)
  try {
    await fs.rename(temporaryPath, filePath)
  } catch (error) {
    await fs.rm(temporaryPath, { force: true }).catch(() => undefined)
    throw error
  }
}

export async function createFileAtomically(
  filePath: string,
  content: string | Uint8Array
): Promise<void> {
  const temporaryPath = await writeTemporaryFile(filePath, content)
  try {
    await fs.link(temporaryPath, filePath)
  } finally {
    await fs.rm(temporaryPath, { force: true }).catch(() => undefined)
  }
}
