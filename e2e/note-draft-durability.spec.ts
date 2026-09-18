import { test, expect, type Page } from '@playwright/test'
import { _electron as electron, type ElectronApplication } from 'playwright'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  createStoredNoteDocumentFromText,
  parseStoredNoteDocument,
  serializeStoredNoteDocument
} from '../src/shared/noteDocument'
import type { StoredNoteDocument } from '../src/shared/types'

declare global {
  interface Window {
    vaultApi: {
      vault: {
        restoreLast: () => Promise<unknown>
      }
      files: {
        writeNoteDocumentWithRevision: (request: unknown) => Promise<unknown>
      }
    }
  }
}

async function createFixtureVault(
  rootPath: string,
  notePath: string,
  noteContent: string
): Promise<void> {
  const absoluteNotePath = path.join(rootPath, 'notebooks', notePath)
  await Promise.all([
    fs.mkdir(path.dirname(absoluteNotePath), { recursive: true }),
    fs.mkdir(path.join(rootPath, 'attachments'), { recursive: true }),
    fs.mkdir(path.join(rootPath, 'schedules'), { recursive: true })
  ])
  await fs.writeFile(path.join(rootPath, 'schedules', 'jobs.json'), '[]', 'utf8')
  await fs.writeFile(
    absoluteNotePath,
    serializeStoredNoteDocument(createStoredNoteDocumentFromText(noteContent)),
    'utf8'
  )
}

async function launchWithSavedVaults(
  vaultA: string,
  vaultB: string | null
): Promise<{
  electronApp: ElectronApplication
  page: Page
  userDataPath: string
}> {
  const userDataPath = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-note-draft-user-'))
  const now = new Date().toISOString()
  await fs.writeFile(
    path.join(userDataPath, 'settings.json'),
    JSON.stringify(
      {
        lastVaultPath: vaultA,
        savedVaults: [
          { rootPath: vaultA, addedAt: now, lastOpenedAt: now, isFavorite: false },
          ...(vaultB
            ? [{ rootPath: vaultB, addedAt: now, lastOpenedAt: null, isFavorite: false }]
            : [])
        ]
      },
      null,
      2
    ),
    'utf8'
  )

  const electronApp = await electron.launch({
    args: [`--user-data-dir=${userDataPath}`, '.'],
    cwd: process.cwd(),
    env: { ...process.env, CI: '1' }
  })
  const page = await electronApp.firstWindow()

  await page.waitForLoadState('domcontentloaded')
  await page.waitForFunction(() => typeof window.vaultApi?.vault?.restoreLast === 'function')
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const commandPalette = document.querySelector<HTMLButtonElement>(
            '[data-testid="sidebar-command-palette"]'
          )
          return commandPalette ? !commandPalette.disabled : false
        }),
      { timeout: 60_000 }
    )
    .toBe(true)

  return { electronApp, page, userDataPath }
}

async function openNote(page: Page, relPath: string): Promise<void> {
  await page.getByTestId('sidebar-page:notes').click()
  const noteRow = page.getByTestId(`note-tree-row:${relPath}`)
  await expect(noteRow).toBeVisible({ timeout: 60_000 })
  await noteRow.click()
  await expect(
    page.locator('[data-testid="note-block-editor"] [contenteditable="true"]').first()
  ).toBeVisible({ timeout: 15_000 })
}

async function replaceEditorContent(page: Page, content: string): Promise<void> {
  const editor = page.locator('[data-testid="note-block-editor"] [contenteditable="true"]').first()
  await editor.click()
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A')
  await page.keyboard.press('Backspace')
  await page.keyboard.type(content)
}

async function delayRevisionWrites(page: Page, delayMs: number): Promise<void> {
  await page.evaluate((nextDelayMs) => {
    const files = window.vaultApi.files as unknown as {
      writeNoteDocumentWithRevision: (request: unknown) => Promise<unknown>
    }
    const original = files.writeNoteDocumentWithRevision.bind(files)
    files.writeNoteDocumentWithRevision = async (request: unknown): Promise<unknown> => {
      await new Promise((resolve) => window.setTimeout(resolve, nextDelayMs))
      return original(request)
    }
  }, delayMs)
}

async function readNoteFromDisk(vaultRoot: string, relPath: string): Promise<StoredNoteDocument> {
  const raw = await fs.readFile(path.join(vaultRoot, 'notebooks', relPath), 'utf8')
  return parseStoredNoteDocument(raw)
}

test('does not lose a note draft when the app closes before the autosave completes', async () => {
  const vaultRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-note-shutdown-vault-'))
  let electronApp: ElectronApplication | null = null
  let userDataPath: string | null = null
  let page: Page

  try {
    await createFixtureVault(vaultRoot, 'alpha.md', 'Original note')
    ;({ electronApp, page, userDataPath } = await launchWithSavedVaults(vaultRoot, null))
    await openNote(page, 'alpha.md')
    await delayRevisionWrites(page, 10_000)
    await replaceEditorContent(page, 'Draft that must survive shutdown')
    await page.waitForTimeout(100)

    await electronApp.close()
    electronApp = null

    const persisted = await readNoteFromDisk(vaultRoot, 'alpha.md')
    expect(persisted.markdown).toContain('Draft that must survive shutdown')
  } finally {
    await electronApp?.close().catch(() => undefined)
    await fs.rm(vaultRoot, { recursive: true, force: true })
    if (userDataPath) {
      await fs.rm(userDataPath, { recursive: true, force: true })
    }
  }
})

test('does not lose a note draft when switching vaults before the save completes', async () => {
  const parentRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-note-vault-switch-'))
  const vaultA = path.join(parentRoot, 'vault-a')
  const vaultB = path.join(parentRoot, 'vault-b')
  let electronApp: ElectronApplication | null = null
  let userDataPath: string | null = null
  let page: Page

  try {
    await createFixtureVault(vaultA, 'alpha.md', 'Original note')
    await createFixtureVault(vaultB, 'beta.md', 'Other vault')
    ;({ electronApp, page, userDataPath } = await launchWithSavedVaults(vaultA, vaultB))
    await openNote(page, 'alpha.md')
    await delayRevisionWrites(page, 10_000)
    await replaceEditorContent(page, 'Draft that must survive a vault switch')
    await page.waitForTimeout(100)

    await page.getByTestId('sidebar-vault-manager').click()
    const dialog = page.getByRole('dialog', { name: 'Manage vaults' })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Switch to vault-b' }).click()
    await expect(page.getByTestId('note-tree-row:beta.md')).toBeVisible({ timeout: 60_000 })

    const persisted = await readNoteFromDisk(vaultA, 'alpha.md')
    expect(persisted.markdown).toContain('Draft that must survive a vault switch')
  } finally {
    await electronApp?.close().catch(() => undefined)
    await fs.rm(parentRoot, { recursive: true, force: true })
    if (userDataPath) {
      await fs.rm(userDataPath, { recursive: true, force: true })
    }
  }
})

test('keeps the current vault and draft when a vault switch encounters a save conflict', async () => {
  const parentRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-note-vault-failure-'))
  const vaultA = path.join(parentRoot, 'vault-a')
  const vaultB = path.join(parentRoot, 'vault-b')
  let electronApp: ElectronApplication | null = null
  let userDataPath: string | null = null
  let page: Page

  try {
    await createFixtureVault(vaultA, 'alpha.md', 'Original note')
    await createFixtureVault(vaultB, 'beta.md', 'Other vault')
    ;({ electronApp, page, userDataPath } = await launchWithSavedVaults(vaultA, vaultB))
    await openNote(page, 'alpha.md')
    await replaceEditorContent(page, 'Draft that must remain visible')
    await page.waitForTimeout(100)
    await fs.writeFile(
      path.join(vaultA, 'notebooks', 'alpha.md'),
      serializeStoredNoteDocument(createStoredNoteDocumentFromText('External update')),
      'utf8'
    )

    await page.getByTestId('sidebar-vault-manager').click()
    const dialog = page.getByRole('dialog', { name: 'Manage vaults' })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Switch to vault-b' }).click()

    await expect(page.getByTestId('note-block-editor')).toContainText(
      'Draft that must remain visible'
    )
    await expect(page.getByTestId('note-tree-row:beta.md')).toHaveCount(0)
    const persisted = await readNoteFromDisk(vaultA, 'alpha.md')
    expect(persisted.markdown).toContain('External update')
  } finally {
    await electronApp
      ?.evaluate(({ app }) => {
        app.exit(0)
      })
      .catch(() => undefined)
    await electronApp?.close().catch(() => undefined)
    await fs.rm(parentRoot, { recursive: true, force: true })
    if (userDataPath) {
      await fs.rm(userDataPath, { recursive: true, force: true })
    }
  }
})
