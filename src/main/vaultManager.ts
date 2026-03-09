import { dialog } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import { joinSafe } from '../shared/pathSafety'
import { VaultInfo, VaultSettings } from '../shared/types'

const APP_META_DIR = '.appmeta'

export interface VaultPaths {
  rootPath: string
  notesPath: string
  attachmentsPath: string
  appMetaPath: string
  vaultConfigPath: string
  fileMapPath: string
  indexPath: string
}

function toInfo(paths: VaultPaths): VaultInfo {
  return {
    rootPath: paths.rootPath,
    notesPath: paths.notesPath,
    attachmentsPath: paths.attachmentsPath
  }
}

export function createVaultPaths(rootPath: string): VaultPaths {
  return {
    rootPath,
    notesPath: path.join(rootPath, 'notes'),
    attachmentsPath: path.join(rootPath, 'attachments'),
    appMetaPath: path.join(rootPath, APP_META_DIR),
    vaultConfigPath: path.join(rootPath, APP_META_DIR, 'vault.json'),
    fileMapPath: path.join(rootPath, APP_META_DIR, 'filemap.json'),
    indexPath: path.join(rootPath, APP_META_DIR, 'index.sqlite')
  }
}

export async function chooseVaultFolder(title: string): Promise<string | null> {
  const result = await dialog.showOpenDialog({
    title,
    properties: ['openDirectory', 'createDirectory']
  })

  if (result.canceled || result.filePaths.length === 0) {
    return null
  }
  return result.filePaths[0]
}

export async function initializeVault(rootPath: string): Promise<VaultPaths> {
  const paths = createVaultPaths(path.resolve(rootPath))
  await fs.mkdir(paths.rootPath, { recursive: true })
  await fs.mkdir(paths.notesPath, { recursive: true })
  await fs.mkdir(paths.attachmentsPath, { recursive: true })
  await fs.mkdir(paths.appMetaPath, { recursive: true })

  const vaultSettings: VaultSettings = {
    version: 1,
    createdAt: new Date().toISOString()
  }

  await ensureJsonFile(paths.vaultConfigPath, vaultSettings)
  await ensureJsonFile(paths.fileMapPath, {})

  return paths
}

export async function validateVault(rootPath: string): Promise<VaultPaths> {
  const resolved = path.resolve(rootPath)
  const paths = createVaultPaths(resolved)

  await fs.access(paths.rootPath)
  await fs.mkdir(paths.notesPath, { recursive: true })
  await fs.mkdir(paths.attachmentsPath, { recursive: true })
  await fs.mkdir(paths.appMetaPath, { recursive: true })
  await ensureJsonFile(paths.vaultConfigPath, {
    version: 1,
    createdAt: new Date().toISOString()
  })
  await ensureJsonFile(paths.fileMapPath, {})

  return paths
}

export function assertPathInVault(paths: VaultPaths, relPath: string, scope: 'notes' | 'attachments'): string {
  const base = scope === 'notes' ? paths.notesPath : paths.attachmentsPath
  return joinSafe(base, relPath)
}

async function ensureJsonFile(filePath: string, defaultValue: object): Promise<void> {
  try {
    await fs.access(filePath)
  } catch {
    await fs.writeFile(filePath, JSON.stringify(defaultValue, null, 2), 'utf-8')
  }
}

export { toInfo }
