import fs from 'node:fs/promises'
import path from 'node:path'

export const VAULT_SYSTEM_DIRNAME = '.xingularity'
export const LEGACY_VAULT_SYSTEM_DIRNAME = '.appmeta'
export const VAULT_NOTEBOOKS_DIRNAME = 'notebooks'
export const LEGACY_VAULT_NOTES_DIRNAME = 'notes'
export const VAULT_ATTACHMENTS_DIRNAME = 'attachments'
export const VAULT_SETTINGS_FILE_NAME = 'settings.json'
export const VAULT_MIGRATIONS_FILE_NAME = 'migrations.json'

export interface VaultMigrationState {
  version: 1
  copiedFromLegacyNotesAt?: string
  copiedFromLegacySystemAt?: string
}

export function getVaultSystemDir(rootPath: string): string {
  return path.join(rootPath, VAULT_SYSTEM_DIRNAME)
}

export function getLegacyVaultSystemDir(rootPath: string): string {
  return path.join(rootPath, LEGACY_VAULT_SYSTEM_DIRNAME)
}

export async function ensureVaultSystemDir(rootPath: string): Promise<string> {
  const dir = getVaultSystemDir(rootPath)
  await fs.mkdir(dir, { recursive: true })
  return dir
}

export function getVaultNotebooksDir(rootPath: string): string {
  return path.join(rootPath, VAULT_NOTEBOOKS_DIRNAME)
}

export function getLegacyVaultNotesDir(rootPath: string): string {
  return path.join(rootPath, LEGACY_VAULT_NOTES_DIRNAME)
}

export function getVaultAttachmentsDir(rootPath: string): string {
  return path.join(rootPath, VAULT_ATTACHMENTS_DIRNAME)
}

export function getVaultSettingsPath(rootPath: string): string {
  return path.join(rootPath, VAULT_SETTINGS_FILE_NAME)
}

export function getLegacyVaultSettingsPath(rootPath: string): string {
  return path.join(getVaultSystemDir(rootPath), VAULT_SETTINGS_FILE_NAME)
}

export function getVaultProjectsPath(rootPath: string): string {
  return path.join(rootPath, 'projects', 'index.json')
}

export function getLegacyVaultProjectsPath(rootPath: string): string {
  return path.join(getVaultSystemDir(rootPath), 'projects.json')
}

export function getVaultCalendarTasksPath(rootPath: string): string {
  return path.join(rootPath, 'calendar', 'tasks.json')
}

export function getLegacyVaultCalendarTasksPath(rootPath: string): string {
  return path.join(getVaultSystemDir(rootPath), 'tasks.json')
}

export function getVaultWeeklyPlanPath(rootPath: string): string {
  return path.join(rootPath, 'weekly-plan', 'state.json')
}

export function getLegacyVaultWeeklyPlanPath(rootPath: string): string {
  return path.join(getVaultSystemDir(rootPath), 'weekly-plan.json')
}

export function getVaultSubscriptionsPath(rootPath: string): string {
  return path.join(rootPath, 'subscriptions', 'data.json')
}

export function getLegacyVaultSubscriptionsPath(rootPath: string): string {
  return path.join(getVaultSystemDir(rootPath), 'subscriptions.json')
}

export function getVaultScheduleJobsPath(rootPath: string): string {
  return path.join(rootPath, 'schedules', 'jobs.json')
}

export function getVaultScheduleRunsPath(rootPath: string): string {
  return path.join(rootPath, 'schedules', 'runs.json')
}

export function getLegacyVaultScheduleJobsPath(rootPath: string): string {
  return path.join(getVaultSystemDir(rootPath), 'schedule-jobs.json')
}

export function getLegacyVaultScheduleRunsPath(rootPath: string): string {
  return path.join(getVaultSystemDir(rootPath), 'schedule-runs.json')
}

export function getVaultAgentChatsPath(rootPath: string): string {
  return path.join(rootPath, 'agent', 'chats.json')
}

export function getVaultAgentRunsPath(rootPath: string): string {
  return path.join(rootPath, 'agent', 'runs.json')
}

export function getLegacyVaultAgentChatsPath(rootPath: string): string {
  return path.join(getVaultSystemDir(rootPath), 'agent-chats.json')
}

export function getLegacyVaultAgentRunsPath(rootPath: string): string {
  return path.join(getVaultSystemDir(rootPath), 'agent-runs.json')
}

export function getVaultGenerativeUiArtifactsPath(rootPath: string): string {
  return path.join(rootPath, 'generative-ui', 'artifacts.json')
}

export function getLegacyVaultGenerativeUiArtifactsPath(rootPath: string): string {
  return path.join(getVaultSystemDir(rootPath), 'generative-ui-artifacts.json')
}

export function getVaultExcalidrawSessionsPath(rootPath: string): string {
  return path.join(getVaultSystemDir(rootPath), 'excalidraw-sessions.json')
}

export function getVaultIndexPath(rootPath: string): string {
  return path.join(getVaultSystemDir(rootPath), 'index.sqlite')
}

export function getVaultFileMapPath(rootPath: string): string {
  return path.join(getVaultSystemDir(rootPath), 'filemap.json')
}

export function getVaultConfigPath(rootPath: string): string {
  return path.join(getVaultSystemDir(rootPath), 'vault.json')
}

export function getLegacyVaultIndexPath(rootPath: string): string {
  return path.join(getLegacyVaultSystemDir(rootPath), 'index.sqlite')
}

export function getLegacyVaultFileMapPath(rootPath: string): string {
  return path.join(getLegacyVaultSystemDir(rootPath), 'filemap.json')
}

export function getLegacyVaultConfigPath(rootPath: string): string {
  return path.join(getLegacyVaultSystemDir(rootPath), 'vault.json')
}

export function getVaultMigrationsPath(rootPath: string): string {
  return path.join(getVaultSystemDir(rootPath), VAULT_MIGRATIONS_FILE_NAME)
}

export async function readVaultMigrations(rootPath: string): Promise<VaultMigrationState> {
  await ensureVaultSystemDir(rootPath)
  try {
    const raw = await fs.readFile(getVaultMigrationsPath(rootPath), 'utf-8')
    const parsed = JSON.parse(raw) as Partial<VaultMigrationState>
    return {
      version: 1,
      copiedFromLegacyNotesAt:
        typeof parsed.copiedFromLegacyNotesAt === 'string'
          ? parsed.copiedFromLegacyNotesAt
          : undefined,
      copiedFromLegacySystemAt:
        typeof parsed.copiedFromLegacySystemAt === 'string'
          ? parsed.copiedFromLegacySystemAt
          : undefined
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error
    }
    return { version: 1 }
  }
}

export async function writeVaultMigrations(
  rootPath: string,
  state: VaultMigrationState
): Promise<void> {
  await ensureVaultSystemDir(rootPath)
  await fs.writeFile(getVaultMigrationsPath(rootPath), JSON.stringify(state, null, 2), 'utf-8')
}
