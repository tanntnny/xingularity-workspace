import { test, expect, Page } from '@playwright/test'
import { _electron as electron, ElectronApplication } from 'playwright'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  createStoredNoteDocumentFromText,
  serializeStoredNoteDocument
} from '../src/shared/noteDocument'

declare global {
  interface Window {
    vaultApi: {
      vault: {
        restoreLast: () => Promise<unknown>
      }
    }
  }
}

async function createFixtureVault(): Promise<string> {
  const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-settings-e2e-vault-'))
  await fs.mkdir(path.join(rootPath, 'notes'), { recursive: true })
  await fs.mkdir(path.join(rootPath, 'attachments'), { recursive: true })
  await fs.writeFile(
    path.join(rootPath, 'notes', 'alpha.md'),
    serializeStoredNoteDocument(createStoredNoteDocumentFromText('Alpha note\n')),
    'utf-8'
  )
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
  const gridPageButton = page.getByTestId('sidebar-page:grid')
  try {
    await expect(gridPageButton).toBeVisible({ timeout: 5_000 })
  } catch {
    await page.evaluate(() => window.vaultApi.vault.restoreLast())
    await expect(gridPageButton).toBeVisible({ timeout: 20_000 })
  }

  return { electronApp, page }
}

test.describe('settings page', () => {
  test('separates workspace and appearance concerns', async () => {
    const vaultRoot = await createFixtureVault()
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await page.getByRole('button', { name: 'Settings' }).first().click()
      await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()

      await expect(page.getByRole('radio', { name: 'Profile' })).toBeVisible()
      await expect(page.getByRole('radio', { name: 'Workspace' })).toBeVisible()
      await expect(page.getByRole('radio', { name: 'Appearance' })).toBeVisible()
      await expect(page.getByRole('radio', { name: 'Agent' })).toBeVisible()
      await expect(page.getByRole('radio', { name: 'Notification' })).toHaveCount(0)

      await page.getByRole('radio', { name: 'Workspace' }).click()
      await expect(page.getByRole('heading', { name: 'Workspace' })).toBeVisible()
      await expect(page.getByText('Vault Location', { exact: true })).toBeVisible()
      await expect(page.locator('[aria-label="Vault location"]').getByText(vaultRoot)).toBeVisible()
      await expect(page.getByRole('button', { name: 'Change Vault Location' })).toBeVisible()
      await expect(page.getByText('App Font')).toHaveCount(0)

      await page.getByRole('radio', { name: 'Appearance' }).click()
      await expect(page.getByRole('heading', { name: 'Appearance' })).toBeVisible()
      await expect(page.getByText('App Font', { exact: true })).toBeVisible()
      await expect(page.getByText('The quick brown fox jumps over the lazy dog.')).toBeVisible()
      await expect(page.getByText('Vault Location')).toHaveCount(0)

      await page.getByRole('radio', { name: 'Agent' }).click()
      await expect(page.getByRole('heading', { name: 'Agent' })).toBeVisible()
      await expect(page.getByText('Mistral API Key')).toBeVisible()
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })
})
