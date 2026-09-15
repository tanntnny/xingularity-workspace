import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { ensureVaultManifest, getVaultManifestPath } from '../main/vaultManifest'
import { readVaultManifestReport } from '../main/vaultContext'
import {
  getVaultAgentDir,
  getVaultAttachmentsDir,
  getVaultCalendarDir,
  getVaultExcalidrawDir,
  getVaultFleetingDir,
  getVaultProjectsDir,
  getVaultResourcesDir,
  getVaultSchedulesDir,
  getVaultSubscriptionsDir,
  getVaultTasksDir,
  getVaultWeeklyPlanDir,
  getVaultNotebooksDir,
  getVaultConfigPath,
  getVaultFileMapPath
} from '../main/vaultData'
import { writeFileAtomically } from '../main/atomicFile'
import { XWorkspaceError } from './xWorkspaceErrors'
import { hashVaultBytes } from '../main/vaultRevision'

export interface XWorkspaceBinding {
  version: 1
  rootPath: string
  vaultId: string
  manifestChecksum: string
  boundAt: string
}

export interface XWorkspaceBindingStoreOptions {
  configDir?: string
  now?: () => Date
}

export function getDefaultXWorkspaceConfigDir(): string {
  if (process.platform === 'win32') {
    return path.join(
      process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
      'Xingularity',
      'x-workspace'
    )
  }
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'Xingularity', 'x-workspace')
  }
  return path.join(
    process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'),
    'xingularity',
    'x-workspace'
  )
}

export class XWorkspaceBindingStore {
  private readonly configDir: string
  private readonly now: () => Date

  constructor(options: XWorkspaceBindingStoreOptions = {}) {
    this.configDir = path.resolve(options.configDir ?? getDefaultXWorkspaceConfigDir())
    this.now = options.now ?? (() => new Date())
  }

  get bindingPath(): string {
    return path.join(this.configDir, 'binding.json')
  }

  get plansDir(): string {
    return path.join(this.configDir, 'plans')
  }

  currentTime(): Date {
    return this.now()
  }

  async read(): Promise<XWorkspaceBinding | null> {
    try {
      const parsed = JSON.parse(
        await fs.readFile(this.bindingPath, 'utf8')
      ) as Partial<XWorkspaceBinding>
      if (
        parsed.version !== 1 ||
        typeof parsed.rootPath !== 'string' ||
        typeof parsed.vaultId !== 'string' ||
        typeof parsed.manifestChecksum !== 'string' ||
        typeof parsed.boundAt !== 'string'
      ) {
        throw new Error('Binding file has an invalid shape')
      }
      return {
        version: 1,
        rootPath: path.resolve(parsed.rootPath),
        vaultId: parsed.vaultId,
        manifestChecksum: parsed.manifestChecksum,
        boundAt: parsed.boundAt
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
      if (error instanceof XWorkspaceError) throw error
      throw new XWorkspaceError(
        'vault-binding-invalid',
        `Unable to read the X Workspace vault binding: ${describeError(error)}`
      )
    }
  }

  async require(): Promise<XWorkspaceBinding> {
    const binding = await this.read()
    if (!binding) {
      throw new XWorkspaceError(
        'vault-unbound',
        'No X Workspace vault is bound. Run vault set or vault init first.'
      )
    }

    const report = await readVaultManifestReport(binding.rootPath)
    if (!report.valid || !report.manifest || report.checksum !== binding.manifestChecksum) {
      throw new XWorkspaceError(
        'vault-binding-invalid',
        'The bound vault is missing, invalid, or has a different manifest. Reset and bind it again.',
        { binding, manifest: report }
      )
    }
    if (report.manifest.vaultId !== binding.vaultId) {
      throw new XWorkspaceError(
        'vault-binding-invalid',
        'The bound path no longer contains the bound vault identity.',
        { binding, manifest: report }
      )
    }
    return binding
  }

  async bindExisting(rootInput: string): Promise<XWorkspaceBinding> {
    const current = await this.read()
    if (current) {
      throw new XWorkspaceError(
        'vault-already-bound',
        'An X Workspace vault is already bound. Reset it before choosing another vault.',
        current
      )
    }
    const rootPath = path.resolve(rootInput)
    const report = await readVaultManifestReport(rootPath)
    if (!report.valid || !report.manifest || !report.checksum) {
      throw new XWorkspaceError(
        'vault-manifest-invalid',
        'Only an existing vault with a valid X Workspace manifest can be bound.',
        report
      )
    }
    return this.writeBinding({
      version: 1,
      rootPath,
      vaultId: report.manifest.vaultId,
      manifestChecksum: report.checksum,
      boundAt: this.now().toISOString()
    })
  }

  async createAndBind(rootInput: string): Promise<XWorkspaceBinding> {
    const current = await this.read()
    if (current) {
      throw new XWorkspaceError(
        'vault-already-bound',
        'An X Workspace vault is already bound. Reset it before creating another vault.',
        current
      )
    }
    const rootPath = path.resolve(rootInput)
    let stats: import('node:fs').Stats | null = null
    try {
      stats = await fs.stat(rootPath)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
    if (stats && !stats.isDirectory()) {
      throw new XWorkspaceError('vault-not-found', `Vault path is not a directory: ${rootPath}`)
    }
    if (stats) {
      const existingManifest = await readVaultManifestReport(rootPath)
      if (existingManifest.present) {
        throw new XWorkspaceError(
          'vault-exists',
          'The target already contains a vault manifest. Use vault set for an existing vault.'
        )
      }
    }

    await initializeHeadlessVault(rootPath)
    const report = await readVaultManifestReport(rootPath)
    if (!report.valid || !report.manifest || !report.checksum) {
      throw new XWorkspaceError(
        'vault-manifest-invalid',
        'The new vault manifest is invalid',
        report
      )
    }
    return this.writeBinding({
      version: 1,
      rootPath,
      vaultId: report.manifest.vaultId,
      manifestChecksum: report.checksum,
      boundAt: this.now().toISOString()
    })
  }

  async reset(): Promise<void> {
    await Promise.all([
      fs.rm(this.bindingPath, { force: true }),
      fs.rm(this.plansDir, { recursive: true, force: true })
    ])
  }

  private async writeBinding(binding: XWorkspaceBinding): Promise<XWorkspaceBinding> {
    await fs.mkdir(this.configDir, { recursive: true, mode: 0o700 })
    await fs.chmod(this.configDir, 0o700).catch(() => undefined)
    await writeFileAtomically(this.bindingPath, `${JSON.stringify(binding, null, 2)}\n`)
    await fs.chmod(this.bindingPath, 0o600).catch(() => undefined)
    return binding
  }
}

async function initializeHeadlessVault(rootPath: string): Promise<void> {
  await fs.mkdir(path.resolve(rootPath), { recursive: true })
  const manifest = await ensureVaultManifest(rootPath)
  const directories = [
    getVaultFleetingDir(rootPath),
    getVaultNotebooksDir(rootPath),
    getVaultAttachmentsDir(rootPath),
    getVaultProjectsDir(rootPath),
    getVaultTasksDir(rootPath),
    getVaultCalendarDir(rootPath),
    getVaultWeeklyPlanDir(rootPath),
    getVaultSubscriptionsDir(rootPath),
    getVaultSchedulesDir(rootPath),
    getVaultAgentDir(rootPath),
    getVaultExcalidrawDir(rootPath),
    getVaultResourcesDir(rootPath),
    path.dirname(getVaultManifestPath(rootPath))
  ]
  await Promise.all(directories.map((directory) => fs.mkdir(directory, { recursive: true })))
  await ensureJsonFile(getVaultConfigPath(rootPath), { version: 1, createdAt: manifest.createdAt })
  await ensureJsonFile(getVaultFileMapPath(rootPath), {})
}

async function ensureJsonFile(filePath: string, value: unknown): Promise<void> {
  try {
    await fs.access(filePath)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    await writeFileAtomically(filePath, `${JSON.stringify(value, null, 2)}\n`)
  }
}

export async function manifestFingerprint(rootPath: string): Promise<string> {
  const report = await readVaultManifestReport(rootPath)
  if (!report.valid || !report.manifest) {
    throw new XWorkspaceError('vault-manifest-invalid', 'The vault manifest is invalid', report)
  }
  return report.checksum ?? hashVaultBytes(JSON.stringify(report.manifest))
}

export async function workspaceContentFingerprint(rootPath: string): Promise<string> {
  const entries: Array<{ relativePath: string; contentHash: string }> = []
  for (const rootName of ['notebooks', 'projects', 'tasks', 'calendar', 'resources']) {
    await collectCanonicalFiles(path.resolve(rootPath), rootName, rootName, entries)
  }
  entries.sort((left, right) => left.relativePath.localeCompare(right.relativePath))
  const digest = createHash('sha256')
  for (const entry of entries) {
    digest.update(entry.relativePath)
    digest.update('\0')
    digest.update(entry.contentHash)
    digest.update('\0')
  }
  return digest.digest('hex')
}

async function collectCanonicalFiles(
  rootPath: string,
  relativePath: string,
  entryPath: string,
  entries: Array<{ relativePath: string; contentHash: string }>
): Promise<void> {
  const absolutePath = path.join(rootPath, relativePath)
  let directoryEntries: import('node:fs').Dirent[]
  try {
    directoryEntries = await fs.readdir(absolutePath, { withFileTypes: true })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
    throw error
  }
  for (const entry of directoryEntries) {
    const childRelativePath = path.join(relativePath, entry.name)
    const childEntryPath = path.join(entryPath, entry.name)
    if (entry.isDirectory()) {
      await collectCanonicalFiles(rootPath, childRelativePath, childEntryPath, entries)
      continue
    }
    if (!entry.isFile() || entry.name.endsWith('.tmp')) continue
    const bytes = await fs.readFile(path.join(rootPath, childRelativePath))
    entries.push({
      relativePath: childEntryPath.replace(/\\/g, '/'),
      contentHash: createHash('sha256').update(bytes).digest('hex')
    })
  }
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
