import { test, expect, Page } from '@playwright/test'
import { _electron as electron, ElectronApplication } from 'playwright'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { expectSingleRightPanelScrollport } from './right-panel-scrollport'

async function createFixtureVault(): Promise<string> {
  const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-knowledge-e2e-vault-'))
  await fs.mkdir(path.join(rootPath, 'notes'), { recursive: true })
  await fs.mkdir(path.join(rootPath, 'attachments'), { recursive: true })
  await fs.writeFile(path.join(rootPath, 'notes', 'alpha.md'), '[[beta]]\n', 'utf-8')
  await fs.writeFile(path.join(rootPath, 'notes', 'beta.md'), 'beta body\n', 'utf-8')
  await fs.writeFile(path.join(rootPath, 'notes', 'orphan.md'), 'orphan body\n', 'utf-8')
  return rootPath
}

async function createOrphanOnlyFixtureVault(): Promise<string> {
  const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-knowledge-e2e-vault-'))
  await fs.mkdir(path.join(rootPath, 'notes'), { recursive: true })
  await fs.mkdir(path.join(rootPath, 'attachments'), { recursive: true })
  await fs.writeFile(path.join(rootPath, 'notes', 'orphan.md'), 'orphan body\n', 'utf-8')
  return rootPath
}

async function launchWithFixture(vaultRoot: string): Promise<{
  electronApp: ElectronApplication
  page: Page
}> {
  const userDataPath = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-knowledge-user-'))
  await fs.writeFile(
    path.join(userDataPath, 'settings.json'),
    JSON.stringify({ lastVaultPath: vaultRoot }, null, 2),
    'utf-8'
  )

  const electronApp = await electron.launch({
    args: [`--user-data-dir=${userDataPath}`, '.'],
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
      async () =>
        page.evaluate(async () => {
          try {
            await window.vaultApi.vault.restoreLast()
          } catch {
            // Retry until the temporary fixture vault is fully restorable.
          }

          const knowledgeButton = document.querySelector<HTMLButtonElement>(
            '[data-testid="sidebar-page:knowledge"]'
          )

          if (!knowledgeButton) {
            return 'missing'
          }

          return knowledgeButton.disabled ? 'disabled' : 'enabled'
        }),
      { timeout: 20_000 }
    )
    .toBe('enabled')

  return { electronApp, page }
}

test.describe('knowledge page', () => {
  test('renders the knowledge graph and opens a note from a node click', async () => {
    const vaultRoot = await createFixtureVault()
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await page.getByTestId('sidebar-page:knowledge').click()

      const knowledgePage = page.getByTestId('knowledge-page')
      await expect(knowledgePage).toBeVisible()
      await expect(page.getByLabel('Knowledge graph')).toBeVisible()
      await expect(page.getByTestId('knowledge-empty-state')).toHaveCount(0)
      await expect(page.getByTestId('knowledge-graph-editor')).toBeVisible()
      await expect(page.getByTestId('knowledge-orphan-visibility-panel')).toBeVisible()

      const graphNodes = page.locator('svg[aria-label="Knowledge graph"] circle')
      const nodeCount = await graphNodes.count()
      expect(nodeCount).toBe(3)

      const orphanToggle = page.getByTestId('knowledge-show-orphans')
      await expect(orphanToggle).toBeChecked()
      await orphanToggle.click()
      await expect(graphNodes).toHaveCount(2)
      await expect(orphanToggle).not.toBeChecked()

      await orphanToggle.click()
      await expect(graphNodes).toHaveCount(3)
      await expect(orphanToggle).toBeChecked()

      await graphNodes.first().click()
      await expect(page.getByTestId('note-block-editor')).toBeVisible()
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('renders orphan notes without showing the empty state', async () => {
    const vaultRoot = await createOrphanOnlyFixtureVault()
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await page.getByTestId('sidebar-page:knowledge').click()

      await expect(page.getByLabel('Knowledge graph')).toBeVisible()
      await expect(page.getByTestId('knowledge-empty-state')).toHaveCount(0)
      const graphNodes = page.locator('svg[aria-label="Knowledge graph"] circle')
      await expect(graphNodes).toHaveCount(1)

      const orphanToggle = page.getByTestId('knowledge-show-orphans')
      await orphanToggle.click()
      await expect(orphanToggle).not.toBeChecked()
      await expect(graphNodes).toHaveCount(0)
      const emptyState = page.getByTestId('knowledge-empty-state')
      await expect(emptyState).toBeVisible()
      await expect(
        emptyState.getByRole('heading', { name: 'No note connections yet' })
      ).toBeVisible()

      await orphanToggle.click()
      await expect(orphanToggle).toBeChecked()
      await expect(graphNodes).toHaveCount(1)
      await expect(page.getByTestId('knowledge-empty-state')).toHaveCount(0)
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('keeps knowledge settings sections in one shared scrollport', async () => {
    const vaultRoot = await createFixtureVault()
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await page.setViewportSize({ width: 1440, height: 360 })
      await page.getByTestId('sidebar-page:knowledge').click()
      await expect(page.getByTestId('knowledge-graph-editor')).toBeVisible()
      await expect(page.getByTestId('knowledge-orphan-visibility-panel')).toBeVisible()
      await expectSingleRightPanelScrollport(page)

      const rightPanel = page.getByTestId('workspace-right-panel')
      const sharedScrollport = rightPanel.locator('[data-workspace-scrollport="true"]')
      await expect
        .poll(() =>
          sharedScrollport.evaluate((element) => element.scrollHeight > element.clientHeight)
        )
        .toBe(true)
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })
})
