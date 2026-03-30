import { test, expect, Page } from '@playwright/test'
import { _electron as electron, ElectronApplication } from 'playwright'
import fs from 'node:fs/promises'
import path from 'node:path'

async function launchWithoutVault(): Promise<{
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
    JSON.stringify({ lastVaultPath: null }, null, 2),
    'utf-8'
  )

  const page = await electronApp.firstWindow()
  await page.waitForLoadState('domcontentloaded')

  return { electronApp, page }
}

test.describe('vault gate', () => {
  test('locks navigation until a vault is selected', async () => {
    const { electronApp, page } = await launchWithoutVault()

    try {
      await expect(page.getByTestId('vault-required-page')).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Select a vault first' })).toBeVisible()
      await expect(page.getByTestId('vault-required-open')).toBeVisible()
      await expect(page.getByTestId('vault-required-create')).toBeVisible()

      await expect(page.getByRole('button', { name: 'Open command palette' })).toBeDisabled()
      await expect(page.getByTestId('sidebar-page:dashboard')).toBeDisabled()
      await expect(page.getByTestId('sidebar-page:notes')).toBeDisabled()
      await expect(page.getByTestId('sidebar-page:projects')).toBeDisabled()
      await expect(page.getByTestId('sidebar-page:settings')).toBeDisabled()
      await expect(page.getByText('No previous vault remembered on this device.')).toBeVisible()
    } finally {
      await electronApp.close()
    }
  })
})
