import { test, expect, type Locator, type Page } from '@playwright/test'
import { _electron as electron, type ElectronApplication } from 'playwright'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

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
  const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-right-panel-e2e-vault-'))
  await fs.mkdir(path.join(rootPath, 'notebooks'), { recursive: true })
  await fs.mkdir(path.join(rootPath, 'attachments'), { recursive: true })
  return rootPath
}

async function launchWithFixture(vaultRoot: string): Promise<{
  electronApp: ElectronApplication
  page: Page
}> {
  const userDataPath = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-right-panel-user-'))
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
  page.on('pageerror', (error) =>
    console.error(`[renderer pageerror] ${error.stack ?? error.message}`)
  )
  page.on('console', (message) => {
    if (message.type() === 'error') {
      console.error(`[renderer console] ${message.text()}`)
    }
  })
  await page.waitForLoadState('domcontentloaded')
  await page.waitForFunction(() => typeof window.vaultApi?.vault?.restoreLast === 'function')
  await expect
    .poll(
      async () =>
        page.evaluate(async () => {
          try {
            await window.vaultApi.vault.restoreLast()
          } catch {
            // Retry until the temporary fixture vault is restorable.
          }

          return Boolean(document.querySelector('[data-testid="sidebar-command-palette"]'))
        }),
      { timeout: 60_000 }
    )
    .toBe(true)

  return { electronApp, page }
}

async function getWidth(locator: Locator): Promise<number> {
  const box = await locator.boundingBox()
  if (!box) {
    throw new Error('Right workspace panel bounding box is not available')
  }

  return Math.round(box.width)
}

test.describe('right workspace panel resizing', () => {
  test('supports pointer and keyboard resizing, collapse, clamping, and persistence', async () => {
    const vaultRoot = await createFixtureVault()
    const { electronApp, page } = await launchWithFixture(vaultRoot)
    const resizeObserverErrors: string[] = []
    const recordResizeObserverError = (message: string): void => {
      if (message.includes('ResizeObserver loop completed with undelivered notifications')) {
        resizeObserverErrors.push(message)
      }
    }
    page.on('pageerror', (error) => recordResizeObserverError(error.message))
    page.on('console', (message) => recordResizeObserverError(message.text()))

    try {
      await page.evaluate(() => window.localStorage.removeItem('workspace_right_panel_width'))
      await page.evaluate(() => window.localStorage.removeItem('sidebar_width'))
      await page.reload()
      await expect(page.getByTestId('sidebar-command-palette')).toBeVisible({ timeout: 20_000 })

      const sidebar = page.locator('[data-side="left"] > div').nth(1)
      const sidebarRail = page.getByRole('separator', { name: 'Resize or toggle Sidebar' })
      const resizeHandle = page.getByTestId('workspace-right-panel-resize')
      const panel = page.getByTestId('workspace-right-panel')

      await expect.poll(() => getWidth(sidebar)).toBe(256)
      const sidebarRailBox = await sidebarRail.boundingBox()
      if (!sidebarRailBox) {
        throw new Error('Sidebar resize rail bounding box is not available')
      }

      await page.mouse.move(sidebarRailBox.x + sidebarRailBox.width / 2, sidebarRailBox.y + 120)
      await page.mouse.down()
      await page.mouse.move(
        sidebarRailBox.x + sidebarRailBox.width / 2 + 180,
        sidebarRailBox.y + 120,
        { steps: 8 }
      )
      await page.mouse.up()
      await expect.poll(() => getWidth(sidebar)).toBe(360)

      await expect(resizeHandle).toBeVisible()
      await expect.poll(() => getWidth(panel)).toBe(300)

      const initialHandleBox = await resizeHandle.boundingBox()
      if (!initialHandleBox) {
        throw new Error('Right workspace panel resize handle bounding box is not available')
      }
      await page.mouse.move(
        initialHandleBox.x + initialHandleBox.width / 2,
        initialHandleBox.y + 120
      )
      await page.mouse.down()
      await page.mouse.move(
        initialHandleBox.x + initialHandleBox.width / 2 - 180,
        initialHandleBox.y + 120,
        { steps: 8 }
      )
      await page.mouse.up()
      await expect.poll(() => getWidth(panel)).toBeGreaterThan(300)
      await expect.poll(() => getWidth(panel)).toBeLessThanOrEqual(360)
      const pointerExpandedWidth = await getWidth(panel)

      await resizeHandle.focus()
      await resizeHandle.press('ArrowRight')
      await expect.poll(() => getWidth(panel)).toBeLessThan(pointerExpandedWidth)
      await expect.poll(() => getWidth(panel)).toBeGreaterThanOrEqual(220)

      const expandedWidth = await getWidth(panel)
      await page.getByRole('button', { name: 'Close right sidebar' }).click()
      await expect.poll(() => getWidth(panel)).toBe(0)

      await page.getByRole('button', { name: 'Open right sidebar' }).click()
      await expect.poll(() => getWidth(panel)).toBe(expandedWidth)

      await page.reload()
      await expect(page.getByTestId('sidebar-command-palette')).toBeVisible({ timeout: 20_000 })
      await expect
        .poll(() => getWidth(page.getByTestId('workspace-right-panel')))
        .toBe(expandedWidth)
      expect(resizeObserverErrors).toEqual([])
    } finally {
      await electronApp.close()
    }
  })
})
