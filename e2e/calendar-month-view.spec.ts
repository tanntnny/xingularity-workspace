import { test, expect, type Locator, type Page } from '@playwright/test'
import { _electron as electron, ElectronApplication } from 'playwright'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { expectSingleRightPanelScrollport } from './right-panel-scrollport'

declare global {
  interface Window {
    vaultApi: {
      vault: {
        restoreLast: () => Promise<unknown>
      }
      settings: {
        get: () => Promise<{
          calendarTasks: Array<{ id: string; date?: string; endDate?: string }>
        }>
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

function shiftIsoDate(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T12:00:00`)
  date.setDate(date.getDate() + days)
  return toIsoDate(date)
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
  projectIndexes: readonly number[] = [],
  unscheduledTaskCount = includeUnscheduled ? 1 : 0,
  taskSchedule: 'scheduled' | 'deadline-only' = 'scheduled',
  taskTitle?: string,
  taskTime?: string,
  taskEndTime?: string
): Promise<{ rootPath: string; todayIso: string }> {
  const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-calendar-month-e2e-vault-'))
  const todayIso = toIsoDate(new Date())
  const calendarTasks = Array.from({ length: taskCount }, (_, index) => {
    const isUnscheduled = includeUnscheduled && index >= taskCount - unscheduledTaskCount

    return {
      id: `task-month-visible-${index}`,
      title: isUnscheduled
        ? unscheduledTaskCount === 1
          ? 'Unscheduled view task'
          : `Unscheduled task ${index + 1}`
        : taskCount === 1
          ? (taskTitle ?? 'Month view task')
          : `Overflow task ${index + 1}`,
      date: isUnscheduled || taskSchedule === 'deadline-only' ? undefined : todayIso,
      endDate: !isUnscheduled && taskSchedule === 'deadline-only' ? todayIso : undefined,
      time: !isUnscheduled && taskSchedule === 'scheduled' ? taskTime : undefined,
      endTime: !isUnscheduled && taskSchedule === 'scheduled' ? taskEndTime : undefined,
      completed: false,
      createdAt: new Date().toISOString(),
      priority: 'medium',
      taskType: 'assignment',
      tags: tagsByIndex[index] ?? [],
      projectId: projectIndexes.includes(index) ? `project-${index}` : undefined,
      reminders: []
    }
  })

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

async function readCalendarTask(
  page: Page,
  taskId: string
): Promise<{ date?: string; endDate?: string } | null> {
  return page.evaluate(async (id) => {
    const settings = await window.vaultApi.settings.get()
    const task = settings.calendarTasks.find((candidate) => candidate.id === id)
    return task ? { date: task.date, endDate: task.endDate } : null
  }, taskId)
}

async function resizeMonthlyTaskHandle(
  page: Page,
  handle: Locator,
  targetDate: string
): Promise<void> {
  const handleBox = await handle.boundingBox()
  const targetCell = page.locator(`.calendar-full .fc-daygrid-day[data-date="${targetDate}"]`)
  const targetBox = await targetCell.boundingBox()
  if (!handleBox || !targetBox) {
    throw new Error(`Expected monthly resize geometry for target date ${targetDate}`)
  }

  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, {
    steps: 8
  })
  await page.mouse.up()
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
  test('shows period navigation in the secondary row with view filters', async () => {
    const { rootPath } = await createFixtureVault()
    const { electronApp, page } = await launchWithFixture(rootPath)

    try {
      await openMonthlyCalendar(page)

      const viewToggle = page.getByTestId('calendar-view-toggle')
      const filterButton = page.getByTestId('calendar-task-filter-trigger')
      const primaryRow = page.locator('[data-workspace-header-row="primary"]')
      const secondaryRow = page.locator('[data-workspace-header-row="secondary"]')
      const secondaryRightActions = secondaryRow.locator(
        '.workspace-header-secondary-actions-right'
      )
      const periodNavigation = page.getByTestId('calendar-period-navigation')
      const workspaceTab = page.getByTestId('workspace-tab:workspace-tab-1')
      const contextMenuTrigger = page.getByTestId('workspace-page-context-menu-trigger')
      const currentPeriodLabel = page.getByTestId('calendar-current-period')
      await expect(currentPeriodLabel).toBeVisible()
      await expect(currentPeriodLabel).toHaveText(
        new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
      )
      const contextMenuBox = await contextMenuTrigger.boundingBox()
      const currentPeriodLabelBox = await currentPeriodLabel.boundingBox()
      if (!contextMenuBox || !currentPeriodLabelBox) {
        throw new Error('Expected calendar topbar context controls to have layout boxes')
      }
      expect(currentPeriodLabelBox.x).toBeGreaterThan(contextMenuBox.x + contextMenuBox.width)
      expect(
        Math.abs(
          currentPeriodLabelBox.y +
            currentPeriodLabelBox.height / 2 -
            (contextMenuBox.y + contextMenuBox.height / 2)
        )
      ).toBeLessThanOrEqual(4)
      await expect(secondaryRow.getByTestId('calendar-period-navigation')).toBeVisible()
      await expect(secondaryRightActions.getByTestId('calendar-period-navigation')).toBeVisible()
      await expect(primaryRow.getByTestId('calendar-period-navigation')).toHaveCount(0)
      await expect(periodNavigation.locator('button')).toHaveCount(3)
      await expect(periodNavigation.getByTestId('calendar-period-previous')).toHaveAttribute(
        'aria-label',
        'Previous month'
      )
      await expect(periodNavigation.getByTestId('calendar-period-current')).toHaveText(
        'Current month'
      )
      await expect(periodNavigation.getByTestId('calendar-period-next')).toHaveAttribute(
        'aria-label',
        'Next month'
      )
      const periodDividers = periodNavigation.locator('[data-slot="separator"]')
      await expect(periodDividers).toHaveCount(2)
      await expect(periodDividers.first()).toHaveAttribute('data-orientation', 'vertical')
      await expect(periodDividers.last()).toHaveAttribute('data-orientation', 'vertical')
      const groupStyles = await periodNavigation.evaluate((group) => {
        const groupComputedStyles = getComputedStyle(group)
        const buttonStyles = Array.from(group.querySelectorAll('button')).map((button) => {
          const computedStyles = getComputedStyle(button)
          return {
            borderTopWidth: computedStyles.borderTopWidth,
            borderRadius: computedStyles.borderRadius
          }
        })

        return {
          groupBorderTopWidth: groupComputedStyles.borderTopWidth,
          groupBorderRadius: groupComputedStyles.borderRadius,
          buttonStyles
        }
      })
      expect(Number.parseFloat(groupStyles.groupBorderTopWidth)).toBeGreaterThan(0)
      expect(groupStyles.groupBorderRadius).not.toBe('0px')
      expect(groupStyles.buttonStyles).toEqual([
        { borderTopWidth: '0px', borderRadius: '0px' },
        { borderTopWidth: '0px', borderRadius: '0px' },
        { borderTopWidth: '0px', borderRadius: '0px' }
      ])

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

      const periodNavigationBox = await periodNavigation.boundingBox()
      if (!periodNavigationBox) {
        throw new Error('Expected secondary calendar actions to have a layout box')
      }

      expect(periodNavigationBox.x).toBeGreaterThan(filterButtonBox.x + filterButtonBox.width)
      expect(Math.abs(periodNavigationBox.y - toggleBox.y)).toBeLessThanOrEqual(4)
      expect(filterButtonBox.x).toBeGreaterThan(toggleBox.x + toggleBox.width)
      expect(Math.abs(filterButtonBox.y - toggleBox.y)).toBeLessThanOrEqual(4)

      await page.getByTestId('workspace-tab-add').click()
      const secondWorkspaceTab = page.getByTestId('workspace-tab:workspace-tab-2')
      await expect(secondWorkspaceTab).toBeVisible()
      await page.getByTestId('sidebar-page:calendar').click()
      await expect(page.getByTestId('calendar-month-view')).toBeVisible()
      await page.getByTestId('calendar-view-toggle').getByText('Weekly', { exact: true }).click()
      await expect(page.getByTestId('calendar-week-view')).toBeVisible()
      await expect(currentPeriodLabel).not.toHaveText(
        new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
      )
      await expect(periodNavigation.getByTestId('calendar-period-current')).toHaveText(
        'Current week'
      )
      await expect(periodNavigation.getByTestId('calendar-period-previous')).toHaveAttribute(
        'aria-label',
        'Previous week'
      )
      await expect(periodNavigation.getByTestId('calendar-period-next')).toHaveAttribute(
        'aria-label',
        'Next week'
      )

      await page.getByTestId('calendar-view-toggle').getByText('Daily', { exact: true }).click()
      await expect(currentPeriodLabel).toContainText(
        new Date().toLocaleDateString(undefined, { weekday: 'long' })
      )
      await expect(periodNavigation.getByTestId('calendar-period-current')).toHaveText(
        'Current day'
      )
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
      await expect(popover.locator('[aria-label="0 selected"]')).toHaveCount(0)
      await expect(popover).not.toContainText('None selected')
      await popover.locator('input[aria-label="Search calendar task tags"]').fill('planning')

      const planningOption = page.getByTestId('calendar-task-tag-option:planning')
      await expect(planningOption).toBeVisible()
      await planningOption.click()
      await expect(planningOption).toHaveAttribute('data-checked', 'true')
      const selectionCount = popover.locator('[aria-label="1 selected"]')
      await expect(selectionCount).toBeVisible()
      await expect(selectionCount).toHaveText('1')
      await expect(selectionCount).toHaveCSS('background-color', 'rgb(255, 255, 255)')
      await expect(selectionCount).toHaveCSS('color', 'rgb(26, 26, 26)')
      const triggerSelectionCount = filterButton.locator('[aria-label="1 selected"]')
      await expect(triggerSelectionCount).toBeVisible()
      await expect(triggerSelectionCount).toHaveText('1')

      await expect(eventByTitle('Overflow task 1')).toHaveCount(1)
      await expect(eventByTitle('Overflow task 2')).toHaveCount(0)
      await expect(eventByTitle('Overflow task 3')).toHaveCount(0)
      await expect(page.getByTestId('calendar-task-filter-popover')).toBeVisible()
      await expect(page.locator('[data-unscheduled-task-id="task-month-visible-3"]')).toBeVisible()

      await page.reload()
      await page.waitForLoadState('domcontentloaded')
      await page.waitForFunction(() => typeof window.vaultApi?.vault?.restoreLast === 'function')
      await openMonthlyCalendar(page)
      await expect(filterButton.locator('[aria-label="1 selected"]')).toHaveText('1')
      await expect(eventByTitle('Overflow task 1')).toHaveCount(1)

      await page.getByTestId('calendar-task-filter-trigger').click()
      await page.getByTestId('calendar-task-filter-clear').click()
      await expect(page.getByTestId('calendar-task-filter-trigger')).toHaveText('Filter')
      await expect(filterButton.locator('[aria-label="1 selected"]')).toHaveCount(0)
      await expect(page.getByTestId('calendar-task-filter-popover')).not.toContainText(
        'None selected'
      )
      await expect(
        page.getByTestId('calendar-task-filter-popover').locator('[aria-label="0 selected"]')
      ).toHaveCount(0)
      await expect(eventByTitle('Overflow task 2')).toHaveCount(1)

      await page.keyboard.press('Escape')
      await expect(page.getByTestId('calendar-task-filter-popover')).toBeHidden()
      await page.setViewportSize({ width: 520, height: 800 })
      await expect
        .poll(() => page.evaluate(() => window.matchMedia('(max-width: 639px)').matches))
        .toBe(true)
      await expect(filterButton).toBeVisible()
      await filterButton.click()

      const mobilePopover = page.getByTestId('calendar-task-filter-popover')
      await expect(mobilePopover).toBeVisible()
      await expect(mobilePopover).toHaveAttribute('data-side', 'bottom')
      await expect(
        mobilePopover.getByRole('heading', { name: 'Filter calendar tasks' })
      ).toBeVisible()
      await expect(mobilePopover.locator('[aria-label="0 selected"]')).toHaveCount(0)
      await mobilePopover.locator('input[aria-label="Search calendar task tags"]').fill('planning')
      await expect(planningOption).toBeVisible()
      await planningOption.click()
      await expect(mobilePopover.locator('[aria-label="1 selected"]')).toHaveText('1')
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
      expect(affordanceStyles.lineWidth).toBe('0.5px')
      expect(affordanceStyles.lineBackgroundImage).toContain('linear-gradient')
      expect(affordanceStyles.lineOpacity).toBe('1')
      expect(affordanceStyles.hoverBackgroundColor).toBe('rgba(0, 0, 0, 0)')
    } finally {
      await electronApp.close()
      await fs.rm(rootPath, { recursive: true, force: true })
    }
  })

  test('divides monthly task metadata evenly and hard cuts long values', async () => {
    const longTitle = 'A very long task title that hard cuts without fade or ellipsis'
    const timeLabel = '09:00 - 17:00'
    const { rootPath } = await createFixtureVault(
      1,
      false,
      {},
      [],
      0,
      'scheduled',
      longTitle,
      '09:00',
      '17:00'
    )
    const { electronApp, page } = await launchWithFixture(rootPath)

    try {
      await openMonthlyCalendar(page)

      const event = page.locator('.calendar-full .fc-event.calendar-task-event').filter({
        hasText: longTitle
      })
      const statusField = event.locator('[data-calendar-task-field="status"]')
      const timeField = event.locator('[data-calendar-task-field="time"]')
      const titleField = event.locator('[data-calendar-task-field="title"]')
      await expect(statusField).toBeVisible()
      await expect(timeField).toBeVisible()
      await expect(titleField).toBeVisible()

      const statusBox = await statusField.boundingBox()
      const timeBox = await timeField.boundingBox()
      if (!statusBox || !timeBox) {
        throw new Error('Expected monthly task metadata columns to have layout boxes')
      }
      expect(Math.abs(statusBox.width - timeBox.width)).toBeLessThanOrEqual(1)

      await expect(statusField.locator('.status-chip-label-clip')).toHaveCount(1)
      await expect(statusField.locator('.status-chip-label-fade')).toHaveCount(0)
      await expect(titleField).toHaveClass(/workspace-text-clip/)
      await expect(timeField).toHaveClass(/workspace-text-clip/)
      await expect(titleField).not.toHaveClass(/workspace-text-fade/)
      await expect(timeField).not.toHaveClass(/workspace-text-fade/)
      await expect(titleField).toHaveAttribute('title', longTitle)
      await expect(timeField).toHaveAttribute('title', timeLabel)

      const overflowStyles = await titleField.evaluate((element) => {
        const styles = getComputedStyle(element)
        return {
          textOverflow: styles.textOverflow,
          webkitMaskImage: styles.webkitMaskImage
        }
      })
      expect(overflowStyles.textOverflow).toBe('clip')
      expect(overflowStyles.webkitMaskImage).toBe('none')
    } finally {
      await electronApp.close()
      await fs.rm(rootPath, { recursive: true, force: true })
    }
  })

  test('resizes deadline-only task start and end dates from monthly handles', async () => {
    const { rootPath, todayIso } = await createFixtureVault(1, false, {}, [], 0, 'deadline-only')
    const { electronApp, page } = await launchWithFixture(rootPath)

    try {
      await openMonthlyCalendar(page)

      const taskId = 'task-month-visible-0'
      const event = page.locator('.calendar-full .fc-event.calendar-task-event').filter({
        hasText: 'Month view task'
      })
      const startResizer = event.locator('.fc-event-resizer-start').first()
      const endResizer = event.locator('.fc-event-resizer-end').first()
      await event.hover()
      await expect(startResizer).toBeVisible()
      await expect(endResizer).toBeVisible()

      const previousDate = shiftIsoDate(todayIso, -1)
      await resizeMonthlyTaskHandle(page, startResizer, previousDate)
      await expect
        .poll(() => readCalendarTask(page, taskId))
        .toEqual({ date: previousDate, endDate: todayIso })

      const nextDate = shiftIsoDate(todayIso, 1)
      await resizeMonthlyTaskHandle(
        page,
        page
          .locator('.calendar-full .fc-event.calendar-task-event')
          .filter({ hasText: 'Month view task' })
          .locator('.fc-event-resizer-end')
          .first(),
        nextDate
      )
      await expect
        .poll(() => readCalendarTask(page, taskId))
        .toEqual({ date: previousDate, endDate: nextDate })
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

      const source = page
        .locator('.calendar-full .fc-event.calendar-task-event')
        .filter({ hasText: 'Month view task' })
        .first()
      await expect(source).toBeVisible()

      const sourceBox = await source.boundingBox()
      if (!sourceBox) {
        throw new Error('Monthly calendar task bounds are unavailable')
      }

      await page.keyboard.down('Alt')
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

      await expect(source).toHaveAttribute('data-dragging', 'true')
      await expect(source).toHaveCSS('opacity', '1')
      await expect(source).toHaveAttribute('data-drag-operation', 'copy')
      const mirror = page.locator('.fc-event-dragging.calendar-task-event').filter({
        hasText: 'Month view task'
      })
      await expect(mirror).toHaveAttribute('data-drag-operation', 'copy')
      await expect(mirror).toContainText('Month view task')
      await expect(page.locator('[data-drag-copy-cue="true"]')).toHaveCount(0)

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
      await page.keyboard.up('Alt')
      await electronApp.close()
      await fs.rm(rootPath, { recursive: true, force: true })
    }
  })

  test('reveals the original when Option is pressed during a monthly drag', async () => {
    const { rootPath } = await createFixtureVault()
    const { electronApp, page } = await launchWithFixture(rootPath)

    try {
      await openMonthlyCalendar(page)

      const source = page
        .locator('.calendar-full .fc-event.calendar-task-event')
        .filter({ hasText: 'Month view task' })
        .first()
      await expect(source).toBeVisible()

      const sourceBox = await source.boundingBox()
      if (!sourceBox) {
        throw new Error('Monthly modifier drag bounds are unavailable')
      }

      await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2)
      await page.mouse.down()
      await page.mouse.move(
        sourceBox.x + sourceBox.width / 2 + 24,
        sourceBox.y + sourceBox.height / 2 + 24,
        { steps: 3 }
      )
      await expect(source).toHaveAttribute('data-dragging', 'true')
      await expect(source).toHaveAttribute('data-drag-operation', 'move')
      await expect(source).toHaveCSS('opacity', '0')

      await page.keyboard.down('Alt')
      await page.mouse.move(
        sourceBox.x + sourceBox.width / 2 + 48,
        sourceBox.y + sourceBox.height / 2 + 48,
        { steps: 3 }
      )

      await expect(source).toHaveAttribute('data-drag-operation', 'copy')
      await expect(source).toHaveCSS('opacity', '1')
      const mirror = page.locator('.fc-event-dragging.calendar-task-event').filter({
        hasText: 'Month view task'
      })
      await expect(mirror).toHaveAttribute('data-drag-operation', 'copy')
      await expect(mirror).toContainText('Month view task')
    } finally {
      await page.mouse.up()
      await page.keyboard.up('Alt')
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
      const targetDate = shiftIsoDate(todayIso, -1)
      const target = page.locator(`.calendar-full .fc-daygrid-day[data-date="${targetDate}"]`)
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
      await expect(source).toHaveAttribute('data-drag-operation', 'move')
      await expect(page.locator('[data-drag-copy-cue="true"]')).toHaveCount(0)
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

  test('keeps a long unscheduled list in the shared panel scrollport', async () => {
    const { rootPath } = await createFixtureVault(28, true, {}, [], 28)
    const { electronApp, page } = await launchWithFixture(rootPath)

    try {
      await openMonthlyCalendar(page)
      await expect(page.getByTestId('calendar-task-panel')).toBeVisible()
      await expectSingleRightPanelScrollport(page)

      const panelStack = page.getByTestId('calendar-task-panel')
      await expect
        .poll(() => panelStack.evaluate((element) => element.scrollHeight > element.clientHeight))
        .toBe(true)

      const lastTask = page.locator('[data-unscheduled-task-id="task-month-visible-27"]')
      await lastTask.scrollIntoViewIfNeeded()
      await expect(lastTask).toBeVisible()
    } finally {
      await electronApp.close()
      await fs.rm(rootPath, { recursive: true, force: true })
    }
  })
})
