import { test, expect, Page } from '@playwright/test'
import { _electron as electron, ElectronApplication } from 'playwright'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  createStoredNoteDocumentFromText,
  parseStoredNoteDocument,
  serializeStoredNoteDocument
} from '../src/shared/noteDocument'
import { StoredNoteDocument } from '../src/shared/types'

interface NoteSnapshot {
  path: string | null
  content: string
}

interface PageLeaveSaveDebug {
  requestedPage: string | null
  notePath: string | null
  snapshotContent: string
  fingerprint: string | null
  attempted: boolean
  writeCompleted: boolean
  skippedReason: string | null
  lastError: string | null
}

interface VisibleNoteBlock {
  type: string
  text: string
}

function extractPersistedBlockText(content: unknown): string {
  if (typeof content === 'string') {
    return content
  }

  if (Array.isArray(content)) {
    return content.map((item) => extractPersistedBlockText(item)).join('')
  }

  if (!content || typeof content !== 'object') {
    return ''
  }

  if ('text' in content && typeof content.text === 'string') {
    return content.text
  }

  if ('content' in content) {
    return extractPersistedBlockText(content.content)
  }

  return ''
}

function getPersistedVisibleBlocks(document: StoredNoteDocument): VisibleNoteBlock[] {
  const blocks = Array.isArray(document.blocks)
    ? document.blocks.map((block) => {
        const record = block && typeof block === 'object' ? (block as Record<string, unknown>) : {}
        return {
          type: typeof record.type === 'string' ? record.type : '',
          text: extractPersistedBlockText(record.content).trim()
        }
      })
    : []

  return blocks.filter(
    (block, index) =>
      !(index === blocks.length - 1 && block.type === 'paragraph' && block.text.length === 0)
  )
}

declare global {
  interface Window {
    __XINGULARITY_E2E__?: {
      getCurrentNoteSnapshot: () => NoteSnapshot
      getLastPageLeaveSaveDebug: () => PageLeaveSaveDebug
    }
    vaultApi: {
      files: {
        readNote: (relPath: string) => Promise<string>
        writeNote: (relPath: string, content: string) => Promise<void>
        readNoteDocument: (relPath: string) => Promise<StoredNoteDocument>
        writeNoteDocument: (relPath: string, document: StoredNoteDocument) => Promise<void>
      }
      vault: {
        restoreLast: () => Promise<unknown>
      }
    }
  }
}

async function createFixtureVault(alphaContent: string): Promise<string> {
  const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-e2e-vault-'))
  await fs.mkdir(path.join(rootPath, 'notes'), { recursive: true })
  await fs.mkdir(path.join(rootPath, 'attachments'), { recursive: true })
  await fs.writeFile(
    path.join(rootPath, 'notes', 'alpha.xnote'),
    serializeStoredNoteDocument(createStoredNoteDocumentFromText(alphaContent)),
    'utf-8'
  )
  await fs.writeFile(
    path.join(rootPath, 'notes', 'beta.xnote'),
    serializeStoredNoteDocument(createStoredNoteDocumentFromText('Side note\n')),
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
  await page.waitForFunction(() => typeof window.vaultApi?.vault?.restoreLast === 'function')
  await page.waitForFunction(
    () => typeof window.__XINGULARITY_E2E__?.getLastPageLeaveSaveDebug === 'function'
  )
  const notesPageButton = page.getByTestId('sidebar-page:notes')
  await expect
    .poll(
      async () =>
        page.evaluate(async () => {
          try {
            await window.vaultApi.vault.restoreLast()
          } catch {
            // Retry until the temporary fixture vault is fully restorable.
          }

          const notesButton = document.querySelector<HTMLButtonElement>(
            '[data-testid="sidebar-page:notes"]'
          )

          if (!notesButton) {
            return 'missing'
          }

          return notesButton.disabled ? 'disabled' : 'enabled'
        }),
      { timeout: 20_000 }
    )
    .toBe('enabled')
  await notesPageButton.click()
  await expect(page.getByTestId('note-panel-toggle:tree')).toBeVisible({ timeout: 20_000 })

  return { electronApp, page }
}

async function getCurrentNoteSnapshot(page: Page): Promise<NoteSnapshot> {
  return page.evaluate(() => window.__XINGULARITY_E2E__!.getCurrentNoteSnapshot())
}

async function getLastPageLeaveSaveDebug(page: Page): Promise<PageLeaveSaveDebug> {
  return page.evaluate(() => window.__XINGULARITY_E2E__!.getLastPageLeaveSaveDebug())
}

async function readNoteFromDisk(page: Page, relPath: string): Promise<string> {
  return page.evaluate((pathArg) => window.vaultApi.files.readNote(pathArg), relPath)
}

async function readNoteDocumentFromDisk(page: Page, relPath: string): Promise<StoredNoteDocument> {
  return page.evaluate((pathArg) => window.vaultApi.files.readNoteDocument(pathArg), relPath)
}

async function readNoteDocumentFromVault(
  vaultRoot: string,
  relPath: string
): Promise<StoredNoteDocument> {
  const raw = await fs.readFile(path.join(vaultRoot, 'notes', relPath), 'utf-8')
  return parseStoredNoteDocument(raw)
}

async function openNote(page: Page, relPath: string): Promise<void> {
  const treeToggle = page.getByTestId('note-panel-toggle:tree')
  if ((await treeToggle.getAttribute('data-state')) === 'on') {
    const treeRow = page.getByTestId(`note-tree-row:${relPath}`)
    await expect(treeRow).toBeVisible({ timeout: 20_000 })
    await treeRow.click()
  } else {
    await page.getByTestId(`note-preview:${relPath}`).click()
  }
  await expect
    .poll(async () => (await getCurrentNoteSnapshot(page)).path, { timeout: 15_000 })
    .toBe(relPath)
}

async function replaceEditorContent(page: Page, lines: string[]): Promise<void> {
  const editor = page.locator('[data-testid="note-block-editor"] [contenteditable="true"]').first()
  await editor.click()

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (line.length > 0) {
      await page.keyboard.type(line)
    }
    if (index < lines.length - 1) {
      await page.keyboard.press('Enter')
    }
  }
}

async function renameCurrentOpenNote(page: Page, nextName: string): Promise<void> {
  await page.getByRole('heading', { level: 1, name: 'alpha' }).click()
  const nameInput = page.locator('input[type="text"]').first()
  await expect(nameInput).toBeVisible({ timeout: 10_000 })
  await nameInput.fill(nextName)
  await nameInput.press('Enter')
}

function toShortcutCode(key: string): string {
  if (/^[0-9]$/.test(key)) {
    return `Digit${key}`
  }

  if (/^[a-z]$/i.test(key)) {
    return `Key${key.toUpperCase()}`
  }

  if (key === ',') {
    return 'Comma'
  }

  return key
}

async function pressAppShortcut(page: Page, key: string): Promise<void> {
  const useMetaKey = process.platform === 'darwin'
  const code = toShortcutCode(key)
  await page.evaluate(
    ({ shortcutKey, shortcutCode, shortcutUsesMetaKey }) => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: shortcutKey,
          code: shortcutCode,
          metaKey: shortcutUsesMetaKey,
          ctrlKey: !shortcutUsesMetaKey,
          bubbles: true,
          cancelable: true
        })
      )
    },
    {
      shortcutKey: key,
      shortcutCode: code,
      shortcutUsesMetaKey: useMetaKey
    }
  )
}

async function delayNoteDocumentWrites(page: Page, delayMs: number): Promise<void> {
  await page.evaluate((nextDelayMs) => {
    const original = window.vaultApi.files.writeNoteDocument.bind(window.vaultApi.files)
    window.vaultApi.files.writeNoteDocument = async (relPath, document) => {
      await new Promise((resolve) => window.setTimeout(resolve, nextDelayMs))
      return original(relPath, document)
    }
  }, delayMs)
}

async function getVisibleNoteBlocks(page: Page): Promise<VisibleNoteBlock[]> {
  return page.evaluate(() => {
    const editorRoot = document.querySelector('[data-testid="note-block-editor"]')
    if (!editorRoot) {
      return []
    }

    const blocks = Array.from(editorRoot.querySelectorAll('[data-node-type="blockContainer"]')).map(
      (container) => {
        const content = container.querySelector<HTMLElement>('[data-content-type]')
        return {
          type: content?.dataset.contentType ?? '',
          text: content?.innerText.replace(/\u200b/g, '').trim() ?? ''
        }
      }
    )

    return blocks.filter(
      (block, index) =>
        !(index === blocks.length - 1 && block.type === 'paragraph' && block.text.length === 0)
    )
  })
}

async function dispatchPageHide(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.dispatchEvent(new Event('pagehide'))
  })
}

async function getEditorTextGap(page: Page, upperText: string, lowerText: string): Promise<number> {
  const editor = page.locator('[data-testid="note-block-editor"]')
  const upper = editor.getByText(upperText, { exact: true }).first()
  const lower = editor.getByText(lowerText, { exact: true }).first()

  const upperBox = await upper.boundingBox()
  const lowerBox = await lower.boundingBox()

  if (!upperBox || !lowerBox) {
    throw new Error(`Could not measure editor text positions for "${upperText}" and "${lowerText}"`)
  }

  return lowerBox.y - (upperBox.y + upperBox.height)
}

test.describe('note page block editor switching', () => {
  test('saves the current note when switching to another page after waiting', async () => {
    const vaultRoot = await createFixtureVault('')
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openNote(page, 'alpha.xnote')
      await replaceEditorContent(page, ['Switch page save'])
      await page.keyboard.type(' latest')
      await page.waitForTimeout(2200)

      await page.getByTestId('sidebar-page:projects').click()
      await expect(page.getByTestId('sidebar-page:projects')).toHaveAttribute('data-active', 'true')

      await expect
        .poll(() => getLastPageLeaveSaveDebug(page), { timeout: 15_000 })
        .toMatchObject({
          requestedPage: 'projects',
          notePath: 'alpha.xnote',
          attempted: true,
          writeCompleted: true,
          lastError: null
        })
      await expect
        .poll(async () => (await getLastPageLeaveSaveDebug(page)).snapshotContent, {
          timeout: 15_000
        })
        .toContain('Switch page save latest')

      await expect
        .poll(() => readNoteFromDisk(page, 'alpha.xnote'), { timeout: 15_000 })
        .toContain('Switch page save latest')

      await page.getByTestId('sidebar-page:notes').click()
      await expect(page.getByTestId('note-panel-toggle:tree')).toBeVisible({ timeout: 20_000 })
      await openNote(page, 'alpha.xnote')
      await expect
        .poll(async () => (await getCurrentNoteSnapshot(page)).content, { timeout: 15_000 })
        .toContain('Switch page save latest')

      await openNote(page, 'beta.xnote')
      await openNote(page, 'alpha.xnote')
      await expect
        .poll(async () => (await getCurrentNoteSnapshot(page)).content, { timeout: 15_000 })
        .toContain('Switch page save latest')
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('keeps the latest editor blocks after switching to projects and back before a forced flush', async () => {
    const vaultRoot = await createFixtureVault('')
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openNote(page, 'alpha.xnote')
      await replaceEditorContent(page, ['Projects return keeps body'])
      await page.keyboard.type(' latest')
      await page.waitForTimeout(2200)

      await page.getByTestId('sidebar-page:projects').click()
      await expect(page.getByTestId('sidebar-page:projects')).toHaveAttribute('data-active', 'true')

      await page.getByTestId('sidebar-page:notes').click()
      await expect(page.getByTestId('note-panel-toggle:tree')).toBeVisible({ timeout: 20_000 })

      await expect
        .poll(() => getVisibleNoteBlocks(page), { timeout: 15_000 })
        .toEqual([
          { type: 'paragraph', text: 'Projects return keeps body latest' }
        ])

      await dispatchPageHide(page)

      await expect
        .poll(() => readNoteFromDisk(page, 'alpha.xnote'), { timeout: 15_000 })
        .toContain('Projects return keeps body latest')
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('saves the current note when switching pages with a shortcut from the editor', async () => {
    const vaultRoot = await createFixtureVault('')
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openNote(page, 'alpha.xnote')
      await replaceEditorContent(page, ['Shortcut page save'])
      await page.keyboard.type(' latest')
      await page.waitForTimeout(2200)

      await pressAppShortcut(page, '2')
      await expect(page.getByTestId('sidebar-page:projects')).toHaveAttribute('data-active', 'true')

      await expect
        .poll(() => getLastPageLeaveSaveDebug(page), { timeout: 15_000 })
        .toMatchObject({
          requestedPage: 'projects',
          notePath: 'alpha.xnote',
          attempted: true,
          writeCompleted: true,
          lastError: null
        })
      await expect
        .poll(async () => (await getLastPageLeaveSaveDebug(page)).snapshotContent, {
          timeout: 15_000
        })
        .toContain('Shortcut page save latest')

      await expect
        .poll(() => readNoteFromDisk(page, 'alpha.xnote'), { timeout: 15_000 })
        .toContain('Shortcut page save latest')

      await pressAppShortcut(page, '1')
      await expect(page.getByTestId('note-panel-toggle:tree')).toBeVisible({ timeout: 20_000 })
      await openNote(page, 'alpha.xnote')
      await expect
        .poll(async () => (await getCurrentNoteSnapshot(page)).content, { timeout: 15_000 })
        .toContain('Shortcut page save latest')
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('saves the latest edit when switching pages immediately after typing', async () => {
    const vaultRoot = await createFixtureVault('')
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openNote(page, 'alpha.xnote')
      await replaceEditorContent(page, ['Immediate page save'])
      await page.keyboard.type(' latest')

      await page.getByTestId('sidebar-page:projects').click()
      await expect(page.getByTestId('sidebar-page:projects')).toHaveAttribute('data-active', 'true')

      await expect
        .poll(() => getLastPageLeaveSaveDebug(page), { timeout: 15_000 })
        .toMatchObject({
          requestedPage: 'projects',
          notePath: 'alpha.xnote',
          attempted: true,
          writeCompleted: true,
          lastError: null
        })
      await expect
        .poll(async () => (await getLastPageLeaveSaveDebug(page)).snapshotContent, {
          timeout: 15_000
        })
        .toContain('Immediate page save latest')

      await expect
        .poll(() => readNoteFromDisk(page, 'alpha.xnote'), { timeout: 15_000 })
        .toContain('Immediate page save latest')
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('keeps latest edit when switching pages back and forth quickly', async () => {
    const vaultRoot = await createFixtureVault('')
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openNote(page, 'alpha.xnote')
      await replaceEditorContent(page, ['Back and forth save'])
      await page.keyboard.type(' latest')

      await pressAppShortcut(page, '2')
      await pressAppShortcut(page, '1')
      await pressAppShortcut(page, '2')

      await expect(page.getByTestId('sidebar-page:projects')).toHaveAttribute('data-active', 'true')

      await expect
        .poll(() => readNoteFromDisk(page, 'alpha.xnote'), { timeout: 20_000 })
        .toContain('Back and forth save latest')

      await pressAppShortcut(page, '1')
      await expect(page.getByTestId('note-panel-toggle:tree')).toBeVisible({ timeout: 20_000 })
      await openNote(page, 'alpha.xnote')
      await expect
        .poll(async () => (await getCurrentNoteSnapshot(page)).content, { timeout: 15_000 })
        .toContain('Back and forth save latest')
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('saves the current note when switching to dashboard after waiting', async () => {
    const vaultRoot = await createFixtureVault('')
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openNote(page, 'alpha.xnote')
      await replaceEditorContent(page, ['Dashboard page save'])
      await page.keyboard.type(' latest')
      await page.waitForTimeout(2200)

      await page.getByTestId('sidebar-page:dashboard').click()
      await expect(page.getByTestId('sidebar-page:dashboard')).toHaveAttribute(
        'data-active',
        'true'
      )

      await expect
        .poll(() => getLastPageLeaveSaveDebug(page), { timeout: 15_000 })
        .toMatchObject({
          requestedPage: 'dashboard',
          notePath: 'alpha.xnote',
          attempted: true,
          writeCompleted: true,
          lastError: null
        })
      await expect
        .poll(async () => (await getLastPageLeaveSaveDebug(page)).snapshotContent, {
          timeout: 15_000
        })
        .toContain('Dashboard page save latest')
      await expect
        .poll(() => readNoteFromDisk(page, 'alpha.xnote'), { timeout: 15_000 })
        .toContain('Dashboard page save latest')
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('saves the latest edit when switching pages during an in-flight autosave', async () => {
    const vaultRoot = await createFixtureVault('')
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await delayNoteDocumentWrites(page, 800)
      await openNote(page, 'alpha.xnote')
      await replaceEditorContent(page, ['Before autosave'])

      await page.waitForTimeout(1300)
      await page.keyboard.type(' latest')
      await page.getByTestId('sidebar-page:projects').click()
      await expect(page.getByTestId('sidebar-page:projects')).toHaveAttribute('data-active', 'true')

      await expect
        .poll(() => getLastPageLeaveSaveDebug(page), { timeout: 15_000 })
        .toMatchObject({
          requestedPage: 'projects',
          notePath: 'alpha.xnote',
          attempted: true,
          writeCompleted: true,
          lastError: null
        })
      await expect
        .poll(async () => (await getLastPageLeaveSaveDebug(page)).snapshotContent, {
          timeout: 15_000
        })
        .toContain('Before autosave latest')

      await expect
        .poll(() => readNoteFromDisk(page, 'alpha.xnote'), { timeout: 15_000 })
        .toContain('Before autosave latest')
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('preserves the current note body when renaming after unsaved edits', async () => {
    const vaultRoot = await createFixtureVault('')
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openNote(page, 'alpha.xnote')
      await replaceEditorContent(page, ['Rename keeps body'])
      await page.keyboard.type(' latest')

      await renameCurrentOpenNote(page, 'alpha-renamed')

      await expect
        .poll(async () => (await getCurrentNoteSnapshot(page)).path, { timeout: 15_000 })
        .toBe('alpha-renamed.xnote')
      await expect
        .poll(async () => (await getCurrentNoteSnapshot(page)).content, { timeout: 15_000 })
        .toContain('Rename keeps body latest')
      await expect
        .poll(() => readNoteFromDisk(page, 'alpha-renamed.xnote'), { timeout: 15_000 })
        .toContain('Rename keeps body latest')

      await openNote(page, 'beta.xnote')
      await openNote(page, 'alpha-renamed.xnote')

      await expect
        .poll(async () => (await getCurrentNoteSnapshot(page)).content, { timeout: 15_000 })
        .toContain('Rename keeps body latest')
      await expect
        .poll(
          async () =>
            JSON.stringify(
              getPersistedVisibleBlocks(await readNoteDocumentFromDisk(page, 'alpha-renamed.xnote'))
            ),
          { timeout: 15_000 }
        )
        .toContain('Rename keeps body latest')
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('preserves heading and list markdown when switching notes', async () => {
    const vaultRoot = await createFixtureVault('')
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openNote(page, 'alpha.xnote')
      await replaceEditorContent(page, ['# Heading', '- Bullet item', '1. Numbered item'])

      await expect
        .poll(() => readNoteFromDisk(page, 'alpha.xnote'), { timeout: 15_000 })
        .toContain('# Heading')
      await expect
        .poll(() => readNoteFromDisk(page, 'alpha.xnote'), { timeout: 15_000 })
        .toContain('Bullet item')
      await expect
        .poll(() => readNoteFromDisk(page, 'alpha.xnote'), { timeout: 15_000 })
        .toContain('1. Numbered item')

      await openNote(page, 'beta.xnote')
      await openNote(page, 'alpha.xnote')

      await expect
        .poll(() => readNoteFromDisk(page, 'alpha.xnote'), { timeout: 15_000 })
        .toContain('# Heading')
      await expect
        .poll(() => readNoteFromDisk(page, 'alpha.xnote'), { timeout: 15_000 })
        .toContain('Bullet item')
      await expect
        .poll(() => readNoteFromDisk(page, 'alpha.xnote'), { timeout: 15_000 })
        .toContain('1. Numbered item')
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('keeps inserted blank lines when switching notes', async () => {
    const vaultRoot = await createFixtureVault('')
    const { electronApp, page } = await launchWithFixture(vaultRoot)
    const expectedVisibleBlocks = [
      { type: 'paragraph', text: 'Alpha' },
      { type: 'paragraph', text: '' },
      { type: 'paragraph', text: 'Beta' }
    ]

    try {
      await openNote(page, 'alpha.xnote')
      await replaceEditorContent(page, ['Alpha', '', 'Beta'])

      const visibleBlocksBeforeSwitch = await getVisibleNoteBlocks(page)
      expect(visibleBlocksBeforeSwitch).toEqual(expectedVisibleBlocks)

      await openNote(page, 'beta.xnote')
      await openNote(page, 'alpha.xnote')

      const visibleBlocksAfterSwitch = await getVisibleNoteBlocks(page)
      const afterSwitch = await getCurrentNoteSnapshot(page)
      expect(visibleBlocksAfterSwitch).toEqual(visibleBlocksBeforeSwitch)
      expect(afterSwitch.path).toBe('alpha.xnote')
      expect(afterSwitch.content).toContain('Alpha')
      expect(afterSwitch.content).toContain('Beta')

      await expect
        .poll(() => readNoteFromDisk(page, 'alpha.xnote'), { timeout: 15_000 })
        .toBe(afterSwitch.content)
      await expect
        .poll(
          async () =>
            JSON.stringify(
              getPersistedVisibleBlocks(await readNoteDocumentFromDisk(page, 'alpha.xnote'))
            ),
          { timeout: 15_000 }
        )
        .toBe(JSON.stringify(expectedVisibleBlocks))
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('keeps removed blank lines removed when switching notes', async () => {
    const vaultRoot = await createFixtureVault('Alpha\n\nBeta\n')
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openNote(page, 'alpha.xnote')
      const editor = page
        .locator('[data-testid="note-block-editor"] [contenteditable="true"]')
        .first()
      await editor.click()
      await page.keyboard.press('ArrowDown')
      await page.keyboard.press('Backspace')

      const visibleBlocksBeforeSwitch = await getVisibleNoteBlocks(page)
      expect(visibleBlocksBeforeSwitch).toEqual([
        { type: 'paragraph', text: 'Alpha' },
        { type: 'paragraph', text: 'Beta' }
      ])

      await openNote(page, 'beta.xnote')
      await openNote(page, 'alpha.xnote')

      const visibleBlocksAfterSwitch = await getVisibleNoteBlocks(page)
      const afterSwitch = await getCurrentNoteSnapshot(page)
      expect(visibleBlocksAfterSwitch).toEqual(visibleBlocksBeforeSwitch)
      expect(afterSwitch.path).toBe('alpha.xnote')
      expect(afterSwitch.content).toContain('Alpha')
      expect(afterSwitch.content).toContain('Beta')

      await expect
        .poll(() => readNoteFromDisk(page, 'alpha.xnote'), { timeout: 15_000 })
        .toBe(afterSwitch.content)
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('does not rewrite blank spacer lines when reopening the app', async () => {
    const vaultRoot = await createFixtureVault('')
    let electronApp: ElectronApplication | null = null
    let page: Page
    const expectedVisibleBlocks = [
      { type: 'paragraph', text: 'Alpha' },
      { type: 'paragraph', text: '' },
      { type: 'paragraph', text: 'Beta' }
    ]

    try {
      ;({ electronApp, page } = await launchWithFixture(vaultRoot))

      await openNote(page, 'alpha.xnote')
      await replaceEditorContent(page, ['Alpha', '', 'Beta'])

      const visibleBlocksBeforeRestart = await getVisibleNoteBlocks(page)
      expect(visibleBlocksBeforeRestart).toEqual([
        { type: 'paragraph', text: 'Alpha' },
        { type: 'paragraph', text: '' },
        { type: 'paragraph', text: 'Beta' }
      ])
      const gapBeforeRestart = await getEditorTextGap(page, 'Alpha', 'Beta')
      expect(gapBeforeRestart).toBeGreaterThan(10)

      const snapshotBeforeRestart = await getCurrentNoteSnapshot(page)
      expect(snapshotBeforeRestart.content).toContain('Alpha')
      expect(snapshotBeforeRestart.content).toContain('Beta')
      await expect
        .poll(() => readNoteFromDisk(page, 'alpha.xnote'), { timeout: 15_000 })
        .toBe(snapshotBeforeRestart.content)
      expect(
        getPersistedVisibleBlocks(await readNoteDocumentFromVault(vaultRoot, 'alpha.xnote'))
      ).toEqual(expectedVisibleBlocks)

      await electronApp.close()
      electronApp = null

      expect(
        getPersistedVisibleBlocks(await readNoteDocumentFromVault(vaultRoot, 'alpha.xnote'))
      ).toEqual(expectedVisibleBlocks)
      ;({ electronApp, page } = await launchWithFixture(vaultRoot))
      expect(
        getPersistedVisibleBlocks(await readNoteDocumentFromVault(vaultRoot, 'alpha.xnote'))
      ).toEqual(expectedVisibleBlocks)

      try {
        await expect
          .poll(async () => (await getCurrentNoteSnapshot(page)).path, { timeout: 5_000 })
          .toBe('alpha.xnote')
      } catch {
        await openNote(page, 'alpha.xnote')
      }

      await page.waitForTimeout(1000)
      expect(
        getPersistedVisibleBlocks(await readNoteDocumentFromVault(vaultRoot, 'alpha.xnote'))
      ).toEqual(expectedVisibleBlocks)

      await expect
        .poll(async () => JSON.stringify(await getCurrentNoteSnapshot(page)), { timeout: 15_000 })
        .toBe(
          JSON.stringify({
            path: 'alpha.xnote',
            content: snapshotBeforeRestart.content
          })
        )
      const editorAfterRestart = page.locator('[data-testid="note-block-editor"]')
      await expect(editorAfterRestart.getByText('Alpha', { exact: true }).first()).toBeVisible({
        timeout: 15_000
      })
      await expect(editorAfterRestart.getByText('Beta', { exact: true }).first()).toBeVisible({
        timeout: 15_000
      })
      const gapAfterRestart = await getEditorTextGap(page, 'Alpha', 'Beta')
      expect(gapAfterRestart).toBeGreaterThan(gapBeforeRestart - 8)
      expect(gapAfterRestart).toBeLessThan(gapBeforeRestart + 8)

      await page.waitForTimeout(1000)
      const stableGapAfterRestart = await getEditorTextGap(page, 'Alpha', 'Beta')
      expect(stableGapAfterRestart).toBeGreaterThan(gapBeforeRestart - 8)
      expect(stableGapAfterRestart).toBeLessThan(gapBeforeRestart + 8)

      await expect
        .poll(() => readNoteFromDisk(page, 'alpha.xnote'), { timeout: 15_000 })
        .toBe(snapshotBeforeRestart.content)
      await expect
        .poll(
          async () =>
            JSON.stringify(
              getPersistedVisibleBlocks(await readNoteDocumentFromDisk(page, 'alpha.xnote'))
            ),
          { timeout: 15_000 }
        )
        .toBe(JSON.stringify(expectedVisibleBlocks))
    } finally {
      await electronApp?.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })
})
