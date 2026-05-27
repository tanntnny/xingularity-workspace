import { dialog } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import { joinSafe } from '../shared/pathSafety'
import { VaultInfo, VaultSettings } from '../shared/types'
import {
  ensureVaultSystemDir,
  getLegacyVaultConfigPath,
  getLegacyVaultFileMapPath,
  getLegacyVaultIndexPath,
  getLegacyVaultNotesDir,
  getLegacyVaultSystemDir,
  getVaultAttachmentsDir,
  getVaultConfigPath,
  getVaultFileMapPath,
  getVaultIndexPath,
  getVaultNotebooksDir,
  getVaultSystemDir,
  readVaultMigrations,
  writeVaultMigrations
} from './vaultData'

export interface VaultPaths {
  rootPath: string
  notebooksPath: string
  notesPath: string
  attachmentsPath: string
  systemPath: string
  appMetaPath: string
  vaultConfigPath: string
  fileMapPath: string
  indexPath: string
}

function toInfo(paths: VaultPaths): VaultInfo {
  return {
    rootPath: paths.rootPath,
    notebooksPath: paths.notebooksPath,
    notesPath: paths.notesPath,
    attachmentsPath: paths.attachmentsPath
  }
}

export function createVaultPaths(rootPath: string): VaultPaths {
  const notebooksPath = getVaultNotebooksDir(rootPath)
  const systemPath = getVaultSystemDir(rootPath)
  return {
    rootPath,
    notebooksPath,
    notesPath: notebooksPath,
    attachmentsPath: getVaultAttachmentsDir(rootPath),
    systemPath,
    appMetaPath: systemPath,
    vaultConfigPath: getVaultConfigPath(rootPath),
    fileMapPath: getVaultFileMapPath(rootPath),
    indexPath: getVaultIndexPath(rootPath)
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
  await fs.mkdir(paths.notebooksPath, { recursive: true })
  await fs.mkdir(paths.attachmentsPath, { recursive: true })
  await ensureVaultSystemDir(paths.rootPath)

  const vaultSettings: VaultSettings = {
    version: 1,
    createdAt: new Date().toISOString()
  }

  await ensureJsonFile(paths.vaultConfigPath, vaultSettings)
  await ensureJsonFile(paths.fileMapPath, {})
  await writeVaultMigrations(paths.rootPath, { version: 1 })

  return paths
}

export async function validateVault(rootPath: string): Promise<VaultPaths> {
  const resolved = path.resolve(rootPath)
  const paths = createVaultPaths(resolved)

  await fs.access(paths.rootPath)
  await fs.mkdir(paths.attachmentsPath, { recursive: true })
  await ensureVaultSystemDir(paths.rootPath)

  let migrations = await readVaultMigrations(paths.rootPath)
  migrations = await migrateLegacyNotebookRoot(paths.rootPath, migrations)
  await migrateLegacySystemMetadata(paths.rootPath, migrations)

  await fs.mkdir(paths.notebooksPath, { recursive: true })
  await ensureJsonFile(paths.vaultConfigPath, {
    version: 1,
    createdAt: new Date().toISOString()
  })
  await ensureJsonFile(paths.fileMapPath, {})

  return paths
}

export function assertPathInVault(
  paths: VaultPaths,
  relPath: string,
  scope: 'notes' | 'attachments'
): string {
  const base = scope === 'notes' ? paths.notebooksPath : paths.attachmentsPath
  return joinSafe(base, relPath)
}

async function migrateLegacyNotebookRoot(
  rootPath: string,
  migrations: Awaited<ReturnType<typeof readVaultMigrations>>
): Promise<Awaited<ReturnType<typeof readVaultMigrations>>> {
  const legacyNotesPath = getLegacyVaultNotesDir(rootPath)
  const notebooksPath = getVaultNotebooksDir(rootPath)
  const legacyExists = await pathExists(legacyNotesPath)
  const notebooksExists = await pathExists(notebooksPath)

  if (!legacyExists) {
    return migrations
  }

  if (notebooksExists && !migrations.copiedFromLegacyNotesAt) {
    throw new Error(
      'Vault migration conflict: both legacy notes/ and canonical notebooks/ exist. Resolve this manually before opening the vault.'
    )
  }

  if (!notebooksExists) {
    await fs.cp(legacyNotesPath, notebooksPath, { recursive: true, errorOnExist: true })
  }

  if (!migrations.copiedFromLegacyNotesAt) {
    const nextMigrations = {
      ...migrations,
      copiedFromLegacyNotesAt: new Date().toISOString()
    }
    await writeVaultMigrations(rootPath, nextMigrations)
    return nextMigrations
  }

  return migrations
}

async function migrateLegacySystemMetadata(
  rootPath: string,
  migrations: Awaited<ReturnType<typeof readVaultMigrations>>
): Promise<void> {
  const legacySystemPath = getLegacyVaultSystemDir(rootPath)
  if (!(await pathExists(legacySystemPath))) {
    return
  }

  await copyFileIfMissing(getLegacyVaultConfigPath(rootPath), getVaultConfigPath(rootPath))
  await copyFileIfMissing(getLegacyVaultFileMapPath(rootPath), getVaultFileMapPath(rootPath))
  await copyFileIfMissing(getLegacyVaultIndexPath(rootPath), getVaultIndexPath(rootPath))

  if (!migrations.copiedFromLegacySystemAt) {
    await writeVaultMigrations(rootPath, {
      ...migrations,
      copiedFromLegacySystemAt: new Date().toISOString()
    })
  }
}

async function ensureJsonFile(filePath: string, defaultValue: object): Promise<void> {
  try {
    await fs.access(filePath)
  } catch {
    await fs.writeFile(filePath, JSON.stringify(defaultValue, null, 2), 'utf-8')
  }
}

async function copyFileIfMissing(sourcePath: string, destinationPath: string): Promise<void> {
  if (!(await pathExists(sourcePath)) || (await pathExists(destinationPath))) {
    return
  }

  await fs.mkdir(path.dirname(destinationPath), { recursive: true })
  await fs.copyFile(sourcePath, destinationPath)
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath)
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return false
    }
    throw error
  }
}

export { toInfo }
