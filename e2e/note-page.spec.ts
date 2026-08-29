import { test, expect, type Locator, type Page } from '@playwright/test'
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

async function createFixtureVault(alphaContent: string, alphaTags: string[] = []): Promise<string> {
  const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-e2e-vault-'))
  await fs.mkdir(path.join(rootPath, 'notes'), { recursive: true })
  await fs.mkdir(path.join(rootPath, 'attachments'), { recursive: true })
  await fs.writeFile(
    path.join(rootPath, 'notes', 'alpha.md'),
    serializeStoredNoteDocument(createStoredNoteDocumentFromText(alphaContent, alphaTags)),
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
    args: [`--user-data-dir=${userDataPath}`, '.'],
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
  await expect(notesPageButton).toBeVisible({ timeout: 60_000 })
  await expect(notesPageButton).toBeEnabled({ timeout: 60_000 })
  await notesPageButton.click()
  await expectNotePanelReady(page)

  return { electronApp, page }
}

function getNotePanelToggle(page: Page): Locator {
  return page
    .getByTestId('note-file-tree-panel')
    .getByRole('button', { name: 'File tree', exact: true })
    .or(page.getByTestId('notes-tree-view'))
    .or(page.getByTestId('notebook-empty-state'))
    .first()
}

async function expectNotePanelReady(page: Page): Promise<void> {
  await expect(getNotePanelToggle(page)).toBeVisible({ timeout: 20_000 })
}

async function getCurrentNoteSnapshot(page: Page): Promise<NoteSnapshot> {
  return page.evaluate(() => window.__XINGULARITY_E2E__!.getCurrentNoteSnapshot())
}

async function getCurrentVimCursorChar(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const cursor = document.querySelector(
      '[data-testid="note-block-editor"] .note-vim-block-cursor-char'
    )

    return cursor?.textContent ?? null
  })
}

async function getEditorSelectionState(page: Page): Promise<{
  anchorInEditor: boolean
  anchorOffset: number | null
  anchorText: string
  anchorTextLength: number | null
}> {
  return page.evaluate(() => {
    const selection = window.getSelection()
    const editorRoot = document.querySelector('[data-testid="note-block-editor"]')
    const editable = editorRoot?.querySelector('[contenteditable="true"]')
    const anchorNode = selection?.anchorNode ?? null
    const anchorText =
      anchorNode?.nodeType === Node.TEXT_NODE
        ? (anchorNode.textContent ?? '')
        : (anchorNode?.parentElement?.textContent ?? '')

    return {
      anchorInEditor: Boolean(anchorNode && editable?.contains(anchorNode)),
      anchorOffset: selection?.anchorOffset ?? null,
      anchorText,
      anchorTextLength: anchorNode?.nodeType === Node.TEXT_NODE ? anchorText.length : null
    }
  })
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
  const treeRow = page.getByTestId(`note-tree-row:${relPath}`)
  const treeRowVisible = await treeRow.isVisible().catch(() => false)
  if (treeRowVisible) {
    await expect(treeRow).toBeVisible({ timeout: 20_000 })
    await treeRow.click()
  } else {
    await page.getByTestId(`note-preview:${relPath}`).click()
  }
  await expect
    .poll(async () => (await getCurrentNoteSnapshot(page)).path, { timeout: 15_000 })
    .toBe(relPath)
}

async function startNoteTreeDrag(
  page: Page,
  sourceRelPath: string,
  targetRelPath: string
): Promise<void> {
  await page.evaluate(
    ({ sourceRelPath, targetRelPath }) => {
      const source = document.querySelector<HTMLElement>(
        `[data-testid="note-tree-row:${sourceRelPath}"]`
      )
      const target = document.querySelector<HTMLElement>(
        `[data-testid="note-tree-row:${targetRelPath}"]`
      )
      if (!source || !target) {
        throw new Error('Note tree drag visual fixtures are missing')
      }

      const sourceRect = source.getBoundingClientRect()
      const targetRect = target.getBoundingClientRect()
      const dataTransfer = new DataTransfer()
      const sourceClientX = sourceRect.left + sourceRect.width / 2
      const sourceClientY = sourceRect.top + sourceRect.height / 2
      const targetClientX = targetRect.left + targetRect.width / 2
      const targetClientY = targetRect.top + targetRect.height / 2

      source.dispatchEvent(
        new DragEvent('dragstart', {
          bubbles: true,
          cancelable: true,
          dataTransfer,
          clientX: sourceClientX,
          clientY: sourceClientY
        })
      )
      target.dispatchEvent(
        new DragEvent('dragover', {
          bubbles: true,
          cancelable: true,
          dataTransfer,
          clientX: targetClientX,
          clientY: targetClientY
        })
      )
    },
    { sourceRelPath, targetRelPath }
  )
}

async function endNoteTreeDrag(page: Page, sourceRelPath: string): Promise<void> {
  await page.evaluate((sourceRelPath) => {
    const source = document.querySelector<HTMLElement>(
      `[data-testid="note-tree-row:${sourceRelPath}"]`
    )
    source?.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true }))
  }, sourceRelPath)
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

async function insertCodeBlockFromSlash(page: Page): Promise<void> {
  const editor = page.locator('[data-testid="note-block-editor"] [contenteditable="true"]').first()
  await editor.click()
  await page.keyboard.type('/code')
  await expect(page.getByTestId('note-slash-completion')).toBeVisible({ timeout: 10_000 })
  await page.keyboard.press('Enter')
  await expect(
    page.locator('[data-testid="note-block-editor"] .milkdown-code-block').first()
  ).toBeVisible({
    timeout: 10_000
  })
}

async function focusFirstCodeBlock(page: Page): Promise<void> {
  const codeContent = page
    .locator('[data-testid="note-block-editor"] .milkdown-code-block .note-code-block-content')
    .first()
  await expect(codeContent).toBeVisible({ timeout: 10_000 })
  await codeContent.click({ position: { x: 6, y: 10 } })
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
  test('shows notebook cards in the center browser', async () => {
    const vaultRoot = await createFixtureVault('Alpha note\n')
    await fs.mkdir(path.join(vaultRoot, 'notes', 'archive'), { recursive: true })
    await fs.writeFile(
      path.join(vaultRoot, 'notes', 'archive', 'nested.md'),
      serializeStoredNoteDocument(createStoredNoteDocumentFromText('Nested note\n')),
      'utf-8'
    )
    await fs.mkdir(path.join(vaultRoot, 'notes', 'archive', '2025'), { recursive: true })
    await fs.writeFile(
      path.join(vaultRoot, 'notes', 'archive', '2025', 'january.md'),
      serializeStoredNoteDocument(createStoredNoteDocumentFromText('January note\n')),
      'utf-8'
    )
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await expect(page.getByTestId('notebook-card-browser')).toBeVisible()
      await expect(page.getByTestId('notebook-card:alpha.md')).toBeVisible()
      await expect(page.getByTestId('notebook-card:beta.md')).toBeVisible()
      await expect(page.getByTestId('notebook-card-menu:alpha.md')).toHaveCount(0)
      await page
        .getByTestId('notebook-card:archive')
        .getByRole('button', { name: 'Open folder archive' })
        .click()
      await expect(page.getByTestId('notebook-card:archive/nested.md')).toBeVisible()
      await expect(page.getByTestId('notebook-breadcrumb:root')).toBeVisible()
      await expect(page.getByTestId('notebook-breadcrumb:current:archive')).toBeVisible()
      await page
        .getByTestId('notebook-card:archive/2025')
        .getByRole('button', { name: 'Open folder 2025' })
        .click()
      await expect(page.getByTestId('notebook-card:archive/2025/january.md')).toBeVisible()
      await expect(page.getByTestId('notebook-breadcrumb:ancestor:archive')).toBeVisible()
      await expect(page.getByTestId('notebook-breadcrumb:current:archive/2025')).toBeVisible()
      await page.getByTestId('notebook-breadcrumb:ancestor:archive').click()
      await expect(page.getByTestId('notebook-card:archive/nested.md')).toBeVisible()
      await page.getByTestId('notebook-breadcrumb:root').click()
      await expect(page.getByTestId('notebook-card:archive')).toBeVisible()
      await openNote(page, 'alpha.md')
      await expect(page.getByTestId('note-block-editor')).toBeVisible()
      const noteRootBreadcrumb = page.getByTestId('notebook-breadcrumb:root')
      await expect(noteRootBreadcrumb).toHaveAttribute('type', 'button')
      await expect(noteRootBreadcrumb).toBeEnabled()
      await expect(noteRootBreadcrumb).toHaveCSS('pointer-events', 'auto')
      await expect(noteRootBreadcrumb).toHaveCSS('-webkit-app-region', 'no-drag')
      await noteRootBreadcrumb.click()
      await expect(page.getByTestId('notebook-card-browser')).toBeVisible()
      await expect(page.getByTestId('notebook-card:alpha.md')).toBeVisible()
      await page
        .getByTestId('notebook-card:archive')
        .getByRole('button', { name: 'Open folder archive' })
        .click()
      await page
        .getByTestId('notebook-card:archive/2025')
        .getByRole('button', { name: 'Open folder 2025' })
        .click()
      await page
        .getByTestId('notebook-card:archive/2025/january.md')
        .getByRole('button', { name: 'Open january' })
        .click()
      await expect(page.getByTestId('note-block-editor')).toBeVisible()
      await expect(page.getByTestId('notebook-breadcrumb:ancestor:archive')).toBeVisible()
      await expect(page.getByTestId('notebook-breadcrumb:ancestor:archive/2025')).toBeVisible()
      await page.getByTestId('notebook-breadcrumb:ancestor:archive').click()
      await expect(page.getByTestId('notebook-card:archive/nested.md')).toBeVisible()
      await page.getByTestId('notebook-breadcrumb:root').click()
      await openNote(page, 'alpha.md')
      await openNote(page, 'beta.md')

      page.once('dialog', (dialog) => dialog.accept())
      await page.getByRole('button', { name: 'Delete Note' }).click()

      await expect(page.getByTestId('notebook-card-browser')).toBeVisible()
      await expect(page.getByTestId('notebook-card:alpha.md')).toBeVisible()
      await page
        .getByTestId('notebook-card:alpha.md')
        .getByRole('button', { name: 'Open alpha' })
        .click()
      await expect(page.getByTestId('note-block-editor')).toBeVisible()
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('opens context menus from notebook cards and unused browser space', async () => {
    const vaultRoot = await createFixtureVault('Alpha note\n')
    await fs.mkdir(path.join(vaultRoot, 'notes', 'archive'), { recursive: true })
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      const browser = page.getByTestId('notebook-card-browser')
      const content = page.getByTestId('notebook-card-content')
      const alphaCard = page.getByTestId('notebook-card:alpha.md')
      const betaCard = page.getByTestId('notebook-card:beta.md')
      const archiveCard = page.getByTestId('notebook-card:archive')

      await alphaCard.click({ button: 'right' })
      const alphaMenu = page.getByTestId('notebook-card-context-menu:alpha.md')
      await expect(alphaMenu).toBeVisible()
      await expect(alphaMenu.getByRole('menuitem', { name: 'New note', exact: true })).toBeVisible()
      await expect(alphaMenu.getByRole('menuitem', { name: 'Rename', exact: true })).toBeVisible()
      await expect(alphaCard.getByRole('button', { name: 'Open alpha' })).toHaveAttribute(
        'aria-pressed',
        'true'
      )
      await page.keyboard.press('Escape')

      await betaCard.click({ button: 'right' })
      await expect(page.getByTestId('notebook-card-context-menu:beta.md')).toBeVisible()
      await expect(betaCard.getByRole('button', { name: 'Open beta' })).toHaveAttribute(
        'aria-pressed',
        'true'
      )
      await expect(alphaCard.getByRole('button', { name: 'Open alpha' })).toHaveAttribute(
        'aria-pressed',
        'false'
      )
      await page.keyboard.press('Escape')

      await archiveCard.click({ button: 'right' })
      const archiveMenu = page.getByTestId('notebook-card-context-menu:archive')
      await expect(archiveMenu).toBeVisible()
      await expect(
        archiveMenu.getByRole('menuitem', { name: 'Export nested notes', exact: true })
      ).toBeVisible()
      await archiveMenu.getByRole('menuitem', { name: 'Export nested notes', exact: true }).hover()
      await expect(page.getByRole('menuitem', { name: 'as PDF', exact: true })).toBeVisible()
      await page.keyboard.press('Escape')
      await page.keyboard.press('Escape')

      const contentBox = await content.boundingBox()
      if (!contentBox) {
        throw new Error('Notebook browser content bounds are unavailable')
      }

      await page.mouse.click(
        contentBox.x + Math.max(40, contentBox.width - 40),
        contentBox.y + Math.max(40, contentBox.height - 40),
        { button: 'right' }
      )
      const browserMenu = page.getByTestId('notebook-browser-context-menu')
      await expect(browserMenu).toBeVisible()
      await expect(
        browserMenu.getByRole('menuitem', { name: 'New folder', exact: true })
      ).toBeVisible()
      await page.keyboard.press('Escape')

      await archiveCard.getByRole('button', { name: 'Open folder archive' }).click()
      await expect(browser.getByTestId('notebook-card-empty-state')).toBeVisible()

      const emptyContentBox = await content.boundingBox()
      if (!emptyContentBox) {
        throw new Error('Empty notebook browser content bounds are unavailable')
      }

      await page.mouse.click(emptyContentBox.x + 16, emptyContentBox.y + 16, { button: 'right' })
      await expect(browserMenu).toBeVisible()
      await expect(
        browserMenu.getByRole('menuitem', { name: 'New note', exact: true })
      ).toBeVisible()
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('shows an upright floating preview while dragging a notebook card', async () => {
    const vaultRoot = await createFixtureVault('Alpha note\n')
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      const source = page.getByTestId('notebook-card-browser').getByTestId('notebook-card:alpha.md')
      await expect(source).toBeVisible()

      await page.evaluate(() => {
        const source = document.querySelector<HTMLElement>('[data-testid="notebook-card:alpha.md"]')
        if (!source) {
          throw new Error('Notebook card drag fixture is missing')
        }

        const rect = source.getBoundingClientRect()
        const dataTransfer = new DataTransfer()
        source.dispatchEvent(
          new DragEvent('dragstart', {
            bubbles: true,
            cancelable: true,
            dataTransfer,
            clientX: rect.left + rect.width / 2,
            clientY: rect.top + rect.height / 2
          })
        )
      })

      const floatingPreview = page.locator('[data-floating-drag-preview="true"]')
      await expect(floatingPreview).toBeVisible()
      await expect
        .poll(() =>
          floatingPreview.evaluate((element) => {
            const transform = getComputedStyle(element).transform
            if (transform === 'none') {
              return true
            }
            const matrix = new DOMMatrixReadOnly(transform)
            return Math.abs(matrix.b) <= 0.01 && Math.abs(matrix.c) <= 0.01
          })
        )
        .toBe(true)
      await expect(source).toHaveAttribute('data-dragging', 'true')

      await page.evaluate(() => {
        const source = document.querySelector<HTMLElement>('[data-testid="notebook-card:alpha.md"]')
        source?.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true }))
      })

      await expect(floatingPreview).toHaveCount(0)
      await expect(source).toHaveAttribute('data-dragging', 'false')
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('moves a notebook card into a folder by drag and drop', async () => {
    const vaultRoot = await createFixtureVault('Alpha note\n')
    await fs.mkdir(path.join(vaultRoot, 'notes', 'archive'), { recursive: true })
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      const source = page.getByTestId('notebook-card:alpha.md')
      const target = page.getByTestId('notebook-card:archive')
      await expect(source).toBeVisible()
      await expect(target).toBeVisible()

      await page.evaluate(() => {
        const source = document.querySelector<HTMLElement>('[data-testid="notebook-card:alpha.md"]')
        const target = document.querySelector<HTMLElement>('[data-testid="notebook-card:archive"]')
        if (!source || !target) {
          throw new Error('Notebook card folder-drop fixtures are missing')
        }

        const sourceRect = source.getBoundingClientRect()
        const targetRect = target.getBoundingClientRect()
        const dataTransfer = new DataTransfer()
        const clientX = targetRect.left + targetRect.width / 2
        const clientY = targetRect.top + targetRect.height / 2

        source.dispatchEvent(
          new DragEvent('dragstart', {
            bubbles: true,
            cancelable: true,
            dataTransfer,
            clientX: sourceRect.left + sourceRect.width / 2,
            clientY: sourceRect.top + sourceRect.height / 2
          })
        )
        target.dispatchEvent(
          new DragEvent('dragover', {
            bubbles: true,
            cancelable: true,
            dataTransfer,
            clientX,
            clientY
          })
        )
        target.dispatchEvent(
          new DragEvent('drop', {
            bubbles: true,
            cancelable: true,
            dataTransfer,
            clientX,
            clientY
          })
        )
        source.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true }))
      })

      await expect
        .poll(async () => {
          try {
            await fs.access(path.join(vaultRoot, 'notebooks', 'archive', 'alpha.md'))
            return true
          } catch {
            return false
          }
        })
        .toBe(true)
      await expect
        .poll(async () => {
          try {
            await fs.access(path.join(vaultRoot, 'notebooks', 'alpha.md'))
            return true
          } catch {
            return false
          }
        })
        .toBe(false)
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('moves a notebook card with a native pointer drag', async () => {
    const vaultRoot = await createFixtureVault('Alpha note\n')
    await fs.mkdir(path.join(vaultRoot, 'notes', 'archive'), { recursive: true })
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      const source = page.getByTestId('notebook-card:alpha.md')
      const target = page.getByTestId('notebook-card:archive')
      await expect(source).toBeVisible()
      await expect(target).toBeVisible()

      await source.dragTo(target, { steps: 20 })

      await expect
        .poll(async () => {
          try {
            await fs.access(path.join(vaultRoot, 'notebooks', 'archive', 'alpha.md'))
            return true
          } catch {
            return false
          }
        })
        .toBe(true)
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('moves a notebook folder with a native pointer drag', async () => {
    const vaultRoot = await createFixtureVault('Alpha note\n')
    await fs.mkdir(path.join(vaultRoot, 'notes', 'source'), { recursive: true })
    await fs.writeFile(
      path.join(vaultRoot, 'notes', 'source', 'nested.md'),
      serializeStoredNoteDocument(createStoredNoteDocumentFromText('Nested note\n')),
      'utf-8'
    )
    await fs.mkdir(path.join(vaultRoot, 'notes', 'target'), { recursive: true })
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      const source = page.getByTestId('notebook-card:source')
      const target = page.getByTestId('notebook-card:target')
      await expect(source).toBeVisible()
      await expect(target).toBeVisible()

      await source.dragTo(target, { steps: 20 })

      await expect
        .poll(async () => {
          try {
            await fs.access(path.join(vaultRoot, 'notebooks', 'target', 'source', 'nested.md'))
            return true
          } catch {
            return false
          }
        })
        .toBe(true)
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('moves a file with a native pointer drag in the right-panel file tree', async () => {
    const vaultRoot = await createFixtureVault('Alpha note\n')
    await fs.mkdir(path.join(vaultRoot, 'notes', 'archive'), { recursive: true })
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      const source = page.getByTestId('note-tree-row:alpha.md')
      const target = page.getByTestId('note-tree-row:archive')
      await expect(source).toBeVisible()
      await expect(target).toBeVisible()

      await source.dragTo(target, { steps: 20 })

      await expect(page.getByTestId('note-tree-row:archive/alpha.md')).toBeVisible({
        timeout: 20_000
      })
      await expect
        .poll(async () => {
          try {
            await fs.access(path.join(vaultRoot, 'notebooks', 'archive', 'alpha.md'))
            return true
          } catch {
            return false
          }
        })
        .toBe(true)
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('moves a folder with a native pointer drag in the right-panel file tree', async () => {
    const vaultRoot = await createFixtureVault('Alpha note\n')
    await fs.mkdir(path.join(vaultRoot, 'notes', 'source'), { recursive: true })
    await fs.writeFile(
      path.join(vaultRoot, 'notes', 'source', 'nested.md'),
      serializeStoredNoteDocument(createStoredNoteDocumentFromText('Nested note\n')),
      'utf-8'
    )
    await fs.mkdir(path.join(vaultRoot, 'notes', 'archive'), { recursive: true })
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      const source = page.getByTestId('note-tree-row:source')
      const target = page.getByTestId('note-tree-row:archive')
      await expect(source).toBeVisible()
      await expect(target).toBeVisible()

      await source.dragTo(target, { steps: 20 })

      await expect(page.getByTestId('note-tree-row:archive/source')).toBeVisible({
        timeout: 20_000
      })
      await expect
        .poll(async () => {
          try {
            await fs.access(path.join(vaultRoot, 'notebooks', 'archive', 'source', 'nested.md'))
            return true
          } catch {
            return false
          }
        })
        .toBe(true)
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('shows surfaced previews and highlights valid right-panel folder drops', async () => {
    const vaultRoot = await createFixtureVault('Alpha note\n')
    await fs.mkdir(path.join(vaultRoot, 'notes', 'source'), { recursive: true })
    await fs.writeFile(
      path.join(vaultRoot, 'notes', 'source', 'nested.md'),
      serializeStoredNoteDocument(createStoredNoteDocumentFromText('Nested note\n')),
      'utf-8'
    )
    await fs.mkdir(path.join(vaultRoot, 'notes', 'archive'), { recursive: true })
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      const target = page.getByTestId('note-tree-row:archive')
      const preview = page.getByTestId('note-tree-drag-preview')
      await expect(target).toBeVisible()

      await startNoteTreeDrag(page, 'alpha.md', 'archive')

      await expect(preview).toBeVisible({ timeout: 10_000 })
      await expect(preview).toHaveAttribute('data-drag-preview-variant', 'surface')
      await expect
        .poll(() => preview.evaluate((element) => getComputedStyle(element).backgroundColor))
        .not.toMatch(/transparent|rgba\(0, 0, 0, 0\)/)
      await expect(target).toHaveAttribute('data-drag-over', 'true')

      await endNoteTreeDrag(page, 'alpha.md')
      await expect(preview).toHaveCount(0)
      await expect(target).toHaveAttribute('data-drag-over', 'false')

      await startNoteTreeDrag(page, 'source', 'archive')

      await expect(preview).toBeVisible({ timeout: 10_000 })
      await expect(preview).toContainText('source')
      await expect(target).toHaveAttribute('data-drag-over', 'true')
      await endNoteTreeDrag(page, 'source')
      await expect(preview).toHaveCount(0)
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('opens the note export dialog and selects PDF', async () => {
    const vaultRoot = await createFixtureVault('Export me\n')
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openNote(page, 'alpha.md')
      await expect(page.getByTestId('note-block-editor')).toBeVisible()
      await page.getByTestId('workspace-page-context-menu-trigger').click()
      await expect(page.getByTestId('workspace-page-context-menu')).toBeVisible()
      await page.getByTestId('workspace-page-context-menu-item:export-note').click()
      const dialog = page.getByTestId('note-export-dialog')
      await expect(dialog).toBeVisible()
      await expect(
        page.getByTestId('note-export-format:markdown').locator('input[type="radio"]')
      ).toBeChecked()

      await page.getByTestId('note-export-format:pdf').click()
      await expect(
        page.getByTestId('note-export-format:pdf').locator('input[type="radio"]')
      ).toBeChecked()
      await expect(
        dialog.getByRole('button', { name: 'Close export dialog', exact: true })
      ).toBeVisible()
      await expect(dialog.getByRole('button', { name: 'Export PDF' })).toBeVisible()
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

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

  test('keeps independent notebook sessions in separate workspace tabs', async () => {
    const vaultRoot = await createFixtureVault('Alpha note\n')
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await expect
        .poll(async () =>
          page.evaluate(() => {
            const tab = document.querySelector<HTMLElement>(
              '[data-toggle-group-indicator-target="true"][data-active="true"]'
            )
            const indicator = document.querySelector<HTMLElement>(
              '[data-toggle-group-indicator="true"]'
            )

            if (!tab || !indicator) {
              return null
            }

            return {
              tabRadius: window.getComputedStyle(tab).borderRadius,
              indicatorRadius: window.getComputedStyle(indicator).borderRadius,
              tabOverflow: window.getComputedStyle(tab).overflow
            }
          })
        )
        .toEqual({
          tabRadius: '8px',
          indicatorRadius: '8px',
          tabOverflow: 'hidden'
        })

      const tabCard = page.locator('.workspace-tab-card').first()
      const tabCloseButton = page.getByTestId('workspace-tab-close:workspace-tab-1')
      const readTabAffordanceState = async (): Promise<{
        closeOpacity: string
        shortcutOpacity: string
        hasMaskImage: boolean
      }> =>
        page.evaluate(() => {
          const close = document.querySelector<HTMLElement>(
            '[data-testid="workspace-tab-close:workspace-tab-1"]'
          )
          const shortcut = document.querySelector<HTMLElement>(
            '[data-testid="workspace-tab-shortcut:workspace-tab-1"]'
          )
          const label = document.querySelector<HTMLElement>(
            '[data-testid="workspace-tab-label:workspace-tab-1"]'
          )
          if (!close || !shortcut || !label) {
            throw new Error('Expected workspace tab affordances')
          }
          const labelStyles = window.getComputedStyle(label)
          return {
            closeOpacity: window.getComputedStyle(close).opacity,
            shortcutOpacity: window.getComputedStyle(shortcut).opacity,
            hasMaskImage: labelStyles.maskImage !== 'none' || labelStyles.webkitMaskImage !== 'none'
          }
        })

      await expect.poll(readTabAffordanceState).toEqual({
        closeOpacity: '0',
        shortcutOpacity: '0',
        hasMaskImage: false
      })
      await tabCard.hover()
      await expect.poll(readTabAffordanceState).toEqual({
        closeOpacity: '1',
        shortcutOpacity: '1',
        hasMaskImage: true
      })
      await tabCloseButton.hover()
      await expect
        .poll(() =>
          tabCloseButton.evaluate((element) => window.getComputedStyle(element).backgroundColor)
        )
        .not.toBe('rgba(0, 0, 0, 0)')
      await page.getByTestId('workspace-tab:workspace-tab-1').focus()
      await expect.poll(readTabAffordanceState).toEqual({
        closeOpacity: '1',
        shortcutOpacity: '1',
        hasMaskImage: true
      })

      await openNote(page, 'alpha.md')
      await replaceEditorContent(page, ['Tab one draft'])

      await page.getByTestId('workspace-tab-add').click()
      await expect(page.getByTestId('workspace-tab:workspace-tab-2')).toBeVisible()
      await expect.poll(async () => (await getCurrentNoteSnapshot(page)).path).toBeNull()

      await openNote(page, 'beta.md')
      await replaceEditorContent(page, ['Tab two draft'])

      await page.getByTestId('workspace-tab:workspace-tab-1').click()
      await expect
        .poll(async () => getCurrentNoteSnapshot(page), { timeout: 15_000 })
        .toMatchObject({ path: 'alpha.md', content: expect.stringContaining('Tab one draft') })
      const firstTab = page.getByTestId('workspace-tab:workspace-tab-1')
      await expect(firstTab).toContainText('alpha')
      await expect(firstTab).not.toContainText('Notebooks')

      await page.getByTestId('workspace-tab:workspace-tab-2').click()
      await expect
        .poll(async () => getCurrentNoteSnapshot(page), { timeout: 15_000 })
        .toMatchObject({ path: 'beta.md', content: expect.stringContaining('Tab two draft') })
      const secondTab = page.getByTestId('workspace-tab:workspace-tab-2')
      await expect(secondTab).toContainText('beta')
      await expect(secondTab).not.toContainText('Notebooks')

      await openNote(page, 'alpha.md')
      await replaceEditorContent(page, ['Duplicate note draft'])

      await page.getByTestId('workspace-tab:workspace-tab-1').click()
      await expect
        .poll(async () => getCurrentNoteSnapshot(page), { timeout: 15_000 })
        .toMatchObject({ path: 'alpha.md', content: expect.stringContaining('Tab one draft') })

      await page.getByTestId('workspace-tab:workspace-tab-2').click()
      await expect
        .poll(async () => getCurrentNoteSnapshot(page), { timeout: 15_000 })
        .toMatchObject({
          path: 'alpha.md',
          content: expect.stringContaining('Duplicate note draft')
        })
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
      await expectNotePanelReady(page)
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
      await expectNotePanelReady(page)

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
      await expectNotePanelReady(page)
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

  test('saves callout edits before tag search unmounts the editor', async () => {
    const vaultRoot = await createFixtureVault('', ['alpha'])
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openNote(page, 'alpha.md')
      await replaceEditorContent(page, ['> [!NOTE] Tag search keeps callout save'])

      await page.getByRole('button', { name: 'Note tags selection', exact: true }).click()
      const tagPopover = page.getByTestId('note-tags-editor-popover')
      await tagPopover.getByRole('button', { name: 'Search tag alpha', exact: true }).click()
      await expect(page.getByText('alpha.md')).toBeVisible({ timeout: 15_000 })

      await page
        .getByRole('button', { name: /alpha\.md/ })
        .first()
        .click()
      await expect
        .poll(async () => (await getCurrentNoteSnapshot(page)).content, { timeout: 15_000 })
        .toContain('Tag search keeps callout save')

      await expect
        .poll(() => readNoteFromDisk(page, 'alpha.md'), { timeout: 15_000 })
        .toContain('Tag search keeps callout save')
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('does not reload the current note from cache when selecting it again', async () => {
    const vaultRoot = await createFixtureVault('')
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openNote(page, 'alpha.md')
      await replaceEditorContent(page, ['Same note click keeps body'])
      await page.keyboard.type(' latest')

      await page.getByTestId('note-tree-row:alpha.md').click()

      await expect
        .poll(async () => (await getCurrentNoteSnapshot(page)).content, { timeout: 15_000 })
        .toContain('Same note click keeps body latest')

      await dispatchPageHide(page)
      await expect
        .poll(() => readNoteFromDisk(page, 'alpha.md'), { timeout: 15_000 })
        .toContain('Same note click keeps body latest')
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
      await expectNotePanelReady(page)
      await openNote(page, 'alpha.md')
      await expect
        .poll(async () => (await getCurrentNoteSnapshot(page)).content, { timeout: 15_000 })
        .toContain('Back and forth save latest')
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('saves the current note when switching to knowledge after waiting', async () => {
    const vaultRoot = await createFixtureVault('')
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openNote(page, 'alpha.md')
      await replaceEditorContent(page, ['Knowledge page save'])
      await page.keyboard.type(' latest')
      await page.waitForTimeout(2200)

      await page.getByTestId('sidebar-page:knowledge').click()
      await expect(page.getByTestId('sidebar-page:knowledge')).toHaveAttribute(
        'data-active',
        'true'
      )

      await expect
        .poll(() => getLastPageLeaveSaveDebug(page), { timeout: 15_000 })
        .toMatchObject({
          requestedPage: 'knowledge',
          notePath: 'alpha.md',
          attempted: true,
          writeCompleted: true,
          lastError: null
        })
      await expect
        .poll(async () => (await getLastPageLeaveSaveDebug(page)).snapshotContent, {
          timeout: 15_000
        })
        .toContain('Knowledge page save latest')
      await expect
        .poll(() => readNoteFromDisk(page, 'alpha.md'), { timeout: 15_000 })
        .toContain('Knowledge page save latest')
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

  test('uses a compact heading hierarchy in the Milkdown editor', async () => {
    const vaultRoot = await createFixtureVault(
      [
        '# Heading 1',
        'Body text',
        '## Heading 2',
        '### Heading 3',
        '#### Heading 4',
        '##### Heading 5',
        '###### Heading 6'
      ].join('\n\n')
    )
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openNote(page, 'alpha.md')
      const typography = await page
        .locator('[data-testid="note-block-editor"] .ProseMirror')
        .evaluate((editor) => {
          const readStyle = (
            selector: string
          ): { fontSize: string; lineHeight: string; marginTop: string } => {
            const element = editor.querySelector<HTMLElement>(selector)
            if (!element) {
              throw new Error(`Missing editor element: ${selector}`)
            }

            const styles = window.getComputedStyle(element)
            return {
              fontSize: styles.fontSize,
              lineHeight: styles.lineHeight,
              marginTop: styles.marginTop
            }
          }

          return {
            paragraph: readStyle('p'),
            h1: readStyle('h1'),
            h2: readStyle('h2'),
            h3: readStyle('h3'),
            h4: readStyle('h4'),
            h5: readStyle('h5'),
            h6: readStyle('h6')
          }
        })

      expect(typography).toEqual({
        paragraph: { fontSize: '15px', lineHeight: '22px', marginTop: '0px' },
        h1: { fontSize: '26px', lineHeight: '32px', marginTop: '24px' },
        h2: { fontSize: '23px', lineHeight: '29px', marginTop: '20px' },
        h3: { fontSize: '20px', lineHeight: '26px', marginTop: '16px' },
        h4: { fontSize: '18px', lineHeight: '24px', marginTop: '14px' },
        h5: { fontSize: '17px', lineHeight: '22px', marginTop: '12px' },
        h6: { fontSize: '16px', lineHeight: '21px', marginTop: '10px' }
      })
      expect(Number.parseFloat(typography.h6.fontSize)).toBeGreaterThan(
        Number.parseFloat(typography.paragraph.fontSize)
      )
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
      await expect(
        page.locator('[data-testid="note-block-editor"] .note-inline-latex-source-hidden')
      ).toBeHidden()

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
      await expect(
        page.locator('[data-testid="note-block-editor"] .note-inline-latex-source-hidden')
      ).toBeHidden()
      await expect
        .poll(async () => (await getCurrentNoteSnapshot(page)).content, { timeout: 15_000 })
        .toContain(markdown.trim())
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('renders LaTeX only on logical lines outside the cursor line', async () => {
    const vaultRoot = await createFixtureVault('')
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openNote(page, 'alpha.md')

      const editor = page.locator('[data-testid="note-block-editor"] [contenteditable="true"]')
      await editor.click()
      await page.keyboard.type('First line $x^2$')
      await page.keyboard.press('Shift+Enter')
      await page.keyboard.type('Second line $y^2$')

      const firstPreview = page.locator(
        '[data-testid="note-block-editor"] .note-inline-latex-preview[data-latex="x^2"]'
      )
      const secondPreview = page.locator(
        '[data-testid="note-block-editor"] .note-inline-latex-preview[data-latex="y^2"]'
      )
      const firstSource = page.locator(
        '[data-testid="note-block-editor"] .note-inline-latex-source[data-latex-source="true"]'
      )

      await expect(firstPreview.locator('.katex')).toBeVisible({ timeout: 15_000 })
      await expect(secondPreview).toHaveCount(0)
      await expect(firstSource).toBeHidden()
      await expect(
        page.locator('[data-testid="note-block-editor"] .note-inline-latex-source')
      ).toContainText('$y^2$')

      await editor.press('ArrowUp')

      await expect(firstPreview).toHaveCount(0)
      await expect(
        page.locator('[data-testid="note-block-editor"] .note-inline-latex-source')
      ).toContainText('$x^2$')
      await expect(secondPreview.locator('.katex')).toBeVisible({ timeout: 15_000 })
      await expect(
        page.locator(
          '[data-testid="note-block-editor"] .note-inline-latex-source-hidden[data-latex-source="true"]'
        )
      ).toBeHidden()
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

      await editor.press('Enter')
      await editor.pressSequentially('Away from the error')
      await expect(invalidSource).toBeVisible()

      await editor.press('ArrowUp')
      await editor.press('End')
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

  test('opens slash completion and applies block commands', async () => {
    const vaultRoot = await createFixtureVault('')
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openNote(page, 'alpha.md')

      const editor = page
        .locator('[data-testid="note-block-editor"] [contenteditable="true"]')
        .first()
      await editor.click()

      await page.keyboard.type('/h2')
      await expect(page.getByTestId('note-slash-completion')).toBeVisible({ timeout: 10_000 })
      await expect(page.getByPlaceholder('Search commands')).toBeVisible()
      await expect(page.getByTestId('note-slash-completion').getByText('Heading 2')).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(page.getByTestId('note-slash-completion')).toBeHidden()
      await expect.poll(async () => (await getCurrentNoteSnapshot(page)).content).toBe('')

      await page.keyboard.type('/h2')
      await expect(page.getByTestId('note-slash-completion')).toBeVisible({ timeout: 10_000 })
      await page.keyboard.press('Enter')
      await page.keyboard.type('Heading from slash')
      await page.keyboard.press('Enter')

      await page.keyboard.type('/bullet')
      await expect(page.getByTestId('note-slash-completion')).toBeVisible({ timeout: 10_000 })
      await page.keyboard.press('Enter')
      await page.keyboard.type('Bullet from slash')

      await expect
        .poll(async () => (await getCurrentNoteSnapshot(page)).content, { timeout: 15_000 })
        .toContain('## Heading from slash')
      await expect
        .poll(async () => (await getCurrentNoteSnapshot(page)).content, { timeout: 15_000 })
        .toContain('- Bullet from slash')
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('keeps slash and note-link popovers navigable and dismissible', async () => {
    const vaultRoot = await createFixtureVault('')
    await fs.writeFile(
      path.join(vaultRoot, 'notes', 'gamma.md'),
      serializeStoredNoteDocument(createStoredNoteDocumentFromText('Third note\n')),
      'utf-8'
    )
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openNote(page, 'alpha.md')

      const editor = page
        .locator('[data-testid="note-block-editor"] [contenteditable="true"]')
        .first()
      await editor.click()

      await page.keyboard.type('/')
      const slashPopover = page.getByTestId('note-slash-completion')
      await expect(slashPopover).toBeVisible({ timeout: 10_000 })
      const slashItems = slashPopover.locator('[cmdk-item]')
      await expect(slashItems.first()).toHaveAttribute('data-selected', 'true')
      await page.keyboard.press('ArrowDown')
      await expect(slashItems.nth(1)).toHaveAttribute('data-selected', 'true')
      await page.keyboard.press('ArrowUp')
      await expect(slashItems.first()).toHaveAttribute('data-selected', 'true')
      await page.keyboard.press('Escape')
      await expect(slashPopover).toBeHidden()

      await editor.click()
      await page.keyboard.type('[[')
      const notePopover = page.getByTestId('note-link-completion')
      await expect(notePopover).toBeVisible({ timeout: 10_000 })
      const noteItems = notePopover.locator('[cmdk-item]')
      await expect(noteItems).toHaveCount(2)
      await expect(noteItems.first()).toHaveAttribute('data-selected', 'true')
      await page.keyboard.press('ArrowDown')
      await expect(noteItems.nth(1)).toHaveAttribute('data-selected', 'true')
      await page.keyboard.press('ArrowUp')
      await expect(noteItems.first()).toHaveAttribute('data-selected', 'true')
      await page.keyboard.press('Escape')
      await expect(notePopover).toBeHidden()
      await expect
        .poll(async () =>
          page.evaluate(() => document.activeElement?.closest('[contenteditable="true"]') !== null)
        )
        .toBe(true)

      await page.keyboard.type('x')
      await expect(notePopover).toBeVisible({ timeout: 10_000 })
      await editor.click()
      await expect(notePopover).toBeHidden()
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('keeps note selection popovers open while an autosave settles', async () => {
    const vaultRoot = await createFixtureVault('', ['alpha'])
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await delayNoteDocumentWrites(page, 800)
      await openNote(page, 'alpha.md')
      const editor = page
        .locator('[data-testid="note-block-editor"] [contenteditable="true"]')
        .first()

      await editor.click()
      await page.keyboard.type('Draft before slash')
      await page.keyboard.press('Enter')
      await page.waitForTimeout(1_300)
      await page.keyboard.type('/')
      const slashPopover = page.getByTestId('note-slash-completion')
      await expect(slashPopover).toBeVisible({ timeout: 10_000 })
      await page.waitForTimeout(1_600)
      await expect(slashPopover).toBeVisible()

      await page.keyboard.press('Escape')
      await expect(slashPopover).toBeHidden()
      await page.keyboard.type('Draft before link')
      await page.keyboard.press('Enter')
      await page.keyboard.type('[[')
      const linkPopover = page.getByTestId('note-link-completion')
      await expect(linkPopover).toBeVisible({ timeout: 10_000 })
      await page.waitForTimeout(1_600)
      await expect(linkPopover).toBeVisible()

      await page.keyboard.press('Escape')
      await expect(linkPopover).toBeHidden()
      await editor.click()
      await page.keyboard.type('Draft before tags')
      const tagTrigger = page.getByRole('button', { name: 'Note tags selection', exact: true })
      await tagTrigger.click()
      const tagPopover = page.getByTestId('note-tags-editor-popover')
      await expect(tagPopover).toBeVisible({ timeout: 10_000 })
      await page.waitForTimeout(1_600)
      await expect(tagPopover).toBeVisible()
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('creates slash code blocks that preserve fenced markdown and copy text', async () => {
    const vaultRoot = await createFixtureVault('')
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openNote(page, 'alpha.md')
      await insertCodeBlockFromSlash(page)
      await focusFirstCodeBlock(page)

      const codeBlockRoot = page
        .locator('[data-testid="note-block-editor"] .milkdown-code-block')
        .first()
      const codeBlock = codeBlockRoot.locator('.note-code-block-body')
      const expectedBorderWidth = await codeBlock.evaluate((element) =>
        getComputedStyle(element).getPropertyValue('--border-width').trim()
      )
      await expect(codeBlock).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
      await expect(codeBlock).toHaveCSS('border-top-style', 'solid')
      await expect(codeBlock).toHaveCSS('border-top-width', expectedBorderWidth)
      await expect(codeBlock.locator('code')).toHaveCSS('font-family', /JetBrains Mono/)
      await expect(codeBlockRoot.locator('.tools')).toHaveCount(0)

      const copyButton = codeBlockRoot.locator('> .copy-button')
      await expect(copyButton).toHaveCSS('position', 'absolute')
      await expect(copyButton).toHaveCSS('width', '28px')
      await expect(copyButton).toHaveCSS('height', '28px')

      await page.keyboard.type('const value = 42')
      await page.keyboard.press('Enter')
      await page.keyboard.type('console.log(value)')

      await expect
        .poll(async () => (await getCurrentNoteSnapshot(page)).content, { timeout: 15_000 })
        .toContain('```\nconst value = 42\nconsole.log(value)\n```')

      await expect(copyButton).toBeVisible()
      await expect(copyButton).toHaveAttribute('aria-label', 'Copy code block')
      await expect(copyButton).toHaveAttribute('title', 'Copy code block')
      await expect(copyButton).not.toContainText('Copy')
      await copyButton.click()

      await expect(copyButton).toHaveAttribute('data-state', 'copied')

      await expect
        .poll(async () => page.evaluate(() => navigator.clipboard.readText()))
        .toBe('const value = 42\nconsole.log(value)')

      await focusFirstCodeBlock(page)
      await page.keyboard.press('Enter')
      await page.keyboard.type('return value')

      await expect
        .poll(async () => (await getCurrentNoteSnapshot(page)).content, { timeout: 15_000 })
        .toContain('```\nconst value = 42\nconsole.log(value)\nreturn value\n```')
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('highlights Python and JavaScript fenced code blocks', async () => {
    const initialMarkdown = [
      '```py',
      '# python comment',
      'def greet(name):',
      '    return "hello"',
      '```',
      '',
      '```js',
      '// javascript comment',
      'function greet(name) {',
      '  const message = "hello " + name',
      '  return message',
      '}',
      '```'
    ].join('\n')
    const vaultRoot = await createFixtureVault(initialMarkdown)
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openNote(page, 'alpha.md')

      const editor = page.getByTestId('note-block-editor')
      const pythonBlock = editor.locator('.milkdown-code-block[data-language="py"]')
      const javascriptBlock = editor.locator('.milkdown-code-block[data-language="js"]')

      await expect(pythonBlock).toBeVisible({ timeout: 15_000 })
      await expect(javascriptBlock).toBeVisible({ timeout: 15_000 })
      await expect(pythonBlock.locator('.code-token-comment')).toContainText('python comment')
      await expect(pythonBlock.getByText('def', { exact: true })).toBeVisible()
      await expect(pythonBlock.locator('.code-token-string')).toContainText('"hello"')
      await expect(javascriptBlock.locator('.code-token-comment')).toContainText(
        'javascript comment'
      )
      await expect(javascriptBlock.getByText('const', { exact: true })).toBeVisible()
      await expect(javascriptBlock.getByText('greet', { exact: true })).toBeVisible()
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('supports Vim motions and edits inside code blocks', async () => {
    const initialMarkdown = ['Before', '', '```ts', 'alpha', '```', '', 'After'].join('\n')
    const vaultRoot = await createFixtureVault(initialMarkdown)
    await fs.writeFile(
      path.join(vaultRoot, 'settings.json'),
      JSON.stringify({ editorVimModeEnabled: true }, null, 2),
      'utf-8'
    )
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openNote(page, 'alpha.md')

      await page.getByText('Before', { exact: true }).click({ position: { x: 4, y: 8 } })
      await page.keyboard.press('Escape')
      await expect(page.getByTestId('note-vim-mode-badge')).toHaveText('normal')

      await page.keyboard.press('j')
      await page.keyboard.press('0')
      await page.keyboard.press('i')
      await expect(page.getByTestId('note-vim-mode-badge')).toHaveText('insert')
      await page.keyboard.type('z')
      await page.keyboard.press('Escape')
      await expect(page.getByTestId('note-vim-mode-badge')).toHaveText('normal')
      await expect
        .poll(async () => (await getCurrentNoteSnapshot(page)).content, { timeout: 15_000 })
        .toContain('```ts\nzalpha\n```')

      await page.keyboard.press('x')
      await expect
        .poll(async () => (await getCurrentNoteSnapshot(page)).content, { timeout: 15_000 })
        .toContain('```ts\nzlpha\n```')

      await page.keyboard.press('j')
      await page.keyboard.press('i')
      await page.keyboard.type('!')
      await expect(page.getByTestId('note-vim-mode-badge')).toHaveText('insert')
      await expect
        .poll(async () => (await getCurrentNoteSnapshot(page)).content, { timeout: 15_000 })
        .toContain('!After')
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('supports core Vim mode without intercepting slash completion', async () => {
    const vaultRoot = await createFixtureVault('')
    await fs.writeFile(
      path.join(vaultRoot, 'settings.json'),
      JSON.stringify(
        {
          editorVimModeEnabled: true,
          editorVimKeyMappings: [
            {
              id: 'escape-ij',
              mode: 'insert',
              sequence: 'ij',
              action: 'enterNormalMode'
            }
          ]
        },
        null,
        2
      ),
      'utf-8'
    )
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openNote(page, 'alpha.md')

      const editor = page
        .locator('[data-testid="note-block-editor"] [contenteditable="true"]')
        .first()
      await editor.click()

      await expect(page.getByTestId('note-vim-mode-badge')).toHaveText('insert')
      await page.keyboard.type('abc')
      await expect.poll(async () => (await getCurrentNoteSnapshot(page)).content).toBe('abc')

      await page.keyboard.press('Escape')
      await expect(page.getByTestId('note-vim-mode-badge')).toHaveText('normal')
      await expect(page.getByTestId('note-vim-mode-badge-icon')).toHaveCount(0)
      await expect(page.getByTestId('note-block-editor')).toHaveAttribute('data-vim-mode', 'normal')
      await expect(
        page.locator(
          '[data-testid="note-block-editor"] .note-vim-block-cursor-char, [data-testid="note-block-editor"] .note-vim-block-cursor-empty'
        )
      ).toHaveCount(1)
      const badgeMetrics = await page.getByTestId('note-vim-mode-badge').evaluate((node) => {
        const element = node as HTMLElement
        const rect = element.getBoundingClientRect()
        return {
          width: rect.width,
          height: rect.height,
          scrollWidth: element.scrollWidth,
          clientWidth: element.clientWidth,
          scrollHeight: element.scrollHeight,
          clientHeight: element.clientHeight,
          whiteSpace: window.getComputedStyle(element).whiteSpace
        }
      })
      expect(badgeMetrics.width).toBeGreaterThan(20)
      expect(badgeMetrics.height).toBeGreaterThan(10)
      expect(badgeMetrics.scrollWidth).toBeLessThanOrEqual(badgeMetrics.clientWidth + 1)
      expect(badgeMetrics.scrollHeight).toBeLessThanOrEqual(badgeMetrics.clientHeight + 1)
      expect(badgeMetrics.whiteSpace).toBe('nowrap')
      await page.keyboard.press('h')
      await page.keyboard.press('j')
      await page.keyboard.press('k')
      await page.keyboard.press('l')
      await expect.poll(async () => (await getCurrentNoteSnapshot(page)).content).toBe('abc')

      await page.keyboard.press('i')
      await expect(page.getByTestId('note-vim-mode-badge')).toHaveText('insert')
      await expect(page.getByTestId('note-block-editor')).toHaveAttribute('data-vim-mode', 'insert')
      await expect(
        page.locator(
          '[data-testid="note-block-editor"] .note-vim-block-cursor-char, [data-testid="note-block-editor"] .note-vim-block-cursor-empty'
        )
      ).toHaveCount(0)
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A')
      await page.keyboard.press('Backspace')
      await page.keyboard.type('xyij')
      await expect.poll(async () => (await getCurrentNoteSnapshot(page)).content).toBe('xy')
      await expect(page.getByTestId('note-vim-mode-badge')).toHaveText('normal')

      await page.keyboard.press('i')
      await expect(page.getByTestId('note-vim-mode-badge')).toHaveText('insert')
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A')
      await page.keyboard.press('Backspace')

      await page.keyboard.type('/h2')
      await expect(page.getByTestId('note-slash-completion')).toBeVisible({ timeout: 10_000 })
      await page.keyboard.press('Escape')
      await expect(page.getByTestId('note-slash-completion')).toBeHidden()
      await expect(page.getByTestId('note-vim-mode-badge')).toHaveText('insert')
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('shows a rectangular block cursor in Vim normal mode', async () => {
    const vaultRoot = await createFixtureVault('abc\n')
    await fs.writeFile(
      path.join(vaultRoot, 'settings.json'),
      JSON.stringify({ editorVimModeEnabled: true }, null, 2),
      'utf-8'
    )
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openNote(page, 'alpha.md')
      await page.getByText('abc', { exact: true }).click({ position: { x: 4, y: 8 } })
      await page.keyboard.press('Escape')
      await expect(page.getByTestId('note-vim-mode-badge')).toHaveText('normal')

      const cursor = page.locator('[data-testid="note-block-editor"] .note-vim-block-cursor-char')
      await expect(cursor).toHaveCount(1)

      const cursorMetrics = await cursor.evaluate((node) => {
        const element = node as HTMLElement
        const rect = element.getBoundingClientRect()
        const styles = window.getComputedStyle(element)
        const editor = element.closest('.ProseMirror')
        const resolveColor = (property: 'backgroundColor' | 'color', token: string): string => {
          const probe = document.createElement('span')
          probe.style[property] = `var(${token})`
          document.body.append(probe)
          const value = window.getComputedStyle(probe)[property]
          probe.remove()
          return value
        }

        return {
          display: styles.display,
          backgroundColor: styles.backgroundColor,
          color: styles.color,
          expectedBackgroundColor: resolveColor('backgroundColor', '--primary'),
          expectedColor: resolveColor('color', '--primary-foreground'),
          borderRadius: styles.borderRadius,
          width: rect.width,
          height: rect.height,
          caretColor: editor ? window.getComputedStyle(editor).caretColor : null
        }
      })

      expect(cursorMetrics.display).toBe('inline-block')
      expect(cursorMetrics.backgroundColor).toBe(cursorMetrics.expectedBackgroundColor)
      expect(cursorMetrics.color).toBe(cursorMetrics.expectedColor)
      expect(cursorMetrics.borderRadius).toBe('0px')
      expect(cursorMetrics.width).toBeGreaterThan(0)
      expect(cursorMetrics.height).toBeGreaterThan(cursorMetrics.width)
      expect(cursorMetrics.caretColor).toBe('rgba(0, 0, 0, 0)')
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('keeps normal-mode h and l inside the current logical line', async () => {
    const vaultRoot = await createFixtureVault('Alpha\nBeta\n')
    await fs.writeFile(
      path.join(vaultRoot, 'settings.json'),
      JSON.stringify({ editorVimModeEnabled: true }, null, 2),
      'utf-8'
    )
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openNote(page, 'alpha.md')

      const editorRoot = page.getByTestId('note-block-editor')

      await editorRoot.getByText('Alpha', { exact: true }).click()
      await page.keyboard.press('Escape')
      await expect(page.getByTestId('note-vim-mode-badge')).toHaveText('normal')

      await page.keyboard.press('$')
      await page.keyboard.press('l')
      const alphaCursor = await getEditorSelectionState(page)
      expect(alphaCursor.anchorInEditor).toBe(true)
      expect(alphaCursor.anchorText).toBe('Alpha')
      expect(alphaCursor.anchorTextLength).not.toBeNull()
      expect(alphaCursor.anchorOffset).toBe((alphaCursor.anchorTextLength ?? 1) - 1)

      await page.keyboard.press('a')
      await expect(page.getByTestId('note-vim-mode-badge')).toHaveText('insert')
      await page.keyboard.type('!')
      await page.keyboard.press('Escape')
      await expect(page.getByTestId('note-vim-mode-badge')).toHaveText('normal')
      await expect
        .poll(async () => (await getCurrentNoteSnapshot(page)).content, { timeout: 15_000 })
        .toContain('Alpha!\nBeta')

      await editorRoot.getByText('Beta', { exact: true }).click()
      await page.keyboard.press('Escape')
      await expect(page.getByTestId('note-vim-mode-badge')).toHaveText('normal')

      await page.keyboard.press('0')
      await page.keyboard.press('h')
      const betaCursor = await getEditorSelectionState(page)
      expect(betaCursor.anchorInEditor).toBe(true)
      expect(betaCursor.anchorText).toBe('Beta')
      expect(betaCursor.anchorOffset).toBe(0)

      await page.keyboard.press('i')
      await expect(page.getByTestId('note-vim-mode-badge')).toHaveText('insert')
      await page.keyboard.type('?')
      await page.keyboard.press('Escape')
      await expect
        .poll(async () => (await getCurrentNoteSnapshot(page)).content, { timeout: 15_000 })
        .toContain('Alpha!\n?Beta')
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('moves j and k symmetrically through plain blockquotes', async () => {
    const vaultRoot = await createFixtureVault(
      'Above paragraph\n\n> Quoted middle\n\nBelow paragraph\n'
    )
    await fs.writeFile(
      path.join(vaultRoot, 'settings.json'),
      JSON.stringify({ editorVimModeEnabled: true }, null, 2),
      'utf-8'
    )
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openNote(page, 'alpha.md')

      const editorRoot = page.getByTestId('note-block-editor')
      await editorRoot.getByText('Quoted middle', { exact: true }).click()
      await page.keyboard.press('Escape')
      await expect(page.getByTestId('note-vim-mode-badge')).toHaveText('normal')

      await page.keyboard.press('j')
      let cursor = await getEditorSelectionState(page)
      expect(cursor.anchorInEditor).toBe(true)
      expect(cursor.anchorText).toBe('Below paragraph')

      await page.keyboard.press('k')
      cursor = await getEditorSelectionState(page)
      expect(cursor.anchorText).toBe('Quoted middle')

      await page.keyboard.press('k')
      cursor = await getEditorSelectionState(page)
      expect(cursor.anchorText).toBe('Above paragraph')
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('moves j and k symmetrically through styled callouts', async () => {
    const vaultRoot = await createFixtureVault(
      'Above paragraph\n\n> [!NOTE] Callout title\n\nBelow paragraph\n'
    )
    await fs.writeFile(
      path.join(vaultRoot, 'settings.json'),
      JSON.stringify({ editorVimModeEnabled: true }, null, 2),
      'utf-8'
    )
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openNote(page, 'alpha.md')

      const editorRoot = page.getByTestId('note-block-editor')
      await editorRoot.getByText('Callout title').click()
      await page.keyboard.press('Escape')
      await expect(page.getByTestId('note-vim-mode-badge')).toHaveText('normal')

      await page.keyboard.press('j')
      let cursor = await getEditorSelectionState(page)
      expect(cursor.anchorInEditor).toBe(true)
      expect(cursor.anchorText).toBe('Below paragraph')

      await page.keyboard.press('k')
      cursor = await getEditorSelectionState(page)
      expect(cursor.anchorText).toContain('Callout title')

      await page.keyboard.press('k')
      cursor = await getEditorSelectionState(page)
      expect(cursor.anchorText).toBe('Above paragraph')
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('preserves a sticky column across repeated j and k moves', async () => {
    const vaultRoot = await createFixtureVault(
      'Alpha target zone\n\n> Short\n\nWider paragraph ending\n'
    )
    await fs.writeFile(
      path.join(vaultRoot, 'settings.json'),
      JSON.stringify({ editorVimModeEnabled: true }, null, 2),
      'utf-8'
    )
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openNote(page, 'alpha.md')

      const editorRoot = page.getByTestId('note-block-editor')
      await editorRoot.getByText('Alpha target zone', { exact: true }).click()
      await page.keyboard.press('Escape')
      await expect(page.getByTestId('note-vim-mode-badge')).toHaveText('normal')

      await page.keyboard.press('0')
      for (let index = 0; index < 10; index += 1) {
        await page.keyboard.press('l')
      }

      const initialCursor = await getEditorSelectionState(page)
      expect(initialCursor.anchorText).toBe('Alpha target zone')
      expect(initialCursor.anchorOffset).toBe(10)

      await page.keyboard.press('j')
      await page.keyboard.press('j')
      await page.keyboard.press('k')
      await page.keyboard.press('k')

      const finalCursor = await getEditorSelectionState(page)
      expect(finalCursor.anchorText).toBe('Alpha target zone')
      expect(finalCursor.anchorOffset).toBe(initialCursor.anchorOffset)
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('treats wrapped content as one logical line for j and k', async () => {
    const wrappedLine =
      'This wrapped logical line is intentionally long so the note editor has to render it across multiple visual rows before the next real line begins. '.repeat(
        4
      )
    const vaultRoot = await createFixtureVault(`${wrappedLine}\nBelow logical line\n`)
    await fs.writeFile(
      path.join(vaultRoot, 'settings.json'),
      JSON.stringify({ editorVimModeEnabled: true }, null, 2),
      'utf-8'
    )
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openNote(page, 'alpha.md')

      const editorRoot = page.getByTestId('note-block-editor')
      const wrappedLineLocator = editorRoot.getByText(wrappedLine, { exact: true })
      const wrappedMetrics = await wrappedLineLocator.evaluate((node) => {
        const rect = (node as HTMLElement).getBoundingClientRect()
        return {
          height: rect.height
        }
      })
      expect(wrappedMetrics.height).toBeGreaterThan(30)

      await wrappedLineLocator.click()
      await page.keyboard.press('Escape')
      await expect(page.getByTestId('note-vim-mode-badge')).toHaveText('normal')

      await page.keyboard.press('j')
      let cursor = await getEditorSelectionState(page)
      expect(cursor.anchorInEditor).toBe(true)
      expect(cursor.anchorText).toBe('Below logical line')

      await page.keyboard.press('k')
      cursor = await getEditorSelectionState(page)
      expect(cursor.anchorText).toContain('This wrapped logical line is intentionally long')
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('supports Vim visual character and line selections', async () => {
    const vaultRoot = await createFixtureVault('')
    await fs.writeFile(
      path.join(vaultRoot, 'settings.json'),
      JSON.stringify({ editorVimModeEnabled: true }, null, 2),
      'utf-8'
    )
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openNote(page, 'alpha.md')

      const editor = page
        .locator('[data-testid="note-block-editor"] [contenteditable="true"]')
        .first()
      await editor.click()

      await page.keyboard.type('abc')
      await expect.poll(async () => (await getCurrentNoteSnapshot(page)).content).toBe('abc')

      await page.keyboard.press('Escape')
      await page.keyboard.press('g')
      await page.keyboard.press('g')
      await page.keyboard.press('v')
      await expect(page.getByTestId('note-vim-mode-badge')).toHaveText('visual')
      await expect(page.getByTestId('note-block-editor')).toHaveAttribute('data-vim-mode', 'visual')
      await page.keyboard.press('l')
      await page.keyboard.press('l')
      await page.keyboard.press('d')
      await expect(page.getByTestId('note-vim-mode-badge')).toHaveText('normal')
      await expect.poll(async () => (await getCurrentNoteSnapshot(page)).content).toBe('')

      await page.keyboard.press('i')
      await page.keyboard.type('one')
      await page.keyboard.press('Enter')
      await page.keyboard.type('two')
      await expect.poll(async () => (await getCurrentNoteSnapshot(page)).content).toContain('two')

      await page.keyboard.press('Escape')
      await page.keyboard.press('g')
      await page.keyboard.press('g')
      await page.keyboard.press('V')
      await expect(page.getByTestId('note-vim-mode-badge')).toHaveText('visualLine')
      await expect(page.getByTestId('note-block-editor')).toHaveAttribute(
        'data-vim-mode',
        'visualLine'
      )
      await page.keyboard.press('j')
      await page.keyboard.press('y')
      await expect(page.getByTestId('note-vim-mode-badge')).toHaveText('normal')
      await expect.poll(async () => (await getCurrentNoteSnapshot(page)).content).toContain('one')
      await expect
        .poll(async () => page.evaluate(() => navigator.clipboard.readText()))
        .toContain('one')
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('supports Vim change operators in plain text', async () => {
    const vaultRoot = await createFixtureVault('alpha beta gamma\n')
    await fs.writeFile(
      path.join(vaultRoot, 'settings.json'),
      JSON.stringify({ editorVimModeEnabled: true }, null, 2),
      'utf-8'
    )
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openNote(page, 'alpha.md')

      await page.getByText('alpha beta gamma', { exact: true }).click({ position: { x: 4, y: 8 } })
      await page.keyboard.press('Escape')
      await expect(page.getByTestId('note-vim-mode-badge')).toHaveText('normal')

      await page.keyboard.press('c')
      await page.keyboard.press('e')
      await expect(page.getByTestId('note-vim-mode-badge')).toHaveText('insert')
      await page.keyboard.type('omega')
      await page.keyboard.press('Escape')
      await expect
        .poll(async () => (await getCurrentNoteSnapshot(page)).content, { timeout: 15_000 })
        .toContain('omega beta gamma')

      await page.keyboard.press('w')
      await page.keyboard.press('d')
      await page.keyboard.press('e')
      await expect(page.getByTestId('note-vim-mode-badge')).toHaveText('normal')
      await expect
        .poll(async () => (await getCurrentNoteSnapshot(page)).content, { timeout: 15_000 })
        .toContain('omega  gamma')

      await page.keyboard.press('w')
      await page.keyboard.press('C')
      await expect(page.getByTestId('note-vim-mode-badge')).toHaveText('insert')
      await page.keyboard.type('delta')
      await page.keyboard.press('Escape')
      await expect
        .poll(
          async () => (await getCurrentNoteSnapshot(page)).content.replace(/\r\n/g, '\n').trim(),
          {
            timeout: 15_000
          }
        )
        .toBe('omega  delta')
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('supports Vim word motions in plain text', async () => {
    const vaultRoot = await createFixtureVault('map sun wax\n')
    await fs.writeFile(
      path.join(vaultRoot, 'settings.json'),
      JSON.stringify({ editorVimModeEnabled: true }, null, 2),
      'utf-8'
    )
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openNote(page, 'alpha.md')

      await page.getByText('map sun wax', { exact: true }).click({ position: { x: 4, y: 8 } })
      await page.keyboard.press('Escape')
      await expect(page.getByTestId('note-vim-mode-badge')).toHaveText('normal')

      await page.keyboard.press('0')
      await expect.poll(async () => getCurrentVimCursorChar(page)).toBe('m')

      await page.keyboard.press('e')
      await expect.poll(async () => getCurrentVimCursorChar(page)).toBe('p')
      await page.keyboard.press('e')
      await expect.poll(async () => getCurrentVimCursorChar(page)).toBe('n')
      await page.keyboard.press('e')
      await expect.poll(async () => getCurrentVimCursorChar(page)).toBe('x')

      await page.keyboard.press('0')
      await expect.poll(async () => getCurrentVimCursorChar(page)).toBe('m')
      await page.keyboard.press('w')
      await expect.poll(async () => getCurrentVimCursorChar(page)).toBe('s')
      await page.keyboard.press('w')
      await expect.poll(async () => getCurrentVimCursorChar(page)).toBe('w')
      await page.keyboard.press('b')
      await expect.poll(async () => getCurrentVimCursorChar(page)).toBe('s')
      await page.keyboard.press('b')
      await expect.poll(async () => getCurrentVimCursorChar(page)).toBe('m')
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('supports Vim change operators inside code blocks', async () => {
    const initialMarkdown = ['Before', '', '```ts', 'alpha beta', '```'].join('\n')
    const vaultRoot = await createFixtureVault(initialMarkdown)
    await fs.writeFile(
      path.join(vaultRoot, 'settings.json'),
      JSON.stringify({ editorVimModeEnabled: true }, null, 2),
      'utf-8'
    )
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openNote(page, 'alpha.md')

      await page.getByText('alpha beta', { exact: true }).click({ position: { x: 6, y: 10 } })
      await page.keyboard.press('Escape')
      await expect(page.getByTestId('note-vim-mode-badge')).toHaveText('normal')

      await page.keyboard.press('c')
      await page.keyboard.press('e')
      await expect(page.getByTestId('note-vim-mode-badge')).toHaveText('insert')
      await page.keyboard.type('omega')
      await page.keyboard.press('Escape')
      await expect
        .poll(async () => (await getCurrentNoteSnapshot(page)).content, { timeout: 15_000 })
        .toContain('```ts\nomega beta\n```')

      await page.keyboard.press('w')
      await page.keyboard.press('C')
      await expect(page.getByTestId('note-vim-mode-badge')).toHaveText('insert')
      await page.keyboard.type('tail')
      await page.keyboard.press('Escape')
      await expect
        .poll(async () => (await getCurrentNoteSnapshot(page)).content, { timeout: 15_000 })
        .toContain('```ts\nomega tail\n```')
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('supports Vim change in visual character and line modes', async () => {
    const vaultRoot = await createFixtureVault('')
    await fs.writeFile(
      path.join(vaultRoot, 'settings.json'),
      JSON.stringify({ editorVimModeEnabled: true }, null, 2),
      'utf-8'
    )
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openNote(page, 'alpha.md')

      const editor = page
        .locator('[data-testid="note-block-editor"] [contenteditable="true"]')
        .first()
      await editor.click()

      await page.keyboard.type('abc')
      await expect.poll(async () => (await getCurrentNoteSnapshot(page)).content).toBe('abc')

      await page.keyboard.press('Escape')
      await page.keyboard.press('g')
      await page.keyboard.press('g')
      await page.keyboard.press('v')
      await page.keyboard.press('l')
      await page.keyboard.press('l')
      await page.keyboard.press('c')
      await expect(page.getByTestId('note-vim-mode-badge')).toHaveText('insert')
      await page.keyboard.type('Z')
      await page.keyboard.press('Escape')
      await expect.poll(async () => (await getCurrentNoteSnapshot(page)).content).toBe('Z')

      await page.keyboard.press('i')
      await page.keyboard.type('one')
      await page.keyboard.press('Enter')
      await page.keyboard.type('two')
      await page.keyboard.press('Enter')
      await page.keyboard.type('three')
      await expect
        .poll(async () => (await getCurrentNoteSnapshot(page)).content, { timeout: 15_000 })
        .toContain('three')

      await page.keyboard.press('Escape')
      await page.keyboard.press('g')
      await page.keyboard.press('g')
      await page.keyboard.press('V')
      await page.keyboard.press('j')
      await page.keyboard.press('c')
      await expect(page.getByTestId('note-vim-mode-badge')).toHaveText('insert')
      await page.keyboard.type('replacement')
      await page.keyboard.press('Escape')
      await expect
        .poll(
          async () => (await getCurrentNoteSnapshot(page)).content.replace(/\r\n/g, '\n').trim(),
          {
            timeout: 15_000
          }
        )
        .toBe('replacement\nthree')
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('dd removes the current line instead of leaving an empty block', async () => {
    const vaultRoot = await createFixtureVault('Alpha\nBeta\n')
    await fs.writeFile(
      path.join(vaultRoot, 'settings.json'),
      JSON.stringify({ editorVimModeEnabled: true }, null, 2),
      'utf-8'
    )
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openNote(page, 'alpha.md')

      await page.getByText('Alpha', { exact: true }).click()
      await page.keyboard.press('Escape')
      await expect(page.getByTestId('note-vim-mode-badge')).toHaveText('normal')

      await page.keyboard.press('d')
      await page.keyboard.press('d')

      await expect
        .poll(async () => {
          const snapshot = await getCurrentNoteSnapshot(page)
          return snapshot.content.replace(/\r\n/g, '\n').trim()
        })
        .toBe('Beta')

      await expect
        .poll(() => getVisibleNoteBlocks(page))
        .toEqual([
          {
            type: 'paragraph',
            text: 'Beta'
          }
        ])
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('O opens a new line above and places the cursor in the inserted line', async () => {
    const vaultRoot = await createFixtureVault('Alpha\nBeta\n')
    await fs.writeFile(
      path.join(vaultRoot, 'settings.json'),
      JSON.stringify({ editorVimModeEnabled: true }, null, 2),
      'utf-8'
    )
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openNote(page, 'alpha.md')

      await page.getByText('Beta', { exact: true }).click()
      await page.keyboard.press('Escape')
      await expect(page.getByTestId('note-vim-mode-badge')).toHaveText('normal')

      await page.keyboard.press('O')
      await expect(page.getByTestId('note-vim-mode-badge')).toHaveText('insert')

      let cursor = await getEditorSelectionState(page)
      expect(cursor.anchorInEditor).toBe(true)
      expect(cursor.anchorText).toBe('')
      expect(cursor.anchorOffset).toBe(0)

      await page.keyboard.type('Inserted above')
      await expect
        .poll(async () => (await getCurrentNoteSnapshot(page)).content.replace(/\r\n/g, '\n'), {
          timeout: 15_000
        })
        .toBe('Alpha\nInserted above\nBeta')

      cursor = await getEditorSelectionState(page)
      expect(cursor.anchorText).toBe('Inserted above')
      expect(cursor.anchorOffset).toBe('Inserted above'.length)
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

  test('matches project title styling while renaming a notebook title', async () => {
    const vaultRoot = await createFixtureVault('Alpha note\n')
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openNote(page, 'alpha.md')

      const titleArea = page.getByTestId('note-title-area')
      await titleArea.getByRole('button', { name: 'alpha', exact: true }).click()
      const titleInput = titleArea.locator('input[type="text"]')
      await expect(titleInput).toBeFocused()
      await expect
        .poll(() =>
          titleInput.evaluate((element) => {
            const styles = window.getComputedStyle(element)
            return {
              backgroundColor: styles.backgroundColor,
              borderTopWidth: styles.borderTopWidth,
              fontSize: styles.fontSize,
              fontWeight: styles.fontWeight
            }
          })
        )
        .toEqual({
          backgroundColor: 'rgba(0, 0, 0, 0)',
          borderTopWidth: '0px',
          fontSize: '30px',
          fontWeight: '700'
        })
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('reclaims note space when the title header hides on scroll', async () => {
    const filler = Array.from({ length: 80 }, (_, index) => `Paragraph ${index + 1}`).join('\n\n')
    const vaultRoot = await createFixtureVault(`# Alpha\n\n${filler}`, ['focus'])
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    const readTitleMetrics = async (): Promise<{
      clientHeight: number
      position: string
      scrollHeight: number
      scrollHeightOnScreen: number
      scrollTop: number
      surfaceHeight: number
      titleHeight: number
    }> =>
      page.evaluate(() => {
        const surface = document.querySelector<HTMLElement>('.note-editor-surface')
        const title = document.querySelector<HTMLElement>('[data-testid="note-title-area"]')
        if (!surface || !title) {
          throw new Error('Note title area is not mounted')
        }

        let scrollContainer: HTMLElement | null = title.parentElement
        while (scrollContainer && scrollContainer !== document.body) {
          const styles = window.getComputedStyle(scrollContainer)
          if (/(auto|scroll)/.test(styles.overflowY)) {
            break
          }
          scrollContainer = scrollContainer.parentElement
        }

        if (!scrollContainer) {
          throw new Error('Note editor scroll container is not mounted')
        }

        return {
          clientHeight: scrollContainer.clientHeight,
          position: window.getComputedStyle(title).position,
          scrollHeight: scrollContainer.scrollHeight,
          scrollHeightOnScreen: scrollContainer.getBoundingClientRect().height,
          scrollTop: scrollContainer.scrollTop,
          surfaceHeight: surface.getBoundingClientRect().height,
          titleHeight: title.getBoundingClientRect().height
        }
      })

    try {
      await openNote(page, 'alpha.md')
      await expect(page.getByTestId('note-block-editor')).toBeVisible({ timeout: 20_000 })

      const titleArea = page.getByTestId('note-title-area')
      await expect(titleArea).toHaveAttribute('data-scroll-state', 'visible')

      const initialMetrics = await readTitleMetrics()
      expect(initialMetrics.scrollHeight).toBeGreaterThan(initialMetrics.clientHeight)
      expect(initialMetrics.scrollHeightOnScreen).toBeGreaterThanOrEqual(
        initialMetrics.surfaceHeight - 8
      )
      expect(initialMetrics.position).toBe('sticky')

      await page.evaluate(() => {
        const title = document.querySelector<HTMLElement>('[data-testid="note-title-area"]')
        const scrollContainer = title?.parentElement
        if (!scrollContainer) {
          throw new Error('Note editor scroll container is not mounted')
        }

        scrollContainer.scrollTop = 260
      })
      await expect(titleArea).toHaveAttribute('data-scroll-state', 'hidden')
      await expect(titleArea).toHaveAttribute('data-scroll-position', 'scrolled')

      const hiddenMetrics = await readTitleMetrics()
      expect(hiddenMetrics.scrollTop).toBe(260)
      expect(hiddenMetrics.scrollHeightOnScreen).toBeGreaterThanOrEqual(
        hiddenMetrics.surfaceHeight - 8
      )

      await page.evaluate(() => {
        const title = document.querySelector<HTMLElement>('[data-testid="note-title-area"]')
        const scrollContainer = title?.parentElement
        if (!scrollContainer) {
          throw new Error('Note editor scroll container is not mounted')
        }

        scrollContainer.scrollTop = 120
      })
      await expect(titleArea).toHaveAttribute('data-scroll-state', 'visible')
      expect((await readTitleMetrics()).scrollTop).toBe(120)

      await page.getByRole('button', { name: 'Note tags selection', exact: true }).click()
      const tagPopover = page.getByTestId('note-tags-editor-popover')
      const tagInput = tagPopover.getByRole('combobox', {
        name: 'Search or add tags',
        exact: true
      })
      await expect(tagPopover).toBeVisible()
      await expect(tagInput).toBeFocused()

      await page.evaluate(() => {
        const title = document.querySelector<HTMLElement>('[data-testid="note-title-area"]')
        const scrollContainer = title?.parentElement
        if (!scrollContainer) {
          throw new Error('Note editor scroll container is not mounted')
        }

        scrollContainer.scrollTop = 420
      })
      await expect(titleArea).toHaveAttribute('data-scroll-state', 'visible')
      await tagInput.press('Escape')
      await expect(tagPopover).toBeHidden()

      await page.evaluate(() => {
        const title = document.querySelector<HTMLElement>('[data-testid="note-title-area"]')
        const scrollContainer = title?.parentElement
        if (!scrollContainer) {
          throw new Error('Note editor scroll container is not mounted')
        }

        scrollContainer.scrollTop = 520
      })
      await expect(titleArea).toHaveAttribute('data-scroll-state', 'hidden')

      await openNote(page, 'beta.md')
      await expect(page.getByTestId('note-title-area')).toHaveAttribute(
        'data-scroll-state',
        'visible'
      )
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })
})
