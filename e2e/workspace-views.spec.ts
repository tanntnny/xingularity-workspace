import { test, expect, type Page } from '@playwright/test'
import { _electron as electron, type ElectronApplication, type Locator } from 'playwright'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { CalendarTask, Project } from '../src/shared/types'

function createFixtureProject(): Project {
  return {
    id: 'project-1',
    name: 'Launch project',
    summary: 'Launch project',
    description: 'Launch project',
    state: 'active',
    updatedAt: '2026-08-29T00:00:00.000Z',
    icon: {
      set: 'tabler',
      glyph: 'folder-kanban',
      variant: 'filled',
      color: '#2563eb'
    }
  }
}

function createFixtureTask(): CalendarTask {
  return {
    id: 'task-1',
    title: 'Launch brief',
    projectId: 'project-1',
    tags: ['planning'],
    completed: false,
    status: 'pending',
    createdAt: '2026-08-29T00:00:00.000Z',
    priority: 'high',
    taskType: 'assignment',
    reminders: []
  }
}

async function createFixtureVault(): Promise<string> {
  const rootPath = await fs.mkdtemp(
    path.join(os.tmpdir(), 'xingularity-workspace-views-e2e-vault-')
  )
  const project = createFixtureProject()
  const task = createFixtureTask()

  await Promise.all([
    fs.mkdir(path.join(rootPath, 'notebooks', 'Projects', project.name), { recursive: true }),
    fs.mkdir(path.join(rootPath, 'attachments'), { recursive: true }),
    fs.mkdir(path.join(rootPath, 'tasks'), { recursive: true })
  ])
  await fs.writeFile(
    path.join(rootPath, 'projects.json'),
    JSON.stringify([project], null, 2),
    'utf8'
  )
  await fs.writeFile(
    path.join(rootPath, 'tasks', `${encodeURIComponent(task.id)}.json`),
    JSON.stringify(task, null, 2),
    'utf8'
  )

  return rootPath
}

async function launchWithFixture(vaultRoot: string): Promise<{
  electronApp: ElectronApplication
  page: Page
  userDataPath: string
}> {
  const userDataPath = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-workspace-views-user-'))
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
        page.evaluate(async () => {
          try {
            await window.vaultApi.vault.restoreLast()
          } catch {
            // Retry while the temporary fixture vault is being initialized.
          }

          const commandPalette = document.querySelector<HTMLButtonElement>(
            '[data-testid="sidebar-command-palette"]'
          )
          return commandPalette ? !commandPalette.disabled : false
        }),
      { timeout: 60_000 }
    )
    .toBe(true)

  return { electronApp, page, userDataPath }
}

function savedViewButton(page: Page, name: string): Locator {
  return page.locator('button[data-testid^="sidebar-view:"]').filter({ hasText: name })
}

async function getSavedViewId(page: Page, name: string): Promise<string> {
  const button = savedViewButton(page, name)
  const testId = await button.getAttribute('data-testid')
  if (!testId) {
    throw new Error(`Saved view button not found for ${name}`)
  }
  return testId.replace('sidebar-view:', '')
}

async function waitForSavedViewName(page: Page, viewId: string, name: string): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(
          ({ id }) =>
            window.vaultApi.settings
              .get()
              .then(
                (settings) => settings.workspaceViews.find((view) => view.id === id)?.name ?? null
              ),
          { id: viewId }
        ),
      { timeout: 15_000 }
    )
    .toBe(name)
}

async function waitForSavedViewIcon(page: Page, viewId: string, glyph: string): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(
          ({ id }) =>
            window.vaultApi.settings
              .get()
              .then(
                (settings) => settings.workspaceViews.find((view) => view.id === id)?.icon.glyph
              ),
          { id: viewId }
        ),
      { timeout: 15_000 }
    )
    .toBe(glyph)
}

test.describe('workspace views', () => {
  test('shows tooltips for workspace icon buttons on hover and focus', async () => {
    const vaultRoot = await createFixtureVault()
    const { electronApp, page, userDataPath } = await launchWithFixture(vaultRoot)

    try {
      const addTabButton = page.getByTestId('workspace-tab-add')
      await expect(addTabButton).toBeVisible()

      await addTabButton.hover()
      await expect(page.getByRole('tooltip', { name: 'New tab' })).toBeVisible()

      await addTabButton.focus()
      await expect(page.getByRole('tooltip', { name: 'New tab' })).toBeVisible()
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
      await fs.rm(userDataPath, { recursive: true, force: true })
    }
  })

  test('creates, configures, opens, and deletes task and resource views', async () => {
    const vaultRoot = await createFixtureVault()
    const { electronApp, page, userDataPath } = await launchWithFixture(vaultRoot)

    try {
      await expect(
        page.locator('[data-sidebar="group-label"]').filter({ hasText: 'Workspace' })
      ).toBeVisible()
      await expect(page.getByTestId('sidebar-page:notes')).toBeVisible()
      await expect(page.getByTestId('sidebar-page:tasks')).toBeVisible()
      await expect(page.getByTestId('sidebar-page:resources')).toBeVisible()
      await expect(page.getByTestId('sidebar-create-view')).toBeVisible()

      await page.getByTestId('sidebar-create-view').click()
      await page.getByTestId('sidebar-create-view-option:tasks').click()

      const taskViewButton = savedViewButton(page, 'Untitled Tasks View')
      await expect(taskViewButton).toBeVisible()
      const taskViewId = await getSavedViewId(page, 'Untitled Tasks View')
      await expect(page.getByTestId('workspace-view-page')).toBeVisible()
      await expect(page.getByTestId('workspace-view-identity')).toHaveCount(0)
      await expect(page.getByTestId('tasks-table')).toBeVisible()
      await expect(page.locator('[data-testid^="workspace-tab:"]')).toHaveCount(1)
      await expect(page.getByTestId('workspace-tab:workspace-tab-1')).toHaveAttribute(
        'aria-selected',
        'true'
      )
      await expect(page.getByText('Launch brief', { exact: true })).toBeVisible()
      const taskViewBreadcrumb = page
        .locator('nav[aria-label="breadcrumb"]')
        .filter({ hasText: 'Untitled Tasks View' })
        .first()
      await expect(taskViewBreadcrumb).toBeVisible()
      await expect(taskViewBreadcrumb.locator('[data-project-icon-surface]')).toHaveCount(0)
      await expect(page.getByTestId('sidebar-page:tasks')).toHaveAttribute('data-active', 'false')
      await expect(taskViewButton).toHaveAttribute('data-active', 'true')

      const taskViewTrigger = page.getByTestId('workspace-view-breadcrumb-trigger')
      await taskViewTrigger.click()
      const taskViewEditor = page.getByTestId('workspace-view-edit-popover')
      await expect(taskViewEditor).toBeVisible()
      const taskViewName = page.getByTestId('workspace-view-name-row')
      await expect(taskViewName).toBeFocused()
      await taskViewName.fill('Planning')
      await taskViewName.press('Enter')
      await expect(taskViewEditor).toBeVisible()
      await waitForSavedViewName(page, taskViewId, 'Planning')

      await page.getByTestId('workspace-view-icon-trigger').click()
      const taskViewIconPicker = page.getByRole('dialog', { name: 'Choose view icon' })
      await expect(taskViewIconPicker).toBeVisible()
      await taskViewIconPicker.getByPlaceholder('Search icon names...').fill('rocket')
      await taskViewIconPicker.getByTestId('workspace-view-icon-option:rocket:outlined').click()
      await expect(taskViewEditor).toBeVisible()
      await waitForSavedViewIcon(page, taskViewId, 'rocket')
      await page.keyboard.press('Escape')
      await page.keyboard.press('Escape')
      await expect(taskViewEditor).toBeHidden()

      await page.getByTestId('task-search-input').fill('launch')
      await expect
        .poll(
          () =>
            page.evaluate(
              ({ id }) =>
                window.vaultApi.settings.get().then((settings) => {
                  const view = settings.workspaceViews.find((candidate) => candidate.id === id)
                  return view?.source === 'tasks' ? view.config.searchQuery : null
                }),
              { id: taskViewId }
            ),
          { timeout: 15_000 }
        )
        .toBe('launch')

      const renamedTaskViewButton = savedViewButton(page, 'Planning')
      await expect(renamedTaskViewButton).toBeVisible()
      await page.getByTestId('sidebar-create-view').click()
      await page.getByTestId('sidebar-create-view-option:resources').click()
      const resourceViewButton = savedViewButton(page, 'Untitled Resources View')
      await expect(resourceViewButton).toBeVisible()
      const resourceViewId = await getSavedViewId(page, 'Untitled Resources View')
      await expect(page.getByTestId('workspace-view-page')).toBeVisible()
      await expect(page.getByTestId('workspace-view-identity')).toHaveCount(0)
      await expect(page.getByRole('heading', { name: 'No resources found' })).toBeVisible()
      await expect(page.locator('[data-testid^="workspace-tab:"]')).toHaveCount(1)
      const resourceViewBreadcrumb = page
        .locator('nav[aria-label="breadcrumb"]')
        .filter({ hasText: 'Untitled Resources View' })
        .first()
      await expect(resourceViewBreadcrumb).toBeVisible()
      await expect(resourceViewBreadcrumb.locator('[data-project-icon-surface]')).toHaveCount(0)
      await expect(page.getByTestId('sidebar-page:resources')).toHaveAttribute(
        'data-active',
        'false'
      )
      await expect(resourceViewButton).toHaveAttribute('data-active', 'true')

      const resourceViewTrigger = page.getByTestId('workspace-view-breadcrumb-trigger')
      await resourceViewTrigger.click()
      await expect(page.getByTestId('workspace-view-edit-popover')).toBeVisible()
      await page.keyboard.press('Escape')

      await expect(
        page.locator('[data-testid^="workspace-tab:"][aria-selected="true"]')
      ).toContainText('Untitled Resources View')
      await page.getByTestId('sidebar-page:notes').click()
      await expect(page.getByTestId('sidebar-page:notes')).toHaveAttribute('data-active', 'true')
      await expect(page.locator('[data-testid^="workspace-tab:"]')).toHaveCount(1)
      await resourceViewButton.click()
      await expect(page.getByTestId('workspace-view-page')).toBeVisible()
      await expect(page.locator('[data-testid^="workspace-tab:"]')).toHaveCount(1)
      await expect(page.getByTestId('workspace-tab:workspace-tab-1')).toHaveAttribute(
        'aria-selected',
        'true'
      )

      await page.getByTestId(`sidebar-view-actions:${resourceViewId}`).click()
      await page.getByTestId(`sidebar-view-delete:${resourceViewId}`).click()
      await expect(page.getByTestId('workspace-view-delete-confirm')).toBeVisible()
      await page.getByTestId('workspace-view-delete-confirm').click()
      await expect(savedViewButton(page, 'Untitled Resources View')).toHaveCount(0)
      await expect(page.getByTestId('sidebar-page:resources')).toHaveAttribute(
        'data-active',
        'true'
      )

      await renamedTaskViewButton.click()
      await expect(page.getByTestId('workspace-view-page')).toBeVisible()
      await expect(page.getByTestId('workspace-view-identity')).toHaveCount(0)
      await expect(
        page.locator('[data-testid^="workspace-tab:"][aria-selected="true"]')
      ).toContainText('Planning')
      const renamedTaskViewBreadcrumb = page
        .locator('nav[aria-label="breadcrumb"]')
        .filter({ hasText: 'Planning' })
        .first()
      await expect(renamedTaskViewBreadcrumb.locator('[data-project-icon-surface]')).toHaveCount(0)
      await expect(page.getByTestId('sidebar-page:tasks')).toHaveAttribute('data-active', 'false')
      await expect(renamedTaskViewButton).toHaveAttribute('data-active', 'true')
      await page.getByTestId(`sidebar-view-actions:${taskViewId}`).click()
      await page.getByTestId(`sidebar-view-delete:${taskViewId}`).click()
      await page.getByTestId('workspace-view-delete-confirm').click()
      await expect(savedViewButton(page, 'Planning')).toHaveCount(0)
      await expect(page.getByTestId('sidebar-page:tasks')).toHaveAttribute('data-active', 'true')

      await expect
        .poll(
          () =>
            page.evaluate(() =>
              window.vaultApi.settings.get().then((settings) => settings.workspaceViews)
            ),
          { timeout: 15_000 }
        )
        .toEqual([])
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
      await fs.rm(userDataPath, { recursive: true, force: true })
    }
  })
})
