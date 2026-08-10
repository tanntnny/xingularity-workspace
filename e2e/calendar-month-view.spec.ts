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

function getMonthDayCellCount(date: Date): number {
  const monthStart = new Date(date.getFullYear(), date.getMonth(), 1)
  const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  return Math.ceil((monthStart.getDay() + daysInMonth) / 7) * 7
}

async function createFixtureVault(
  taskCount = 1,
  includeUnscheduled = false
): Promise<{ rootPath: string; todayIso: string }> {
  const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-calendar-month-e2e-vault-'))
  const todayIso = toIsoDate(new Date())
  const calendarTasks = Array.from({ length: taskCount }, (_, index) => ({
    id: `task-month-visible-${index}`,
    title:
      includeUnscheduled && index === taskCount - 1
        ? 'Unscheduled view task'
        : taskCount === 1
          ? 'Month view task'
          : `Overflow task ${index + 1}`,
    date: includeUnscheduled && index === taskCount - 1 ? undefined : todayIso,
    completed: false,
    createdAt: new Date().toISOString(),
    priority: 'medium',
    taskType: 'assignment',
    reminders: []
  }))

  await fs.mkdir(path.join(rootPath, 'notes'), { recursive: true })
  await fs.mkdir(path.join(rootPath, 'attachments'), { recursive: true })
  await fs.writeFile(
    path.join(rootPath, 'settings.json'),
    JSON.stringify(
      {
        calendarTasks
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
  const userDataPath = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-calendar-month-user-'))
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

async function openMonthlyCalendar(page: Page): Promise<void> {
  await page.getByTestId('sidebar-page:calendar').click()
  await expect(page.getByTestId('calendar-month-view')).toBeVisible()
}

test.describe('calendar monthly view', () => {
  test('renders a visible month grid with day cells', async () => {
    const { rootPath } = await createFixtureVault()
    const { electronApp, page } = await launchWithFixture(rootPath)

    try {
      await openMonthlyCalendar(page)

      const shell = page.getByTestId('calendar-month-shell')
      await expect(shell).toBeVisible()

      const grid = page.locator('.calendar-full .fc .fc-scrollgrid')
      await expect(grid).toBeVisible()

      const dayCells = page.locator('.calendar-full .fc .fc-daygrid-day')
      await expect(dayCells.first()).toBeVisible()
      await expect(dayCells).toHaveCount(getMonthDayCellCount(new Date()))
      await expect(dayCells.last()).toBeVisible()

      const metrics = await page.evaluate(() => {
        const cells = Array.from(
          document.querySelectorAll<HTMLElement>('.calendar-full .fc .fc-daygrid-day')
        )
        const firstCell = cells[0]
        const shell = document.querySelector<HTMLElement>('[data-testid="calendar-month-shell"]')
        const uniqueRowTops = Array.from(
          new Set(cells.map((cell) => Math.round(cell.getBoundingClientRect().top)))
        )

        return {
          rowCount: uniqueRowTops.length,
          firstCellHeight: firstCell?.getBoundingClientRect().height ?? 0,
          shellHeight: shell?.getBoundingClientRect().height ?? 0,
          shellBottom: shell?.getBoundingClientRect().bottom ?? 0,
          lastCellBottom: cells.at(-1)?.getBoundingClientRect().bottom ?? 0
        }
      })

      const firstCellBorder = await dayCells.first().evaluate((cell) => {
        const styles = getComputedStyle(cell)
        return {
          borderRightColor: styles.borderRightColor,
          borderRightStyle: styles.borderRightStyle
        }
      })

      expect(firstCellBorder.borderRightStyle).toBe('solid')
      expect(firstCellBorder.borderRightColor).not.toBe('rgba(0, 0, 0, 0)')

      expect(metrics.rowCount).toBeGreaterThanOrEqual(5)
      expect(metrics.firstCellHeight).toBeGreaterThanOrEqual(132)
      expect(metrics.shellHeight).toBeGreaterThan(500)
      expect(metrics.lastCellBottom).toBeLessThanOrEqual(metrics.shellBottom + 1)
    } finally {
      await electronApp.close()
      await fs.rm(rootPath, { recursive: true, force: true })
    }
  })

  test('keeps every task reachable when a day has many tasks', async () => {
    const { rootPath } = await createFixtureVault(18)
    const { electronApp, page } = await launchWithFixture(rootPath)

    try {
      await openMonthlyCalendar(page)

      const workspaceContent = page.locator('.document-workspace-main-content')
      await expect
        .poll(() =>
          workspaceContent.evaluate((element) => element.scrollHeight > element.clientHeight)
        )
        .toBe(true)

      const weekdayHeader = page
        .locator('.calendar-full .fc .fc-scrollgrid-section-header > th')
        .first()
      const weekdayHeaderTop = await weekdayHeader.evaluate(
        (element) => element.getBoundingClientRect().top
      )
      await workspaceContent.evaluate((element) => {
        element.scrollTop = 240
      })
      await expect
        .poll(() => workspaceContent.evaluate((element) => element.scrollTop))
        .toBeGreaterThan(0)
      expect(
        await weekdayHeader.evaluate((element) => element.getBoundingClientRect().top)
      ).toBeGreaterThanOrEqual(weekdayHeaderTop - 4)

      const lastTask = page.getByText('Overflow task 18', { exact: true })
      await lastTask.scrollIntoViewIfNeeded()
      await expect(lastTask).toBeVisible()
    } finally {
      await electronApp.close()
      await fs.rm(rootPath, { recursive: true, force: true })
    }
  })

  test('updates a task status from the calendar card picker', async () => {
    const { rootPath } = await createFixtureVault()
    const { electronApp, page } = await launchWithFixture(rootPath)

    try {
      await openMonthlyCalendar(page)

      const statusButton = page.getByRole('button', {
        name: 'Status for Month view task: Pending'
      })
      await statusButton.click()
      await page
        .getByRole('dialog', { name: 'Status for Month view task options' })
        .getByRole('radio', { name: 'Backlog', exact: true })
        .click()

      const taskCard = page.locator('[data-task-status="backlog"]').filter({
        hasText: 'Month view task'
      })
      await expect(taskCard).toHaveCSS('opacity', '0.6')
      await expect(
        taskCard.getByRole('button', { name: 'Status for Month view task: Backlog' })
      ).toBeVisible()
    } finally {
      await electronApp.close()
      await fs.rm(rootPath, { recursive: true, force: true })
    }
  })

  test('rotates only the task mirror while dragging a monthly task', async () => {
    const { rootPath } = await createFixtureVault()
    const { electronApp, page } = await launchWithFixture(rootPath)

    try {
      await openMonthlyCalendar(page)

      const source = page.locator('.calendar-full .fc-event.calendar-task-event').filter({
        hasText: 'Month view task'
      })
      await expect(source).toBeVisible()

      const sourceBox = await source.boundingBox()
      if (!sourceBox) {
        throw new Error('Monthly calendar task bounds are unavailable')
      }

      await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2)
      await page.mouse.down()
      await page.mouse.move(
        sourceBox.x + sourceBox.width / 2 + 24,
        sourceBox.y + sourceBox.height / 2 + 24,
        { steps: 3 }
      )

      await expect
        .poll(
          () =>
            page.evaluate(() => {
              const mirrors = Array.from(
                document.querySelectorAll<HTMLElement>(
                  '.fc-event-dragging, .fc-event-mirror, .calendar-task-drag-preview'
                )
              )
              return mirrors.some((mirror) => {
                const transform = getComputedStyle(mirror).transform
                if (transform === 'none') {
                  return false
                }
                const matrix = new DOMMatrixReadOnly(transform)
                return Math.abs(matrix.b) > 0.01 || Math.abs(matrix.c) > 0.01
              })
            }),
          { timeout: 5_000 }
        )
        .toBe(true)

      await expect
        .poll(() =>
          page.evaluate(() => {
            const mirror = document.querySelector<HTMLElement>(
              '.fc-event-dragging.calendar-task-event'
            )
            const taskCard = mirror?.querySelector<HTMLElement>('[data-task-status]')
            if (!mirror || !taskCard) {
              return false
            }

            const mirrorStyles = getComputedStyle(mirror)
            const taskCardStyles = getComputedStyle(taskCard)
            return (
              mirrorStyles.backgroundColor === 'rgba(0, 0, 0, 0)' &&
              mirrorStyles.borderTopColor === 'rgba(0, 0, 0, 0)' &&
              taskCardStyles.backgroundColor !== 'rgba(0, 0, 0, 0)'
            )
          })
        )
        .toBe(true)

      await expect
        .poll(() =>
          source.evaluate((element) => {
            const transform = getComputedStyle(element).transform
            return transform === 'none' || transform === 'matrix(1, 0, 0, 1, 0, 0)'
          })
        )
        .toBe(true)
    } finally {
      await page.mouse.up()
      await electronApp.close()
      await fs.rm(rootPath, { recursive: true, force: true })
    }
  })

  test('shows the shared unschedule drop message while dragging a monthly task', async () => {
    const { rootPath } = await createFixtureVault()
    const { electronApp, page } = await launchWithFixture(rootPath)

    try {
      await openMonthlyCalendar(page)

      const source = page.locator('.calendar-full .fc-event.calendar-task-event').filter({
        hasText: 'Month view task'
      })
      await expect(source).toBeVisible()
      const dropZone = page.locator('[data-unscheduled-drop-zone="true"]')
      await expect(dropZone).toBeVisible()

      const sourceBox = await source.boundingBox()
      const dropZoneBox = await dropZone.boundingBox()
      if (!sourceBox || !dropZoneBox) {
        throw new Error('Monthly unschedule drag bounds are unavailable')
      }

      await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2)
      await page.mouse.down()
      await page.mouse.move(
        dropZoneBox.x + dropZoneBox.width / 2,
        dropZoneBox.y + dropZoneBox.height / 2,
        { steps: 5 }
      )

      await expect(page.getByText('Drop here to unschedule', { exact: true })).toBeVisible()
    } finally {
      await page.mouse.up()
      await electronApp.close()
      await fs.rm(rootPath, { recursive: true, force: true })
    }
  })

})
