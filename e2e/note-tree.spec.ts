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
  const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-note-tree-e2e-vault-'))
  await fs.mkdir(path.join(rootPath, 'notes'), { recursive: true })
  await fs.mkdir(path.join(rootPath, 'attachments'), { recursive: true })
  await fs.writeFile(
    path.join(rootPath, 'notes', 'alpha.xnote'),
    serializeStoredNoteDocument(createStoredNoteDocumentFromText('Alpha note\n')),
    'utf-8'
  )
  await fs.writeFile(
    path.join(rootPath, 'notes', 'beta.xnote'),
    serializeStoredNoteDocument(createStoredNoteDocumentFromText('Beta note\n')),
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
  await expect(page.getByTestId('note-preview:alpha.xnote')).toBeVisible({ timeout: 20_000 })

  return { electronApp, page }
}

test.describe('notes tree view', () => {
  test('renames a note from the tree view', async () => {
    const vaultRoot = await createFixtureVault()
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await page.getByTestId('note-panel-toggle:tree').click()
      await expect(page.getByTestId('notes-tree-view')).toBeVisible()

      const alphaRow = page.getByTestId('note-tree-row:alpha.xnote')
      await expect(alphaRow).toBeVisible()

      await alphaRow.hover()
      await page.getByTestId('note-tree-rename:alpha.xnote').click()

      const renameInput = page.getByTestId('note-tree-input:alpha.xnote')
      await expect(renameInput).toBeVisible()
      await renameInput.fill('alpha-renamed')
      await renameInput.press('Enter')

      await expect
        .poll(async () => {
          try {
            await fs.access(path.join(vaultRoot, 'notes', 'alpha-renamed.xnote'))
            return true
          } catch {
            return false
          }
        })
        .toBe(true)

      await expect
        .poll(async () => {
          try {
            await fs.access(path.join(vaultRoot, 'notes', 'alpha.xnote'))
            return true
          } catch {
            return false
          }
        })
        .toBe(false)

      await expect(page.getByTestId('note-tree-row:alpha-renamed.xnote')).toBeVisible()
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })
})
