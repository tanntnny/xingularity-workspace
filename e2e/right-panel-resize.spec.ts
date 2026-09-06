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

type PanelMotionSample = {
  state: string
  left: number
  width: number
  transform: string
  opacity: string
}

async function getPanelMotionSample(page: Page): Promise<PanelMotionSample | null> {
  return page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>(
      '[data-panel-state][data-panel-resizable="true"]'
    )
    if (!panel) {
      return null
    }

    const styles = getComputedStyle(panel)
    const box = panel.getBoundingClientRect()
    return {
      state: panel.dataset.panelState ?? '',
      left: box.left,
      width: box.width,
      transform: styles.transform,
      opacity: styles.opacity
    }
  })
}

async function getResizeAffordanceStyles(locator: Locator): Promise<{
  cursor: string
  lineBackgroundImage: string
  lineOpacity: string
  lineWidth: string
}> {
  return locator.evaluate((element) => {
    const line = getComputedStyle(element, '::after')

    return {
      cursor: getComputedStyle(element).cursor,
      lineBackgroundImage: line.backgroundImage,
      lineOpacity: line.opacity,
      lineWidth: line.width
    }
  })
}

async function resizeRightPanelBy(page: Page, delta: number): Promise<void> {
  const resizeHandle = page.getByTestId('workspace-right-panel-resize')
  const handleBox = await resizeHandle.boundingBox()
  if (!handleBox) {
    throw new Error('Right workspace panel resize handle bounding box is not available')
  }

  const startX = handleBox.x + handleBox.width / 2
  const startY = handleBox.y + handleBox.height / 2
  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX - delta, startY, { steps: 8 })
  await page.mouse.up()
}

async function expectRightPanelToggle(page: Page, open: boolean): Promise<void> {
  const toggle = page.getByTestId('workspace-right-panel-toggle')
  const state = open ? 'open' : 'collapsed'
  const label = open ? 'Close right sidebar' : 'Open right sidebar'
  const activeIcon = open ? 'workspace-right-panel-close-icon' : 'workspace-right-panel-open-icon'
  const inactiveIcon = open ? 'workspace-right-panel-open-icon' : 'workspace-right-panel-close-icon'

  await expect(toggle).toHaveAttribute('data-panel-toggle-state', state)
  await expect(toggle).toHaveAttribute('aria-label', label)
  await expect(page.getByTestId(activeIcon)).toBeVisible()
  await expect(page.getByTestId(inactiveIcon)).toHaveCount(0)
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
      await expect
        .poll(async () => (await getResizeAffordanceStyles(sidebarRail)).lineOpacity)
        .toBe('0')
      await sidebarRail.hover()
      await expect
        .poll(async () => (await getResizeAffordanceStyles(sidebarRail)).lineOpacity, {
          timeout: 2_000
        })
        .toBe('1')
      const sidebarAffordanceStyles = await getResizeAffordanceStyles(sidebarRail)
      expect(sidebarAffordanceStyles.cursor).toBe('ew-resize')
      expect(sidebarAffordanceStyles.lineWidth).toBe('1px')
      expect(sidebarAffordanceStyles.lineBackgroundImage).toContain('linear-gradient')

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
      await expect
        .poll(async () => (await getResizeAffordanceStyles(resizeHandle)).lineOpacity)
        .toBe('0')
      await resizeHandle.hover()
      await expect
        .poll(async () => (await getResizeAffordanceStyles(resizeHandle)).lineOpacity, {
          timeout: 2_000
        })
        .toBe('1')
      const affordanceStyles = await getResizeAffordanceStyles(resizeHandle)
      expect(affordanceStyles.cursor).toBe('ew-resize')
      expect(affordanceStyles.lineWidth).toBe('1px')
      expect(affordanceStyles.lineBackgroundImage).toContain('linear-gradient')
      expect(affordanceStyles.lineOpacity).toBe('1')

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
      await expect.poll(() => getWidth(panel)).toBe(480)
      const pointerExpandedWidth = await getWidth(panel)

      await resizeHandle.focus()
      await resizeHandle.press('ArrowRight')
      await expect.poll(() => getWidth(panel)).toBeLessThan(pointerExpandedWidth)
      await expect.poll(() => getWidth(panel)).toBeGreaterThanOrEqual(220)

      const expandedWidth = await getWidth(panel)
      await expect
        .poll(async () => (await getPanelMotionSample(page))?.state, { timeout: 1_000 })
        .toBe('open')
      await expect
        .poll(async () => (await getPanelMotionSample(page))?.transform, { timeout: 1_000 })
        .toMatch(/matrix\(1, 0, 0, 1, 0, 0\)/)
      const openSample = await getPanelMotionSample(page)
      expect(openSample?.state).toBe('open')
      await page.getByRole('button', { name: 'Close right sidebar' }).click()
      await expect
        .poll(async () => (await getPanelMotionSample(page))?.state, { timeout: 1_000 })
        .toBe('exiting')
      await page.waitForTimeout(60)
      const exitSample = await getPanelMotionSample(page)
      expect(exitSample?.width ?? 0).toBeGreaterThan(0)
      expect(exitSample?.transform).not.toBe('none')
      expect(exitSample?.left ?? 0).toBeGreaterThan((openSample?.left ?? 0) + 4)
      await expect.poll(() => getWidth(panel)).toBe(0)

      await page.getByRole('button', { name: 'Open right sidebar' }).click()
      await expect
        .poll(async () => (await getPanelMotionSample(page))?.state, { timeout: 1_000 })
        .toMatch(/entering|open/)
      await expect.poll(() => getWidth(panel)).toBe(expandedWidth)
      await expect
        .poll(async () => (await getPanelMotionSample(page))?.state, { timeout: 1_000 })
        .toBe('open')

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

  test('remembers independent widths per page and migrates the legacy width', async () => {
    const vaultRoot = await createFixtureVault()
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await page.evaluate(() => {
        window.localStorage.setItem('workspace_right_panel_width', JSON.stringify(340))
      })
      await page.reload()
      await expect(page.getByTestId('sidebar-command-palette')).toBeVisible({ timeout: 20_000 })

      const panel = page.getByTestId('workspace-right-panel')
      await expect.poll(() => getWidth(panel)).toBe(340)

      await resizeRightPanelBy(page, 60)
      await expect.poll(() => getWidth(panel)).toBe(400)

      await page.getByTestId('sidebar-page:knowledge').click()
      await expect(page.getByTestId('workspace-right-panel-resize')).toBeVisible()
      await expect.poll(() => getWidth(panel)).toBe(340)

      await resizeRightPanelBy(page, 40)
      await expect.poll(() => getWidth(panel)).toBe(380)

      await page.getByTestId('sidebar-page:notes').click()
      await expect.poll(() => getWidth(panel)).toBe(400)

      await page.getByTestId('sidebar-page:knowledge').click()
      await expect.poll(() => getWidth(panel)).toBe(380)

      await page.reload()
      await expect(page.getByTestId('sidebar-command-palette')).toBeVisible({ timeout: 20_000 })
      await page.getByTestId('sidebar-page:notes').click()
      await expect.poll(() => getWidth(panel)).toBe(400)
      await page.getByTestId('sidebar-page:knowledge').click()
      await expect.poll(() => getWidth(panel)).toBe(380)
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('toggles the right panel with Cmd+B across panel-bearing pages', async () => {
    const vaultRoot = await createFixtureVault()
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      const panelPages = ['notes', 'knowledge', 'subscriptions', 'calendar'] as const

      for (const pageId of panelPages) {
        await page.getByTestId(`sidebar-page:${pageId}`).click()

        await expectRightPanelToggle(page, true)
        await expect(
          page.locator('[data-panel-state="open"][data-panel-resizable="true"]').first()
        ).toHaveCSS('transition-property', /transform/)
        await page.keyboard.press('Meta+B')
        await expectRightPanelToggle(page, false)
        await page.keyboard.press('Meta+B')
        await expectRightPanelToggle(page, true)
      }

      await page.getByTestId('sidebar-page:schedules').click()
      await expect(page.getByTestId('scheduling-add-automation')).toBeVisible({ timeout: 20_000 })
      await page.getByTestId('scheduling-add-automation').click()
      await expect(page.getByTestId('scheduling-panel-stack')).toBeVisible()
      await expectRightPanelToggle(page, true)
      await page.keyboard.press('Meta+B')
      await expectRightPanelToggle(page, false)
      await page.keyboard.press('Meta+B')
      await expectRightPanelToggle(page, true)

      await page.getByTestId('sidebar-page:settings').click()
      await expect
        .poll(async () => (await getPanelMotionSample(page))?.state, { timeout: 1_000 })
        .toBe('exiting')
      await expect
        .poll(async () => page.locator('[data-panel-state][data-panel-resizable="true"]').count(), {
          timeout: 1_000
        })
        .toBe(0)
      await expect(page.getByTestId('workspace-right-panel-toggle')).toHaveCount(0)
      const profileInput = page.getByLabel('Profile Name')
      await profileInput.focus()
      await page.keyboard.press('Meta+B')
      await expect(page.getByTestId('workspace-right-panel-toggle')).toHaveCount(0)

      await page.getByTestId('sidebar-vault-manager').click()
      await expect(page.getByRole('dialog')).toBeVisible()
      await page.keyboard.press('Meta+B')
      await page.keyboard.press('Escape')
      await expect(page.getByTestId('workspace-right-panel-toggle')).toHaveCount(0)

      await page.getByTestId('sidebar-page:capture').click()
      await expect(page.getByTestId('workspace-right-panel-toggle')).toHaveCount(0)
      await page.keyboard.press('Meta+B')
      await expect(page.getByTestId('workspace-right-panel-toggle')).toHaveCount(0)

      await page.getByTestId('sidebar-page:settings').click()
      await page.getByRole('tab', { name: 'Developer', exact: true }).click()
      await page.getByTestId('settings-open-design-audit').click()
      await expect(page.getByRole('heading', { name: 'Design Audit' })).toBeVisible()
      await expect(page.getByTestId('design-audit-panel')).toBeVisible()
      await expectRightPanelToggle(page, true)
      await page.keyboard.press('Meta+B')
      await expectRightPanelToggle(page, false)
      await page.keyboard.press('Meta+B')
      await expectRightPanelToggle(page, true)

      await page.keyboard.press('Meta+F')
      await expect(page.locator('[data-focus-mode="true"]')).toHaveCount(1)
      await expectRightPanelToggle(page, false)
      const desktopSidebar = page.locator('[data-side="left"] > div').nth(1)
      await expect(desktopSidebar).toHaveClass(/motion-sidebar/)
      await expect
        .poll(
          async () =>
            desktopSidebar.evaluate((element) => getComputedStyle(element).transitionProperty),
          { timeout: 1_000 }
        )
        .toMatch(/transform/)
      await expect
        .poll(
          async () => desktopSidebar.evaluate((element) => element.getBoundingClientRect().left),
          { timeout: 1_000 }
        )
        .toBeLessThan(0)
      await page.getByTestId('workspace-right-panel-toggle').click()
      await expect(page.locator('[data-focus-mode="false"]')).toHaveCount(1)
      await expectRightPanelToggle(page, true)

      await page.getByTestId('sidebar-page:projects').click()
      await expect(page.getByTestId('workspace-right-panel-toggle')).toHaveCount(0)
      await expect(page.getByTestId('project-properties-panel')).toHaveCount(0)
      await expect(page.getByTestId('workspace-right-panel-resize')).toHaveCount(0)
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('slides the visual panel before collapsing its resizable geometry', async () => {
    const vaultRoot = await createFixtureVault()
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await page.getByTestId('sidebar-page:notes').click()
      await expect
        .poll(async () => (await getPanelMotionSample(page))?.state, { timeout: 1_000 })
        .toBe('open')
      await expect
        .poll(async () => (await getPanelMotionSample(page))?.transform, { timeout: 1_000 })
        .toMatch(/matrix\(1, 0, 0, 1, 0, 0\)/)

      const openSample = await getPanelMotionSample(page)
      expect(openSample?.width ?? 0).toBeGreaterThan(0)

      await page.getByRole('button', { name: 'Close right sidebar' }).click()
      await expect
        .poll(async () => (await getPanelMotionSample(page))?.state, { timeout: 1_000 })
        .toBe('exiting')
      await page.waitForTimeout(60)

      const exitSample = await getPanelMotionSample(page)
      expect(exitSample?.width ?? 0).toBeGreaterThan(0)
      expect(exitSample?.transform).not.toBe('none')
      expect(exitSample?.left ?? 0).toBeGreaterThan((openSample?.left ?? 0) + 4)
      await expect
        .poll(async () => (await getPanelMotionSample(page))?.state, { timeout: 1_000 })
        .toBe('collapsed')

      await page.getByRole('button', { name: 'Open right sidebar' }).click()
      await expect
        .poll(async () => (await getPanelMotionSample(page))?.state, { timeout: 1_000 })
        .toMatch(/entering|open/)
      await expect
        .poll(async () => (await getPanelMotionSample(page))?.state, { timeout: 1_000 })
        .toBe('open')
      await expect
        .poll(async () => (await getPanelMotionSample(page))?.transform, { timeout: 1_000 })
        .toMatch(/matrix\(1, 0, 0, 1, 0, 0\)/)

      await page.keyboard.press('Meta+F')
      await expect(page.locator('[data-focus-mode="true"]')).toHaveCount(1)
      const sidebar = page.locator('[data-side="left"] > div').nth(1)
      await expect(sidebar).toHaveClass(/motion-sidebar/)
      await expect
        .poll(
          async () => sidebar.evaluate((element) => getComputedStyle(element).transitionProperty),
          { timeout: 1_000 }
        )
        .toMatch(/transform/)
      await expect
        .poll(async () => sidebar.evaluate((element) => element.getBoundingClientRect().left), {
          timeout: 1_000
        })
        .toBeLessThan(0)

      await page.getByTestId('workspace-right-panel-toggle').click()
      await expect(page.locator('[data-focus-mode="false"]')).toHaveCount(1)
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.getByRole('button', { name: 'Close right sidebar' }).click()
      await expect
        .poll(async () => (await getPanelMotionSample(page))?.state, { timeout: 1_000 })
        .toBe('collapsed')
      await page.getByRole('button', { name: 'Open right sidebar' }).click()
      await expect
        .poll(async () => (await getPanelMotionSample(page))?.state, { timeout: 1_000 })
        .toBe('open')
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })
})
