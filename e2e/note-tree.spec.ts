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
      files: {
        listTree: () => Promise<Array<{ id: string }>>
        renamePath: (fromRelPath: string, toRelPath: string) => Promise<void>
        readNoteDocument: (relPath: string) => Promise<{ tags: string[] }>
      }
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
  await fs.mkdir(path.join(rootPath, '.xingularity'), { recursive: true })
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
  await fs.writeFile(
    path.join(rootPath, '.xingularity', 'settings.json'),
    JSON.stringify(
      {
        projects: [
          {
            id: 'project-1',
            name: 'Alpha Project',
            summary: '',
            status: 'on-track',
            updatedAt: '2026-04-02T00:00:00.000Z',
            progress: 0,
            milestones: [],
            icon: {
              shape: 'circle',
              variant: 'filled',
              color: '#000000'
            }
          }
        ]
      },
      null,
      2
    ),
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
  await page.getByTestId('sidebar-page:notes').click()
  await expect(page.getByTestId('note-panel-toggle:tree')).toBeVisible({ timeout: 20_000 })

  return { electronApp, page }
}

test.describe('notes tree view', () => {
  test('renames a note from the tree view', async () => {
    const vaultRoot = await createFixtureVault()
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await expect(page.getByTestId('note-panel-toggle:tree')).toHaveAttribute('data-state', 'on')
      await expect
        .poll(async () => page.evaluate(() => window.vaultApi.files.listTree().then((tree) => tree.length)))
        .toBe(3)

      const alphaRow = page.getByTestId('note-tree-row:alpha.xnote')
      await expect(alphaRow).toBeVisible({ timeout: 20_000 })

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

  test('shows protected project folders and syncs note tags when moving into them', async () => {
    const vaultRoot = await createFixtureVault()
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      const projectsRow = page.getByTestId('note-tree-row:Projects')
      await expect(projectsRow).toBeVisible({ timeout: 20_000 })
      await expect
        .poll(async () =>
          page.evaluate(() =>
            window.vaultApi.files.listTree().then((tree) => {
              const projects = tree.find((entry) => entry.id === 'folder:Projects') as
                | { isProtected?: boolean; children?: Array<{ relPath: string; isProtected?: boolean }> }
                | undefined
              return {
                isProtected: projects?.isProtected ?? false,
                childPaths: projects?.children?.map((child) => child.relPath) ?? [],
                childProtected: projects?.children?.map((child) => child.isProtected ?? false) ?? []
              }
            })
          )
        )
        .toEqual({
          isProtected: true,
          childPaths: ['Projects/Alpha Project'],
          childProtected: [true]
        })
      await expect(page.getByTestId('note-tree-rename:Projects')).toHaveCount(0)

      await page.evaluate(() =>
        window.vaultApi.files.renamePath('alpha.xnote', 'Projects/Alpha Project/alpha.xnote')
      )

      await expect
        .poll(async () => {
          try {
            await fs.access(path.join(vaultRoot, 'notes', 'Projects', 'Alpha Project', 'alpha.xnote'))
            return true
          } catch {
            return false
          }
        })
        .toBe(true)

      await expect
        .poll(async () => {
          const document = await page.evaluate(() =>
            window.vaultApi.files.readNoteDocument('Projects/Alpha Project/alpha.xnote')
          )
          return document.tags
        })
        .toContain('project:alpha-project')
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })
})
