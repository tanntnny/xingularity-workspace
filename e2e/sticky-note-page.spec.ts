import { test, expect, type Page } from '@playwright/test'
import { _electron as electron, type ElectronApplication } from 'playwright'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { AppSettings, StickyNoteBoardState, StickyNoteItem } from '../src/shared/types'

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
  const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-sticky-note-e2e-vault-'))
  await fs.mkdir(path.join(rootPath, 'notebooks'), { recursive: true })
  await fs.mkdir(path.join(rootPath, 'attachments'), { recursive: true })
  return rootPath
}

function getVaultSettingsPath(vaultRoot: string): string {
  return path.join(vaultRoot, 'settings.json')
}

async function readVaultSettings(vaultRoot: string): Promise<AppSettings> {
  const raw = await fs.readFile(getVaultSettingsPath(vaultRoot), 'utf-8')
  return JSON.parse(raw) as AppSettings
}

async function waitForStickyNotes(vaultRoot: string, count: number): Promise<StickyNoteItem[]> {
  await expect
    .poll(async () => (await readVaultSettings(vaultRoot)).stickyNoteBoard.notes.length)
    .toBe(count)

  return (await readVaultSettings(vaultRoot)).stickyNoteBoard.notes
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
  await expect(page.getByTestId('sidebar-page:stickyNote')).toBeVisible({ timeout: 20_000 })

  return { electronApp, page }
}

function createBenchmarkBoard(count: number): StickyNoteBoardState {
  return {
    viewport: { x: 0, y: 0, zoom: 1 },
    notes: Array.from({ length: count }, (_, index) => ({
      id: `sticky-note:benchmark-${index}`,
      text: '',
      color: 'yellow' as const,
      position: {
        x: (index % 10) * 300,
        y: Math.floor(index / 10) * 260
      },
      size: { width: 260, height: 220 },
      zIndex: count - index
    }))
  }
}

async function resetSettingsWriteProbe(electronApp: ElectronApplication): Promise<void> {
  await electronApp.evaluate(() => {
    type SettingsWriteProbe = { count: number; bytes: number }
    type MainGlobal = typeof globalThis & {
      __stickyNoteSettingsWriteProbe?: SettingsWriteProbe
      __stickyNoteSettingsWriteProbeInstalled?: boolean
    }

    const mainGlobal = globalThis as MainGlobal
    if (!mainGlobal.__stickyNoteSettingsWriteProbeInstalled) {
      const fsPromises = process.getBuiltinModule('node:fs/promises') as unknown as {
        writeFile: (...args: unknown[]) => Promise<unknown>
      }
      const originalWriteFile = fsPromises.writeFile
      const probe: SettingsWriteProbe = { count: 0, bytes: 0 }
      fsPromises.writeFile = async (...args: unknown[]): Promise<unknown> => {
        const filePath = typeof args[0] === 'string' ? args[0] : ''
        if (filePath.includes('settings.json.tmp-')) {
          const payload = args[1]
          probe.count += 1
          if (typeof payload === 'string') {
            probe.bytes += Buffer.byteLength(payload)
          }
        }

        return originalWriteFile(...args)
      }
      mainGlobal.__stickyNoteSettingsWriteProbe = probe
      mainGlobal.__stickyNoteSettingsWriteProbeInstalled = true
      return
    }

    const probe = mainGlobal.__stickyNoteSettingsWriteProbe
    if (probe) {
      probe.count = 0
      probe.bytes = 0
    }
  })
}

async function readSettingsWriteProbe(
  electronApp: ElectronApplication
): Promise<{ count: number; bytes: number }> {
  return electronApp.evaluate(() => {
    type MainGlobal = typeof globalThis & {
      __stickyNoteSettingsWriteProbe?: { count: number; bytes: number }
    }
    const probe = (globalThis as MainGlobal).__stickyNoteSettingsWriteProbe
    return probe ? { count: probe.count, bytes: probe.bytes } : { count: 0, bytes: 0 }
  })
}

async function startFrameProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    type FrameProbe = {
      lastFrame: number
      maxFrameGap: number
      longTaskCount: number
      animationFrameId: number
      longTaskObserver: PerformanceObserver | null
    }

    const windowWithProbe = window as typeof window & { __stickyNoteFrameProbe?: FrameProbe }
    const probe: FrameProbe = {
      lastFrame: performance.now(),
      maxFrameGap: 0,
      longTaskCount: 0,
      animationFrameId: 0,
      longTaskObserver: null
    }

    const tick = (timestamp: number): void => {
      probe.maxFrameGap = Math.max(probe.maxFrameGap, timestamp - probe.lastFrame)
      probe.lastFrame = timestamp
      probe.animationFrameId = window.requestAnimationFrame(tick)
    }

    try {
      const observer = new PerformanceObserver((list) => {
        probe.longTaskCount += list.getEntries().length
      })
      observer.observe({ type: 'longtask', buffered: false })
      probe.longTaskObserver = observer
    } catch {
      probe.longTaskObserver = null
    }

    probe.animationFrameId = window.requestAnimationFrame(tick)
    windowWithProbe.__stickyNoteFrameProbe = probe
  })
}

async function stopFrameProbe(page: Page): Promise<{
  maxFrameGap: number
  longTaskCount: number
}> {
  return page.evaluate(async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 100))

    const windowWithProbe = window as typeof window & {
      __stickyNoteFrameProbe?: {
        maxFrameGap: number
        longTaskCount: number
        animationFrameId: number
        longTaskObserver: PerformanceObserver | null
      }
    }
    const probe = windowWithProbe.__stickyNoteFrameProbe
    if (!probe) {
      return { maxFrameGap: 0, longTaskCount: 0 }
    }

    window.cancelAnimationFrame(probe.animationFrameId)
    probe.longTaskObserver?.disconnect()
    delete windowWithProbe.__stickyNoteFrameProbe
    return {
      maxFrameGap: probe.maxFrameGap,
      longTaskCount: probe.longTaskCount
    }
  })
}

async function openStickyNotePage(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Open command palette' }).click()
  const commandInput = page.getByPlaceholder('Search names, aliases, paths... use @ for body')
  await expect(commandInput).toBeVisible()
  await commandInput.fill('>sticky')
  await expect(page.getByText('Go to Sticky Note')).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByTestId('sidebar-page:stickyNote').click()
  await expect(page.getByTestId('sticky-note-page')).toBeVisible()
}

test.describe('sticky note page', () => {
  test('creates, edits, colors, moves, resizes, deletes, and restores sticky notes', async () => {
    const vaultRoot = await createFixtureVault()
    let electronApp: ElectronApplication | null = null

    try {
      ;({ electronApp } = await launchWithFixture(vaultRoot))
      const page = await electronApp.firstWindow()
      await openStickyNotePage(page)

      await expect(page.getByRole('button', { name: 'New note' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Fit notes' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Reset view' })).toBeVisible()

      await page.getByTestId('sticky-note-add').click()
      const [createdNote] = await waitForStickyNotes(vaultRoot, 1)
      const noteCard = page.getByTestId(`sticky-note:${createdNote.id}`)
      await expect(noteCard).toBeVisible()
      await expect(noteCard).toHaveCSS('border-top-left-radius', '0px')
      await expect(noteCard).toHaveCSS('border-top-width', '0px')
      const textarea = noteCard.getByRole('textbox')
      await expect(textarea).toHaveCSS('font-size', '24px')
      await expect(textarea).toHaveCSS('font-weight', '500')

      const noteText = 'First line\nSecond line'
      await textarea.fill(noteText)
      const focusSnapshot = await textarea.evaluate((element) =>
        `${document.activeElement === element}:${element.selectionStart}:${element.selectionEnd}`
      )
      await expect
        .poll(async () => (await readVaultSettings(vaultRoot)).stickyNoteBoard.notes[0]?.text)
        .toBe(noteText)
      await expect
        .poll(async () =>
          textarea.evaluate(
            (element) =>
              `${document.activeElement === element}:${element.selectionStart}:${element.selectionEnd}`
          )
        )
        .toBe(focusSnapshot)

      await page.getByTestId('sticky-note-color-menu').click()
      await page.getByTestId('sticky-note-color-pink').click()
      await expect
        .poll(async () => (await readVaultSettings(vaultRoot)).stickyNoteBoard.notes[0]?.color)
        .toBe('pink')
      await expect(noteCard).toHaveAttribute('data-color', 'pink')

      const initialCardBox = await noteCard.boundingBox()
      expect(initialCardBox).not.toBeNull()
      if (!initialCardBox) {
        throw new Error('Sticky note card is not measurable')
      }
      await page.mouse.move(
        initialCardBox.x + initialCardBox.width * 0.75,
        initialCardBox.y + initialCardBox.height - 32
      )
      await page.mouse.down()
      await page.mouse.move(
        initialCardBox.x + initialCardBox.width * 0.75 + 120,
        initialCardBox.y + initialCardBox.height - 32 + 70,
        { steps: 8 }
      )
      await page.mouse.up()
      await expect
        .poll(async () => {
          const note = (await readVaultSettings(vaultRoot)).stickyNoteBoard.notes[0]
          return note ? `${note.position.x}:${note.position.y}` : ''
        })
        .not.toBe(`${createdNote.position.x}:${createdNote.position.y}`)
      const movedNote = (await readVaultSettings(vaultRoot)).stickyNoteBoard.notes[0]
      expect(movedNote).toBeDefined()
      if (!movedNote) {
        throw new Error('Moved sticky note was not persisted')
      }
      expect(movedNote.position.x).not.toBe(createdNote.position.x)
      expect(movedNote.position.y).not.toBe(createdNote.position.y)

      const initialFontSize = await noteCard
        .getByRole('textbox')
        .evaluate((element) => Number.parseFloat(window.getComputedStyle(element).fontSize))
      const noteNode = page.locator(`.react-flow__node[data-id="${createdNote.id}"]`)
      await expect(noteNode).toHaveClass(/selected/)
      const resizeHandle = noteNode.locator('.react-flow__resize-control.bottom.right.handle')
      await expect(resizeHandle).toBeAttached()
      const resizeBox = await resizeHandle.boundingBox()
      expect(resizeBox).not.toBeNull()
      if (!resizeBox) {
        throw new Error('Sticky note resize handle is not measurable')
      }
      await page.mouse.move(resizeBox.x + resizeBox.width / 2, resizeBox.y + resizeBox.height / 2)
      await page.mouse.down()
      await page.mouse.move(
        resizeBox.x + resizeBox.width / 2 + 90,
        resizeBox.y + resizeBox.height / 2 + 70,
        { steps: 8 }
      )
      await page.mouse.up()

      await expect
        .poll(
          async () => (await readVaultSettings(vaultRoot)).stickyNoteBoard.notes[0]?.size.width ?? 0
        )
        .toBeGreaterThan(createdNote.size.width)
      await expect
        .poll(
          async () =>
            (await readVaultSettings(vaultRoot)).stickyNoteBoard.notes[0]?.size.height ?? 0
        )
        .toBeGreaterThan(createdNote.size.height)
      const resizedNote = (await readVaultSettings(vaultRoot)).stickyNoteBoard.notes[0]
      expect(resizedNote).toBeDefined()
      if (!resizedNote) {
        throw new Error('Resized sticky note was not persisted')
      }
      expect(resizedNote.size.width).toBeGreaterThan(createdNote.size.width)
      expect(resizedNote.size.height).toBeGreaterThan(createdNote.size.height)
      await expect
        .poll(async () =>
          noteCard
            .getByRole('textbox')
            .evaluate((element) => Number.parseFloat(window.getComputedStyle(element).fontSize))
        )
        .toBe(initialFontSize)

      await page.getByTestId('sticky-note-add').click()
      const notesAfterSecondCreate = await waitForStickyNotes(vaultRoot, 2)
      const deletedNote = notesAfterSecondCreate.find((note) => note.id !== createdNote.id)
      expect(deletedNote).toBeDefined()
      if (!deletedNote) {
        throw new Error('Second sticky note was not persisted')
      }
      const survivingNote = notesAfterSecondCreate.find((note) => note.id === createdNote.id)
      expect(survivingNote).toBeDefined()
      if (!survivingNote) {
        throw new Error('Original sticky note was not preserved')
      }

      await page.getByTestId('sticky-note-delete').click()
      await expect
        .poll(async () => (await readVaultSettings(vaultRoot)).stickyNoteBoard.notes.length)
        .toBe(1)
      await expect(page.getByTestId(`sticky-note:${deletedNote.id}`)).not.toBeVisible()

      await page.getByTestId('sticky-note-fit').click()
      await expect
        .poll(async () => {
          const settings = await readVaultSettings(vaultRoot)
          return settings.stickyNoteBoard.viewport.zoom
        })
        .toBeGreaterThan(0)

      await electronApp.close()
      electronApp = null
      ;({ electronApp } = await launchWithFixture(vaultRoot))
      const relaunchedPage = await electronApp.firstWindow()
      await openStickyNotePage(relaunchedPage)
      await expect(relaunchedPage.getByTestId(`sticky-note:${survivingNote.id}`)).toBeVisible()
      const persistedSettings = await readVaultSettings(vaultRoot)
      expect(persistedSettings.stickyNoteBoard.notes).toHaveLength(1)
      expect(persistedSettings.stickyNoteBoard.notes[0]?.id).toBe(survivingNote.id)
    } finally {
      await electronApp?.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('keeps rapid typing responsive with 500 notes', async () => {
    const vaultRoot = await createFixtureVault()
    let electronApp: ElectronApplication | null = null
    const benchmarkBoard = createBenchmarkBoard(500)

    try {
      await fs.writeFile(
        getVaultSettingsPath(vaultRoot),
        JSON.stringify({ stickyNoteBoard: benchmarkBoard }, null, 2),
        'utf-8'
      )
      ;({ electronApp } = await launchWithFixture(vaultRoot))
      const page = await electronApp.firstWindow()
      await openStickyNotePage(page)

      await expect
        .poll(() => page.locator('.react-flow__node').count())
        .toBeLessThan(benchmarkBoard.notes.length)

      const benchmarkText =
        'fast typing performance probe '.repeat(4) + 'fast typing performance probe'
      const textarea = page.locator('.sticky-note-card textarea').first()
      await expect(textarea).toBeVisible()
      await textarea.click()
      await textarea.fill('')
      await resetSettingsWriteProbe(electronApp)

      await startFrameProbe(page)
      await textarea.pressSequentially(benchmarkText)
      const metrics = await stopFrameProbe(page)
      await textarea.blur()

      await expect
        .poll(async () => (await readVaultSettings(vaultRoot)).stickyNoteBoard.notes[0]?.text)
        .toBe(benchmarkText)
      const writeProbe = await readSettingsWriteProbe(electronApp)
      expect(metrics.maxFrameGap).toBeLessThan(200)
      expect(metrics.longTaskCount).toBeLessThanOrEqual(5)
      expect(writeProbe.count).toBeLessThanOrEqual(2)
    } finally {
      await electronApp?.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })
})
