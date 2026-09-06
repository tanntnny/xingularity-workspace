import { test, expect, Page } from '@playwright/test'
import { _electron as electron, ElectronApplication } from 'playwright'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

async function createFixtureVault(): Promise<string> {
  const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-design-audit-e2e-vault-'))
  await fs.mkdir(path.join(rootPath, 'notebooks'), { recursive: true })
  await fs.mkdir(path.join(rootPath, 'attachments'), { recursive: true })
  return rootPath
}

async function launchWithFixture(vaultRoot: string): Promise<{
  electronApp: ElectronApplication
  page: Page
}> {
  const userDataPath = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-design-audit-user-'))
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

  const actualUserDataPath = await electronApp.evaluate(({ app }) => app.getPath('userData'))
  await fs.mkdir(actualUserDataPath, { recursive: true })
  await fs.writeFile(
    path.join(actualUserDataPath, 'settings.json'),
    JSON.stringify({ lastVaultPath: vaultRoot }, null, 2),
    'utf-8'
  )

  const page = await electronApp.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  await page.waitForFunction(() => typeof window.vaultApi?.vault?.restoreLast === 'function')
  await page.evaluate(() => window.vaultApi.vault.restoreLast())
  await expect(page.getByTestId('sidebar-page:settings')).toBeEnabled({ timeout: 20_000 })

  return { electronApp, page }
}

test.describe('design audit page', () => {
  test('opens from Settings and presents focused primitive specimens', async () => {
    const vaultRoot = await createFixtureVault()
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await expect(page.getByTestId('sidebar-page:designAudit')).toHaveCount(0)
      await page.getByTestId('sidebar-page:settings').click()
      await page.getByRole('tab', { name: 'Developer' }).click()
      await page.getByTestId('settings-open-design-audit').click()
      await expect(page.getByTestId('design-audit-page')).toBeVisible()
      const auditMain = page.getByTestId('design-audit-main')
      await expect(auditMain).toHaveClass(/max-w-5xl/)
      await expect(
        auditMain.getByText('Foundations · Live CSS values', { exact: true })
      ).toHaveCount(0)
      await expect(page.getByText('Component catalog', { exact: true })).toHaveCount(0)
      await expect(
        page.getByText("Browse focused views of the app's primitives and semantic tokens.", {
          exact: true
        })
      ).toHaveCount(0)
      const catalogPanel = page.getByTestId('design-audit-panel')
      await expect(catalogPanel).toBeVisible()

      const catalogGroups = [
        { id: 'foundations', label: 'Foundations', firstTab: 'tokens-surfaces' },
        { id: 'actions', label: 'Actions', firstTab: 'button' },
        { id: 'forms', label: 'Forms', firstTab: 'inputs' },
        { id: 'display', label: 'Display', firstTab: 'badges-status' },
        { id: 'overlays', label: 'Overlays', firstTab: 'overlays' }
      ] as const

      for (const group of catalogGroups) {
        const section = page.getByTestId(`design-audit-panel-section:${group.id}`)
        const navigation = page.getByTestId(`design-audit-navigation:${group.id}`)

        await expect(section).toBeVisible()
        await expect(section.getByRole('button', { name: group.label, exact: true })).toBeVisible()
        await expect(navigation).toBeVisible()
        await expect(
          navigation.getByTestId(`design-audit-nav-item:${group.firstTab}`)
        ).toBeVisible()
      }

      const foundationsNavigation = page.getByTestId('design-audit-navigation:foundations')
      await expect(foundationsNavigation.locator('h3')).toHaveCount(0)
      await expect(foundationsNavigation.locator('p')).toHaveCount(0)

      const formsSection = page.getByTestId('design-audit-panel-section:forms')
      const formsNavigation = page.getByTestId('design-audit-navigation:forms')
      await formsSection.getByRole('button', { name: 'Forms', exact: true }).click()
      await expect(formsNavigation).toBeHidden()
      await expect(page.getByTestId('design-audit-navigation:actions')).toBeVisible()
      await formsSection.getByRole('button', { name: 'Forms', exact: true }).click()
      await expect(formsNavigation).toBeVisible()

      await expect(page.getByTestId('design-audit-section:tokens-surfaces')).toBeVisible()
      await expect(page.getByTestId('design-audit-token:accent')).toHaveCount(0)
      await expect(page.getByTestId('design-audit-token:app-background')).toBeVisible()
      await expect(page.getByRole('tab', { name: 'Forms' })).toHaveCount(0)

      await page.getByTestId('design-audit-nav-item:button').click()
      await expect(auditMain.getByText('Actions', { exact: true })).toHaveCount(0)

      await page.getByTestId('design-audit-nav-item:badges-status').click()
      await expect(auditMain.getByText('Information primitives', { exact: true })).toHaveCount(0)

      await page.getByTestId('design-audit-nav-item:inputs').click()
      await expect(page.getByTestId('design-audit-section:inputs')).toBeVisible()
      await expect(page.getByTestId('design-audit-component:field')).toBeVisible()
      await expect(auditMain.getByText('Forms', { exact: true })).toHaveCount(0)

      await page.getByTestId('design-audit-nav-item:overlays').click()
      await expect(page.getByTestId('design-audit-section:overlays')).toBeVisible()
      await expect(auditMain.getByText('Overlays', { exact: true })).toHaveCount(0)
      await page.getByRole('button', { name: 'Open dialog' }).click()
      await expect(page.getByTestId('design-audit-variant:dialog:content')).toBeVisible()
      await page
        .getByTestId('design-audit-variant:dialog:content')
        .getByRole('button', { name: 'Close' })
        .click()

      await page.getByTestId('design-audit-nav-item:menus-popovers').click()
      await expect(auditMain.getByText('Menus and popovers', { exact: true })).toHaveCount(0)
      await page.getByRole('button', { name: 'Open dropdown' }).click()
      await expect(page.getByRole('menu')).toBeVisible()
      await page.keyboard.press('Escape')
      await page.getByTestId('design-audit-variant:popover:center:trigger').click()
      const popover = page.getByTestId('design-audit-variant:popover:center:content')
      await expect(popover).toBeVisible()
      await popover.getByText('center alignment', { exact: true }).click()
      await page.keyboard.press('Escape')

      await page.getByRole('button', { name: 'Open command palette' }).click()
      await page.locator('[cmdk-input]').fill('>design audit')
      await expect(page.getByText('Go to Design Audit')).toBeVisible()
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })
})
