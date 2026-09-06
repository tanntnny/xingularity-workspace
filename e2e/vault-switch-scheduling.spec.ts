import { test, expect, type Page } from '@playwright/test'
import { _electron as electron, type ElectronApplication } from 'playwright'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

async function createFixtureVault(rootPath: string, jobId: string, jobName: string): Promise<void> {
  const now = new Date().toISOString()

  await Promise.all([
    fs.mkdir(path.join(rootPath, 'notebooks'), { recursive: true }),
    fs.mkdir(path.join(rootPath, 'attachments'), { recursive: true }),
    fs.mkdir(path.join(rootPath, 'schedules'), { recursive: true })
  ])
  await fs.writeFile(
    path.join(rootPath, 'schedules', 'jobs.json'),
    JSON.stringify(
      [
        {
          id: jobId,
          name: jobName,
          enabled: false,
          trigger: { type: 'manual' },
          runtime: 'javascript',
          code: '',
          permissions: [],
          outputMode: 'review_before_apply',
          createdAt: now,
          updatedAt: now
        }
      ],
      null,
      2
    ),
    'utf8'
  )
}

async function launchWithSavedVaults(
  vaultA: string,
  vaultB: string
): Promise<{
  electronApp: ElectronApplication
  page: Page
  userDataPath: string
}> {
  const userDataPath = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-vault-switch-user-'))
  const now = new Date().toISOString()
  await fs.writeFile(
    path.join(userDataPath, 'settings.json'),
    JSON.stringify(
      {
        lastVaultPath: vaultA,
        savedVaults: [
          { rootPath: vaultA, addedAt: now, lastOpenedAt: now, isFavorite: false },
          { rootPath: vaultB, addedAt: now, lastOpenedAt: null, isFavorite: false }
        ]
      },
      null,
      2
    ),
    'utf8'
  )

  const electronApp = await electron.launch({
    args: [`--user-data-dir=${userDataPath}`, '.'],
    cwd: process.cwd(),
    env: { ...process.env, CI: '1' }
  })
  const page = await electronApp.firstWindow()

  await page.waitForLoadState('domcontentloaded')
  await page.waitForFunction(() => typeof window.vaultApi?.vault?.restoreLast === 'function')
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const commandPalette = document.querySelector<HTMLButtonElement>(
            '[data-testid="sidebar-command-palette"]'
          )
          return commandPalette ? !commandPalette.disabled : false
        }),
      { timeout: 60_000 }
    )
    .toBe(true)

  return { electronApp, page, userDataPath }
}

test('keeps schedule IPC reads valid while switching vaults', async () => {
  const parentRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-vault-switch-'))
  const vaultA = path.join(parentRoot, 'vault-a')
  const vaultB = path.join(parentRoot, 'vault-b')
  await createFixtureVault(vaultA, 'job-a', 'Vault A automation')
  await createFixtureVault(vaultB, 'job-b', 'Vault B automation')

  const { electronApp, page, userDataPath } = await launchWithSavedVaults(vaultA, vaultB)

  try {
    await page.getByTestId('sidebar-page:schedules').click()
    await expect(page.getByTestId('scheduling-job:job-a')).toBeVisible()

    const scheduleReadErrors = page.evaluate(async () => {
      const api = (
        window as unknown as {
          vaultApi: { schedules: { listJobs: () => Promise<unknown> } }
        }
      ).vaultApi
      const errors: string[] = []
      const deadline = Date.now() + 3_000

      while (Date.now() < deadline) {
        try {
          await api.schedules.listJobs()
        } catch (error) {
          errors.push(String(error))
        }
        await new Promise((resolve) => window.setTimeout(resolve, 25))
      }

      return errors
    })

    await page.getByTestId('sidebar-vault-manager').click()
    await expect(page.getByRole('dialog', { name: 'Manage vaults' })).toBeVisible()
    await page.getByRole('button', { name: 'Switch to vault-b' }).click()

    expect(await scheduleReadErrors).toEqual([])
    await page.getByTestId('sidebar-page:schedules').click()
    await expect(page.getByTestId('scheduling-job:job-b')).toBeVisible({ timeout: 60_000 })
    await expect(page.getByTestId('scheduling-job:job-a')).toHaveCount(0)
    await expect(page.getByText('Fatal Application Error')).toHaveCount(0)
  } finally {
    await electronApp.close()
    await fs.rm(userDataPath, { recursive: true, force: true })
    await fs.rm(parentRoot, { recursive: true, force: true })
  }
})
