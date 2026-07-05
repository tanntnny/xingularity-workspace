import { dialog } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import { joinSafe } from '../shared/pathSafety'
import { VaultInfo, VaultSettings } from '../shared/types'
import {
  deleteLegacyVaultPath,
  getLegacyVaultConfigPath,
  getLegacyVaultFileMapPath,
  getLegacyVaultIndexPath,
  getLegacyVaultMigrationsPath,
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
  return {
    rootPath,
    notebooksPath,
    notesPath: notebooksPath,
    attachmentsPath: getVaultAttachmentsDir(rootPath),
    systemPath: rootPath,
    appMetaPath: rootPath,
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
  const hiddenSystemPath = getVaultSystemDir(rootPath)
  const legacySystemPath = getLegacyVaultSystemDir(rootPath)

  const migratedVaultConfig = await promoteFirstLegacyFile(getVaultConfigPath(rootPath), [
    path.join(hiddenSystemPath, 'vault.json'),
    getLegacyVaultConfigPath(rootPath)
  ])
  const migratedFileMap = await promoteFirstLegacyFile(getVaultFileMapPath(rootPath), [
    path.join(hiddenSystemPath, 'filemap.json'),
    getLegacyVaultFileMapPath(rootPath)
  ])
  const migratedIndex = await promoteFirstLegacyFile(getVaultIndexPath(rootPath), [
    path.join(hiddenSystemPath, 'index.sqlite'),
    getLegacyVaultIndexPath(rootPath)
  ])
  const migratedAny = migratedVaultConfig || migratedFileMap || migratedIndex

  if (migratedAny && !migrations.copiedFromLegacySystemAt) {
    await writeVaultMigrations(rootPath, {
      ...migrations,
      copiedFromLegacySystemAt: new Date().toISOString()
    })
  }

  await Promise.all([
    deleteLegacyVaultPath(path.join(hiddenSystemPath, 'vault.json'), rootPath),
    deleteLegacyVaultPath(path.join(hiddenSystemPath, 'filemap.json'), rootPath),
    deleteLegacyVaultPath(path.join(hiddenSystemPath, 'index.sqlite'), rootPath),
    deleteLegacyVaultPath(getLegacyVaultMigrationsPath(rootPath), rootPath),
    deleteLegacyVaultPath(getLegacyVaultConfigPath(rootPath), rootPath),
    deleteLegacyVaultPath(getLegacyVaultFileMapPath(rootPath), rootPath),
    deleteLegacyVaultPath(getLegacyVaultIndexPath(rootPath), rootPath)
  ])

  if (await pathExists(hiddenSystemPath)) {
    await removeDirIfEmpty(hiddenSystemPath)
  }
  if (await pathExists(legacySystemPath)) {
    await removeDirIfEmpty(legacySystemPath)
  }
}

async function ensureJsonFile(filePath: string, defaultValue: object): Promise<void> {
  try {
    await fs.access(filePath)
  } catch {
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, JSON.stringify(defaultValue, null, 2), 'utf-8')
  }
}

async function promoteFirstLegacyFile(
  destinationPath: string,
  sourcePaths: string[]
): Promise<boolean> {
  if (await pathExists(destinationPath)) {
    return false
  }

  for (const sourcePath of sourcePaths) {
    if (!(await pathExists(sourcePath))) {
      continue
    }

    await fs.mkdir(path.dirname(destinationPath), { recursive: true })
    await fs.copyFile(sourcePath, destinationPath)
    return true
  }

  return false
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

async function removeDirIfEmpty(targetPath: string): Promise<void> {
  try {
    await fs.rmdir(targetPath)
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT' || code === 'ENOTEMPTY' || code === 'EEXIST') {
      return
    }
    throw error
  }
}

export { toInfo }
