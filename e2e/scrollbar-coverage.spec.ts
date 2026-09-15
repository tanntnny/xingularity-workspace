import { test, expect, type Page } from '@playwright/test'
import { _electron as electron, type ElectronApplication } from 'playwright'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  createStoredNoteDocumentFromText,
  serializeStoredNoteDocument
} from '../src/shared/noteDocument'

async function createFixtureVault(): Promise<string> {
  const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-scrollbar-e2e-vault-'))
  await fs.mkdir(path.join(rootPath, 'notes'), { recursive: true })
  await fs.mkdir(path.join(rootPath, 'attachments'), { recursive: true })

  await Promise.all(
    Array.from({ length: 80 }, (_, index) => {
      const name = `scroll-test-${String(index + 1).padStart(3, '0')}.md`
      const content = serializeStoredNoteDocument(
        createStoredNoteDocumentFromText(`# Scroll test ${index + 1}\n`)
      )
      return fs.writeFile(path.join(rootPath, 'notes', name), content, 'utf-8')
    })
  )

  return rootPath
}

async function launchWithFixture(vaultRoot: string): Promise<{
  electronApp: ElectronApplication
  page: Page
  userDataPath: string
}> {
  const userDataPath = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-scrollbar-e2e-user-'))
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
  await fs.mkdir(actualUserDataPath, { recursive: true })
  await fs.writeFile(
    path.join(actualUserDataPath, 'settings.json'),
    JSON.stringify({ lastVaultPath: vaultRoot }, null, 2),
    'utf-8'
  )

  const page = await electronApp.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  await page.waitForFunction(() => typeof window.vaultApi?.vault?.restoreLast === 'function')
  await expect
    .poll(
      async () => {
        try {
          await page.evaluate(() => window.vaultApi.vault.restoreLast())
        } catch {
          // Retry while the temporary fixture vault is being initialized.
        }

        return page.getByTestId('sidebar-page:notes').isEnabled()
      },
      { timeout: 20_000 }
    )
    .toBe(true)

  return { electronApp, page, userDataPath }
}

async function readScrollportMetrics(page: Page): Promise<
  Array<{
    className: string
    clientHeight: number
    overflowY: string
    scrollbarWidth: string
    scrollHeight: number
  }>
> {
  return page.locator('[data-workspace-scrollport="true"]').evaluateAll((elements) =>
    elements.map((element) => {
      const node = element as HTMLElement
      const styles = getComputedStyle(node)
      return {
        className: node.className,
        clientHeight: node.clientHeight,
        overflowY: styles.overflowY,
        scrollbarWidth: styles.getPropertyValue('scrollbar-width').trim(),
        scrollHeight: node.scrollHeight
      }
    })
  )
}

test('keeps page and panel scrollbars available across shared workspace scrollports', async () => {
  const vaultRoot = await createFixtureVault()
  const { electronApp, page, userDataPath } = await launchWithFixture(vaultRoot)

  try {
    await page.setViewportSize({ width: 1200, height: 360 })
    await expect(page.getByTestId('notebook-card-browser')).toBeVisible()
    await expect
      .poll(async () => {
        const metrics = await readScrollportMetrics(page)
        return metrics.length
      })
      .toBeGreaterThanOrEqual(2)

    const initialScrollports = await readScrollportMetrics(page)
    expect(initialScrollports.every(({ className }) => !className.includes('scrollbar-none'))).toBe(
      true
    )

    const notesPanelStack = page.getByTestId('notes-panel-stack')
    await expect
      .poll(async () =>
        notesPanelStack.evaluate((element) => {
          const node = element as HTMLElement
          return node.scrollHeight > node.clientHeight
        })
      )
      .toBe(true)
    await notesPanelStack.evaluate((element) => {
      const node = element as HTMLElement
      node.scrollTop = node.scrollHeight
    })
    await expect(notesPanelStack).toHaveClass(/scrollbar-visible/)

    await page.getByTestId('sidebar-page:settings').click()
    await expect(page.getByTestId('settings-tabs')).toBeVisible()
    await page.getByTestId('settings-tabs').getByRole('tab', { name: 'Editor' }).click()
    await expect(page.getByRole('heading', { name: 'Editor' })).toBeVisible()

    const mainScrollport = page.locator('main.document-workspace-main-content')
    await expect
      .poll(async () =>
        mainScrollport.evaluate((element) => {
          const node = element as HTMLElement
          return node.scrollHeight > node.clientHeight
        })
      )
      .toBe(true)
    const mainMetrics = await mainScrollport.evaluate((element) => {
      const node = element as HTMLElement
      const styles = getComputedStyle(node)
      return {
        className: node.className,
        overflowY: styles.overflowY,
        scrollbarWidth: styles.getPropertyValue('scrollbar-width').trim()
      }
    })
    expect(mainMetrics.className).not.toContain('scrollbar-none')
    expect(mainMetrics.overflowY).toBe('auto')
    expect(mainMetrics.scrollbarWidth).not.toBe('none')

    await mainScrollport.evaluate((element) => {
      const node = element as HTMLElement
      node.scrollTop = node.scrollHeight
    })
    await expect(mainScrollport).toHaveClass(/scrollbar-visible/)
  } finally {
    await electronApp.close()
    await fs.rm(vaultRoot, { recursive: true, force: true })
    await fs.rm(userDataPath, { recursive: true, force: true })
  }
})
