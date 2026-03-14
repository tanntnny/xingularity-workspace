import fs from 'node:fs/promises'
import path from 'node:path'

export const VAULT_APP_DIRNAME = '.xingularity'

export function getVaultAppDir(rootPath: string): string {
  return path.join(rootPath, VAULT_APP_DIRNAME)
}

export async function ensureVaultAppDir(rootPath: string): Promise<string> {
  const dir = getVaultAppDir(rootPath)
  await fs.mkdir(dir, { recursive: true })
  return dir
}
