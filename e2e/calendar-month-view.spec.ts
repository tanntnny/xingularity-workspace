import { test, expect, type Locator, type Page } from '@playwright/test'
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
  includeUnscheduled = false,
  tagsByIndex: Record<number, string[]> = {},
  projectIndexes: readonly number[] = []
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
    tags: tagsByIndex[index] ?? [],
    projectId: projectIndexes.includes(index) ? `project-${index}` : undefined,
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

async function getMonthlyResizeAffordanceStyles(locator: Locator): Promise<{
  lineBackgroundImage: string
  lineOpacity: string
  lineWidth: string
  hoverBackgroundColor: string
}> {
  return locator.evaluate((element) => {
    const line = getComputedStyle(element, '::after')
    const styles = getComputedStyle(element)

    return {
      lineBackgroundImage: line.backgroundImage,
      lineOpacity: line.opacity,
      lineWidth: line.width,
      hoverBackgroundColor: styles.backgroundColor
    }
  })
}

test.describe('calendar monthly view', () => {
  test('keeps page actions in the context menu and view filters on the second row', async () => {
    const { rootPath } = await createFixtureVault()
    const { electronApp, page } = await launchWithFixture(rootPath)

    try {
      await openMonthlyCalendar(page)

      const viewToggle = page.getByTestId('calendar-view-toggle')
      const filterButton = page.getByTestId('calendar-task-filter-trigger')
      const workspaceTab = page.getByTestId('workspace-tab:workspace-tab-1')
      const contextMenuTrigger = page.getByTestId('workspace-page-context-menu-trigger')
      await expect(contextMenuTrigger).toBeVisible()
      await contextMenuTrigger.click()
      await expect(page.getByTestId('workspace-page-context-menu')).toBeVisible()
      await expect(
        page.getByTestId('workspace-page-context-menu-item:previous-period')
      ).toBeVisible()
      await expect(
        page.getByTestId('workspace-page-context-menu-item:current-period')
      ).toBeVisible()
      await expect(page.getByTestId('workspace-page-context-menu-item:next-period')).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(viewToggle).toBeVisible()
      await expect(filterButton).toBeVisible()

      const toggleBox = await viewToggle.boundingBox()
      const filterButtonBox = await filterButton.boundingBox()
      if (!toggleBox || !filterButtonBox) {
        throw new Error('Expected calendar header controls to have layout boxes')
      }

      expect(filterButtonBox.x).toBeGreaterThan(toggleBox.x + toggleBox.width)
      expect(Math.abs(filterButtonBox.y - toggleBox.y)).toBeLessThanOrEqual(4)

      await page.getByTestId('workspace-tab-add').click()
      const secondWorkspaceTab = page.getByTestId('workspace-tab:workspace-tab-2')
      await expect(secondWorkspaceTab).toBeVisible()
      await page.getByTestId('sidebar-page:calendar').click()
      await expect(page.getByTestId('calendar-month-view')).toBeVisible()
      await page.getByTestId('calendar-view-toggle').getByText('Weekly', { exact: true }).click()
      await expect(page.getByTestId('calendar-week-view')).toBeVisible()

      await workspaceTab.click()
      await expect(page.getByTestId('calendar-month-view')).toBeVisible()

      await secondWorkspaceTab.click()
      await expect(page.getByTestId('calendar-week-view')).toBeVisible()
    } finally {
      await electronApp.close()
      await fs.rm(rootPath, { recursive: true, force: true })
    }
  })

  test('filters scheduled and unscheduled tasks by searchable tags and remembers selection', async () => {
    const { rootPath } = await createFixtureVault(4, true, {
      0: ['planning'],
      1: ['review'],
      3: ['planning']
    })
    const { electronApp, page } = await launchWithFixture(rootPath)

    try {
      await openMonthlyCalendar(page)

      const filterButton = page.getByTestId('calendar-task-filter-trigger')
      const eventByTitle = (title: string): Locator =>
        page.locator('.calendar-full .fc-event.calendar-task-event').filter({ hasText: title })

      await filterButton.click()
      const popover = page.getByTestId('calendar-task-filter-popover')
      await expect(popover).toBeVisible()
      await popover.locator('input[aria-label="Search calendar task tags"]').fill('planning')

      const planningOption = page.getByTestId('calendar-task-tag-option:planning')
      await expect(planningOption).toBeVisible()
      await planningOption.click()
      await expect(planningOption).toHaveAttribute('data-checked', 'true')
      await expect(filterButton).toContainText('Filter (1)')

      await expect(eventByTitle('Overflow task 1')).toHaveCount(1)
      await expect(eventByTitle('Overflow task 2')).toHaveCount(0)
      await expect(eventByTitle('Overflow task 3')).toHaveCount(0)
      await expect(page.getByTestId('calendar-task-filter-popover')).toBeVisible()
      await expect(page.locator('[data-unscheduled-task-id="task-month-visible-3"]')).toBeVisible()

      await page.reload()
      await page.waitForLoadState('domcontentloaded')
      await page.waitForFunction(() => typeof window.vaultApi?.vault?.restoreLast === 'function')
      await openMonthlyCalendar(page)
      await expect(page.getByTestId('calendar-task-filter-trigger')).toContainText('Filter (1)')
      await expect(eventByTitle('Overflow task 1')).toHaveCount(1)

      await page.getByTestId('calendar-task-filter-trigger').click()
      await page.getByTestId('calendar-task-filter-clear').click()
      await expect(page.getByTestId('calendar-task-filter-trigger')).toHaveText('Filter')
      await expect(eventByTitle('Overflow task 2')).toHaveCount(1)
    } finally {
      await electronApp.close()
      await fs.rm(rootPath, { recursive: true, force: true })
    }
  })

  test('applies project and non-project filters to scheduled and unscheduled tasks', async () => {
    const { rootPath } = await createFixtureVault(4, true, {}, [0, 3])
    const { electronApp, page } = await launchWithFixture(rootPath)

    try {
      await openMonthlyCalendar(page)

      const eventByTitle = (title: string): Locator =>
        page.locator('.calendar-full .fc-event.calendar-task-event').filter({ hasText: title })
      const filterButton = page.getByTestId('calendar-task-filter-trigger')

      await filterButton.click()
      await expect(page.getByTestId('calendar-content-filter')).toBeVisible()

      await page.getByTestId('calendar-content-filter-option:projectTasks').click()
      await expect(eventByTitle('Overflow task 1')).toHaveCount(1)
      await expect(eventByTitle('Overflow task 2')).toHaveCount(0)
      await expect(eventByTitle('Overflow task 3')).toHaveCount(0)
      await expect(page.locator('[data-unscheduled-task-id="task-month-visible-3"]')).toBeVisible()

      await page.getByTestId('calendar-content-filter-option:nonProjectTasks').click()
      await expect(eventByTitle('Overflow task 1')).toHaveCount(0)
      await expect(eventByTitle('Overflow task 2')).toHaveCount(1)
      await expect(eventByTitle('Overflow task 3')).toHaveCount(1)
      await expect(page.locator('[data-unscheduled-task-id="task-month-visible-3"]')).toHaveCount(0)

      await page.getByTestId('calendar-task-filter-clear').click()
      await expect(eventByTitle('Overflow task 1')).toHaveCount(1)
      await expect(eventByTitle('Overflow task 2')).toHaveCount(1)
      await expect(page.locator('[data-unscheduled-task-id="task-month-visible-3"]')).toBeVisible()
    } finally {
      await electronApp.close()
      await fs.rm(rootPath, { recursive: true, force: true })
    }
  })

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

  test('shows the expanded vertical resize affordance on monthly task handles', async () => {
    const { rootPath } = await createFixtureVault()
    const { electronApp, page } = await launchWithFixture(rootPath)

    try {
      await openMonthlyCalendar(page)

      const event = page.locator('.calendar-full .fc-event.calendar-task-event').filter({
        hasText: 'Month view task'
      })
      await event.hover()
      const resizer = event.locator('.fc-event-resizer-start')
      await expect(resizer).toBeVisible()
      await expect
        .poll(async () => (await getMonthlyResizeAffordanceStyles(resizer)).lineOpacity)
        .toBe('0')
      await resizer.hover()

      await expect
        .poll(async () => (await getMonthlyResizeAffordanceStyles(resizer)).lineOpacity, {
          timeout: 2_000
        })
        .toBe('1')
      const affordanceStyles = await getMonthlyResizeAffordanceStyles(resizer)
      expect(affordanceStyles.lineWidth).toBe('1px')
      expect(affordanceStyles.lineBackgroundImage).toContain('linear-gradient')
      expect(affordanceStyles.lineOpacity).toBe('1')
      expect(affordanceStyles.hoverBackgroundColor).toBe('rgba(0, 0, 0, 0)')
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

  test('keeps the task mirror upright while dragging a monthly task', async () => {
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
        .toBe(false)

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

  test('ghosts an unscheduled source and highlights its monthly drop destination', async () => {
    const { rootPath, todayIso } = await createFixtureVault(2, true)
    const { electronApp, page } = await launchWithFixture(rootPath)

    try {
      await openMonthlyCalendar(page)

      const source = page.locator(
        '[data-unscheduled-task-list="true"] [data-unscheduled-task-id="task-month-visible-1"]'
      )
      const target = page.locator(`.calendar-full .fc-daygrid-day[data-date="${todayIso}"]`)
      await expect(source).toBeVisible()
      await expect(target).toBeVisible()

      const sourceBox = await source.boundingBox()
      const targetBox = await target.boundingBox()
      if (!sourceBox || !targetBox) {
        throw new Error('Monthly external drag bounds are unavailable')
      }

      await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2)
      await page.mouse.down()
      await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, {
        steps: 5
      })

      await expect(source).toHaveAttribute('data-dragging', 'true')
      await expect(source).toHaveCSS('opacity', '0')
      await expect(target).toHaveAttribute('data-calendar-drop-over', 'true')
      await expect(target).toHaveCSS('background-color', 'rgba(188, 232, 241, 0.3)')
      await expect(
        page.locator('.fc-event-dragging[data-unscheduled-task-id="task-month-visible-1"]')
      ).toBeVisible()
    } finally {
      await page.mouse.up()
      await electronApp.close()
      await fs.rm(rootPath, { recursive: true, force: true })
    }
  })

  test('keeps the unschedule destination free of a callout while dragging a monthly task', async () => {
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

      await expect(page.getByText('Drop here to unschedule', { exact: true })).toHaveCount(0)
    } finally {
      await page.mouse.up()
      await electronApp.close()
      await fs.rm(rootPath, { recursive: true, force: true })
    }
  })
})
