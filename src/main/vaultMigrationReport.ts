import fs from 'node:fs/promises'
import path from 'node:path'
import {
  getVaultAgentDir,
  getVaultAttachmentsDir,
  getVaultCalendarDir,
  getVaultExcalidrawDir,
  getVaultFleetingDir,
  getVaultMigrationsPath,
  getVaultNotebooksDir,
  getVaultProjectsDir,
  getVaultResourcesDir,
  getVaultSchedulesDir,
  getVaultSubscriptionsDir,
  getVaultTasksDir,
  getVaultWeeklyPlanDir,
  readVaultMigrations
} from './vaultData'
import type { VaultMigrationReport } from '../shared/types'

const CANONICAL_PATHS = [
  'notebooks',
  'fleeting',
  'attachments',
  'projects',
  'tasks',
  'calendar',
  'weekly-plan',
  'subscriptions',
  'schedules',
  'agent',
  'excalidraw',
  'resources',
  'migrations.json'
] as const

const LEGACY_PATHS = [
  'notes',
  '.appmeta',
  'calendar/tasks.json',
  'tasks.json',
  'projects.json',
  'weekly-plan.json',
  'subscriptions.json',
  'schedules/jobs.json',
  'schedules/runs.json',
  'agent/chats.json',
  'agent/runs.json',
  'excalidraw-sessions.json'
] as const

export async function buildVaultMigrationReport(rootPath: string): Promise<VaultMigrationReport> {
  const root = path.resolve(rootPath)
  const migrations = await readVaultMigrations(root)
  const legacyPathsFound = await findExistingPaths(root, LEGACY_PATHS)
  const canonicalPaths = await findExistingPaths(root, CANONICAL_PATHS)
  const conflicts = legacyPathsFound.filter((legacyPath) => {
    const equivalent = legacyToCanonicalPath(legacyPath)
    return equivalent !== null && canonicalPaths.includes(equivalent)
  })

  const counts = await countCanonicalEntries(root)
  return {
    generatedAt: new Date().toISOString(),
    schemaVersion: migrations.version,
    migrations,
    canonicalPaths,
    legacyPathsFound,
    conflicts,
    counts,
    rollbackGuidance:
      'Create a portable backup before resolving conflicts. Legacy files are retained in the report until the canonical record is verified and the migration marker is written.'
  }
}

async function findExistingPaths(
  root: string,
  relativePaths: readonly string[]
): Promise<string[]> {
  const existing: string[] = []
  for (const relativePath of relativePaths) {
    try {
      await fs.lstat(path.join(root, relativePath))
      existing.push(relativePath)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error
      }
    }
  }
  return existing
}

function legacyToCanonicalPath(relativePath: string): string | null {
  const mappings: Record<string, string> = {
    notes: 'notebooks',
    '.appmeta': 'migrations.json',
    'calendar/tasks.json': 'tasks',
    'tasks.json': 'tasks',
    'projects.json': 'projects',
    'weekly-plan.json': 'weekly-plan',
    'subscriptions.json': 'subscriptions',
    'schedules/jobs.json': 'schedules',
    'schedules/runs.json': 'schedules',
    'agent/chats.json': 'agent',
    'agent/runs.json': 'agent',
    'excalidraw-sessions.json': 'excalidraw'
  }
  return mappings[relativePath] ?? null
}

async function countCanonicalEntries(root: string): Promise<Record<string, number>> {
  const paths: Record<string, string> = {
    notebooks: getVaultNotebooksDir(root),
    fleeting: getVaultFleetingDir(root),
    attachments: getVaultAttachmentsDir(root),
    projects: getVaultProjectsDir(root),
    tasks: getVaultTasksDir(root),
    calendar: getVaultCalendarDir(root),
    'weekly-plan': getVaultWeeklyPlanDir(root),
    subscriptions: getVaultSubscriptionsDir(root),
    schedules: getVaultSchedulesDir(root),
    agent: getVaultAgentDir(root),
    excalidraw: getVaultExcalidrawDir(root),
    resources: getVaultResourcesDir(root),
    migrations: getVaultMigrationsPath(root)
  }
  const counts: Record<string, number> = {}
  for (const [key, targetPath] of Object.entries(paths)) {
    counts[key] = await countEntries(targetPath)
  }
  return counts
}

async function countEntries(targetPath: string): Promise<number> {
  try {
    const stats = await fs.lstat(targetPath)
    if (stats.isFile()) {
      return 1
    }
    if (!stats.isDirectory()) {
      return 0
    }
    const entries = await fs.readdir(targetPath, { withFileTypes: true })
    return entries.filter((entry) => !entry.name.startsWith('.tmp-')).length
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return 0
    }
    throw error
  }
}
