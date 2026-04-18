import { test, expect, Page } from '@playwright/test'
import { _electron as electron, ElectronApplication } from 'playwright'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { AppSettings, GridBoardItem } from '../src/shared/types'
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

async function createFixtureVault(): Promise<string> {
  const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-grid-enabled-e2e-vault-'))
  await fs.mkdir(path.join(rootPath, 'notes'), { recursive: true })
  await fs.mkdir(path.join(rootPath, 'attachments'), { recursive: true })
  await fs.writeFile(
    path.join(rootPath, 'notes', 'alpha.md'),
    serializeStoredNoteDocument(
      createStoredNoteDocumentFromText(
        'A distinctive note body for canvas preview.\nSecond line for preview coverage.\n'
      )
    ),
    'utf-8'
  )
  return rootPath
}

function getVaultSettingsPath(vaultRoot: string): string {
  return path.join(vaultRoot, '.xingularity', 'settings.json')
}

async function readVaultSettings(vaultRoot: string): Promise<AppSettings> {
  const raw = await fs.readFile(getVaultSettingsPath(vaultRoot), 'utf-8')
  return JSON.parse(raw) as AppSettings
}

async function openGridPage(page: Page): Promise<void> {
  await expect(page.getByTestId('sidebar-page:grid')).toBeVisible()
  await page.getByTestId('sidebar-page:grid').click()
  await expect(page.getByTestId('grid-page')).toBeVisible()
}

function findBoardItem(
  items: GridBoardItem[],
  predicate: (item: GridBoardItem) => boolean
): GridBoardItem | undefined {
  return items.find(predicate)
}

async function waitForBoardItem(
  vaultRoot: string,
  predicate: (item: GridBoardItem) => boolean
): Promise<GridBoardItem> {
  await expect
    .poll(async () => {
      const settings = await readVaultSettings(vaultRoot)
      return Boolean(findBoardItem(settings.gridBoard.items, predicate))
    })
    .toBe(true)

  const settings = await readVaultSettings(vaultRoot)
  const item = findBoardItem(settings.gridBoard.items, predicate)
  if (!item) {
    throw new Error('Expected persisted grid board item to exist')
  }

  return item
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
  await expect(page.getByTestId('sidebar-page:grid')).toBeVisible({ timeout: 20_000 })

  return { electronApp, page }
}

test.describe('grid page', () => {
  test('is available again and uses the shared workspace surface', async () => {
    const vaultRoot = await createFixtureVault()
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await expect(page.getByTestId('sidebar-page:grid')).toBeVisible()

      await page.getByRole('button', { name: 'Open command palette' }).click()
      await expect(page.getByPlaceholder('Search notes and projects...')).toBeVisible()
      await page.getByPlaceholder('Search notes and projects...').fill('>grid')
      await expect(page.getByText('Go to Grid')).toBeVisible()
      await page.keyboard.press('Escape')

      await page.getByTestId('sidebar-page:grid').click()
      const gridPage = page.getByTestId('grid-page')
      await expect(gridPage).toBeVisible()
      await expect(page.getByRole('button', { name: 'Add to canvas' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Fit all cards' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Reset board' })).toBeVisible()

      const styles = await gridPage.evaluate((element) => {
        const computed = window.getComputedStyle(element as HTMLElement)
        return {
          backgroundColor: computed.backgroundColor,
          backgroundImage: computed.backgroundImage
        }
      })

      expect(styles.backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
      expect(styles.backgroundImage).toBe('none')
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('snaps drag and resize to the grid and persists note and text cards', async () => {
    const vaultRoot = await createFixtureVault()
    let electronApp: ElectronApplication | null = null

    try {
      ;({ electronApp } = await launchWithFixture(vaultRoot))
      const page = await electronApp.firstWindow()

      await openGridPage(page)

      await page.getByRole('button', { name: 'Add to canvas' }).click()
      await page.getByRole('button', { name: 'Add note' }).click()
      await page.getByRole('button', { name: /Alpha/i }).click()

      const initialNoteItem = await waitForBoardItem(
        vaultRoot,
        (item) => item.id === 'grid-note:alpha.md'
      )

      const noteCard = page.getByTestId('grid-card:note:alpha.md')
      await expect(noteCard).toBeVisible()
      await expect(noteCard).toContainText('alpha')
      await expect(noteCard).toContainText('A distinctive note body for canvas preview.')

      const noteBox = await noteCard.boundingBox()
      expect(noteBox).not.toBeNull()
      if (!noteBox) {
        throw new Error('Note card bounding box not available')
      }

      await page.mouse.move(noteBox.x + noteBox.width / 2, noteBox.y + noteBox.height / 2)
      await page.mouse.down()
      await page.mouse.move(
        noteBox.x + noteBox.width / 2 + 127,
        noteBox.y + noteBox.height / 2 + 83,
        {
          steps: 12
        }
      )
      await page.mouse.up()

      const noteItemAfterDrag = await waitForBoardItem(
        vaultRoot,
        (item) => item.id === 'grid-note:alpha.md'
      )
      expect(noteItemAfterDrag.position.x).not.toBe(initialNoteItem.position.x)
      expect(noteItemAfterDrag.position.y).not.toBe(initialNoteItem.position.y)

      await noteCard.click()
      const noteCardAfterSelectBox = await noteCard.boundingBox()
      expect(noteCardAfterSelectBox).not.toBeNull()
      if (!noteCardAfterSelectBox) {
        throw new Error('Selected note card bounding box not available')
      }

      const noteRightEdge = page.locator('.react-flow__resize-control.right.line').last()
      await expect(noteRightEdge).toBeAttached()
      const noteRightEdgeBox = await noteRightEdge.boundingBox()
      expect(noteRightEdgeBox).not.toBeNull()
      if (!noteRightEdgeBox) {
        throw new Error('Right resize edge bounding box not available')
      }

      const noteRightEdgeOverflow =
        noteRightEdgeBox.x +
        noteRightEdgeBox.width -
        (noteCardAfterSelectBox.x + noteCardAfterSelectBox.width)
      expect(noteRightEdgeOverflow).toBeLessThanOrEqual(8)

      const noteCorner = page.locator('.react-flow__resize-control.bottom.right.handle').last()
      await expect(noteCorner).toBeAttached()
      const noteCornerBox = await noteCorner.boundingBox()
      expect(noteCornerBox).not.toBeNull()
      if (!noteCornerBox) {
        throw new Error('Diagonal resize corner bounding box not available')
      }

      const noteCornerOverflowX =
        noteCornerBox.x +
        noteCornerBox.width -
        (noteCardAfterSelectBox.x + noteCardAfterSelectBox.width)
      const noteCornerOverflowY =
        noteCornerBox.y +
        noteCornerBox.height -
        (noteCardAfterSelectBox.y + noteCardAfterSelectBox.height)
      expect(noteCornerOverflowX).toBeLessThanOrEqual(14)
      expect(noteCornerOverflowY).toBeLessThanOrEqual(14)

      await page.mouse.move(
        noteCornerBox.x + noteCornerBox.width / 2,
        noteCornerBox.y + noteCornerBox.height / 2
      )
      await page.mouse.down()
      await page.mouse.move(
        noteCornerBox.x + noteCornerBox.width / 2 + 94,
        noteCornerBox.y + noteCornerBox.height / 2 + 71,
        {
          steps: 12
        }
      )
      await page.mouse.up()

      const noteItemAfterResize = await waitForBoardItem(
        vaultRoot,
        (item) => item.id === 'grid-note:alpha.md'
      )
      expect(noteItemAfterResize.size?.width).toBeDefined()
      expect(noteItemAfterResize.size?.height).toBeDefined()
      expect(noteItemAfterResize.size?.width ?? 0).toBeGreaterThan(312)
      expect(noteItemAfterResize.size?.height ?? 0).toBeGreaterThan(190)

      await page.getByRole('button', { name: 'Add to canvas' }).click()
      await page.getByRole('button', { name: 'Add text' }).click()

      const textCard = page.locator('[data-testid^="grid-card:text:"]').first()
      await expect(textCard).toBeVisible()
      await textCard.click()

      const longText =
        'This grid text block should wrap across multiple lines when the width is constrained.'
      await page.getByRole('textbox').fill(longText)
      await page.keyboard.press('Enter')

      const textBoardItem = await waitForBoardItem(
        vaultRoot,
        (item) => item.kind === 'text' && item.textContent === longText
      )
      const textDisplay = textCard.getByText(longText)
      expect(textBoardItem.size?.width).toBeDefined()
      expect(textBoardItem.size?.height).toBeDefined()
      expect(textBoardItem.size?.width).toBe(296)
      expect(textBoardItem.size?.height).toBe(84)

      const textMetrics = await textDisplay.evaluate((element) => {
        const computed = window.getComputedStyle(element as HTMLElement)
        const lineHeight = Number.parseFloat(computed.lineHeight)
        return {
          whiteSpace: computed.whiteSpace,
          overflowWrap: computed.overflowWrap,
          clientHeight: (element as HTMLElement).clientHeight,
          lineHeight
        }
      })
      expect(textMetrics.whiteSpace).toBe('pre-wrap')
      expect(textMetrics.overflowWrap).toBe('anywhere')
      expect(textMetrics.clientHeight).toBeGreaterThan(textMetrics.lineHeight * 1.5)

      const resizeControlCount = await textCard.locator('.react-flow__resize-control').count()
      expect(resizeControlCount).toBe(2)

      const textRightEdge = textCard.locator('.react-flow__resize-control.right.line')
      await expect(textRightEdge).toBeAttached()
      const textRightEdgeBox = await textRightEdge.boundingBox()
      expect(textRightEdgeBox).not.toBeNull()
      if (!textRightEdgeBox) {
        throw new Error('Text resize edge bounding box not available')
      }

      await page.mouse.move(
        textRightEdgeBox.x + textRightEdgeBox.width / 2,
        textRightEdgeBox.y + textRightEdgeBox.height / 2
      )
      await page.mouse.down()
      await page.mouse.move(
        textRightEdgeBox.x + textRightEdgeBox.width / 2 + 112,
        textRightEdgeBox.y + textRightEdgeBox.height / 2,
        {
          steps: 12
        }
      )
      await page.mouse.up()

      const textItemAfterResize = await waitForBoardItem(
        vaultRoot,
        (item) => item.kind === 'text' && item.textContent === longText
      )
      expect(textItemAfterResize.size?.width ?? 0).toBeGreaterThan(296)
      expect(textItemAfterResize.size?.height).toBe(84)

      await electronApp.close()
      electronApp = null
      ;({ electronApp } = await launchWithFixture(vaultRoot))
      const relaunchedPage = await electronApp.firstWindow()
      await openGridPage(relaunchedPage)

      await expect(relaunchedPage.getByTestId('grid-card:note:alpha.md')).toBeVisible()
      await expect(relaunchedPage.locator('[data-testid^="grid-card:text:"]').first()).toBeVisible()

      const persistedSettings = await readVaultSettings(vaultRoot)
      const persistedNote = findBoardItem(
        persistedSettings.gridBoard.items,
        (item) => item.id === 'grid-note:alpha.md'
      )
      const persistedText = findBoardItem(
        persistedSettings.gridBoard.items,
        (item) => item.kind === 'text'
      )

      expect(persistedNote?.size?.width).toBe(noteItemAfterResize.size?.width)
      expect(persistedNote?.size?.height).toBe(noteItemAfterResize.size?.height)
      expect(persistedText?.size?.width).toBe(textItemAfterResize.size?.width)
      expect(persistedText?.size?.height).toBe(textItemAfterResize.size?.height)
      expect(persistedText?.textContent).toBe(longText)
    } finally {
      await electronApp?.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })
})
