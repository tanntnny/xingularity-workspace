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
    }
    vaultApi: {
      files: {
        readNote: (relPath: string) => Promise<string>
        writeNote: (relPath: string, content: string) => Promise<void>
        readNoteDocument: (relPath: string) => Promise<StoredNoteDocument>
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
  const alphaPreview = page.getByTestId('note-preview:alpha.xnote')

  try {
    await expect(alphaPreview).toBeVisible({ timeout: 5_000 })
  } catch {
    await page.evaluate(() => window.vaultApi.vault.restoreLast())
    await expect(alphaPreview).toBeVisible({ timeout: 20_000 })
  }

  return { electronApp, page }
}

async function getCurrentNoteSnapshot(page: Page): Promise<NoteSnapshot> {
  return page.evaluate(() => window.__XINGULARITY_E2E__!.getCurrentNoteSnapshot())
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
  await page.getByTestId(`note-preview:${relPath}`).click()
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
