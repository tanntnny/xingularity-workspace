import { test, expect, type Page } from '@playwright/test'
import { _electron as electron, type ElectronApplication } from 'playwright'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

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
    args: ['.', `--user-data-dir=${userDataPath}`],
    cwd: process.cwd(),
    env: { ...process.env, CI: '1' }
  })
  const page = await electronApp.firstWindow()

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
