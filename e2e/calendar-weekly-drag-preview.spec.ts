import { test, expect, type Locator, type Page } from '@playwright/test'
import { _electron as electron, ElectronApplication } from 'playwright'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { CalendarTask } from '../src/shared/types'

declare global {
  interface Window {
    vaultApi: {
      vault: {
        restoreLast: () => Promise<unknown>
      }
      settings: {
        get: () => Promise<{ calendarTasks: CalendarTask[] }>
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

function addIsoDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00`)
  date.setDate(date.getDate() + days)
  return toIsoDate(date)
}

function getAdjacentWeekDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00`)
  return addIsoDays(iso, date.getDay() === 6 ? -1 : 1)
}

async function createFixtureVault(
  options: {
    includeUnscheduled?: boolean
    includeAllDay?: boolean
    includeMixedAllDay?: boolean
    includeOverlap?: boolean
  } = {}
): Promise<{ rootPath: string; todayIso: string }> {
  const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-calendar-week-e2e-vault-'))
  const todayIso = toIsoDate(new Date())
  const adjacentWeekDate = getAdjacentWeekDate(todayIso)
  const calendarTasks: CalendarTask[] = [
    {
      id: 'task-weekly-preview',
      title: 'Timed drag preview task',
      tags: [],
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

  if (options.includeUnscheduled) {
    calendarTasks.push({
      id: 'task-weekly-unscheduled',
      title: 'Unscheduled timed drag task',
      tags: [],
      date: undefined,
      completed: false,
      createdAt: new Date().toISOString(),
      priority: 'medium',
      taskType: 'assignment',
      reminders: []
    })
  }

  if (options.includeAllDay) {
    calendarTasks.push({
      id: 'task-weekly-all-day',
      title: 'All-day task for timed conversion',
      tags: [],
      date: todayIso,
      endDate: addIsoDays(todayIso, 1),
      completed: false,
      createdAt: new Date().toISOString(),
      priority: 'medium',
      taskType: 'assignment',
      reminders: []
    })
  }

  if (options.includeMixedAllDay) {
    calendarTasks.push(
      {
        id: 'task-weekly-all-day-short',
        title: 'Short all-day task',
        tags: [],
        date: todayIso,
        endDate: todayIso,
        completed: false,
        createdAt: new Date().toISOString(),
        priority: 'medium',
        taskType: 'assignment',
        reminders: []
      },
      {
        id: 'task-weekly-all-day-follow-up',
        title: 'Same-day follow-up',
        tags: [],
        date: todayIso,
        endDate: todayIso,
        completed: false,
        createdAt: new Date().toISOString(),
        priority: 'medium',
        taskType: 'assignment',
        reminders: []
      },
      {
        id: 'task-weekly-all-day-tall',
        title: 'Tall all-day task with tags',
        tags: ['planning', 'review'],
        date: adjacentWeekDate,
        endDate: adjacentWeekDate,
        completed: false,
        createdAt: new Date().toISOString(),
        priority: 'medium',
        taskType: 'assignment',
        reminders: []
      }
    )
  }

  if (options.includeOverlap) {
    calendarTasks.push({
      id: 'task-weekly-overlap',
      title: 'Existing overlapping task',
      tags: [],
      date: adjacentWeekDate,
      time: '01:00',
      endTime: '01:30',
      completed: false,
      createdAt: new Date().toISOString(),
      priority: 'medium',
      taskType: 'assignment',
      reminders: []
    })
  }

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

async function readPersistedTask(rootPath: string, taskId: string): Promise<CalendarTask> {
  return JSON.parse(
    await fs.readFile(path.join(rootPath, 'tasks', `${taskId}.json`), 'utf8')
  ) as CalendarTask
}

async function dragTaskToTimedColumn(
  page: Page,
  sourceSelector: string,
  targetDate: string,
  sourceOffsetY: number,
  dropOffsetY: number
): Promise<void> {
  await page.evaluate(
    ({
      sourceSelector: selector,
      targetDate: date,
      sourceOffsetY: sourceY,
      dropOffsetY: dropY
    }) => {
      const source = document.querySelector<HTMLElement>(selector)
      const target = document.querySelector<HTMLElement>(
        `[data-testid="calendar-week-timed-column:${date}"]`
      )
      if (!source || !target) {
        throw new Error('Weekly timed drag fixtures are missing')
      }

      const sourceRect = source.getBoundingClientRect()
      const targetRect = target.getBoundingClientRect()
      const dataTransfer = new DataTransfer()
      const clientX = targetRect.left + targetRect.width / 2
      const sourceClientY = sourceRect.top + sourceY
      const dropClientY = targetRect.top + dropY

      source.dispatchEvent(
        new DragEvent('dragstart', {
          bubbles: true,
          cancelable: true,
          dataTransfer,
          clientX: sourceRect.left + sourceRect.width / 2,
          clientY: sourceClientY
        })
      )

      target.dispatchEvent(
        new DragEvent('dragover', {
          bubbles: true,
          cancelable: true,
          dataTransfer,
          clientX,
          clientY: dropClientY
        })
      )

      target.dispatchEvent(
        new DragEvent('drop', {
          bubbles: true,
          cancelable: true,
          dataTransfer,
          clientX,
          clientY: dropClientY
        })
      )

      source.dispatchEvent(
        new DragEvent('dragend', {
          bubbles: true,
          cancelable: true,
          dataTransfer,
          clientX,
          clientY: dropClientY
        })
      )
    },
    { sourceSelector, targetDate, sourceOffsetY, dropOffsetY }
  )
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
  const weeklyViewButton = page.getByText('Weekly', { exact: true })
  await expect(weeklyViewButton).toBeVisible()
  await weeklyViewButton.click()
  await expect(page.getByTestId('calendar-week-view')).toBeVisible()
}

async function getResizeAffordanceStyles(locator: Locator): Promise<{
  cursor: string
  lineBackgroundImage: string
  lineHeight: string
  lineOpacity: string
}> {
  return locator.evaluate((element) => {
    const line = getComputedStyle(element, '::after')

    return {
      cursor: getComputedStyle(element).cursor,
      lineBackgroundImage: line.backgroundImage,
      lineHeight: line.height,
      lineOpacity: line.opacity
    }
  })
}

test.describe('calendar weekly drag preview', () => {
  test('keeps weekday headers visible while scrolling the time grid', async () => {
    const { rootPath } = await createFixtureVault()
    const { electronApp, page } = await launchWithFixture(rootPath)

    try {
      await openWeeklyCalendar(page)

      const weekdayHeader = page.getByTestId('calendar-week-weekday-header')
      await expect(weekdayHeader).toBeVisible()
      await expect(weekdayHeader).toHaveCSS('position', 'sticky')
      const weekdayHeaderTop = await weekdayHeader.evaluate(
        (element) => element.getBoundingClientRect().top
      )

      const workspaceContent = page.locator('.document-workspace-main-content')
      await expect
        .poll(() =>
          workspaceContent.evaluate((element) => element.scrollHeight > element.clientHeight)
        )
        .toBe(true)
      await workspaceContent.evaluate((element) => {
        element.scrollTop = 240
      })
      await expect
        .poll(() => workspaceContent.evaluate((element) => element.scrollTop))
        .toBeGreaterThan(0)
      expect(
        await weekdayHeader.evaluate((element) => element.getBoundingClientRect().top)
      ).toBeGreaterThanOrEqual(weekdayHeaderTop - 4)
    } finally {
      await electronApp.close()
      await fs.rm(rootPath, { recursive: true, force: true })
    }
  })

  test('resizes timed cells with command wheel without cancelling normal wheel events', async () => {
    const { rootPath } = await createFixtureVault()
    const { electronApp, page } = await launchWithFixture(rootPath)

    try {
      await openWeeklyCalendar(page)

      const wheelResults = await page.evaluate(() => {
        const scroller = document.querySelector<HTMLElement>(
          '[data-testid="calendar-week-timed-scroller"]'
        )
        if (!scroller) {
          throw new Error('Weekly timed scroller is missing')
        }

        const normalWheel = new WheelEvent('wheel', {
          bubbles: true,
          cancelable: true,
          deltaY: 100
        })
        const normalDispatchResult = scroller.dispatchEvent(normalWheel)
        const commandWheel = new WheelEvent('wheel', {
          bubbles: true,
          cancelable: true,
          deltaY: -100,
          metaKey: true
        })
        const commandDispatchResult = scroller.dispatchEvent(commandWheel)

        return {
          initialHeight: scroller.dataset.weeklyHourHeight,
          normalCancelled: !normalDispatchResult,
          normalDefaultPrevented: normalWheel.defaultPrevented,
          commandCancelled: !commandDispatchResult,
          commandDefaultPrevented: commandWheel.defaultPrevented
        }
      })

      expect(wheelResults).toEqual({
        initialHeight: '160',
        normalCancelled: false,
        normalDefaultPrevented: false,
        commandCancelled: true,
        commandDefaultPrevented: true
      })
      await expect(page.getByTestId('calendar-week-timed-scroller')).toHaveAttribute(
        'data-weekly-hour-height',
        '180'
      )
    } finally {
      await electronApp.close()
      await fs.rm(rootPath, { recursive: true, force: true })
    }
  })

  test('shows the expanded vertical resize affordance on timed task handles', async () => {
    const { rootPath } = await createFixtureVault()
    const { electronApp, page } = await launchWithFixture(rootPath)

    try {
      await openWeeklyCalendar(page)

      const task = page.getByTestId('calendar-week-task:task-weekly-preview')
      await task.hover()
      const handle = task.locator('[data-weekly-resize-handle="true"]').first()
      await expect(handle).toBeVisible()
      await expect.poll(async () => (await getResizeAffordanceStyles(handle)).lineOpacity).toBe('0')
      await handle.hover()

      await expect
        .poll(async () => (await getResizeAffordanceStyles(handle)).lineOpacity, { timeout: 2_000 })
        .toBe('1')
      const affordanceStyles = await getResizeAffordanceStyles(handle)
      expect(affordanceStyles.cursor).toBe('ns-resize')
      expect(affordanceStyles.lineHeight).toBe('1px')
      expect(affordanceStyles.lineBackgroundImage).toContain('linear-gradient')
      expect(affordanceStyles.lineOpacity).toBe('1')
    } finally {
      await electronApp.close()
      await fs.rm(rootPath, { recursive: true, force: true })
    }
  })

  test('creates and opens a timed task when double-clicking an empty weekly cell', async () => {
    const { rootPath, todayIso } = await createFixtureVault()
    const { electronApp, page } = await launchWithFixture(rootPath)

    try {
      await openWeeklyCalendar(page)

      await page.evaluate((dateIso) => {
        const column = document.querySelector<HTMLElement>(
          `[data-testid="calendar-week-timed-column:${dateIso}"]`
        )
        if (!column) {
          throw new Error('Weekly timed column is missing')
        }

        const rect = column.getBoundingClientRect()
        column.dispatchEvent(
          new MouseEvent('dblclick', {
            bubbles: true,
            cancelable: true,
            clientX: rect.left + rect.width / 2,
            clientY: rect.top + 520
          })
        )
      }, todayIso)

      const taskDialog = page.getByTestId('task-center-dialog')
      const taskTitleInput = taskDialog.getByLabel('Task name')
      await expect(taskTitleInput).toHaveValue('')
      await expect(taskTitleInput).toHaveAttribute('placeholder', 'Task name')
      await expect(taskTitleInput).toBeFocused()
      await taskTitleInput.fill('Weekly focus task')
      await taskDialog.getByRole('button', { name: 'Open full page', exact: true }).click()
      await expect(page.getByTestId('task-page')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Task start time', exact: true })).toHaveText(
        '3:10 AM'
      )
      await expect(page.getByRole('button', { name: 'Task end time', exact: true })).toHaveText(
        '4:10 AM'
      )
      await expect(page.getByRole('button', { name: 'Task start date', exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Task end date', exact: true })).toBeVisible()

      const savedTask = await page.evaluate(async (title) => {
        const settings = await window.vaultApi.settings.get()
        return settings.calendarTasks.find((task) => task.title === title)
      }, 'Weekly focus task')
      expect(savedTask).toMatchObject({
        date: todayIso,
        endDate: todayIso,
        time: '03:10',
        endTime: '04:10'
      })
    } finally {
      await electronApp.close()
      await fs.rm(rootPath, { recursive: true, force: true })
    }
  })

  test('shows a timed preview band while dragging a weekly task', async () => {
    const { rootPath, todayIso } = await createFixtureVault()
    const { electronApp, page } = await launchWithFixture(rootPath)

    try {
      await openWeeklyCalendar(page)
      const task = page.locator(
        '[data-testid="calendar-week-task:task-weekly-preview"][data-drag-visual="source"]'
      )
      await expect(task).toBeVisible()
      await expect(task.getByText('Pending', { exact: true })).toBeVisible()

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
            altKey: true,
            clientX: sourceRect.left + sourceRect.width / 2,
            clientY: sourceRect.top + 12
          })
        )

        target.dispatchEvent(
          new DragEvent('dragover', {
            bubbles: true,
            cancelable: true,
            dataTransfer,
            altKey: true,
            clientX: targetRect.left + targetRect.width / 2,
            clientY: targetRect.top + 200
          })
        )
      }, todayIso)

      const floatingPreview = page.locator('[data-floating-drag-preview="true"]')
      await expect(floatingPreview).toBeVisible()
      await expect(task).toHaveAttribute('data-dragging', 'true')
      await expect(task).toHaveCSS('opacity', '1')
      await expect(task).toHaveAttribute('data-drag-operation', 'copy')
      await expect(floatingPreview).toHaveAttribute('data-drag-operation', 'copy')
      await expect(floatingPreview).toContainText('Timed drag preview task')
      await expect(page.locator('[data-drag-copy-cue="true"]')).toHaveCount(0)
      await expect
        .poll(() =>
          floatingPreview.evaluate((element) => {
            const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform)
            return Math.abs(matrix.b) > 0.01 || Math.abs(matrix.c) > 0.01
          })
        )
        .toBe(false)

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
      await expect(floatingPreview).toHaveCount(0)
      await expect(task).toHaveAttribute('data-dragging', 'false')
    } finally {
      await electronApp.close()
      await fs.rm(rootPath, { recursive: true, force: true })
    }
  })

  test('keeps the original visible when Option is pressed during a weekly drag', async () => {
    const { rootPath, todayIso } = await createFixtureVault()
    const { electronApp, page } = await launchWithFixture(rootPath)

    try {
      await openWeeklyCalendar(page)
      const task = page.locator(
        '[data-testid="calendar-week-task:task-weekly-preview"][data-drag-visual="source"]'
      )
      const target = page.getByTestId(`calendar-week-timed-column:${todayIso}`)
      await expect(task).toBeVisible()
      await expect(target).toBeVisible()
      await task.scrollIntoViewIfNeeded()

      const sourceBox = await task.boundingBox()
      const targetBox = await target.boundingBox()
      if (!sourceBox || !targetBox) {
        throw new Error('Weekly modifier drag bounds are unavailable')
      }

      await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2)
      await page.mouse.down()
      await page.mouse.move(
        sourceBox.x + sourceBox.width / 2 + 24,
        sourceBox.y + sourceBox.height / 2 + 24,
        { steps: 3 }
      )
      await page.keyboard.down('Alt')
      await page.mouse.move(
        targetBox.x + targetBox.width / 2,
        targetBox.y + targetBox.height / 2 + 120,
        { steps: 5 }
      )

      await expect(task).toHaveAttribute('data-dragging', 'true')
      await expect(task).toHaveAttribute('data-drag-operation', 'copy')
      await expect(task).toHaveCSS('opacity', '1')
      const floatingPreview = page.locator('[data-floating-drag-preview="true"]')
      await expect(floatingPreview).toBeVisible()
      await expect(floatingPreview).toHaveAttribute('data-drag-operation', 'copy')
    } finally {
      await page.mouse.up()
      await page.keyboard.up('Alt')
      await electronApp.close()
      await fs.rm(rootPath, { recursive: true, force: true })
    }
  })

  test('auto-scrolls the calendar page while dragging near the workspace edge', async () => {
    const { rootPath, todayIso } = await createFixtureVault()
    const { electronApp, page } = await launchWithFixture(rootPath)

    try {
      await openWeeklyCalendar(page)

      const workspaceContent = page.locator('.document-workspace-main-content')
      await expect
        .poll(() =>
          workspaceContent.evaluate((element) => element.scrollHeight > element.clientHeight)
        )
        .toBe(true)

      await page.evaluate((dateIso) => {
        const source = document.querySelector<HTMLElement>(
          '[data-testid="calendar-week-task:task-weekly-preview"]'
        )
        const calendar = document.querySelector<HTMLElement>('[data-testid="calendar-week-view"]')
        const scroller = document.querySelector<HTMLElement>('.document-workspace-main-content')
        if (!source || !calendar || !scroller) {
          throw new Error('Weekly calendar autoscroll fixtures are missing')
        }

        const sourceRect = source.getBoundingClientRect()
        const scrollerRect = scroller.getBoundingClientRect()
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

        calendar.dispatchEvent(
          new DragEvent('dragover', {
            bubbles: true,
            cancelable: true,
            dataTransfer,
            clientX: scrollerRect.left + 20,
            clientY: scrollerRect.bottom - 4
          })
        )

        const target = document.querySelector<HTMLElement>(
          `[data-testid="calendar-week-timed-column:${dateIso}"]`
        )
        target?.dispatchEvent(
          new DragEvent('dragover', {
            bubbles: true,
            cancelable: true,
            dataTransfer,
            clientX: target.getBoundingClientRect().left + target.getBoundingClientRect().width / 2,
            clientY: scrollerRect.bottom - 4
          })
        )
      }, todayIso)

      await expect
        .poll(() => workspaceContent.evaluate((element) => element.scrollTop))
        .toBeGreaterThan(0)

      await page.evaluate(() => {
        document
          .querySelector<HTMLElement>('[data-testid="calendar-week-task:task-weekly-preview"]')
          ?.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true }))
      })
    } finally {
      await electronApp.close()
      await fs.rm(rootPath, { recursive: true, force: true })
    }
  })

  test('persists a scheduled task move into an occupied timed cell', async () => {
    const { rootPath, todayIso } = await createFixtureVault({ includeOverlap: true })
    const targetDate = getAdjacentWeekDate(todayIso)
    const { electronApp, page } = await launchWithFixture(rootPath)

    try {
      await openWeeklyCalendar(page)
      const source = page.getByTestId('calendar-week-task:task-weekly-preview')
      const target = page.getByTestId(`calendar-week-timed-column:${targetDate}`)
      await expect(source).toBeVisible()
      await expect(target).toHaveAttribute('data-drop-zone-variant', 'timed')

      await dragTaskToTimedColumn(
        page,
        '[data-testid="calendar-week-task:task-weekly-preview"]',
        targetDate,
        12,
        100
      )

      await expect
        .poll(async () => {
          const task = await readPersistedTask(rootPath, 'task-weekly-preview')
          return {
            date: task.date,
            endDate: task.endDate,
            time: task.time,
            endTime: task.endTime,
            weeklyHeightMode: task.weeklyHeightMode
          }
        })
        .toEqual({
          date: targetDate,
          endDate: undefined,
          time: '01:00',
          endTime: '01:40',
          weeklyHeightMode: 'duration'
        })

      await expect(page.getByTestId('calendar-week-task:task-weekly-preview')).toBeVisible()
      await expect(page.getByTestId('calendar-week-task:task-weekly-overlap')).toBeVisible()
    } finally {
      await electronApp.close()
      await fs.rm(rootPath, { recursive: true, force: true })
    }
  })

  test('converts an all-day task when dropped into a timed cell', async () => {
    const { rootPath, todayIso } = await createFixtureVault({ includeAllDay: true })
    const { electronApp, page } = await launchWithFixture(rootPath)

    try {
      await openWeeklyCalendar(page)
      const source = page.getByTestId('calendar-week-all-day-task:task-weekly-all-day')
      await expect(source).toBeVisible()

      await dragTaskToTimedColumn(
        page,
        '[data-testid="calendar-week-all-day-task:task-weekly-all-day"]',
        todayIso,
        20,
        88
      )

      await expect
        .poll(async () => {
          const task = await readPersistedTask(rootPath, 'task-weekly-all-day')
          return {
            date: task.date,
            endDate: task.endDate,
            time: task.time,
            endTime: task.endTime,
            weeklyHeightMode: task.weeklyHeightMode
          }
        })
        .toEqual({
          date: todayIso,
          endDate: undefined,
          time: '01:00',
          endTime: '02:00',
          weeklyHeightMode: 'content'
        })

      await expect(page.getByTestId('calendar-week-task:task-weekly-all-day')).toBeVisible()
      await expect(page.getByTestId('calendar-week-all-day-task:task-weekly-all-day')).toHaveCount(
        0
      )
    } finally {
      await electronApp.close()
      await fs.rm(rootPath, { recursive: true, force: true })
    }
  })

  test('fits all-day cards to content without coupling neighboring day heights', async () => {
    const { rootPath } = await createFixtureVault({ includeMixedAllDay: true })
    const { electronApp, page } = await launchWithFixture(rootPath)

    try {
      await openWeeklyCalendar(page)

      await expect
        .poll(async () =>
          page.evaluate(() => {
            const shortTask = document.querySelector<HTMLElement>(
              '[data-testid="calendar-week-all-day-task:task-weekly-all-day-short"]'
            )
            const tallTask = document.querySelector<HTMLElement>(
              '[data-testid="calendar-week-all-day-task:task-weekly-all-day-tall"]'
            )
            return Boolean(
              shortTask &&
              tallTask &&
              tallTask.getBoundingClientRect().height > shortTask.getBoundingClientRect().height
            )
          })
        )
        .toBe(true)

      const rects = await page.evaluate(() => {
        const taskIds = [
          'task-weekly-all-day-short',
          'task-weekly-all-day-follow-up',
          'task-weekly-all-day-tall'
        ]

        return Object.fromEntries(
          taskIds.map((taskId) => {
            const element = document.querySelector<HTMLElement>(
              `[data-testid="calendar-week-all-day-task:${taskId}"]`
            )
            if (!element) {
              throw new Error(`Missing all-day task ${taskId}`)
            }

            const rect = element.getBoundingClientRect()
            return [taskId, { top: rect.top, bottom: rect.bottom, height: rect.height }]
          })
        )
      })

      const shortTask = rects['task-weekly-all-day-short']
      const followUpTask = rects['task-weekly-all-day-follow-up']
      const tallTask = rects['task-weekly-all-day-tall']
      expect(tallTask.height).toBeGreaterThan(shortTask.height)
      expect(Math.abs(tallTask.top - shortTask.top)).toBeLessThan(2)

      const sameDayTasks = [shortTask, followUpTask].sort((left, right) => left.top - right.top)
      const sameDayGap = sameDayTasks[1].top - sameDayTasks[0].bottom
      expect(sameDayGap).toBeGreaterThanOrEqual(7)
      expect(sameDayGap).toBeLessThanOrEqual(9)
    } finally {
      await electronApp.close()
      await fs.rm(rootPath, { recursive: true, force: true })
    }
  })

  test('keeps an unscheduled task drag preview content-fit in the weekly time grid', async () => {
    const { rootPath, todayIso } = await createFixtureVault({ includeUnscheduled: true })
    const { electronApp, page } = await launchWithFixture(rootPath)

    try {
      await openWeeklyCalendar(page)
      const source = page.locator(
        '[data-unscheduled-task-id="task-weekly-unscheduled"][data-drag-visual="source"]'
      )
      await expect(source).toBeVisible()

      const previewStyles = await page.evaluate((dateIso) => {
        const source = document.querySelector<HTMLElement>(
          '[data-unscheduled-task-id="task-weekly-unscheduled"]'
        )
        const target = document.querySelector<HTMLElement>(
          `[data-testid="calendar-week-timed-column:${dateIso}"]`
        )
        if (!source || !target) {
          throw new Error('Unscheduled weekly drag fixtures are missing')
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
            clientY: sourceRect.top + sourceRect.height / 2
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

        const preview = document.querySelector<HTMLElement>('[data-floating-drag-preview="true"]')
        return preview
          ? {
              height: preview.style.height,
              maxHeight: preview.style.maxHeight
            }
          : null
      }, todayIso)

      expect(previewStyles).toEqual({ height: 'fit-content', maxHeight: 'none' })
      await expect(source).toHaveCSS('opacity', '0')

      const indicator = page.getByTestId('calendar-week-all-day-drop-indicator')
      await expect(indicator).toBeVisible()
      const indicatorBox = await indicator.boundingBox()
      expect(indicatorBox).not.toBeNull()
      if (!indicatorBox) {
        throw new Error('Unscheduled weekly drop indicator bounds are unavailable')
      }
      expect(indicatorBox.height).toBeGreaterThan(0)

      await page.evaluate((dateIso) => {
        const target = document.querySelector<HTMLElement>(
          `[data-testid="calendar-week-timed-column:${dateIso}"]`
        )
        if (!target) {
          throw new Error('Unscheduled weekly drop target is missing')
        }
        const dataTransfer = new DataTransfer()
        dataTransfer.setData('text/plain', 'move:task-weekly-unscheduled')
        target.dispatchEvent(
          new DragEvent('drop', {
            bubbles: true,
            cancelable: true,
            dataTransfer,
            clientX: target.getBoundingClientRect().left + target.getBoundingClientRect().width / 2,
            clientY: target.getBoundingClientRect().top + 200
          })
        )
      }, todayIso)

      const task = page.getByTestId('calendar-week-all-day-task:task-weekly-unscheduled')
      await expect(task).toBeVisible()
      const taskBox = await task.boundingBox()
      expect(taskBox).not.toBeNull()
      if (!taskBox) {
        throw new Error('Unscheduled weekly task bounds are unavailable')
      }
      expect(taskBox.height).toBeLessThan(80)

      await page.evaluate(() => {
        const source = document.querySelector<HTMLElement>(
          '[data-unscheduled-task-id="task-weekly-unscheduled"][data-drag-visual="source"]'
        )
        source?.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true }))
      })
    } finally {
      await electronApp.close()
      await fs.rm(rootPath, { recursive: true, force: true })
    }
  })
})
