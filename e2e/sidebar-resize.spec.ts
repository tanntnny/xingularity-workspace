import { test, expect, type Locator, type Page } from '@playwright/test'
import { _electron as electron, type ElectronApplication } from 'playwright'
import fs from 'node:fs/promises'
import path from 'node:path'

async function launchWithoutVault(): Promise<{
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
    JSON.stringify({ lastVaultPath: null }, null, 2),
    'utf-8'
  )

  const page = await electronApp.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  await expect(page.getByTestId('sidebar-command-palette')).toBeVisible({ timeout: 20_000 })

  return { electronApp, page }
}

function getDesktopSidebar(page: Page): Locator {
  return page.locator('[data-side="left"] > div').nth(1)
}

async function getDesktopSidebarWidth(page: Page): Promise<number> {
  const box = await getDesktopSidebar(page).boundingBox()
  if (!box) {
    throw new Error('Desktop sidebar bounding box is not available')
  }

  return Math.round(box.width)
}

test.describe('sidebar resizing', () => {
  test('keeps a minimum width, clamps resizing, and persists width', async () => {
    const { electronApp, page } = await launchWithoutVault()

    try {
      await page.evaluate(() => window.localStorage.removeItem('sidebar_width'))
      await page.reload()
      await expect(page.getByTestId('sidebar-command-palette')).toBeVisible({ timeout: 20_000 })

      const provider = page.locator('[data-focus-mode]')
      const rail = page.getByRole('separator', { name: 'Resize or toggle Sidebar' })

      await expect.poll(() => getDesktopSidebarWidth(page)).toBe(256)

      const initialRailBox = await rail.boundingBox()
      if (!initialRailBox) {
        throw new Error('Sidebar resize rail bounding box is not available')
      }

      await page.mouse.move(initialRailBox.x + initialRailBox.width / 2, initialRailBox.y + 120)
      await page.mouse.down()
      await page.mouse.move(
        initialRailBox.x + initialRailBox.width / 2 + 180,
        initialRailBox.y + 120,
        {
          steps: 8
        }
      )
      await page.mouse.up()

      await expect.poll(() => getDesktopSidebarWidth(page)).toBe(360)
      await expect(rail).toHaveAttribute('aria-valuenow', '360')

      await rail.click()
      await expect(provider).toHaveAttribute('data-focus-mode', 'false')
      await expect(provider.locator('[data-collapsible="min"]')).toBeVisible()
      await expect.poll(() => getDesktopSidebarWidth(page)).toBe(220)

      const collapsedRailBox = await rail.boundingBox()
      if (!collapsedRailBox) {
        throw new Error('Collapsed sidebar resize rail bounding box is not available')
      }

      await page.mouse.move(
        collapsedRailBox.x + collapsedRailBox.width / 2,
        collapsedRailBox.y + 120
      )
      await page.mouse.down()
      await page.mouse.move(
        collapsedRailBox.x + collapsedRailBox.width / 2 + 90,
        collapsedRailBox.y + 120,
        { steps: 8 }
      )
      await page.mouse.up()

      await expect.poll(() => getDesktopSidebarWidth(page)).toBe(310)
      await page.reload()
      await expect(page.getByTestId('sidebar-command-palette')).toBeVisible({ timeout: 20_000 })
      await expect.poll(() => getDesktopSidebarWidth(page)).toBe(310)
    } finally {
      await electronApp.close()
    }
  })
})
