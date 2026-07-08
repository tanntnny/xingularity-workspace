import { test, expect, Page } from '@playwright/test'
import { _electron as electron, ElectronApplication } from 'playwright'
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

function toIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

async function createFixtureVault(): Promise<{ rootPath: string; todayIso: string }> {
  const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-calendar-week-e2e-vault-'))
  const todayIso = toIsoDate(new Date())

  await fs.mkdir(path.join(rootPath, 'notes'), { recursive: true })
  await fs.mkdir(path.join(rootPath, 'attachments'), { recursive: true })
  await fs.writeFile(
    path.join(rootPath, 'settings.json'),
    JSON.stringify(
      {
        calendarTasks: [
          {
            id: 'task-weekly-preview',
            title: 'Timed drag preview task',
            date: todayIso,
            time: '09:00',
            endTime: '09:40',
            completed: false,
            createdAt: new Date().toISOString(),
            priority: 'medium',
            taskType: 'assignment',
            reminders: []
          }
        ]
      },
      null,
      2
    ),
    'utf-8'
  )

  return { rootPath, todayIso }
}

async function launchWithFixture(vaultRoot: string): Promise<{
  electronApp: ElectronApplication
  page: Page
}> {
  const userDataPath = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-calendar-week-user-'))
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

          const calendarButton = document.querySelector<HTMLButtonElement>(
            '[data-testid="sidebar-page:calendar"]'
          )

          if (!calendarButton) {
            return 'missing'
          }

          return calendarButton.disabled ? 'disabled' : 'enabled'
        }),
      { timeout: 60_000 }
    )
    .toBe('enabled')

  return { electronApp, page }
}

async function openWeeklyCalendar(page: Page): Promise<void> {
  await page.getByTestId('sidebar-page:calendar').click()
  await expect(page.getByLabel(/Calendar view:/)).toBeVisible()
  await page.getByLabel(/Calendar view:/).click()
  await page.getByRole('menuitemradio', { name: 'Weekly' }).click()
  await expect(page.getByTestId('calendar-week-view')).toBeVisible()
}

test.describe('calendar weekly drag preview', () => {
  test('shows a timed preview band while dragging a weekly task', async () => {
    const { rootPath, todayIso } = await createFixtureVault()
    const { electronApp, page } = await launchWithFixture(rootPath)

    try {
      await openWeeklyCalendar(page)
      await expect(page.getByTestId('calendar-week-task:task-weekly-preview')).toBeVisible()

      await page.evaluate((dateIso) => {
        const source = document.querySelector<HTMLElement>(
          '[data-testid="calendar-week-task:task-weekly-preview"]'
        )
        const target = document.querySelector<HTMLElement>(
          `[data-testid="calendar-week-timed-column:${dateIso}"]`
        )
        if (!source || !target) {
          throw new Error('Weekly drag preview fixtures are missing')
        }

        const sourceRect = source.getBoundingClientRect()
        const targetRect = target.getBoundingClientRect()
        const dataTransfer = new DataTransfer()

        source.dispatchEvent(
          new DragEvent('dragstart', {
            bubbles: true,
            cancelable: true,
            dataTransfer,
            clientX: sourceRect.left + sourceRect.width / 2,
            clientY: sourceRect.top + 12
          })
        )

        target.dispatchEvent(
          new DragEvent('dragover', {
            bubbles: true,
            cancelable: true,
            dataTransfer,
            clientX: targetRect.left + targetRect.width / 2,
            clientY: targetRect.top + 520
          })
        )
      }, todayIso)

      const indicator = page.getByTestId('calendar-week-drop-indicator')
      await expect(indicator).toBeVisible()
      const indicatorBox = await indicator.boundingBox()
      expect(indicatorBox).not.toBeNull()
      if (!indicatorBox) {
        throw new Error('Weekly drag preview indicator bounding box not available')
      }
      expect(indicatorBox.height).toBeGreaterThan(0)
      expect(indicatorBox.height).toBeLessThan(120)

      await page.evaluate(() => {
        const source = document.querySelector<HTMLElement>(
          '[data-testid="calendar-week-task:task-weekly-preview"]'
        )
        if (!source) {
          return
        }
        source.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true }))
      })
    } finally {
      await electronApp.close()
      await fs.rm(rootPath, { recursive: true, force: true })
    }
  })
})
