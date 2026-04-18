import { test, expect, Page } from '@playwright/test'
import { _electron as electron, ElectronApplication } from 'playwright'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  createStoredNoteDocumentFromText,
  serializeStoredNoteDocument
} from '../src/shared/noteDocument'
import { StoredNoteDocument } from '../src/shared/types'

declare global {
  interface Window {
    vaultApi: {
      files: {
        listTree: () => Promise<Array<{ id: string }>>
        renamePath: (fromRelPath: string, toRelPath: string) => Promise<void>
        readNoteDocument: (relPath: string) => Promise<{ tags: string[] }>
        writeNoteDocument: (relPath: string, document: StoredNoteDocument) => Promise<void>
      }
      vault: {
        restoreLast: () => Promise<unknown>
      }
    }
    __XINGULARITY_E2E__?: {
      getCurrentNoteSnapshot: () =>
        | { path: string | null; content: string }
        | Promise<{ path: string | null; content: string }>
    }
  }
}

async function createFixtureVault(): Promise<string> {
  const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-note-tree-e2e-vault-'))
  await fs.mkdir(path.join(rootPath, 'notes'), { recursive: true })
  await fs.mkdir(path.join(rootPath, 'notes', 'archive'), { recursive: true })
  await fs.mkdir(path.join(rootPath, 'attachments'), { recursive: true })
  await fs.mkdir(path.join(rootPath, '.xingularity'), { recursive: true })
  await fs.writeFile(
    path.join(rootPath, 'notes', 'alpha.md'),
    serializeStoredNoteDocument(createStoredNoteDocumentFromText('Alpha note\n')),
    'utf-8'
  )
  await fs.writeFile(
    path.join(rootPath, 'notes', 'beta.md'),
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

async function openNote(page: Page, relPath: string): Promise<void> {
  const row = page.getByTestId(`note-tree-row:${relPath}`)
  await expect(row).toBeVisible({ timeout: 20_000 })
  await row.click()
  await expect(page.getByTestId('note-block-editor')).toBeVisible({ timeout: 20_000 })
}

async function getCurrentNoteSnapshot(
  page: Page
): Promise<{ path: string | null; content: string }> {
  return page.evaluate(() => window.__XINGULARITY_E2E__!.getCurrentNoteSnapshot())
}

test.describe('notes tree view', () => {
  test('renames a note from the tree view', async () => {
    const vaultRoot = await createFixtureVault()
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await expect(page.getByTestId('note-panel-toggle:tree')).toHaveAttribute('data-state', 'on')
      await expect
        .poll(async () =>
          page.evaluate(() => window.vaultApi.files.listTree().then((tree) => tree.length))
        )
        .toBe(4)

      const alphaRow = page.getByTestId('note-tree-row:alpha.md')
      await expect(alphaRow).toBeVisible({ timeout: 20_000 })

      await alphaRow.hover()
      await page.getByTestId('note-tree-rename:alpha.md').click()

      const renameInput = page.getByTestId('note-tree-input:alpha.md')
      await expect(renameInput).toBeVisible()
      await renameInput.fill('alpha-renamed')
      await renameInput.press('Enter')

      await expect
        .poll(async () => {
          try {
            await fs.access(path.join(vaultRoot, 'notes', 'alpha-renamed.md'))
            return true
          } catch {
            return false
          }
        })
        .toBe(true)

      await expect
        .poll(async () => {
          try {
            await fs.access(path.join(vaultRoot, 'notes', 'alpha.md'))
            return true
          } catch {
            return false
          }
        })
        .toBe(false)

      await expect(page.getByTestId('note-tree-row:alpha-renamed.md')).toBeVisible()
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('expands and collapses a folder when clicking the folder card', async () => {
    const vaultRoot = await createFixtureVault()
    await fs.writeFile(
      path.join(vaultRoot, 'notes', 'archive', 'nested.md'),
      serializeStoredNoteDocument(createStoredNoteDocumentFromText('Nested note\n')),
      'utf-8'
    )
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      const archiveRow = page.getByTestId('note-tree-row:archive')
      const nestedRow = page.getByTestId('note-tree-row:archive/nested.md')
      await expect(archiveRow).toBeVisible({ timeout: 20_000 })
      await expect(nestedRow).toHaveCount(0)

      await archiveRow.click()
      await expect(nestedRow).toBeVisible({ timeout: 20_000 })

      await archiveRow.click()
      await expect(nestedRow).toHaveCount(0)
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('opens note and folder action menus and focuses new folder rename input', async () => {
    const vaultRoot = await createFixtureVault()
    await fs.writeFile(
      path.join(vaultRoot, 'notes', 'archive', 'nested.md'),
      serializeStoredNoteDocument(createStoredNoteDocumentFromText('Nested note\n')),
      'utf-8'
    )
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      const alphaRow = page.getByTestId('note-tree-row:alpha.md')
      await expect(alphaRow).toBeVisible({ timeout: 20_000 })
      await alphaRow.hover()
      await page.getByTestId('note-tree-menu:alpha.md').click()
      await expect(page.getByRole('menuitem', { name: 'Rename' })).toBeVisible()
      await page.keyboard.press('Escape')

      const archiveRow = page.getByTestId('note-tree-row:archive')
      const nestedRow = page.getByTestId('note-tree-row:archive/nested.md')
      await expect(archiveRow).toBeVisible({ timeout: 20_000 })
      await expect(nestedRow).toHaveCount(0)

      await archiveRow.hover()
      await page.getByTestId('note-tree-menu:archive').click()
      await expect(page.getByRole('menuitem', { name: 'New folder' })).toBeVisible()
      await expect(nestedRow).toHaveCount(0)

      await page.getByTestId('note-tree-create-folder:archive').click()
      await expect
        .poll(async () =>
          page.evaluate(() =>
            window.vaultApi.files
              .listTree()
              .then((tree) => JSON.stringify(tree.map((entry) => entry.id)))
          )
        )
        .toContain('folder:archive/untitled-folder')
      const renameInput = page.getByTestId('note-tree-input:archive/untitled-folder')
      await expect(renameInput).toBeVisible({ timeout: 20_000 })
      await expect(renameInput).toBeFocused()
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('hides protected project folders from the explorer and syncs note tags when moving into them', async () => {
    const vaultRoot = await createFixtureVault()
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      const projectsRow = page.getByTestId('note-tree-row:Projects')
      await expect(projectsRow).toHaveCount(0)
      await expect
        .poll(async () =>
          page.evaluate(() =>
            window.vaultApi.files.listTree().then((tree) => {
              const projects = tree.find((entry) => entry.id === 'folder:Projects') as
                | {
                    isProtected?: boolean
                    children?: Array<{ relPath: string; isProtected?: boolean }>
                  }
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
      await page.evaluate(() =>
        window.vaultApi.files.renamePath('alpha.md', 'Projects/Alpha Project/alpha.md')
      )

      await expect
        .poll(async () => {
          try {
            await fs.access(path.join(vaultRoot, 'notes', 'Projects', 'Alpha Project', 'alpha.md'))
            return true
          } catch {
            return false
          }
        })
        .toBe(true)

      await expect
        .poll(async () => {
          const document = await page.evaluate(() =>
            window.vaultApi.files.readNoteDocument('Projects/Alpha Project/alpha.md')
          )
          return document.tags
        })
        .toContain('project:alpha-project')
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('keeps the open note body and tags visible after moving the note into a different folder', async () => {
    const vaultRoot = await createFixtureVault()
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await page.evaluate(() =>
        window.vaultApi.files.writeNoteDocument('alpha.md', {
          version: 1,
          tags: ['alpha'],
          markdown: 'Alpha note survives move'
        })
      )

      const archiveRow = page.getByTestId('note-tree-row:archive')
      await expect(archiveRow).toBeVisible({ timeout: 20_000 })

      await openNote(page, 'alpha.md')
      await expect
        .poll(async () => (await getCurrentNoteSnapshot(page)).content)
        .toContain('Alpha note survives move')
      await expect(page.getByLabel('Search tag alpha')).toBeVisible()

      await page.getByTestId('note-tree-row:alpha.md').dragTo(archiveRow)

      await expect(page.getByTestId('note-tree-row:archive/alpha.md')).toBeVisible({
        timeout: 20_000
      })
      await expect
        .poll(async () => (await getCurrentNoteSnapshot(page)).content)
        .toContain('Alpha note survives move')
      await expect(page.getByLabel('Search tag alpha')).toBeVisible()
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })
})
