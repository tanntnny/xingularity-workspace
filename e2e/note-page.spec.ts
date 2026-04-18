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

function markdownLineToVisibleBlock(line: string): VisibleNoteBlock {
  if (/^#{1,6}\s+/.test(line)) {
    return {
      type: 'heading',
      text: line.replace(/^#{1,6}\s+/, '').trim()
    }
  }

  if (/^\s*[-*+]\s+/.test(line)) {
    return {
      type: 'bulletListItem',
      text: line.replace(/^\s*[-*+]\s+/, '').trim()
    }
  }

  if (/^\s*\d+\.\s+/.test(line)) {
    return {
      type: 'numberedListItem',
      text: line.replace(/^\s*\d+\.\s+/, '').trim()
    }
  }

  return {
    type: 'paragraph',
    text: line.trim()
  }
}

function getPersistedVisibleBlocks(document: StoredNoteDocument): VisibleNoteBlock[] {
  const blocks = document.markdown
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(markdownLineToVisibleBlock)

  return blocks.filter(
    (block, index) =>
      !(index === blocks.length - 1 && block.type === 'paragraph' && block.text.length === 0)
  )
}

declare global {
  interface Window {
    __XINGULARITY_E2E__?: {
      getCurrentNoteSnapshot: () => NoteSnapshot | Promise<NoteSnapshot>
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
    path.join(rootPath, 'notes', 'alpha.md'),
    serializeStoredNoteDocument(createStoredNoteDocumentFromText(alphaContent)),
    'utf-8'
  )
  await fs.writeFile(
    path.join(rootPath, 'notes', 'beta.md'),
    serializeStoredNoteDocument(createStoredNoteDocumentFromText('Side note\n')),
    'utf-8'
  )
  return rootPath
}

async function launchWithFixture(vaultRoot: string): Promise<{
  electronApp: ElectronApplication
  page: Page
}> {
  const userDataPath = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-e2e-user-data-'))
  await fs.mkdir(userDataPath, { recursive: true })
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
  if (actualUserDataPath !== userDataPath) {
    await fs.mkdir(actualUserDataPath, { recursive: true })
    await fs.writeFile(
      path.join(actualUserDataPath, 'settings.json'),
      JSON.stringify({ lastVaultPath: vaultRoot }, null, 2),
      'utf-8'
    )
  }

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
      { timeout: 60_000 }
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
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A')
  await page.keyboard.press('Backspace')

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
  const { content: markdown } = await getCurrentNoteSnapshot(page)
  return getPersistedVisibleBlocks({
    version: 1,
    tags: [],
    markdown
  })
}

async function dispatchPageHide(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.dispatchEvent(new Event('pagehide'))
  })
}

async function getEditorTextGap(page: Page, upperText: string, lowerText: string): Promise<number> {
  const { content: value } = await getCurrentNoteSnapshot(page)
  const upperIndex = value.split('\n').findIndex((line) => line.trim() === upperText)
  const lowerIndex = value.split('\n').findIndex((line) => line.trim() === lowerText)

  if (upperIndex < 0 || lowerIndex < 0) {
    throw new Error(`Could not measure editor text positions for "${upperText}" and "${lowerText}"`)
  }

  return lowerIndex - upperIndex
}

async function sampleEditorInstanceCounts(
  page: Page,
  durationMs: number
): Promise<Array<{ proseMirrorCount: number; text: string }>> {
  return page.evaluate((nextDurationMs) => {
    return new Promise<Array<{ proseMirrorCount: number; text: string }>>((resolve) => {
      const samples: Array<{ proseMirrorCount: number; text: string }> = []
      const startedAt = performance.now()

      const sample = (): void => {
        const root = document.querySelector('[data-testid="note-milkdown-root"]')
        const editors = Array.from(root?.querySelectorAll('.ProseMirror') ?? [])
        samples.push({
          proseMirrorCount: editors.length,
          text: editors.map((editor) => editor.textContent ?? '').join('\n---editor---\n')
        })

        if (performance.now() - startedAt >= nextDurationMs) {
          resolve(samples)
          return
        }

        window.requestAnimationFrame(sample)
      }

      sample()
    })
  }, durationMs)
}

test.describe('note page block editor switching', () => {
  test('does not render duplicate editor content while opening a note', async () => {
    const uniqueContent = 'Unique opening content\nSecond line\n'
    const vaultRoot = await createFixtureVault(uniqueContent)
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      const treeRow = page.getByTestId('note-tree-row:alpha.md')
      await expect(treeRow).toBeVisible({ timeout: 20_000 })
      await treeRow.click()
      await expect(page.getByTestId('note-block-editor')).toBeVisible({ timeout: 20_000 })

      const samples = await sampleEditorInstanceCounts(page, 1200)
      const maxEditorCount = Math.max(...samples.map((sample) => sample.proseMirrorCount))
      const duplicatedSample = samples.find(
        (sample) => sample.text.split('Unique opening content').length - 1 > 1
      )

      expect(maxEditorCount).toBeLessThanOrEqual(1)
      expect(duplicatedSample).toBeUndefined()
      await expect
        .poll(async () => (await getCurrentNoteSnapshot(page)).content, { timeout: 15_000 })
        .toContain('Unique opening content')
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('converts typed ASCII arrows into connected arrow characters', async () => {
    const vaultRoot = await createFixtureVault('')
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openNote(page, 'alpha.md')
      await replaceEditorContent(page, ['Flow -> <- => <= <-> <=> != >= === !=='])

      await expect
        .poll(() => getVisibleNoteBlocks(page), { timeout: 15_000 })
        .toEqual([{ type: 'paragraph', text: 'Flow → ← ⇒ ⇐ ↔ ⇔ ≠ ≥ ≡ ≢' }])

      await expect
        .poll(async () => (await getCurrentNoteSnapshot(page)).content, { timeout: 15_000 })
        .toContain('Flow → ← ⇒ ⇐ ↔ ⇔ ≠ ≥ ≡ ≢')
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('saves the current note when switching to another page after waiting', async () => {
    const vaultRoot = await createFixtureVault('')
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openNote(page, 'alpha.md')
      await replaceEditorContent(page, ['Switch page save'])
      await page.keyboard.type(' latest')
      await page.waitForTimeout(2200)

      await page.getByTestId('sidebar-page:projects').click()
      await expect(page.getByTestId('sidebar-page:projects')).toHaveAttribute('data-active', 'true')

      await expect
        .poll(() => getLastPageLeaveSaveDebug(page), { timeout: 15_000 })
        .toMatchObject({
          requestedPage: 'projects',
          notePath: 'alpha.md',
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
        .poll(() => readNoteFromDisk(page, 'alpha.md'), { timeout: 15_000 })
        .toContain('Switch page save latest')

      await page.getByTestId('sidebar-page:notes').click()
      await expect(page.getByTestId('note-panel-toggle:tree')).toBeVisible({ timeout: 20_000 })
      await openNote(page, 'alpha.md')
      await expect
        .poll(async () => (await getCurrentNoteSnapshot(page)).content, { timeout: 15_000 })
        .toContain('Switch page save latest')

      await openNote(page, 'beta.md')
      await openNote(page, 'alpha.md')
      await expect
        .poll(async () => (await getCurrentNoteSnapshot(page)).content, { timeout: 15_000 })
        .toContain('Switch page save latest')
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('keeps the editor focused after autosave', async () => {
    const vaultRoot = await createFixtureVault('')
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openNote(page, 'alpha.md')
      const editor = page
        .locator('[data-testid="note-block-editor"] [contenteditable="true"]')
        .first()
      await editor.click()
      await page.keyboard.type('Focus stays after autosave')

      await expect
        .poll(() =>
          page.evaluate(() => {
            const activeElement = document.activeElement
            return Boolean(activeElement?.closest('[data-testid="note-block-editor"]'))
          })
        )
        .toBe(true)

      await page.waitForTimeout(1800)
      await expect
        .poll(
          () =>
            page.evaluate(() => {
              const activeElement = document.activeElement
              return Boolean(activeElement?.closest('[data-testid="note-block-editor"]'))
            }),
          { timeout: 5_000 }
        )
        .toBe(true)

      await page.keyboard.type(' and still accepts typing')
      await expect
        .poll(async () => readNoteFromDisk(page, 'alpha.md'), { timeout: 10_000 })
        .toContain('Focus stays after autosave and still accepts typing')
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('keeps the latest editor blocks after switching to projects and back before a forced flush', async () => {
    const vaultRoot = await createFixtureVault('')
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openNote(page, 'alpha.md')
      await replaceEditorContent(page, ['Projects return keeps body'])
      await page.keyboard.type(' latest')
      await page.waitForTimeout(2200)

      await page.getByTestId('sidebar-page:projects').click()
      await expect(page.getByTestId('sidebar-page:projects')).toHaveAttribute('data-active', 'true')

      await page.getByTestId('sidebar-page:notes').click()
      await expect(page.getByTestId('note-panel-toggle:tree')).toBeVisible({ timeout: 20_000 })

      await expect
        .poll(() => getVisibleNoteBlocks(page), { timeout: 15_000 })
        .toEqual([{ type: 'paragraph', text: 'Projects return keeps body latest' }])

      await dispatchPageHide(page)

      await expect
        .poll(() => readNoteFromDisk(page, 'alpha.md'), { timeout: 15_000 })
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
      await openNote(page, 'alpha.md')
      await replaceEditorContent(page, ['Shortcut page save'])
      await page.keyboard.type(' latest')
      await page.waitForTimeout(2200)

      await pressAppShortcut(page, '2')
      await expect(page.getByTestId('sidebar-page:projects')).toHaveAttribute('data-active', 'true')

      await expect
        .poll(() => getLastPageLeaveSaveDebug(page), { timeout: 15_000 })
        .toMatchObject({
          requestedPage: 'projects',
          notePath: 'alpha.md',
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
        .poll(() => readNoteFromDisk(page, 'alpha.md'), { timeout: 15_000 })
        .toContain('Shortcut page save latest')

      await pressAppShortcut(page, '1')
      await expect(page.getByTestId('note-panel-toggle:tree')).toBeVisible({ timeout: 20_000 })
      await openNote(page, 'alpha.md')
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
      await openNote(page, 'alpha.md')
      await replaceEditorContent(page, ['Immediate page save'])
      await page.keyboard.type(' latest')

      await page.getByTestId('sidebar-page:projects').click()
      await expect(page.getByTestId('sidebar-page:projects')).toHaveAttribute('data-active', 'true')

      await expect
        .poll(() => getLastPageLeaveSaveDebug(page), { timeout: 15_000 })
        .toMatchObject({
          requestedPage: 'projects',
          notePath: 'alpha.md',
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
        .poll(() => readNoteFromDisk(page, 'alpha.md'), { timeout: 15_000 })
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
      await openNote(page, 'alpha.md')
      await replaceEditorContent(page, ['Back and forth save'])
      await page.keyboard.type(' latest')

      await pressAppShortcut(page, '2')
      await pressAppShortcut(page, '1')
      await pressAppShortcut(page, '2')

      await expect(page.getByTestId('sidebar-page:projects')).toHaveAttribute('data-active', 'true')

      await expect
        .poll(() => readNoteFromDisk(page, 'alpha.md'), { timeout: 20_000 })
        .toContain('Back and forth save latest')

      await pressAppShortcut(page, '1')
      await expect(page.getByTestId('note-panel-toggle:tree')).toBeVisible({ timeout: 20_000 })
      await openNote(page, 'alpha.md')
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
      await openNote(page, 'alpha.md')
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
          notePath: 'alpha.md',
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
        .poll(() => readNoteFromDisk(page, 'alpha.md'), { timeout: 15_000 })
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
      await openNote(page, 'alpha.md')
      await replaceEditorContent(page, ['Before autosave'])

      await page.waitForTimeout(1300)
      await page.keyboard.type(' latest')
      await page.getByTestId('sidebar-page:projects').click()
      await expect(page.getByTestId('sidebar-page:projects')).toHaveAttribute('data-active', 'true')

      await expect
        .poll(() => getLastPageLeaveSaveDebug(page), { timeout: 15_000 })
        .toMatchObject({
          requestedPage: 'projects',
          notePath: 'alpha.md',
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
        .poll(() => readNoteFromDisk(page, 'alpha.md'), { timeout: 15_000 })
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
      await openNote(page, 'alpha.md')
      await replaceEditorContent(page, ['Rename keeps body'])
      await page.keyboard.type(' latest')

      await renameCurrentOpenNote(page, 'alpha-renamed')

      await expect
        .poll(async () => (await getCurrentNoteSnapshot(page)).path, { timeout: 15_000 })
        .toBe('alpha-renamed.md')
      await expect
        .poll(async () => (await getCurrentNoteSnapshot(page)).content, { timeout: 15_000 })
        .toContain('Rename keeps body latest')
      await expect
        .poll(() => readNoteFromDisk(page, 'alpha-renamed.md'), { timeout: 15_000 })
        .toContain('Rename keeps body latest')

      await openNote(page, 'beta.md')
      await openNote(page, 'alpha-renamed.md')

      await expect
        .poll(async () => (await getCurrentNoteSnapshot(page)).content, { timeout: 15_000 })
        .toContain('Rename keeps body latest')
      await expect
        .poll(
          async () =>
            JSON.stringify(
              getPersistedVisibleBlocks(await readNoteDocumentFromDisk(page, 'alpha-renamed.md'))
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
      await openNote(page, 'alpha.md')
      await replaceEditorContent(page, ['# Heading', '- Bullet item', '1. Numbered item'])

      await expect
        .poll(() => readNoteFromDisk(page, 'alpha.md'), { timeout: 15_000 })
        .toContain('# Heading')
      await expect
        .poll(() => readNoteFromDisk(page, 'alpha.md'), { timeout: 15_000 })
        .toContain('Bullet item')
      await expect
        .poll(() => readNoteFromDisk(page, 'alpha.md'), { timeout: 15_000 })
        .toContain('Numbered item')

      await openNote(page, 'beta.md')
      await openNote(page, 'alpha.md')

      await expect
        .poll(() => readNoteFromDisk(page, 'alpha.md'), { timeout: 15_000 })
        .toContain('# Heading')
      await expect
        .poll(() => readNoteFromDisk(page, 'alpha.md'), { timeout: 15_000 })
        .toContain('Bullet item')
      await expect
        .poll(() => readNoteFromDisk(page, 'alpha.md'), { timeout: 15_000 })
        .toContain('Numbered item')
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('renders and preserves inline LaTeX markdown when switching notes', async () => {
    const inlineLatex = '2^{x}=e^{2s}'
    const markdown = `Inline math $${inlineLatex}$ works\n`
    const vaultRoot = await createFixtureVault(markdown)
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openNote(page, 'alpha.md')

      const mathPreview = page.locator(
        `[data-testid="note-block-editor"] .note-inline-latex-preview[data-latex="${inlineLatex}"]`
      )
      await expect(mathPreview.locator('.katex')).toBeVisible({ timeout: 15_000 })

      const editorText = await page
        .locator('[data-testid="note-block-editor"] [contenteditable="true"]')
        .first()
        .textContent()
      expect(editorText).toContain('Inline math')
      expect(editorText).toContain('works')

      await expect
        .poll(async () => (await getCurrentNoteSnapshot(page)).content, { timeout: 15_000 })
        .toContain(markdown.trim())
      await expect
        .poll(() => readNoteFromDisk(page, 'alpha.md'), { timeout: 15_000 })
        .toContain(markdown.trim())

      await openNote(page, 'beta.md')
      await openNote(page, 'alpha.md')

      await expect(mathPreview.locator('.katex')).toBeVisible({ timeout: 15_000 })
      await expect
        .poll(async () => (await getCurrentNoteSnapshot(page)).content, { timeout: 15_000 })
        .toContain(markdown.trim())
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('creates inline LaTeX from typed dollar delimiters', async () => {
    const inlineLatex = '2^{x}=e^{2s}'
    const vaultRoot = await createFixtureVault('')
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openNote(page, 'alpha.md')
      await replaceEditorContent(page, [`Inline math $${inlineLatex}$ works`])

      const rawSource = page.locator('[data-testid="note-block-editor"] .note-inline-latex-source')
      await expect(rawSource).toContainText(`$${inlineLatex}$`, { timeout: 15_000 })
      await expect(
        page.locator(
          `[data-testid="note-block-editor"] .note-inline-latex-preview[data-latex="${inlineLatex}"]`
        )
      ).toHaveCount(0)

      const editor = page.locator('[data-testid="note-block-editor"] [contenteditable="true"]')
      await editor.press('Enter')
      await editor.pressSequentially('Next line')

      const mathPreview = page.locator(
        `[data-testid="note-block-editor"] .note-inline-latex-preview[data-latex="${inlineLatex}"]`
      )
      await expect(mathPreview.locator('.katex')).toBeVisible({ timeout: 15_000 })
      await expect(page.locator('.milkdown-latex-inline-edit')).toBeHidden()

      await expect
        .poll(async () => (await getCurrentNoteSnapshot(page)).content, { timeout: 15_000 })
        .toContain(`Inline math $${inlineLatex}$ works`)
      await expect
        .poll(async () => (await getCurrentNoteSnapshot(page)).content, { timeout: 15_000 })
        .not.toContain(`\\$${inlineLatex}\\$`)

      const cursorState = await page.evaluate(() => {
        const selection = window.getSelection()
        const editorRoot = document.querySelector('[data-testid="note-block-editor"]')
        const editable = editorRoot?.querySelector('[contenteditable="true"]')
        const math = editorRoot?.querySelector('.note-inline-latex-preview')

        return {
          anchorInEditor: Boolean(
            selection?.anchorNode && editable?.contains(selection.anchorNode)
          ),
          paragraphText: editable?.textContent ?? '',
          mathTop: math?.getBoundingClientRect().top ?? null,
          anchorTop:
            selection && selection.rangeCount > 0
              ? selection.getRangeAt(0).getBoundingClientRect().top
              : null
        }
      })

      expect(cursorState.anchorInEditor).toBe(true)
      expect(cursorState.paragraphText).toContain('Inline math')
      expect(cursorState.paragraphText).toContain('Next line')
      expect(cursorState.paragraphText).toContain('works')
      expect(cursorState.anchorTop).not.toBeNull()
      expect(cursorState.mathTop).not.toBeNull()
      expect(Math.abs((cursorState.anchorTop ?? 0) - (cursorState.mathTop ?? 0))).toBeGreaterThan(8)
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('renders raw double-dollar LaTeX while editing its line', async () => {
    const displayLatex = '2^{x}=e^{2s}'
    const vaultRoot = await createFixtureVault('')
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openNote(page, 'alpha.md')
      await replaceEditorContent(page, [`Display math $$${displayLatex}$$ works`])

      const rawSource = page.locator('[data-testid="note-block-editor"] .note-inline-latex-source')
      await expect(rawSource).toContainText(`$$${displayLatex}$$`, { timeout: 15_000 })
      await expect(page.locator('.note-inline-latex-source-hidden')).toHaveCount(0)
      await expect(page.locator('.note-inline-latex-preview')).toHaveCount(0)

      const editor = page.locator('[data-testid="note-block-editor"] [contenteditable="true"]')
      await editor.press('Enter')
      await editor.pressSequentially('Next line')

      const mathPreview = page.locator(
        `[data-testid="note-block-editor"] .note-inline-latex-preview-display[data-latex="${displayLatex}"]`
      )
      await expect(mathPreview.locator('.katex-display')).toBeVisible({ timeout: 15_000 })
      await expect
        .poll(async () => (await getCurrentNoteSnapshot(page)).content, { timeout: 15_000 })
        .toContain(`Display math $$${displayLatex}$$ works`)
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('creates inline LaTeX from escaped typed dollar delimiters', async () => {
    const inlineLatex = '2^{x}=e^{2s}'
    const vaultRoot = await createFixtureVault(`Inline math \\$${inlineLatex}\\$ works\n`)
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openNote(page, 'alpha.md')

      const mathPreview = page.locator(
        `[data-testid="note-block-editor"] .note-inline-latex-preview[data-latex="${inlineLatex}"]`
      )
      await expect(mathPreview.locator('.katex')).toBeVisible({ timeout: 15_000 })

      await expect
        .poll(async () => (await getCurrentNoteSnapshot(page)).content, { timeout: 15_000 })
        .toContain(`Inline math $${inlineLatex}$ works`)
      await expect
        .poll(async () => (await getCurrentNoteSnapshot(page)).content, { timeout: 15_000 })
        .not.toContain(`\\$${inlineLatex}\\$`)
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('edits invalid inline LaTeX in place and renders when completed', async () => {
    const vaultRoot = await createFixtureVault('')
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openNote(page, 'alpha.md')
      await replaceEditorContent(page, ['Broken inline $2^{'])

      const editor = page.locator('[data-testid="note-block-editor"] [contenteditable="true"]')
      const invalidSource = page.locator(
        '[data-testid="note-block-editor"] .note-inline-latex-error'
      )
      await expect(invalidSource).toContainText('$2^{', { timeout: 15_000 })
      await expect
        .poll(async () => (await getCurrentNoteSnapshot(page)).content, { timeout: 15_000 })
        .toContain('Broken inline $2^{')
      await expect(page.locator('.milkdown-latex-inline-edit')).toBeHidden()

      await editor.pressSequentially('x}$')

      const completedSource = page.locator(
        '[data-testid="note-block-editor"] .note-inline-latex-source'
      )
      await expect(completedSource).toContainText('$2^{x}$', { timeout: 15_000 })
      await expect(page.locator('.note-inline-latex-preview[data-latex="2^{x}"]')).toHaveCount(0)

      await editor.press('Enter')
      await editor.pressSequentially('Done')

      const mathPreview = page.locator(
        '[data-testid="note-block-editor"] .note-inline-latex-preview[data-latex="2^{x}"]'
      )
      await expect(mathPreview.locator('.katex')).toBeVisible({ timeout: 15_000 })
      await expect(invalidSource).toHaveCount(0)
      await expect
        .poll(async () => (await getCurrentNoteSnapshot(page)).content, { timeout: 15_000 })
        .toContain('Broken inline $2^{x}$')
      await expect
        .poll(async () => (await getCurrentNoteSnapshot(page)).content, { timeout: 15_000 })
        .not.toContain('\\$2^{x}\\$')
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('renders visible bullet and numbered list markers in the note editor', async () => {
    const vaultRoot = await createFixtureVault(
      '- Bullet item\n\n1. Numbered item\n2. Second item\n'
    )
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openNote(page, 'alpha.md')

      const styles = await page.evaluate(() => {
        const editorRoot = document.querySelector('[data-testid="note-block-editor"]')
        const editable = editorRoot?.querySelector('[contenteditable="true"]')
        const bulletParagraph = editable?.querySelector(
          "ul li[data-list-type='bullet'] > p"
        ) as HTMLElement | null
        const numberedParagraph = editable?.querySelector(
          "ol li[data-list-type='ordered'] > p"
        ) as HTMLElement | null

        return {
          editableHtml: editable?.innerHTML ?? null,
          bulletMarkerContent: bulletParagraph
            ? window.getComputedStyle(bulletParagraph, '::before').content
            : null,
          bulletMarkerColor: bulletParagraph
            ? window.getComputedStyle(bulletParagraph, '::before').color
            : null,
          numberedMarkerContent: numberedParagraph
            ? window.getComputedStyle(numberedParagraph, '::before').content
            : null,
          numberedMarkerColor: numberedParagraph
            ? window.getComputedStyle(numberedParagraph, '::before').color
            : null
        }
      })

      expect(styles.bulletMarkerContent).toContain('•')
      expect(styles.bulletMarkerColor).not.toBe('rgba(0, 0, 0, 0)')
      expect(styles.numberedMarkerContent).toContain('1.')
      expect(styles.numberedMarkerColor).not.toBe('rgba(0, 0, 0, 0)')
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('keeps inserted blank lines when switching notes', async () => {
    const vaultRoot = await createFixtureVault('')
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openNote(page, 'alpha.md')
      await replaceEditorContent(page, ['Alpha', '', 'Beta'])

      const visibleBlocksBeforeSwitch = await getVisibleNoteBlocks(page)
      expect(visibleBlocksBeforeSwitch.some((block) => block.text === 'Alpha')).toBe(true)
      expect(visibleBlocksBeforeSwitch.some((block) => block.text === 'Beta')).toBe(true)

      await openNote(page, 'beta.md')
      await openNote(page, 'alpha.md')

      const visibleBlocksAfterSwitch = await getVisibleNoteBlocks(page)
      const afterSwitch = await getCurrentNoteSnapshot(page)
      expect(visibleBlocksAfterSwitch).toEqual(visibleBlocksBeforeSwitch)
      expect(afterSwitch.path).toBe('alpha.md')
      expect(afterSwitch.content).toContain('Alpha')
      expect(afterSwitch.content).toContain('Beta')

      await expect
        .poll(() => readNoteFromDisk(page, 'alpha.md'), { timeout: 15_000 })
        .toBe(afterSwitch.content)
      await expect
        .poll(
          async () =>
            JSON.stringify(
              getPersistedVisibleBlocks(await readNoteDocumentFromDisk(page, 'alpha.md'))
            ),
          { timeout: 15_000 }
        )
        .toBe(JSON.stringify(visibleBlocksBeforeSwitch))
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('keeps paragraph spacing stable when switching notes', async () => {
    const vaultRoot = await createFixtureVault('Alpha\n\nBeta\n')
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openNote(page, 'alpha.md')
      const editor = page
        .locator('[data-testid="note-block-editor"] [contenteditable="true"]')
        .first()
      await editor.click()
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A')
      await page.keyboard.press('Backspace')
      await page.keyboard.type('Alpha')
      await page.keyboard.press('Enter')
      await page.keyboard.type('Beta')

      const visibleBlocksBeforeSwitch = await getVisibleNoteBlocks(page)
      expect(visibleBlocksBeforeSwitch.some((block) => block.text === 'Alpha')).toBe(true)
      expect(visibleBlocksBeforeSwitch.some((block) => block.text === 'Beta')).toBe(true)

      await openNote(page, 'beta.md')
      await openNote(page, 'alpha.md')

      const visibleBlocksAfterSwitch = await getVisibleNoteBlocks(page)
      const afterSwitch = await getCurrentNoteSnapshot(page)
      expect(visibleBlocksAfterSwitch).toEqual(visibleBlocksBeforeSwitch)
      expect(afterSwitch.path).toBe('alpha.md')
      expect(afterSwitch.content).toContain('Alpha')
      expect(afterSwitch.content).toContain('Beta')

      await expect
        .poll(() => readNoteFromDisk(page, 'alpha.md'), { timeout: 15_000 })
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

    try {
      ;({ electronApp, page } = await launchWithFixture(vaultRoot))

      await openNote(page, 'alpha.md')
      await replaceEditorContent(page, ['Alpha', '', 'Beta'])

      const visibleBlocksBeforeRestart = await getVisibleNoteBlocks(page)
      expect(visibleBlocksBeforeRestart.some((block) => block.text === 'Alpha')).toBe(true)
      expect(visibleBlocksBeforeRestart.some((block) => block.text === 'Beta')).toBe(true)
      const gapBeforeRestart = await getEditorTextGap(page, 'Alpha', 'Beta')
      expect(gapBeforeRestart).toBeGreaterThan(0)

      const snapshotBeforeRestart = await getCurrentNoteSnapshot(page)
      expect(snapshotBeforeRestart.content).toContain('Alpha')
      expect(snapshotBeforeRestart.content).toContain('Beta')
      await expect
        .poll(() => readNoteFromDisk(page, 'alpha.md'), { timeout: 15_000 })
        .toBe(snapshotBeforeRestart.content)
      expect(
        getPersistedVisibleBlocks(await readNoteDocumentFromVault(vaultRoot, 'alpha.md'))
      ).toEqual(visibleBlocksBeforeRestart)

      await electronApp.close()
      electronApp = null

      expect(
        getPersistedVisibleBlocks(await readNoteDocumentFromVault(vaultRoot, 'alpha.md'))
      ).toEqual(visibleBlocksBeforeRestart)
      ;({ electronApp, page } = await launchWithFixture(vaultRoot))
      expect(
        getPersistedVisibleBlocks(await readNoteDocumentFromVault(vaultRoot, 'alpha.md'))
      ).toEqual(visibleBlocksBeforeRestart)

      try {
        await expect
          .poll(async () => (await getCurrentNoteSnapshot(page)).path, { timeout: 5_000 })
          .toBe('alpha.md')
      } catch {
        await openNote(page, 'alpha.md')
      }

      await page.waitForTimeout(1000)
      expect(
        getPersistedVisibleBlocks(await readNoteDocumentFromVault(vaultRoot, 'alpha.md'))
      ).toEqual(visibleBlocksBeforeRestart)

      await expect
        .poll(async () => JSON.stringify(await getCurrentNoteSnapshot(page)), { timeout: 15_000 })
        .toBe(
          JSON.stringify({
            path: 'alpha.md',
            content: snapshotBeforeRestart.content
          })
        )
      await expect
        .poll(async () => (await getCurrentNoteSnapshot(page)).content, { timeout: 15_000 })
        .toBe(snapshotBeforeRestart.content)
      const gapAfterRestart = await getEditorTextGap(page, 'Alpha', 'Beta')
      expect(gapAfterRestart).toBe(gapBeforeRestart)

      await page.waitForTimeout(1000)
      const stableGapAfterRestart = await getEditorTextGap(page, 'Alpha', 'Beta')
      expect(stableGapAfterRestart).toBe(gapBeforeRestart)

      await expect
        .poll(() => readNoteFromDisk(page, 'alpha.md'), { timeout: 15_000 })
        .toBe(snapshotBeforeRestart.content)
      await expect
        .poll(
          async () =>
            JSON.stringify(
              getPersistedVisibleBlocks(await readNoteDocumentFromDisk(page, 'alpha.md'))
            ),
          { timeout: 15_000 }
        )
        .toBe(JSON.stringify(visibleBlocksBeforeRestart))
    } finally {
      await electronApp?.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })
})
