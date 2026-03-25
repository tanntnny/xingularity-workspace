import { test, expect, Page } from '@playwright/test'
import { _electron as electron, ElectronApplication } from 'playwright'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

interface NoteSnapshot {
  path: string | null
  content: string
}

interface VisibleNoteBlock {
  type: string
  text: string
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
  await fs.writeFile(path.join(rootPath, 'notes', 'alpha.md'), alphaContent, 'utf-8')
  await fs.writeFile(path.join(rootPath, 'notes', 'beta.md'), 'Side note\n', 'utf-8')
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
  await expect(page.getByTestId('note-preview:alpha.md')).toBeVisible({ timeout: 20_000 })

  return { electronApp, page }
}

async function getCurrentNoteSnapshot(page: Page): Promise<NoteSnapshot> {
  return page.evaluate(() => window.__XINGULARITY_E2E__!.getCurrentNoteSnapshot())
}

async function readNoteFromDisk(page: Page, relPath: string): Promise<string> {
  return page.evaluate((pathArg) => window.vaultApi.files.readNote(pathArg), relPath)
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

test.describe('note page block editor switching', () => {
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
        .toContain('1. Numbered item')

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
        .toContain('1. Numbered item')
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
      expect(visibleBlocksBeforeSwitch).toEqual([
        { type: 'paragraph', text: 'Alpha' },
        { type: 'paragraph', text: '' },
        { type: 'paragraph', text: 'Beta' }
      ])

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

  test('keeps removed blank lines removed when switching notes', async () => {
    const vaultRoot = await createFixtureVault('Alpha\n\nBeta\n')
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openNote(page, 'alpha.md')
      const editor = page.locator('[data-testid="note-block-editor"] [contenteditable="true"]').first()
      await editor.click()
      await page.keyboard.press('ArrowDown')
      await page.keyboard.press('Backspace')

      const visibleBlocksBeforeSwitch = await getVisibleNoteBlocks(page)
      expect(visibleBlocksBeforeSwitch).toEqual([
        { type: 'paragraph', text: 'Alpha' },
        { type: 'paragraph', text: 'Beta' }
      ])

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
})
