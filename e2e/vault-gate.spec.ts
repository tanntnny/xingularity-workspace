import { test, expect, Page } from '@playwright/test'
import { _electron as electron, ElectronApplication } from 'playwright'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

async function launchWithoutVault(): Promise<{
  electronApp: ElectronApplication
  page: Page
}> {
  return launchWithGlobalSettings({ lastVaultPath: null })
}

async function launchWithGlobalSettings(settings: { lastVaultPath: string | null }): Promise<{
  electronApp: ElectronApplication
  page: Page
}> {
  const electronApp = await electron.launch({
    args: ['.'],
    cwd: process.cwd(),
    env: {
      ...process.env,
      CI: '1'
    }
  })

  const userDataPath = await electronApp.evaluate(({ app }) => app.getPath('userData'))
  await fs.mkdir(userDataPath, { recursive: true })
  await fs.writeFile(
    path.join(userDataPath, 'settings.json'),
    JSON.stringify(settings, null, 2),
    'utf-8'
  )

  const page = await electronApp.firstWindow()
  await page.waitForLoadState('domcontentloaded')

  return { electronApp, page }
}

test.describe('vault gate', () => {
  test('shows standalone vault onboarding until a vault is selected', async () => {
    const { electronApp, page } = await launchWithoutVault()

    try {
      await expect(page.getByTestId('vault-required-page')).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Select a vault first' })).toBeVisible()
      await expect(page.getByTestId('vault-required-open')).toBeVisible()
      await expect(page.getByTestId('vault-required-create')).toBeVisible()
      await expect(page.getByTestId('vault-required-manage')).toBeVisible()

      await expect(page.getByTestId('sidebar-page:notes')).toHaveCount(0)
      await expect(page.getByTestId('workspace-tab:workspace-tab-1')).toHaveCount(0)
      await page.getByTestId('vault-required-manage').click()
      await expect(page.getByRole('dialog', { name: 'Manage vaults' })).toBeVisible()
      await expect(page.getByText('No previous vault remembered on this device.')).toBeVisible()
    } finally {
      await electronApp.close()
    }
  })

  test('clears a stale remembered vault and falls back to the vault gate', async () => {
    const staleVaultPath = path.join(os.tmpdir(), 'xingularity-missing-vault-gate')
    await fs.rm(staleVaultPath, { recursive: true, force: true })

    const { electronApp, page } = await launchWithGlobalSettings({
      lastVaultPath: staleVaultPath
    })

    try {
      await expect(page.getByTestId('vault-required-page')).toBeVisible()
      await expect(page.getByText('No previous vault remembered on this device.')).toBeVisible()
      await expect(
        page.getByText(`Could not restore previous vault at ${staleVaultPath}`)
      ).toHaveCount(0)

      const userDataPath = await electronApp.evaluate(({ app }) => app.getPath('userData'))
      const raw = await fs.readFile(path.join(userDataPath, 'settings.json'), 'utf-8')
      expect(JSON.parse(raw)).toMatchObject({ lastVaultPath: null })
    } finally {
      await electronApp.close()
    }
  })
})
