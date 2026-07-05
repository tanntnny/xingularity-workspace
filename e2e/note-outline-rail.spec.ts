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

async function createFixtureVault(alphaContent: string): Promise<string> {
  const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-outline-vault-'))
  await fs.mkdir(path.join(rootPath, 'notes'), { recursive: true })
  await fs.mkdir(path.join(rootPath, 'attachments'), { recursive: true })
  await fs.writeFile(
    path.join(rootPath, 'notes', 'alpha.md'),
    serializeStoredNoteDocument(createStoredNoteDocumentFromText(alphaContent)),
    'utf-8'
  )
  return rootPath
}

async function launchWithFixture(vaultRoot: string): Promise<{
  electronApp: ElectronApplication
  page: Page
}> {
  const userDataPath = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-outline-user-data-'))
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

  await notesPageButton.click()
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
        '[data-testid="note-block-editor"] h1, [data-testid="note-block-editor"] h2, [data-testid="note-block-editor"] h3'
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

async function getHeadingMargins(page: Page): Promise<number[]> {
  return page.evaluate(() =>
    Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-testid="note-block-editor"] h1, [data-testid="note-block-editor"] h2, [data-testid="note-block-editor"] h3, [data-testid="note-block-editor"] h4, [data-testid="note-block-editor"] h5, [data-testid="note-block-editor"] h6'
      )
    ).map((heading) => Number.parseFloat(window.getComputedStyle(heading).marginTop))
  )
}

async function getOutlineRodMargins(page: Page): Promise<number[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('[data-testid^="note-outline-rod:"]')).map(
      (rod) => Number.parseFloat(window.getComputedStyle(rod).marginTop)
    )
  )
}

async function getOutlineRodVisuals(page: Page): Promise<
  Array<{
    buttonCenterY: number
    spanHeight: number
    spanOpacity: number
    spanWidth: number
  }>
> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('[data-testid^="note-outline-rod:"]')).map(
      (button) => {
        const span = button.querySelector<HTMLElement>('span')
        const buttonRect = button.getBoundingClientRect()
        const spanRect = span?.getBoundingClientRect()

        return {
          buttonCenterY: buttonRect.top + buttonRect.height / 2,
          spanHeight: spanRect?.height ?? 0,
          spanOpacity: span ? Number.parseFloat(window.getComputedStyle(span).opacity) : 0,
          spanWidth: spanRect?.width ?? 0
        }
      }
    )
  )
}

test.describe('note outline rail', () => {
  test('renders a textless rail with heading tooltips and click-to-jump navigation', async () => {
    const filler = Array.from({ length: 18 }, (_, index) => `Paragraph ${index + 1}`).join('\n\n')
    const vaultRoot = await createFixtureVault(
      ['# Title', filler, '## Section', filler, '### Deep Dive', filler].join('\n')
    )
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openNote(page, 'alpha.md')

      const rail = page.getByTestId('note-outline-rail')
      await expect(rail).toBeVisible({ timeout: 20_000 })
      await expect(page.getByTestId('note-outline-rod:0')).toBeVisible()
      await expect(page.getByTestId('note-outline-rod:1')).toBeVisible()
      await expect(page.getByTestId('note-outline-rod:2')).toBeVisible()

      await expect
        .poll(async () => ((await rail.textContent()) ?? '').trim(), { timeout: 10_000 })
        .toBe('')

      const targetHeading = 'Deep Dive'
      await scrollEditorToTop(page)
      const initialPosition = await getHeadingPositionInEditor(page, targetHeading)
      expect(initialPosition).not.toBeNull()
      expect(initialPosition!.relativeTop).toBeGreaterThan(initialPosition!.containerHeight)

      await page.getByTestId('note-outline-rod:2').hover()
      await expect(page.locator('[role="tooltip"]')).toContainText(targetHeading)

      await page.getByTestId('note-outline-rod:2').click()
      await expect
        .poll(
          async () => {
            const position = await getHeadingPositionInEditor(page, targetHeading)
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
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('applies descending heading spacing in the editor and rail', async () => {
    const vaultRoot = await createFixtureVault(
      ['# Title', '## Section', '### Deep Dive', '#### Detail', '##### Minor', '###### Tiny'].join(
        '\n\n'
      )
    )
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openNote(page, 'alpha.md')

      await expect(page.getByTestId('note-outline-rail')).toBeVisible({ timeout: 20_000 })

      const headingMargins = await getHeadingMargins(page)
      expect(headingMargins).toEqual([0, 16, 12.8, 10.4, 8, 6.4])

      const rodMargins = await getOutlineRodMargins(page)
      expect(rodMargins).toEqual([0, 2, 0, 0, 0, 0])
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('applies proximity emphasis to nearby rods without resizing them', async () => {
    const vaultRoot = await createFixtureVault(
      ['# Title', '## Section', '### Deep Dive', '#### Detail', '##### Minor', '###### Tiny'].join(
        '\n\n'
      )
    )
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openNote(page, 'alpha.md')

      const rail = page.getByTestId('note-outline-rail')
      await expect(rail).toBeVisible({ timeout: 20_000 })

      const baselineVisuals = await getOutlineRodVisuals(page)
      const railBounds = await rail.boundingBox()
      const targetRodBounds = await page.getByTestId('note-outline-rod:2').boundingBox()
      expect(railBounds).not.toBeNull()
      expect(targetRodBounds).not.toBeNull()

      await page.mouse.move(targetRodBounds!.x + 2, targetRodBounds!.y + targetRodBounds!.height / 2)

      await expect
        .poll(
          async () => {
            const visuals = await getOutlineRodVisuals(page)
            const targetOpacityBoost = visuals[2]!.spanOpacity - baselineVisuals[2]!.spanOpacity
            const upperNeighborOpacityBoost =
              visuals[1]!.spanOpacity - baselineVisuals[1]!.spanOpacity
            const lowerNeighborOpacityBoost =
              visuals[3]!.spanOpacity - baselineVisuals[3]!.spanOpacity
            const neighborOpacityBoost = Math.max(
              upperNeighborOpacityBoost,
              lowerNeighborOpacityBoost
            )
            const farOpacityBoost = visuals[5]!.spanOpacity - baselineVisuals[5]!.spanOpacity

            return (
              targetOpacityBoost > 0.12 &&
              neighborOpacityBoost > 0.03 &&
              neighborOpacityBoost < targetOpacityBoost &&
              farOpacityBoost < neighborOpacityBoost &&
              Math.abs(visuals[2]!.spanWidth - baselineVisuals[2]!.spanWidth) < 0.75 &&
              Math.abs(visuals[2]!.spanHeight - baselineVisuals[2]!.spanHeight) < 0.35 &&
              Math.abs(visuals[1]!.spanWidth - baselineVisuals[1]!.spanWidth) < 0.75 &&
              Math.abs(visuals[1]!.spanHeight - baselineVisuals[1]!.spanHeight) < 0.35
            )
          },
          { timeout: 10_000 }
        )
        .toBe(true)

      await page.mouse.move(railBounds!.x - 40, railBounds!.y - 40)

      await expect
        .poll(
          async () => {
            const visuals = await getOutlineRodVisuals(page)
            return visuals.every((visual, index) => {
              const baselineVisual = baselineVisuals[index]!
              return (
                Math.abs(visual.spanWidth - baselineVisual.spanWidth) < 0.75 &&
                Math.abs(visual.spanHeight - baselineVisual.spanHeight) < 0.75 &&
                Math.abs(visual.spanOpacity - baselineVisual.spanOpacity) < 0.05
              )
            })
          },
          { timeout: 10_000 }
        )
        .toBe(true)
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('hides the rail when a note has no headings', async () => {
    const vaultRoot = await createFixtureVault('Plain paragraph\nAnother paragraph\n')
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openNote(page, 'alpha.md')
      await expect(page.getByTestId('note-outline-rail')).toHaveCount(0)
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })
})
