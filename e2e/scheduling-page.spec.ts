import { test, expect, type Page } from '@playwright/test'
import { _electron as electron, type ElectronApplication } from 'playwright'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { expectSingleRightPanelScrollport } from './right-panel-scrollport'

async function createFixtureVault(): Promise<string> {
  const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-scheduling-e2e-vault-'))
  const now = new Date().toISOString()

  await Promise.all([
    fs.mkdir(path.join(rootPath, 'notebooks'), { recursive: true }),
    fs.mkdir(path.join(rootPath, 'attachments'), { recursive: true }),
    fs.mkdir(path.join(rootPath, 'schedules'), { recursive: true })
  ])
  await fs.writeFile(
    path.join(rootPath, 'schedules', 'jobs.json'),
    JSON.stringify(
      [
        {
          id: 'job-selected',
          name: 'Selected automation',
          enabled: true,
          trigger: { type: 'daily', time: '08:00', timezone: 'local' },
          runtime: 'python',
          code: 'print({})',
          permissions: ['createTasks'],
          outputMode: 'review_before_apply',
          createdAt: now,
          updatedAt: now,
          lastStatus: 'success'
        },
        {
          id: 'job-hover',
          name: 'Hover automation',
          enabled: true,
          trigger: { type: 'daily', time: '09:00', timezone: 'local' },
          runtime: 'python',
          code: 'print({})',
          permissions: ['createTasks'],
          outputMode: 'review_before_apply',
          createdAt: now,
          updatedAt: now,
          lastStatus: 'success'
        }
      ],
      null,
      2
    ),
    'utf8'
  )

  return rootPath
}

async function createAutoApplyFixtureVault(): Promise<string> {
  const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-auto-apply-e2e-vault-'))
  const now = new Date().toISOString()

  await Promise.all([
    fs.mkdir(path.join(rootPath, 'notebooks'), { recursive: true }),
    fs.mkdir(path.join(rootPath, 'attachments'), { recursive: true }),
    fs.mkdir(path.join(rootPath, 'schedules'), { recursive: true })
  ])
  await fs.writeFile(
    path.join(rootPath, 'schedules', 'jobs.json'),
    JSON.stringify(
      [
        {
          id: 'job-auto-apply',
          name: 'Auto apply automation',
          enabled: false,
          trigger: { type: 'manual' },
          runtime: 'javascript',
          code: `beacon.emit({
  type: 'task.create',
  title: 'Auto-applied scheduling task',
  automationSource: 'scheduling-e2e',
  automationSourceKey: 'auto-apply-task'
})`,
          permissions: ['createTasks'],
          outputMode: 'review_before_apply',
          createdAt: now,
          updatedAt: now
        }
      ],
      null,
      2
    ),
    'utf8'
  )

  return rootPath
}

async function launchWithFixture(vaultRoot: string): Promise<{
  electronApp: ElectronApplication
  page: Page
}> {
  const userDataPath = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-scheduling-user-'))
  await fs.writeFile(
    path.join(userDataPath, 'settings.json'),
    JSON.stringify({ lastVaultPath: vaultRoot }, null, 2),
    'utf8'
  )

  const electronApp = await electron.launch({
    args: [`--user-data-dir=${userDataPath}`, '.'],
    cwd: process.cwd(),
    env: { ...process.env, CI: '1' }
  })
  const page = await electronApp.firstWindow()

  await page.waitForLoadState('domcontentloaded')
  await page.waitForFunction(() => typeof window.vaultApi?.vault?.restoreLast === 'function')
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const commandPalette = document.querySelector<HTMLButtonElement>(
            '[data-testid="sidebar-command-palette"]'
          )
          return commandPalette ? !commandPalette.disabled : false
        }),
      { timeout: 60_000 }
    )
    .toBe(true)

  return { electronApp, page }
}

test('automation rows change background on hover', async () => {
  const rootPath = await createFixtureVault()
  const { electronApp, page } = await launchWithFixture(rootPath)

  try {
    await page.getByTestId('sidebar-page:schedules').click()
    const row = page.getByTestId('scheduling-job:job-hover')
    await expect(row).toBeVisible()
    await page.getByTestId('workspace-page-context-menu-trigger').click()
    await expect(page.getByTestId('workspace-page-context-menu')).toBeVisible()
    await expect(page.getByTestId('scheduling-context-menu-item:api-guide')).toBeVisible()
    await page.keyboard.press('Escape')

    const cell = row.locator('td').first()
    await page.mouse.move(1, 1)
    const before = await row.evaluate((element) => {
      const cellElement = element.querySelector('td')
      return {
        rowBackground: getComputedStyle(element).backgroundColor,
        cellBackground: cellElement ? getComputedStyle(cellElement).backgroundColor : ''
      }
    })
    await cell.hover()
    await expect
      .poll(async () => cell.evaluate((element) => getComputedStyle(element).backgroundColor), {
        timeout: 1_000
      })
      .not.toBe(before.cellBackground)

    const after = await row.evaluate((element) => {
      const cellElement = element.querySelector('td')
      return {
        rowHovered: element.matches(':hover'),
        cellHovered: cellElement?.matches(':hover') ?? false,
        rowBackground: getComputedStyle(element).backgroundColor,
        cellBackground: cellElement ? getComputedStyle(cellElement).backgroundColor : ''
      }
    })

    expect(after.cellHovered).toBe(true)
    expect(after.rowBackground).not.toBe(before.rowBackground)
    expect(after.cellBackground).not.toBe(before.cellBackground)
  } finally {
    await electronApp.close()
    await fs.rm(rootPath, { recursive: true, force: true })
  }
})

test('keeps a long automation properties panel in the shared scrollport', async () => {
  const rootPath = await createFixtureVault()
  const { electronApp, page } = await launchWithFixture(rootPath)

  try {
    await page.setViewportSize({ width: 1440, height: 420 })
    await page.getByTestId('sidebar-page:schedules').click()
    await page.getByTestId('scheduling-job:job-selected').click()

    const panelStack = page.getByTestId('scheduling-panel-stack')
    await expect(page.getByTestId('scheduling-properties-panel')).toBeVisible()
    await expect(panelStack).toBeVisible()
    await expectSingleRightPanelScrollport(page)
    await expect
      .poll(() => panelStack.evaluate((element) => element.scrollHeight > element.clientHeight))
      .toBe(true)
  } finally {
    await electronApp.close()
    await fs.rm(rootPath, { recursive: true, force: true })
  }
})

test('saves and executes an automation in auto-apply mode', async () => {
  const rootPath = await createAutoApplyFixtureVault()
  const { electronApp, page } = await launchWithFixture(rootPath)

  try {
    await page.getByTestId('sidebar-page:schedules').click()
    await page.getByTestId('scheduling-job:job-auto-apply').click()

    const outputMode = page.getByTestId('scheduling-output-mode')
    await outputMode.click()
    const autoApplyOption = page.getByRole('option', { name: 'auto_apply' })
    await expect(autoApplyOption).toBeVisible()
    await autoApplyOption.click()
    await expect(outputMode).toContainText('Auto apply')

    await page.getByTestId('scheduling-topbar-save').click()
    await expect
      .poll(async () => {
        const jobs = await page.evaluate(() => window.vaultApi.schedules.listJobs())
        return jobs.find((job) => job.id === 'job-auto-apply')?.outputMode
      })
      .toBe('auto_apply')

    await page.getByTestId('scheduling-topbar-run').click()
    await expect
      .poll(async () => {
        const runs = await page.evaluate(() => window.vaultApi.schedules.listRuns('job-auto-apply'))
        return runs[0]?.status
      })
      .toBe('success')

    await expect
      .poll(async () => {
        const settings = await page.evaluate(() => window.vaultApi.settings.get())
        return settings.calendarTasks.find((task) => task.automationSourceKey === 'auto-apply-task')
      })
      .toMatchObject({ title: 'Auto-applied scheduling task' })
  } finally {
    await electronApp.close()
    await fs.rm(rootPath, { recursive: true, force: true })
  }
})
