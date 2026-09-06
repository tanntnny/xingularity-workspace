import { test, expect, Page } from '@playwright/test'
import { _electron as electron, ElectronApplication } from 'playwright'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

async function createFixtureVault(): Promise<string> {
  const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-capture-e2e-vault-'))
  await fs.mkdir(path.join(rootPath, 'notebooks'), { recursive: true })
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
  await expect
    .poll(
      async () =>
        page.evaluate(async () => {
          try {
            await window.vaultApi.vault.restoreLast()
          } catch {
            // Retry until the temporary fixture vault is fully restorable.
          }

          return document
            .querySelector('[data-testid="sidebar-page:capture"]')
            ?.getAttribute('disabled')
        }),
      { timeout: 20_000 }
    )
    .toBeNull()

  return { electronApp, page }
}

test.describe('capture page', () => {
  test('captures, groups, and finalizes quick captures', async () => {
    const vaultRoot = await createFixtureVault()
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await page.getByTestId('sidebar-page:capture').click()
      await expect(page.getByTestId('capture-page')).toBeVisible()
      await expect(page.getByTestId('capture-board')).toBeVisible()
      await expect(page.getByTestId('capture-column:today')).toBeVisible()
      await expect(page.getByTestId('capture-empty-state')).toHaveCount(0)

      const input = page.getByTestId('capture-input')
      await input.fill('New note idea with details intact')
      await input.press('Enter')
      await expect(page.locator('[data-testid^="fleeting-note:"]')).toHaveCount(1)

      const noteCard = page.locator('[data-testid^="fleeting-note:"]').first()
      await noteCard.click()
      await page.getByRole('menuitem', { name: 'To Note' }).click()
      await expect(page.locator('[data-testid^="fleeting-note:"]')).toHaveCount(0)
      const convertedNoteFiles = await fs.readdir(path.join(vaultRoot, 'notebooks'))
      expect(convertedNoteFiles).toContain('new-note-idea.md')
      await expect(
        fs.readFile(path.join(vaultRoot, 'notebooks', 'new-note-idea.md'), 'utf-8')
      ).resolves.toContain('New note idea with details intact')

      await input.fill('Follow up with the team')
      await input.press('Enter')
      await expect(page.locator('[data-testid^="fleeting-note:"]')).toHaveCount(1)
      await page
        .locator('[data-testid^="fleeting-note:"]')
        .first()
        .locator('[data-testid^="fleeting-menu:"]')
        .click()
      await page.getByRole('menuitem', { name: 'To Task' }).click()
      await expect(page.locator('[data-testid^="fleeting-note:"]')).toHaveCount(0)

      const taskFiles = await fs.readdir(path.join(vaultRoot, 'tasks'))
      expect(taskFiles.length).toBe(1)
      await expect(
        fs.readFile(path.join(vaultRoot, 'tasks', taskFiles[0]), 'utf-8')
      ).resolves.toContain('Follow up with the team')

      const directTaskFiles = await fs.readdir(path.join(vaultRoot, 'tasks'))
      expect(directTaskFiles).toHaveLength(1)

      await input.fill('Discard this capture')
      await input.press('Enter')
      await expect(page.locator('[data-testid^="fleeting-note:"]')).toHaveCount(1)
      await page.locator('[data-testid^="fleeting-note:"]').first().click({ button: 'right' })
      await page.getByRole('menuitem', { name: 'Remove' }).click()
      await expect(page.locator('[data-testid^="fleeting-note:"]')).toHaveCount(0)
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('supports the platform primary-action shortcut for quick capture', async () => {
    const vaultRoot = await createFixtureVault()
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await page.getByTestId('sidebar-page:capture').click()
      await expect(page.getByTestId('capture-page')).toBeVisible()

      const input = page.getByTestId('capture-input')
      await input.fill('Command enter capture')
      await input.press(process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter')
      await expect(page.locator('[data-testid^="fleeting-note:"]')).toHaveCount(1)
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })
})
