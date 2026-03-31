import { test, expect, Page } from '@playwright/test'
import { _electron as electron, ElectronApplication } from 'playwright'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

function serializeNote(blocks: unknown[]): string {
  return JSON.stringify(
    {
      version: 1,
      tags: [],
      blocks
    },
    null,
    2
  )
}

async function createFixtureVault(): Promise<string> {
  const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-knowledge-e2e-vault-'))
  await fs.mkdir(path.join(rootPath, 'notes'), { recursive: true })
  await fs.mkdir(path.join(rootPath, 'attachments'), { recursive: true })
  await fs.writeFile(
    path.join(rootPath, 'notes', 'alpha.xnote'),
    serializeNote([
      {
        type: 'paragraph',
        content: [
          {
            type: 'link',
            href: 'note-mention://beta',
            content: 'beta'
          }
        ]
      }
    ]),
    'utf-8'
  )
  await fs.writeFile(
    path.join(rootPath, 'notes', 'beta.xnote'),
    serializeNote([{ type: 'paragraph', content: 'beta body' }]),
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
  await page.evaluate(() => window.vaultApi.vault.restoreLast())
  await expect(page.getByTestId('sidebar-page:knowledge')).toBeVisible({ timeout: 20_000 })

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

      const graphNodes = page.locator('svg[aria-label="Knowledge graph"] circle')
      const nodeCount = await graphNodes.count()
      expect(nodeCount).toBeGreaterThan(0)

      await graphNodes.first().click()
      await expect(page.getByTestId('note-block-editor')).toBeVisible()
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })
})
