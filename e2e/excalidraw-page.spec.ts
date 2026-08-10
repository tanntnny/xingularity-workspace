import { test, expect } from '@playwright/test'
import { _electron as electron } from 'playwright'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

declare global {
  interface Window {
    vaultApi: {
      vault: {
        restoreLast: () => Promise<unknown>
      }
    }
  }
}

async function createFixtureVault(includeDrawing = true): Promise<string> {
  const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-excalidraw-e2e-vault-'))
  await fs.mkdir(path.join(rootPath, 'notebooks'), { recursive: true })
  await fs.mkdir(path.join(rootPath, 'attachments'), { recursive: true })
  if (includeDrawing) {
    await fs.writeFile(
      path.join(rootPath, 'notebooks', 'debug.excalidraw'),
      JSON.stringify(
        {
          version: 1,
          scene: {
            type: 'excalidraw',
            version: 2,
            source: 'https://excalidraw.com',
            elements: [],
            appState: { viewBackgroundColor: 'transparent' },
            files: {}
          }
        },
        null,
        2
      ),
      'utf-8'
    )
  }
  return rootPath
}

test('opens an Excalidraw file with a visible canvas', async () => {
  const vaultRoot = await createFixtureVault()
  const userDataPath = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-excalidraw-e2e-user-'))
  await fs.writeFile(
    path.join(userDataPath, 'settings.json'),
    JSON.stringify({ lastVaultPath: vaultRoot }, null, 2),
    'utf-8'
  )
  const electronApp = await electron.launch({
    args: [`--user-data-dir=${userDataPath}`, '.'],
    cwd: process.cwd(),
    env: { ...process.env, CI: '1' }
  })

  try {
    const page = await electronApp.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByTestId('sidebar-page:notes')).toBeVisible({ timeout: 20_000 })
    await page.getByTestId('sidebar-page:notes').click()

    const drawingRow = page.getByTestId('note-tree-row:debug.excalidraw')
    await expect(drawingRow).toBeVisible({ timeout: 20_000 })
    await drawingRow.click()

    const canvas = page.locator('.excalidraw')
    await expect(canvas).toBeVisible({ timeout: 20_000 })
    await expect.poll(async () => (await canvas.boundingBox())?.height ?? 0).toBeGreaterThan(0)
  } finally {
    await electronApp.close()
    await fs.rm(vaultRoot, { recursive: true, force: true })
    await fs.rm(userDataPath, { recursive: true, force: true })
  }
})

test('creates, renames, and deletes an Excalidraw file', async () => {
  const vaultRoot = await createFixtureVault(false)
  const userDataPath = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-excalidraw-e2e-user-'))
  await fs.writeFile(
    path.join(userDataPath, 'settings.json'),
    JSON.stringify({ lastVaultPath: vaultRoot }, null, 2),
    'utf-8'
  )
  const electronApp = await electron.launch({
    args: [`--user-data-dir=${userDataPath}`, '.'],
    cwd: process.cwd(),
    env: { ...process.env, CI: '1' }
  })

  try {
    const page = await electronApp.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByTestId('sidebar-page:notes')).toBeVisible({ timeout: 20_000 })
    await page.getByTestId('sidebar-page:notes').click()

    await page.getByRole('button', { name: 'Notebook actions' }).click()
    await page.getByRole('menuitem', { name: 'New drawing', exact: true }).click()

    const createdPath = 'untitled-drawing.excalidraw'
    const createdRow = page.getByTestId(`note-tree-row:${createdPath}`)
    await expect(createdRow).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('.excalidraw')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('Drawing created', { exact: true })).toBeVisible()
    await expect(fs.access(path.join(vaultRoot, 'notebooks', createdPath))).resolves.toBeUndefined()

    await page.getByTestId(`note-tree-menu:${createdPath}`).click()
    await page.getByRole('menuitem', { name: 'Rename', exact: true }).click()
    const renameInput = page.getByTestId(`note-tree-input:${createdPath}`)
    await expect(renameInput).toBeVisible()
    await renameInput.fill('renamed-drawing')
    await renameInput.press('Enter')

    const renamedPath = 'renamed-drawing.excalidraw'
    await expect(page.getByTestId(`note-tree-row:${renamedPath}`)).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId(`note-tree-row:${createdPath}`)).toHaveCount(0)
    await expect(page.locator('.excalidraw')).toBeVisible({ timeout: 20_000 })
    await expect(fs.access(path.join(vaultRoot, 'notebooks', renamedPath))).resolves.toBeUndefined()
    await expect(fs.access(path.join(vaultRoot, 'notebooks', createdPath))).rejects.toThrow()
    await expect(page.getByText('Drawing renamed', { exact: true })).toBeVisible()

    page.once('dialog', (dialog) => dialog.accept())
    await page.getByTestId(`note-tree-menu:${renamedPath}`).click()
    await page.getByRole('menuitem', { name: 'Delete', exact: true }).click()

    await expect(page.getByTestId(`note-tree-row:${renamedPath}`)).toHaveCount(0)
    await expect(page.locator('.excalidraw')).toHaveCount(0)
    await expect(page.getByTestId('notebook-empty-state')).toBeVisible()
    await expect(fs.access(path.join(vaultRoot, 'notebooks', renamedPath))).rejects.toThrow()
    await expect(page.getByText('Drawing deleted', { exact: true })).toBeVisible()
  } finally {
    await electronApp.close()
    await fs.rm(vaultRoot, { recursive: true, force: true })
    await fs.rm(userDataPath, { recursive: true, force: true })
  }
})
