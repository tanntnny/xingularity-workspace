import { test, expect, type Page } from '@playwright/test'
import { _electron as electron, type ElectronApplication } from 'playwright'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

async function createFixtureVault(): Promise<string> {
  const rootPath = await fs.mkdtemp(
    path.join(os.tmpdir(), 'xingularity-scheduling-guide-e2e-vault-')
  )
  await fs.mkdir(path.join(rootPath, 'notebooks'), { recursive: true })
  await fs.mkdir(path.join(rootPath, 'attachments'), { recursive: true })
  return rootPath
}

async function launchWithFixture(vaultRoot: string): Promise<{
  electronApp: ElectronApplication
  page: Page
}> {
  const userDataPath = await fs.mkdtemp(
    path.join(os.tmpdir(), 'xingularity-scheduling-guide-user-')
  )
  await fs.writeFile(
    path.join(userDataPath, 'settings.json'),
    JSON.stringify({ lastVaultPath: vaultRoot }, null, 2),
    'utf-8'
  )

  const electronApp = await electron.launch({
    args: ['.', `--user-data-dir=${userDataPath}`],
    cwd: process.cwd(),
    env: {
      ...process.env,
      CI: '1'
    }
  })

  const page = await electronApp.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  await page.waitForFunction(() => typeof window.vaultApi?.vault?.restoreLast === 'function')
  await expect
    .poll(
      async () => {
        try {
          await page.evaluate(async () => window.vaultApi.vault.restoreLast())
        } catch {
          // Retry while the temporary fixture vault is being initialized.
        }

        return Boolean(await page.getByTestId('sidebar-command-palette').count())
      },
      { timeout: 60_000 }
    )
    .toBe(true)

  return { electronApp, page }
}

test('opens the scheduling API guide from the three-dots context menu', async () => {
  const vaultRoot = await createFixtureVault()
  const { electronApp, page } = await launchWithFixture(vaultRoot)

  try {
    await page.getByTestId('sidebar-page:schedules').click()
    await expect(page.getByTestId('scheduling-job-list')).toBeVisible()
    await page.getByTestId('workspace-page-context-menu-trigger').click()
    const apiGuideItem = page.getByTestId('scheduling-context-menu-item:api-guide')
    await expect(apiGuideItem).toBeVisible()
    const backgroundBeforeHover = await apiGuideItem.evaluate(
      (element) => getComputedStyle(element).backgroundColor
    )
    await apiGuideItem.hover()
    await expect(apiGuideItem).toHaveAttribute('data-highlighted', '')
    await expect
      .poll(() => apiGuideItem.evaluate((element) => getComputedStyle(element).cursor))
      .toBe('pointer')
    await expect
      .poll(() => apiGuideItem.evaluate((element) => getComputedStyle(element).backgroundColor))
      .not.toBe(backgroundBeforeHover)
    await apiGuideItem.click()
    await expect(page.getByTestId('scheduling-api-guide-page')).toBeVisible()
  } finally {
    await electronApp.close()
    await fs.rm(vaultRoot, { recursive: true, force: true })
  }
})
