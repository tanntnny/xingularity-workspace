import { test, expect, Page } from '@playwright/test'
import { _electron as electron, ElectronApplication } from 'playwright'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

async function createFixtureVault(): Promise<string> {
  const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-design-audit-e2e-vault-'))
  await fs.mkdir(path.join(rootPath, 'notes'), { recursive: true })
  await fs.mkdir(path.join(rootPath, 'attachments'), { recursive: true })
  return rootPath
}

async function launchWithFixture(vaultRoot: string): Promise<{
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
    JSON.stringify({ lastVaultPath: vaultRoot }, null, 2),
    'utf-8'
  )

  const page = await electronApp.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  await page.waitForFunction(() => typeof window.vaultApi?.vault?.restoreLast === 'function')
  await page.evaluate(() => window.vaultApi.vault.restoreLast())
  await expect(page.getByTestId('sidebar-page:designAudit')).toBeEnabled({ timeout: 20_000 })

  return { electronApp, page }
}

test.describe('design audit page', () => {
  test('opens from navigation and presents live primitive specimens', async () => {
    const vaultRoot = await createFixtureVault()
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await page.getByTestId('sidebar-page:designAudit').click()
      await expect(page.getByTestId('design-audit-page')).toBeVisible()
      await expect(page.getByTestId('design-audit-section:foundations')).toBeVisible()
      await expect(page.getByTestId('design-audit-component:button')).toBeVisible()
      await expect(page.getByTestId('design-audit-token:accent')).toBeVisible()

      await page.getByRole('radio', { name: 'Forms' }).click()
      await expect(page.getByTestId('design-audit-section:forms')).toBeVisible()

      await page.getByRole('radio', { name: 'Overlays' }).click()
      await page.getByRole('button', { name: 'Open dialog' }).click()
      await expect(page.getByTestId('design-audit-dialog')).toBeVisible()
      await page.getByTestId('design-audit-dialog').getByRole('button', { name: 'Close' }).click()

      await page.getByRole('button', { name: 'Open command palette' }).click()
      await page.locator('[cmdk-input]').fill('>design audit')
      await expect(page.getByText('Go to Design Audit')).toBeVisible()
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })
})
