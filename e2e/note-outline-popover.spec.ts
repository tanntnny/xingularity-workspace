import { test, expect, type Page } from '@playwright/test'
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
      vault: {
        restoreLast: () => Promise<unknown>
      }
    }
  }
}

async function createFixtureVault(alphaContent: string, betaContent?: string): Promise<string> {
  const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-outline-vault-'))
  await fs.mkdir(path.join(rootPath, 'notes'), { recursive: true })
  await fs.mkdir(path.join(rootPath, 'attachments'), { recursive: true })
  await fs.writeFile(
    path.join(rootPath, 'notes', 'alpha.md'),
    serializeStoredNoteDocument(createStoredNoteDocumentFromText(alphaContent)),
    'utf-8'
  )
  if (betaContent !== undefined) {
    await fs.writeFile(
      path.join(rootPath, 'notes', 'beta.md'),
      serializeStoredNoteDocument(createStoredNoteDocumentFromText(betaContent)),
      'utf-8'
    )
  }
  return rootPath
}

async function launchWithFixture(vaultRoot: string): Promise<{
  electronApp: ElectronApplication
  page: Page
}> {
  const userDataPath = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-outline-user-data-'))
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
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.waitForLoadState('domcontentloaded')
  await page.waitForFunction(() => typeof window.vaultApi?.vault?.restoreLast === 'function')
  const notesPageButton = page.getByTestId('sidebar-page:notes')

  await expect
    .poll(
      async () =>
        page.evaluate(async () => {
          try {
            await window.vaultApi.vault.restoreLast()
          } catch {
            // Retry until the fixture vault is restorable.
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

  await expect(notesPageButton).toBeVisible({ timeout: 20_000 })
  await expect(notesPageButton).toBeEnabled({ timeout: 20_000 })
  await notesPageButton.click({ force: true })
  await expect(page.getByTestId('notes-tree-view')).toBeVisible({ timeout: 20_000 })

  return { electronApp, page }
}

async function openNote(page: Page, relPath: string): Promise<void> {
  const treeRow = page.getByTestId(`note-tree-row:${relPath}`)
  await expect(treeRow).toBeVisible({ timeout: 20_000 })
  await treeRow.click()
  await expect(page.getByTestId('note-block-editor')).toBeVisible({ timeout: 20_000 })
}

async function getHeadingPositionInEditor(
  page: Page,
  headingText: string
): Promise<{
  containerHeight: number
  relativeTop: number
  scrollTop: number
} | null> {
  return page.evaluate((text) => {
    const headings = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-testid="note-block-editor"] h1, [data-testid="note-block-editor"] h2, [data-testid="note-block-editor"] h3, [data-testid="note-block-editor"] h4, [data-testid="note-block-editor"] h5, [data-testid="note-block-editor"] h6'
      )
    )
    const target = headings.find((heading) => heading.textContent?.trim() === text)
    if (!target) {
      return null
    }

    let scrollContainer: HTMLElement | null = target.parentElement
    while (scrollContainer && scrollContainer !== document.body) {
      const style = window.getComputedStyle(scrollContainer)
      const isScrollable = /(auto|scroll)/.test(style.overflowY)
      if (isScrollable && scrollContainer.scrollHeight > scrollContainer.clientHeight) {
        const targetRect = target.getBoundingClientRect()
        const containerRect = scrollContainer.getBoundingClientRect()
        return {
          containerHeight: scrollContainer.clientHeight,
          relativeTop: targetRect.top - containerRect.top,
          scrollTop: scrollContainer.scrollTop
        }
      }

      scrollContainer = scrollContainer.parentElement
    }

    return null
  }, headingText)
}

async function scrollEditorToTop(page: Page): Promise<void> {
  await page.evaluate(() => {
    const editorRoot = document.querySelector<HTMLElement>('[data-testid="note-block-editor"]')
    let scrollContainer = editorRoot?.parentElement ?? null

    while (scrollContainer && scrollContainer !== document.body) {
      const style = window.getComputedStyle(scrollContainer)
      const isScrollable = /(auto|scroll)/.test(style.overflowY)
      if (isScrollable && scrollContainer.scrollHeight > scrollContainer.clientHeight) {
        scrollContainer.scrollTop = 0
        return
      }

      scrollContainer = scrollContainer.parentElement
    }
  })
}

test.describe('note outline panel', () => {
  test('shows the stacked panels and updates the outline when switching notes', async () => {
    const vaultRoot = await createFixtureVault(
      '# Alpha Title\n\n## Alpha Section\n',
      '# Beta Title\n\n## Beta Section\n'
    )
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await expect(page.getByTestId('note-outline-panel')).toHaveCount(0)
      await openNote(page, 'alpha.md')
      const fileTreePanel = page.getByTestId('note-file-tree-panel')
      const outlinePanel = page.getByTestId('note-outline-panel')
      const backlinksPanel = page.getByTestId('note-backlinks-panel')

      await expect(fileTreePanel).toBeVisible()
      await expect(outlinePanel).toBeVisible()
      await expect(backlinksPanel).toBeVisible()
      await expect(backlinksPanel.getByTestId('note-backlinks-list')).toBeEmpty()
      await expect(
        fileTreePanel.getByRole('button', { name: 'Explorer', exact: true })
      ).toHaveAttribute('aria-expanded', 'true')
      await expect(
        outlinePanel.getByRole('button', { name: 'Outline', exact: true })
      ).toHaveAttribute('aria-expanded', 'true')
      await expect(
        backlinksPanel.getByRole('button', { name: 'Backlinks', exact: true })
      ).toHaveAttribute('aria-expanded', 'true')
      await page.getByTestId('workspace-page-context-menu-trigger').click()
      await expect(page.getByTestId('workspace-page-context-menu-item:outline')).toHaveCount(0)
      await expect(page.getByTestId('workspace-page-context-menu-item:backlinks')).toHaveCount(0)
      await page.keyboard.press('Escape')

      await expect(outlinePanel.getByTestId('note-outline-item:0')).toContainText('Alpha Title')
      await expect(outlinePanel.getByTestId('note-outline-item:1')).toContainText('Alpha Section')

      await openNote(page, 'beta.md')
      await expect(outlinePanel.getByTestId('note-outline-item:0')).toContainText('Beta Title')
      await expect(outlinePanel.getByTestId('note-outline-item:1')).toContainText('Beta Section')
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('shows and opens notes that link to the current note', async () => {
    const vaultRoot = await createFixtureVault(
      '# Alpha Title\n\n## Alpha Section\n',
      '[[alpha]]\n\n# Beta Title\n\n## Beta Section\n'
    )
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openNote(page, 'alpha.md')

      const backlinksPanel = page.getByTestId('note-backlinks-panel')
      const backlinkItem = page.getByTestId('note-backlink-item:beta.md')
      await expect(backlinksPanel).toBeVisible()
      await expect(backlinkItem).toContainText('beta')

      await backlinkItem.click()
      await expect(
        page.getByTestId('note-outline-panel').getByTestId('note-outline-item:0')
      ).toContainText('Beta Title')
      await expect(page.getByTestId('note-backlinks-panel')).toBeVisible()
      await expect(page.getByTestId('note-backlinks-list')).toBeEmpty()
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('collapses the file tree and outline independently', async () => {
    const vaultRoot = await createFixtureVault('# Alpha Title\n\n## Alpha Section\n')
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openNote(page, 'alpha.md')
      const fileTreePanel = page.getByTestId('note-file-tree-panel')
      const fileTreeToggle = fileTreePanel.getByRole('button', {
        name: 'Explorer',
        exact: true
      })
      const outlineToggle = page
        .getByTestId('note-outline-panel')
        .getByRole('button', { name: 'Outline', exact: true })

      await expect(fileTreePanel).toHaveCSS('flex-grow', '0')
      await expect(fileTreePanel).toHaveCSS('flex-shrink', '0')
      await fileTreeToggle.press('Enter')
      await expect(fileTreeToggle).toHaveAttribute('aria-expanded', 'false')
      await expect(fileTreePanel).toHaveCSS('flex-grow', '0')
      await expect(fileTreePanel).toHaveCSS('flex-shrink', '0')
      await expect(outlineToggle).toHaveAttribute('aria-expanded', 'true')

      await outlineToggle.press('Space')
      await expect(outlineToggle).toHaveAttribute('aria-expanded', 'false')

      await fileTreeToggle.press('Space')
      await expect(fileTreeToggle).toHaveAttribute('aria-expanded', 'true')
      await expect(fileTreePanel).toHaveCSS('flex-grow', '0')
      await expect(fileTreePanel).toHaveCSS('flex-shrink', '0')
      await expect(outlineToggle).toHaveAttribute('aria-expanded', 'false')

      await outlineToggle.press('Enter')
      await expect(outlineToggle).toHaveAttribute('aria-expanded', 'true')
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('jumps to a heading and returns focus to the editor', async () => {
    const filler = Array.from({ length: 18 }, (_, index) => `Paragraph ${index + 1}`).join('\n\n')
    const vaultRoot = await createFixtureVault(
      ['# Title', filler, '## Section', filler, '### Deep Dive', filler].join('\n')
    )
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openNote(page, 'alpha.md')
      await scrollEditorToTop(page)

      const initialPosition = await getHeadingPositionInEditor(page, 'Deep Dive')
      expect(initialPosition).not.toBeNull()
      expect(initialPosition!.relativeTop).toBeGreaterThan(initialPosition!.containerHeight)

      await page.getByTestId('note-outline-panel').getByTestId('note-outline-item:2').click()
      await expect(page.getByTestId('note-outline-panel')).toBeVisible()

      await expect
        .poll(
          async () => {
            const position = await getHeadingPositionInEditor(page, 'Deep Dive')
            if (!position) {
              return false
            }

            return (
              position.relativeTop > 0 &&
              position.relativeTop < position.containerHeight &&
              position.scrollTop > 0
            )
          },
          { timeout: 10_000 }
        )
        .toBe(true)

      await expect
        .poll(
          () =>
            page.evaluate(() => {
              const editor = document.querySelector<HTMLElement>(
                '[data-testid="note-block-editor"] [contenteditable="true"]'
              )
              return Boolean(editor && editor.contains(document.activeElement))
            }),
          { timeout: 5_000 }
        )
        .toBe(true)
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('keeps a long outline in the shared panel scrollport', async () => {
    const headings = Array.from({ length: 36 }, (_, index) => `## Section ${index + 1}`)
    const vaultRoot = await createFixtureVault(headings.join('\n\n'))
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openNote(page, 'alpha.md')
      const outlineList = page.getByTestId('note-outline-list')
      const notesPanelStack = page.getByTestId('notes-panel-stack')
      await expect(outlineList).toBeVisible()
      await expect(page.locator('[data-workspace-scrollport="true"]')).toHaveCount(1)
      await expect
        .poll(
          () =>
            outlineList.evaluate((element) => ({
              overflowY: window.getComputedStyle(element).overflowY
            })),
          { timeout: 5_000 }
        )
        .toEqual({ overflowY: 'visible' })

      const stackMetrics = await notesPanelStack.evaluate((element) => ({
        clientHeight: element.clientHeight,
        overflowY: window.getComputedStyle(element).overflowY,
        scrollHeight: element.scrollHeight
      }))
      expect(stackMetrics.overflowY).toBe('auto')
      expect(stackMetrics.scrollHeight).toBeGreaterThan(stackMetrics.clientHeight)
      const nestedScrollableElements = await notesPanelStack.evaluate((element) =>
        Array.from(element.querySelectorAll<HTMLElement>('*'))
          .filter((candidate) => /(auto|scroll)/.test(getComputedStyle(candidate).overflowY))
          .filter((candidate) => candidate.scrollHeight > candidate.clientHeight + 1)
          .map((candidate) => candidate.dataset.testid ?? candidate.tagName.toLowerCase())
      )
      expect(nestedScrollableElements).toEqual([])
      await expect(page.getByTestId('note-outline-item:35')).toContainText('Section 36')
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('shows no outline content for a note without headings', async () => {
    const vaultRoot = await createFixtureVault('Plain paragraph\nAnother paragraph\n')
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openNote(page, 'alpha.md')
      await expect(page.getByTestId('note-outline-panel')).toBeVisible()
      await expect(
        page.getByTestId('note-outline-panel').getByTestId('note-outline-list')
      ).toBeEmpty()
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })
})
