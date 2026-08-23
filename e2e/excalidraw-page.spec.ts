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

async function writeDrawingFixture(rootPath: string, relPath: string): Promise<void> {
  const absolutePath = path.join(rootPath, 'notebooks', relPath)
  await fs.mkdir(path.dirname(absolutePath), { recursive: true })
  await fs.writeFile(
    absolutePath,
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

async function createFixtureVault(
  includeDrawing = true,
  drawingRelPath = 'debug.excalidraw'
): Promise<string> {
  const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-excalidraw-e2e-vault-'))
  await fs.mkdir(path.join(rootPath, 'notebooks'), { recursive: true })
  await fs.mkdir(path.join(rootPath, 'attachments'), { recursive: true })
  if (includeDrawing) {
    await writeDrawingFixture(rootPath, drawingRelPath)
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

    const canvas = page.locator('.excalidraw canvas').last()
    await expect(canvas).toBeVisible()
    const canvasBounds = await canvas.boundingBox()
    if (!canvasBounds) {
      throw new Error('Expected the Excalidraw canvas to have a bounding box')
    }
    await page.mouse.move(canvasBounds.x + 120, canvasBounds.y + 120)
    await page.mouse.down()
    await page.mouse.move(canvasBounds.x + 240, canvasBounds.y + 180, { steps: 4 })
    await page.mouse.up()

    await page.getByTestId(`note-tree-menu:${createdPath}`).click()
    await page.getByRole('menuitem', { name: 'Rename', exact: true }).click()
    const escapeRenameInput = page.getByTestId(`note-tree-input:${createdPath}`)
    await expect(escapeRenameInput).toBeVisible()
    await expect(escapeRenameInput).toBeFocused()
    await escapeRenameInput.press('Escape')
    await expect(createdRow).toBeVisible()

    await page.getByTestId(`note-tree-menu:${createdPath}`).click()
    await page.getByRole('menuitem', { name: 'Rename', exact: true }).click()
    const blankRenameInput = page.getByTestId(`note-tree-input:${createdPath}`)
    await expect(blankRenameInput).toBeFocused()
    await blankRenameInput.fill('   ')
    await blankRenameInput.press('Enter')
    await expect(createdRow).toBeVisible()

    await page.getByTestId(`note-tree-menu:${createdPath}`).click()
    await page.getByRole('menuitem', { name: 'Rename', exact: true }).click()
    const renameInput = page.getByTestId(`note-tree-input:${createdPath}`)
    await expect(renameInput).toBeVisible()
    await expect(renameInput).toBeFocused()
    await renameInput.fill('renamed-drawing.excalidraw')
    await renameInput.press('Enter')

    const renamedPath = 'renamed-drawing.excalidraw'
    await expect(page.getByTestId(`note-tree-row:${renamedPath}`)).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId(`note-tree-row:${createdPath}`)).toHaveCount(0)
    await expect(page.locator('.excalidraw')).toBeVisible({ timeout: 20_000 })
    const renamedContent = JSON.parse(
      await fs.readFile(path.join(vaultRoot, 'notebooks', renamedPath), 'utf-8')
    ) as { scene?: { elements?: unknown[] } }
    expect(renamedContent.scene?.elements?.length ?? 0).toBeGreaterThan(0)
    await expect(fs.access(path.join(vaultRoot, 'notebooks', renamedPath))).resolves.toBeUndefined()
    await expect(fs.access(path.join(vaultRoot, 'notebooks', createdPath))).rejects.toThrow()
    await expect(page.getByText('Drawing renamed', { exact: true })).toBeVisible()

    page.once('dialog', (dialog) => dialog.accept())
    await page.getByTestId(`note-tree-menu:${renamedPath}`).click()
    await page.getByRole('menuitem', { name: 'Delete', exact: true }).click()

    await expect(page.getByTestId(`note-tree-row:${renamedPath}`)).toHaveCount(0)
    await expect(page.locator('.excalidraw')).toHaveCount(0)
    await expect(page.getByTestId('notebook-card-browser')).toBeVisible()
    await expect(fs.access(path.join(vaultRoot, 'notebooks', renamedPath))).rejects.toThrow()
    await expect(page.getByText('Drawing deleted', { exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Notebook actions' }).click()
    await page.getByRole('menuitem', { name: 'New drawing', exact: true }).click()

    const recreatedPath = 'untitled-drawing.excalidraw'
    await expect(page.getByTestId(`note-tree-row:${recreatedPath}`)).toBeVisible({
      timeout: 20_000
    })
    await expect(page.locator('.excalidraw')).toBeVisible({ timeout: 20_000 })
    await expect(
      fs.access(path.join(vaultRoot, 'notebooks', recreatedPath))
    ).resolves.toBeUndefined()

    page.once('dialog', (dialog) => dialog.accept())
    await page.getByTestId(`note-tree-menu:${recreatedPath}`).click()
    await page.getByRole('menuitem', { name: 'Delete', exact: true }).click()
    await expect(page.getByTestId(`note-tree-row:${recreatedPath}`)).toHaveCount(0)
  } finally {
    await electronApp.close()
    await fs.rm(vaultRoot, { recursive: true, force: true })
    await fs.rm(userDataPath, { recursive: true, force: true })
  }
})

test('deletes an Excalidraw file safely while it is still loading', async () => {
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

    const drawingPath = 'untitled-drawing.excalidraw'
    const drawingRow = page.getByTestId(`note-tree-row:${drawingPath}`)
    await expect(drawingRow).toBeVisible({ timeout: 20_000 })

    page.once('dialog', (dialog) => dialog.accept())
    await page.getByTestId(`note-tree-menu:${drawingPath}`).click()
    await page.getByRole('menuitem', { name: 'Delete', exact: true }).click()

    await expect(drawingRow).toHaveCount(0)
    await expect(page.getByTestId('notebook-card-browser')).toBeVisible()
    await expect(page.getByText('Fatal Application Error', { exact: true })).toHaveCount(0)
    await expect(page.getByText(/read-excalidraw-file-document|ENOENT/)).toHaveCount(0)
  } finally {
    await electronApp.close()
    await fs.rm(vaultRoot, { recursive: true, force: true })
    await fs.rm(userDataPath, { recursive: true, force: true })
  }
})

test('syncs externally added and removed Excalidraw files', async () => {
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

    const externalPath = 'external-drawing.excalidraw'
    await writeDrawingFixture(vaultRoot, externalPath)
    await expect(page.getByTestId(`note-tree-row:${externalPath}`)).toBeVisible({ timeout: 20_000 })

    await fs.rm(path.join(vaultRoot, 'notebooks', externalPath))
    await expect(page.getByTestId(`note-tree-row:${externalPath}`)).toHaveCount(0, {
      timeout: 20_000
    })
  } finally {
    await electronApp.close()
    await fs.rm(vaultRoot, { recursive: true, force: true })
    await fs.rm(userDataPath, { recursive: true, force: true })
  }
})

test('renames a nested Excalidraw file without changing its folder', async () => {
  const vaultRoot = await createFixtureVault(true, 'projects/debug.excalidraw')
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

    const originalPath = 'projects/debug.excalidraw'
    await page.getByTestId('note-tree-row:projects').click()
    await page.getByTestId(`note-tree-row:${originalPath}`).click()
    await expect(page.locator('.excalidraw')).toBeVisible({ timeout: 20_000 })
    await page.getByTestId(`note-tree-menu:${originalPath}`).click()
    await page.getByRole('menuitem', { name: 'Rename', exact: true }).click()
    await page.getByTestId(`note-tree-input:${originalPath}`).fill('renamed-drawing')
    await page.getByTestId(`note-tree-input:${originalPath}`).press('Enter')

    const renamedPath = 'projects/renamed-drawing.excalidraw'
    await expect(page.getByTestId(`note-tree-row:${renamedPath}`)).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId(`note-tree-row:${originalPath}`)).toHaveCount(0)
    await expect(fs.access(path.join(vaultRoot, 'notebooks', renamedPath))).resolves.toBeUndefined()
    await expect(fs.access(path.join(vaultRoot, 'notebooks', originalPath))).rejects.toThrow()
    await expect(page.locator('.excalidraw')).toBeVisible({ timeout: 20_000 })
  } finally {
    await electronApp.close()
    await fs.rm(vaultRoot, { recursive: true, force: true })
    await fs.rm(userDataPath, { recursive: true, force: true })
  }
})

test('keeps the original drawing when the rename target already exists', async () => {
  const vaultRoot = await createFixtureVault(false)
  await writeDrawingFixture(vaultRoot, 'existing.excalidraw')
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

    const sourcePath = 'untitled-drawing.excalidraw'
    await expect(page.getByTestId(`note-tree-row:${sourcePath}`)).toBeVisible({ timeout: 20_000 })
    await page.getByTestId(`note-tree-menu:${sourcePath}`).click()
    await page.getByRole('menuitem', { name: 'Rename', exact: true }).click()
    await page.getByTestId(`note-tree-input:${sourcePath}`).fill('existing.excalidraw')
    await page.getByTestId(`note-tree-input:${sourcePath}`).press('Enter')

    await expect(page.getByTestId(`note-tree-row:${sourcePath}`)).toBeVisible()
    await expect(page.getByTestId('note-tree-row:existing.excalidraw')).toBeVisible()
    await expect(fs.access(path.join(vaultRoot, 'notebooks', sourcePath))).resolves.toBeUndefined()
    await expect(
      fs.access(path.join(vaultRoot, 'notebooks', 'existing.excalidraw'))
    ).resolves.toBeUndefined()
    await expect(page.locator('.excalidraw')).toBeVisible({ timeout: 20_000 })
  } finally {
    await electronApp.close()
    await fs.rm(vaultRoot, { recursive: true, force: true })
    await fs.rm(userDataPath, { recursive: true, force: true })
  }
})
