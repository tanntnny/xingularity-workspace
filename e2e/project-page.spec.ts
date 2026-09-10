import { test, expect, type Page } from '@playwright/test'
import { _electron as electron, ElectronApplication, Locator } from 'playwright'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { CalendarTask, Project, ProjectUpdate } from '../src/shared/types'
import { expectSingleRightPanelScrollport } from './right-panel-scrollport'

function createFixtureProject(
  id: string,
  name: string,
  state: Project['state'] = 'active'
): Project {
  return {
    id,
    name,
    summary: `${name} description`,
    description: `${name} description`,
    state,
    updatedAt: '2026-04-02T00:00:00.000Z',
    icon: {
      set: 'tabler',
      glyph: 'folder-kanban',
      variant: 'filled',
      color: '#2563eb'
    }
  }
}

async function expectStandardDestructiveMenuItem(menu: Locator): Promise<void> {
  const regularItem = menu.getByRole('menuitem', { name: 'Open project', exact: true })
  const destructiveItem = menu.getByRole('menuitem', { name: 'Delete project', exact: true })
  await expect(destructiveItem).toBeVisible()

  await expect
    .poll(async () => destructiveItem.evaluate((element) => getComputedStyle(element).color))
    .toBe(await regularItem.evaluate((element) => getComputedStyle(element).color))
  await expect
    .poll(async () =>
      destructiveItem
        .locator('svg')
        .first()
        .evaluate((element) => getComputedStyle(element).color)
    )
    .toBe(
      await regularItem
        .locator('svg')
        .first()
        .evaluate((element) => getComputedStyle(element).color)
    )

  const restBackground = await destructiveItem.evaluate(
    (element) => getComputedStyle(element).backgroundColor
  )
  await destructiveItem.hover()
  await expect
    .poll(async () =>
      destructiveItem.evaluate((element) => getComputedStyle(element).backgroundColor)
    )
    .not.toBe(restBackground)
}

function createFixtureTask(
  id: string,
  title: string,
  projectId: string,
  options: {
    milestoneId?: string
    tags?: string[]
    date?: string
    time?: string
    endDate?: string
    endTime?: string
  } = {}
): CalendarTask {
  return {
    id,
    title,
    projectId,
    milestoneId: options.milestoneId,
    tags: options.tags ?? [],
    date: options.date,
    time: options.time,
    endDate: options.endDate,
    endTime: options.endTime,
    completed: false,
    status: 'backlog',
    createdAt: '2026-08-20T00:00:00.000Z',
    priority: 'low',
    taskType: 'assignment',
    reminders: []
  }
}

async function createFixtureVault(
  projects: Project[],
  tasks: CalendarTask[] = []
): Promise<string> {
  const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-project-page-e2e-vault-'))
  await fs.mkdir(path.join(rootPath, 'notebooks'), { recursive: true })
  await fs.mkdir(path.join(rootPath, 'notebooks', 'Projects', 'Shared'), { recursive: true })
  await Promise.all(
    projects.map((project) =>
      fs.mkdir(path.join(rootPath, 'notebooks', 'Projects', project.name), { recursive: true })
    )
  )
  await fs.mkdir(path.join(rootPath, 'attachments'), { recursive: true })
  await fs.writeFile(
    path.join(rootPath, 'projects.json'),
    JSON.stringify(projects, null, 2),
    'utf-8'
  )
  if (tasks.length > 0) {
    const tasksPath = path.join(rootPath, 'tasks')
    await fs.mkdir(tasksPath, { recursive: true })
    await Promise.all(
      tasks.map((task) =>
        fs.writeFile(
          path.join(tasksPath, `${encodeURIComponent(task.id)}.json`),
          JSON.stringify(task, null, 2),
          'utf-8'
        )
      )
    )
  }
  return rootPath
}

async function readTaskRowMetrics(row: Locator): Promise<{
  height: number
  centerSpread: number
}> {
  return row.evaluate((element) => {
    const selectors = [
      '[data-testid^="project-task-status-chip:"]',
      'span.text-base.font-semibold',
      '[data-testid^="project-task-schedule:"]',
      '[data-testid^="project-task-menu:"]'
    ]
    const centers = selectors.flatMap((selector) => {
      const node = element.querySelector(selector)
      if (!node) return []
      const box = node.getBoundingClientRect()
      if (box.width === 0 || box.height === 0) return []
      return [box.top + box.height / 2]
    })
    const rowBox = element.getBoundingClientRect()
    return {
      height: rowBox.height,
      centerSpread: Math.max(...centers) - Math.min(...centers)
    }
  })
}

async function launchWithFixture(vaultRoot: string): Promise<{
  electronApp: ElectronApplication
  page: Page
}> {
  const userDataPath = path.join(vaultRoot, '.user-data')
  await fs.mkdir(userDataPath, { recursive: true })
  await fs.writeFile(
    path.join(userDataPath, 'settings.json'),
    JSON.stringify({ lastVaultPath: vaultRoot }, null, 2),
    'utf-8'
  )

  const electronApp = await electron.launch({
    args: [`--user-data-dir=${userDataPath}`, '.'],
    cwd: process.cwd(),
    env: {
      ...process.env,
      CI: '1'
    }
  })

  const page = await electronApp.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  await expect(page.getByTestId('sidebar-page:projects')).toBeVisible({ timeout: 20_000 })
  return { electronApp, page }
}

async function openTaskPageFromCenterDialog(page: Page): Promise<void> {
  const taskDialog = page.getByTestId('task-center-dialog')
  const taskPage = page.getByTestId('task-page')
  await expect(taskDialog.or(taskPage)).toBeVisible()
  if (!(await taskDialog.isVisible())) {
    return
  }

  await expect(taskDialog.locator('.ProseMirror')).toHaveCount(1)
  await taskDialog.getByRole('button', { name: 'Open full page', exact: true }).click()
  await expect(taskPage).toBeVisible()
}

async function fillNewTaskTitle(page: Page, title: string): Promise<void> {
  const taskDialog = page.getByTestId('task-center-dialog')
  const titleInput = taskDialog.getByLabel('Task name')
  await expect(titleInput).toHaveValue('')
  await expect(titleInput).toHaveAttribute('placeholder', 'Task name')
  await expect(titleInput).toBeFocused()
  await titleInput.fill(title)
}

async function openProjectHome(page: Page, projectId = 'project-1'): Promise<void> {
  const allProjectsPage = page.getByTestId('all-projects-page')
  if (!(await allProjectsPage.isVisible())) {
    const allProjectsBreadcrumb = page.getByTestId('projects-breadcrumb:all')
    if (await allProjectsBreadcrumb.isVisible()) {
      await allProjectsBreadcrumb.click()
    } else {
      await page.getByTestId('sidebar-page:projects').click()
    }
  }
  await expect(allProjectsPage).toBeVisible()
  await page.getByTestId(`all-project-row:${projectId}`).click()
  await expect(page.getByTestId('project-main-detail-panel')).toBeVisible()
}

test.describe('projects workspace', () => {
  test('opens All Projects first and keeps project view context per workspace tab', async () => {
    const vaultRoot = await createFixtureVault([
      createFixtureProject('project-1', 'Alpha Project'),
      createFixtureProject('project-2', 'Beta Project')
    ])
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await page.getByTestId('sidebar-page:projects').click()

      await expect(page.getByTestId('all-projects-page')).toBeVisible()
      await expect(page.getByTestId('all-projects-table')).toBeVisible()
      const workspaceTab = page.getByTestId('workspace-tab:workspace-tab-1')
      await expect(workspaceTab).toContainText('All Projects')
      await expect(page.getByTestId('workspace-tab-icon:workspace-tab-1')).toBeVisible()
      await page.getByTestId('workspace-page-context-menu-trigger').click()
      await expect(page.getByTestId('workspace-page-context-menu')).toBeVisible()
      await expect(page.getByTestId('workspace-page-context-menu-item:new-project')).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(page.getByTestId('all-project-row:project-1')).toBeVisible()
      await expect(page.getByTestId('all-project-row:project-2')).toBeVisible()
      await expect(page.getByTestId('projects-workspace-sidebar')).toHaveCount(0)
      await expect(page.getByTestId('project-properties-panel')).toHaveCount(0)
      await expect(page.getByRole('button', { name: 'Close right sidebar' })).toHaveCount(0)
      await expect(page.getByTestId('workspace-right-panel-resize')).toHaveCount(0)
      await expect(page.getByLabel('Project name')).toHaveCount(0)
      const projectOpenButton = page.getByRole('button', {
        name: 'Open project Alpha Project',
        exact: true
      })
      await expect(projectOpenButton).toBeVisible()
      await projectOpenButton.focus()
      await projectOpenButton.press('Enter')
      await expect(page.getByLabel('Project name')).toHaveValue('Alpha Project')
      const projectDescription = page.getByLabel('Project description')
      await expect(projectDescription).toHaveAttribute('role', 'group')
      await expect(projectDescription.locator('.ProseMirror')).toHaveCount(1)
      await expect(page.getByTestId('project-main-detail-description-editor-status')).toHaveCount(0)
      await expect(page.getByTestId('project-main-detail-description-editor-count')).toHaveCount(0)
      await expect(projectDescription).not.toHaveClass(/border/)
      await expect(projectDescription).not.toHaveClass(/bg-card/)
      await expect(page.getByTestId('project-main-detail-header')).toBeVisible()
      await expect(page.getByTestId('project-main-detail-actions')).toHaveCount(0)
      await expect(page.getByTestId('project-main-detail-icon-row')).toBeVisible()
      await expect(page.getByTestId('project-main-detail-name-row')).toBeVisible()
      await expect(page.getByTestId('project-main-detail-description-row')).toBeVisible()
      await expect(page.getByTestId('project-properties-panel')).toBeVisible()
      await page.getByTestId('workspace-page-context-menu-trigger').click()
      await expect(
        page.getByTestId('workspace-page-context-menu-item:delete-project')
      ).toBeVisible()
      await page.keyboard.press('Escape')
      const projectViewTabs = page.getByTestId('project-view-tabs')
      await expect(projectViewTabs).toBeVisible()
      await expect(
        projectViewTabs.getByRole('tab', { name: 'Resources', exact: true })
      ).toBeVisible()
      await page.getByTestId('project-view-tab:resources').click()
      const resourcesPage = page.getByTestId('project-resources-page')
      await expect(resourcesPage).toBeVisible()
      await expect(page.getByTestId('project-resources-table')).toHaveCount(0)
      await expect(resourcesPage.getByRole('heading', { name: 'No resources found' })).toBeVisible()
      await expect(page.getByTestId('project-resources-panel')).toHaveCount(0)
      await expect(page.getByTestId('workspace-right-panel-content')).toHaveCount(0)
      await expect(page.getByTestId('add-resource-button')).toBeVisible()
      await expect(page.getByTestId('new-project-button')).toHaveCount(0)
      await page.getByTestId('project-view-tab:home').click()
      await expect(page.getByTestId('new-project-button')).toHaveCount(0)
      await expect(page.getByTestId('export-project-context-button')).toBeVisible()
      await expect(page.getByTestId('project-knowledge-button')).toHaveCount(0)
      await expect(page.getByRole('heading', { name: 'Project Tasks' })).toBeVisible()
      await expect(page.getByText('Project Board')).toHaveCount(0)
      await expect(page.getByText('Task List')).toHaveCount(0)

      await page.getByTestId('workspace-tab-add').click()
      const secondWorkspaceTab = page.getByTestId('workspace-tab:workspace-tab-2')
      await expect(secondWorkspaceTab).toBeVisible()
      await page.getByTestId('sidebar-page:projects').click()
      await expect(secondWorkspaceTab).toContainText('All Projects')
      await page.getByTestId('all-project-row:project-2').click()
      await expect(secondWorkspaceTab).toContainText('Beta Project')

      await workspaceTab.click()
      await expect(page.getByLabel('Project name')).toHaveValue('Alpha Project')
      await expect(workspaceTab).toContainText('Alpha Project')

      await page.getByTestId('projects-breadcrumb:all').click()
      await page.getByTestId('all-projects-page').getByTestId('all-project-row:project-2').click()
      await expect(page.getByLabel('Project name')).toHaveValue('Beta Project')
      await expect(workspaceTab).toContainText('Beta Project')
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('returns to All Projects when clicking the sidebar Projects item', async () => {
    const vaultRoot = await createFixtureVault([
      createFixtureProject('project-1', 'Alpha Project'),
      createFixtureProject('project-2', 'Beta Project')
    ])
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await page.getByTestId('sidebar-page:projects').click()
      await page.getByTestId('all-project-row:project-1').click()
      await expect(page.getByLabel('Project name')).toHaveValue('Alpha Project')

      await page.getByTestId('sidebar-page:projects').click()
      await expect(page.getByTestId('all-projects-page')).toBeVisible()
      await expect(page.getByTestId('all-project-row:project-1')).toBeVisible()
      await expect(page.getByTestId('all-project-row:project-2')).toBeVisible()
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('opens the organized project menu from an All Projects row', async () => {
    const vaultRoot = await createFixtureVault([createFixtureProject('project-1', 'Alpha Project')])
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await page.getByTestId('sidebar-page:projects').click()
      const row = page.getByTestId('all-project-row:project-1')
      await expect(row).toBeVisible()

      await row.click({ button: 'right' })
      const contextMenu = page.getByTestId('project-context-menu:project-1')
      await expect(contextMenu).toBeVisible()
      await expect(contextMenu.getByRole('menuitem', { name: 'Open project' })).toBeVisible()
      await expect(contextMenu.getByRole('menuitem', { name: 'Add favorite' })).toBeVisible()
      await expect(contextMenu.getByRole('menuitem', { name: 'Archive project' })).toBeVisible()
      await expect(
        contextMenu.getByRole('menuitem', { name: 'Export project context' })
      ).toBeVisible()
      await expectStandardDestructiveMenuItem(contextMenu)
      await expect(contextMenu.getByRole('separator')).toHaveCount(2)
      await page.keyboard.press('Escape')

      await page.getByTestId('all-project-menu:project-1').click()
      const dropdownMenu = page.locator('[role="menu"][data-state="open"]')
      await expect(dropdownMenu.getByRole('menuitem', { name: 'Open project' })).toBeVisible()
      await expectStandardDestructiveMenuItem(dropdownMenu)
      await expect(dropdownMenu.getByRole('separator')).toHaveCount(2)
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('adds and opens multiple notebook resources from the Resources topbar', async () => {
    const vaultRoot = await createFixtureVault([createFixtureProject('project-1', 'Alpha Project')])
    await fs.mkdir(path.join(vaultRoot, 'notebooks', 'Projects', 'Other'), { recursive: true })
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await page.getByTestId('sidebar-page:projects').click()
      await page.getByTestId('all-project-row:project-1').click()
      await page.getByTestId('project-view-tab:resources').click()

      const resourcesPage = page.getByTestId('project-resources-page')
      const addResourceButton = page.getByTestId('add-resource-button')
      const resourceDialog = page.getByTestId('project-resource-dialog')
      await expect(resourcesPage).toBeVisible()
      await expect(addResourceButton).toBeVisible()
      await expect(page.getByTestId('new-project-button')).toHaveCount(0)
      await expect(page.getByTestId('workspace-right-panel-content')).toHaveCount(0)

      await addResourceButton.click()
      await resourceDialog.getByTestId('project-resource-type:notebook').click()
      await resourceDialog.getByTestId('project-resource-notebook-picker').click()
      const notebookSearch = page.getByRole('combobox', { name: 'Search notebook folders' })
      await expect(notebookSearch).toBeFocused()
      await notebookSearch.fill('Alpha')
      await page
        .getByTestId('project-resource-notebook-options-search-results')
        .getByRole('option', { name: /Projects\/Alpha Project/ })
        .click()
      await page
        .getByTestId('project-resource-notebook-options')
        .getByRole('button', { name: 'Done', exact: true })
        .click()
      await resourceDialog.getByRole('button', { name: 'Add resource', exact: true }).click()
      await expect(
        resourcesPage.getByRole('button', { name: 'Open Alpha Project', exact: true })
      ).toBeVisible()

      await addResourceButton.click()
      await resourceDialog.getByTestId('project-resource-type:notebook').click()
      await resourceDialog.getByTestId('project-resource-notebook-picker').click()
      const secondNotebookPicker = page.getByTestId('project-resource-notebook-options')
      await secondNotebookPicker
        .getByTestId('project-resource-notebook-options-column:root')
        .getByRole('option', { name: 'Projects', exact: true })
        .click()
      await secondNotebookPicker
        .getByTestId('project-resource-notebook-options-column:Projects')
        .getByRole('option', { name: /Projects\/Shared/ })
        .click()
      await expect(
        secondNotebookPicker
          .getByTestId('project-resource-notebook-options-column:root')
          .getByRole('option', { name: 'Projects', exact: true })
      ).toHaveClass(/bg-card-hover/)
      await expect(
        secondNotebookPicker
          .getByTestId('project-resource-notebook-options-column:Projects')
          .getByRole('option', { name: /Projects\/Shared/ })
      ).toHaveClass(/bg-card-hover/)
      await secondNotebookPicker.getByRole('button', { name: 'Done', exact: true }).click()
      await resourceDialog.getByRole('button', { name: 'Add resource', exact: true }).click()
      await expect(
        resourcesPage.getByRole('button', { name: 'Open Shared', exact: true })
      ).toBeVisible()
      await expect(resourcesPage.locator('[data-testid^="project-resource-row:"]')).toHaveCount(2)
      await expect(
        resourcesPage.getByRole('columnheader', { name: 'Health', exact: true })
      ).toBeVisible()
      await expect(
        resourcesPage.getByRole('columnheader', { name: 'Actions', exact: true })
      ).toHaveCount(0)
      const refreshAllResourceHealthButton = page.getByTestId('refresh-all-resource-health-button')
      await expect(refreshAllResourceHealthButton).toBeVisible()
      await refreshAllResourceHealthButton.click()
      await expect(
        page.getByText('Refreshed health for 2 resources', { exact: true })
      ).toBeVisible()

      const alphaRow = resourcesPage
        .locator('[data-testid^="project-resource-row:"]')
        .filter({ hasText: 'Alpha Project' })
      const alphaActions = alphaRow.locator('[data-testid^="project-resource-actions-container:"]')
      await expect(alphaActions).toHaveCSS('opacity', '0')
      await alphaRow.hover()
      await expect(alphaActions).toHaveCSS('opacity', '1')
      await alphaRow.click({ button: 'right' })
      const resourceContextMenu = page.locator('[data-testid^="project-resource-context-menu:"]')
      await expect(resourceContextMenu).toBeVisible()
      await expect(page.getByRole('menuitem', { name: 'Edit resource', exact: true })).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(resourceContextMenu).toHaveCount(0)

      await resourcesPage.getByRole('button', { name: 'Manage Alpha Project', exact: true }).click()
      await page.getByRole('menuitem', { name: 'Edit resource', exact: true }).click()
      await resourceDialog.getByTestId('project-resource-notebook-picker').click()
      const editNotebookPicker = page.getByTestId('project-resource-notebook-options')
      const projectsColumn = editNotebookPicker.getByTestId(
        'project-resource-notebook-options-column:Projects'
      )
      const alphaOption = projectsColumn.getByRole('option', { name: /Projects\/Alpha Project/ })
      await expect(alphaOption).not.toHaveAttribute('aria-disabled', 'true')
      await projectsColumn.getByRole('option', { name: /Projects\/Other/ }).click()
      await editNotebookPicker.getByRole('button', { name: 'Done', exact: true }).click()
      await resourceDialog.getByRole('button', { name: 'Save resource', exact: true }).click()
      await expect(
        resourcesPage.getByRole('button', { name: 'Open Alpha Project', exact: true })
      ).toBeVisible()
      await expect
        .poll(async () => {
          const settings = await page.evaluate(() => window.vaultApi.settings.get())
          return settings.projects[0]?.resourceRefs?.find(
            (resource) => resource.title === 'Alpha Project' && resource.type === 'notebook'
          )?.canonicalUri
        })
        .toBe('xingularity://notebook/Projects%2FOther')

      await expect
        .poll(async () => {
          const settings = await page.evaluate(() => window.vaultApi.settings.get())
          return settings.projects[0]?.resourceRefs?.filter(
            (resource) => resource.type === 'notebook'
          ).length
        })
        .toBe(2)

      await resourcesPage.getByRole('button', { name: 'Open Shared', exact: true }).click()
      await expect(page.getByTestId('notebook-card-browser')).toBeVisible()
      await expect(page.getByTestId('notebook-breadcrumb:current:Projects/Shared')).toBeVisible()
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('renders and autosaves a project Markdown description', async () => {
    const project = createFixtureProject('project-1', 'Alpha Project')
    project.description = '# Alpha brief\n\nA **Markdown** description.'
    project.summary = project.description
    const vaultRoot = await createFixtureVault([project])
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openProjectHome(page)
      const projectDescription = page.getByTestId('project-main-detail-description-editor')
      const descriptionEditor = projectDescription.locator('.ProseMirror')

      await expect(descriptionEditor.locator('h1')).toHaveText('Alpha brief')
      await expect(descriptionEditor.locator('strong')).toHaveText('Markdown')

      await descriptionEditor.fill('Updated project details')
      await expect
        .poll(async () => {
          const settings = await page.evaluate(() => window.vaultApi.settings.get())
          return settings.projects.find((item) => item.id === 'project-1')?.description?.trim()
        })
        .toBe('Updated project details')

      await descriptionEditor.fill('Saved on project switch')
      await page.getByTestId('projects-breadcrumb:all').click()
      await expect(page.getByTestId('all-projects-page')).toBeVisible()
      await expect
        .poll(async () => {
          const settings = await page.evaluate(() => window.vaultApi.settings.get())
          return settings.projects.find((item) => item.id === 'project-1')?.description?.trim()
        })
        .toBe('Saved on project switch')

      await page.getByTestId('all-project-row:project-1').click()
      await expect(
        page.getByTestId('project-main-detail-description-editor').locator('.ProseMirror')
      ).toContainText('Saved on project switch')
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('keeps typed project Markdown across repeated autosave cycles', async () => {
    const vaultRoot = await createFixtureVault([createFixtureProject('project-1', 'Alpha Project')])
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openProjectHome(page)
      const descriptionEditor = page
        .getByTestId('project-main-detail-description-editor')
        .locator('[contenteditable="true"]')
      await descriptionEditor.click()

      await page.keyboard.type('# First heading')
      await page.keyboard.press('Enter')
      await page.keyboard.type('First paragraph')
      await page.waitForTimeout(1800)

      await expect
        .poll(() => descriptionEditor.innerText(), { timeout: 5_000 })
        .toContain('First paragraph')
      await expect
        .poll(() =>
          page.evaluate(() =>
            Boolean(
              document.activeElement?.closest(
                '[data-testid="project-main-detail-description-editor"]'
              )
            )
          )
        )
        .toBe(true)

      await page.keyboard.press('Enter')
      await page.keyboard.type('Second paragraph')
      await page.waitForTimeout(1800)

      await expect
        .poll(() => descriptionEditor.innerText(), { timeout: 5_000 })
        .toContain('Second paragraph')
      await expect
        .poll(async () => {
          const settings = await page.evaluate(() => window.vaultApi.settings.get())
          return settings.projects.find((item) => item.id === 'project-1')?.description ?? ''
        })
        .toContain('Second paragraph')
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('does not rewrite an in-progress Markdown trigger during autosave', async () => {
    const project = createFixtureProject('project-1', 'Alpha Project')
    project.description = ''
    project.summary = ''
    const vaultRoot = await createFixtureVault([project])
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openProjectHome(page)
      const descriptionEditor = page
        .getByTestId('project-main-detail-description-editor')
        .locator('[contenteditable="true"]')
      await descriptionEditor.click()

      await page.keyboard.type('# ')
      await page.waitForTimeout(1800)
      await page.keyboard.type('Autosaved heading')

      await expect
        .poll(() => descriptionEditor.locator('h1').innerText(), { timeout: 5_000 })
        .toBe('Autosaved heading')
      await expect
        .poll(async () => {
          const settings = await page.evaluate(() => window.vaultApi.settings.get())
          return settings.projects.find((item) => item.id === 'project-1')?.description ?? ''
        })
        .toBe('# Autosaved heading')
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('keeps project editor undo scoped to the latest typed change after autosave', async () => {
    const project = createFixtureProject('project-1', 'Alpha Project')
    project.description = ''
    project.summary = ''
    const vaultRoot = await createFixtureVault([project])
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openProjectHome(page)
      const descriptionEditor = page
        .getByTestId('project-main-detail-description-editor')
        .locator('[contenteditable="true"]')
      await descriptionEditor.click()

      await page.keyboard.type('First draft')
      await page.waitForTimeout(1800)
      await page.keyboard.type(' latest change')
      await page.keyboard.press('Meta+z')

      await expect.poll(() => descriptionEditor.innerText(), { timeout: 5_000 }).toBe('First draft')
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('searches and saves a project icon and color from the main detail popover', async () => {
    const vaultRoot = await createFixtureVault([createFixtureProject('project-1', 'Alpha Project')])
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await page.getByTestId('sidebar-page:projects').click()
      await page.getByTestId('all-project-row:project-1').click()

      const iconTrigger = page.getByTestId('project-main-detail-icon-trigger')
      await iconTrigger.click()

      const popover = page.getByRole('dialog', { name: 'Choose project icon' })
      await expect(popover).toBeVisible()
      const iconSearch = popover.getByPlaceholder('Search icon names...')
      await expect(iconSearch).toBeVisible()
      await expect(iconSearch).toBeFocused()
      await expect(popover.locator('[role="separator"]')).toHaveCount(2)
      await expect(popover.getByText('Color', { exact: true })).toBeVisible()
      const iconOptions = popover.locator('[data-testid^="project-icon-option:"]')
      expect(await iconOptions.count()).toBeLessThanOrEqual(48)

      await iconSearch.fill('a')
      await expect(iconOptions).toHaveCount(48)
      await expect(popover.getByRole('status')).toContainText('Showing the first 48')

      await iconSearch.fill('rocket')
      const filledRocket = popover.getByTestId('project-icon-option:rocket:filled')
      const outlinedRocket = popover.getByTestId('project-icon-option:rocket:outlined')
      await expect(filledRocket).toBeVisible()
      await expect(outlinedRocket).toBeVisible()
      await expect(popover.getByTestId('project-icon-option:briefcase:filled')).toHaveCount(0)

      await outlinedRocket.click()
      await expect(popover).toBeVisible()
      await expect(outlinedRocket).toHaveAttribute('data-current', 'true')

      const colorOption = popover.getByLabel('Select #f472b6 icon color')
      await colorOption.click()
      await expect(popover).toBeVisible()
      await expect(outlinedRocket).toHaveAttribute('data-current', 'true')
      await expect(popover.getByLabel('Select #f472b6 icon color')).toHaveAttribute(
        'data-state',
        'on'
      )
      await page.keyboard.press('Escape')
      await expect(iconTrigger).toBeFocused()

      await page.reload()
      await expect(page.getByTestId('sidebar-page:projects')).toBeVisible({ timeout: 20_000 })
      await page.getByTestId('sidebar-page:projects').click()
      await page.getByTestId('all-project-row:project-1').click()
      await page.getByTestId('project-main-detail-icon-trigger').click()
      const afterReloadPopover = page.getByRole('dialog', { name: 'Choose project icon' })
      await afterReloadPopover.getByPlaceholder('Search icon names...').fill('rocket')
      await expect(
        afterReloadPopover.getByTestId('project-icon-option:rocket:outlined')
      ).toHaveAttribute('data-current', 'true')
      await expect(afterReloadPopover.getByLabel('Select #f472b6 icon color')).toHaveAttribute(
        'data-state',
        'on'
      )
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('exposes project context export from the detail-page context menu', async () => {
    const project: Project = {
      ...createFixtureProject('project-1', 'Alpha Project'),
      updates: [
        {
          id: 'update-1',
          projectId: 'project-1',
          markdown: 'Launch work is on track.',
          status: 'on-track',
          createdAt: '2026-08-21T00:00:00.000Z',
          updatedAt: '2026-08-21T00:00:00.000Z'
        } satisfies ProjectUpdate
      ]
    }
    const vaultRoot = await createFixtureVault(
      [project, createFixtureProject('project-2', 'Beta Project')],
      [
        createFixtureTask('task-1', 'Prepare brief', 'project-1', {
          date: '2026-08-25',
          tags: ['launch']
        })
      ]
    )
    await fs.mkdir(path.join(vaultRoot, 'notebooks', 'Projects', 'Alpha Project', 'nested'), {
      recursive: true
    })
    await fs.writeFile(
      path.join(vaultRoot, 'notebooks', 'Projects', 'Alpha Project', 'brief.md'),
      '---\ntags: [launch]\n---\n# Brief\n\nShip the launch.',
      'utf-8'
    )
    await fs.writeFile(
      path.join(vaultRoot, 'notebooks', 'Projects', 'Alpha Project', 'nested', 'notes.md'),
      '# Nested note\n\nNested context.',
      'utf-8'
    )
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openProjectHome(page)
      await page.getByTestId('workspace-page-context-menu-trigger').click()
      await expect(
        page.getByTestId('workspace-page-context-menu-item:export-project-context')
      ).toBeVisible()
      await expect(
        page.getByRole('menuitem', { name: 'Export project context', exact: true })
      ).toBeVisible()
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('posts, edits, and deletes project updates and edits the linked notebook folder from project properties', async () => {
    const vaultRoot = await createFixtureVault([createFixtureProject('project-1', 'Alpha Project')])
    await fs.mkdir(path.join(vaultRoot, 'notebooks', 'Projects', 'Alpha Project'), {
      recursive: true
    })
    await fs.writeFile(
      path.join(vaultRoot, 'notebooks', 'Projects', 'Alpha Project', 'brief.md'),
      '# Alpha brief\n',
      'utf-8'
    )
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openProjectHome(page)
      const projectViewTabs = page.getByTestId('project-view-tabs')
      await expect(
        projectViewTabs.getByRole('tab', { name: 'Overview', exact: true })
      ).toBeVisible()
      await expect(
        projectViewTabs.getByRole('tab', { name: 'Activity', exact: true })
      ).toBeVisible()
      await expect(
        projectViewTabs.getByRole('tab', { name: 'Meeting', exact: true })
      ).toBeVisible()
      await expect(
        projectViewTabs.getByRole('tab', { name: 'Resources', exact: true })
      ).toBeVisible()
      const projectRightPanel = page.getByTestId('workspace-right-panel')
      await expect(projectRightPanel.getByTestId('project-properties-panel')).toBeVisible()
      await expect(projectRightPanel.getByTestId('project-activity-panel')).toBeVisible()
      await expect(projectRightPanel.getByTestId('project-activity-empty')).toBeVisible()
      await page.getByTestId('project-view-tab:pulse').click()
      const pulsePage = page.getByTestId('project-pulse-page')
      await expect(pulsePage).toBeVisible()
      await expect(page.getByTestId('new-project-button')).toHaveCount(0)
      await expect(page.getByTestId('export-project-context-button')).toHaveCount(0)
      const composer = pulsePage.getByTestId('project-update-composer')
      await expect(composer).toBeVisible()
      await expect(composer.locator('[data-testid="note-block-editor"] .milkdown')).toHaveCSS(
        'background-color',
        /^(?!rgba\(0, 0, 0, 0\)$)/
      )
      await expect(projectRightPanel.getByTestId('project-activity-panel')).toBeVisible()
      await expect(
        pulsePage.getByRole('heading', { name: 'Activity', exact: true, level: 1 })
      ).toBeVisible()
      await expect(pulsePage.getByRole('button', { name: 'Overview', exact: true })).toBeVisible()
      await composer.getByTestId('project-update-status-select').click()
      await page.getByRole('option', { name: /^At risk/ }).click()
      await composer.locator('.ProseMirror').fill('## Progress\n\nLaunch work is on track.')
      await composer.getByRole('button', { name: 'Post update', exact: true }).click()

      await expect
        .poll(async () => {
          const settings = await page.evaluate(() => window.vaultApi.settings.get())
          return settings.projects[0]?.updates?.[0]?.status
        })
        .toBe('at-risk')

      const updateItem = pulsePage.locator('[data-testid^="project-update-feed-item:"]')
      await expect(updateItem).toHaveCount(1)
      await expect(updateItem).toContainText('At risk')
      await expect(updateItem).toContainText('Launch work is on track.')
      await expect(projectRightPanel.getByTestId('project-activity-table')).toBeVisible()
      await expect(projectRightPanel.getByTestId('project-activity-table')).toContainText(
        'Launch work is on track.'
      )

      const persistedSettings = await page.evaluate(() => window.vaultApi.settings.get())
      const persistedProject = persistedSettings.projects[0]
      expect(persistedProject?.updates?.[0]?.status).toBe('at-risk')
      expect(persistedProject).not.toHaveProperty('pulseEvents')

      await updateItem.getByTestId(/project-update-menu:/).click()
      await page.getByRole('menuitem', { name: 'Edit', exact: true }).click()
      await expect(
        composer.getByRole('heading', { name: 'Edit update', exact: true })
      ).toBeVisible()
      await composer.getByTestId('project-update-status-select').click()
      await page.getByRole('option', { name: /^Off track/ }).click()
      await composer.locator('.ProseMirror').fill('## Progress\n\nLaunch work is now off track.')
      await composer.getByRole('button', { name: 'Save changes', exact: true }).click()
      await expect
        .poll(async () => {
          const settings = await page.evaluate(() => window.vaultApi.settings.get())
          return settings.projects[0]?.updates?.[0]?.status
        })
        .toBe('off-track')
      await expect(updateItem).toContainText('Launch work is now off track.')

      await updateItem.getByTestId(/project-update-menu:/).click()
      await page.getByRole('menuitem', { name: 'Delete', exact: true }).click()
      const deleteDialog = page.getByRole('alertdialog')
      await expect(deleteDialog).toBeVisible()
      await deleteDialog.getByRole('button', { name: 'Delete update', exact: true }).click()
      await expect(updateItem).toHaveCount(0)
      await expect
        .poll(async () => {
          const settings = await page.evaluate(() => window.vaultApi.settings.get())
          return settings.projects[0]?.updates?.length ?? 0
        })
        .toBe(0)

      await page.getByTestId('project-view-tab:resources').click()
      const resourcesPage = page.getByTestId('project-resources-page')
      await expect(resourcesPage).toBeVisible()
      await expect(page.getByTestId('project-resources-panel')).toHaveCount(0)
      await page.getByTestId('add-resource-button').click()
      const resourceDialog = page.getByTestId('project-resource-dialog')
      await expect(resourceDialog.getByText('Project Resources', { exact: true })).toBeVisible()
      await expect(
        resourceDialog.getByRole('button', { name: 'Close resource editor', exact: true })
      ).toBeVisible()
      await resourceDialog.getByTestId('project-resource-type:notebook').click()
      await resourceDialog.getByTestId('project-resource-notebook-picker').click()
      const firstResourcePicker = page.getByTestId('project-resource-notebook-options')
      await firstResourcePicker
        .getByTestId('project-resource-notebook-options-column:root')
        .getByRole('option', { name: 'Projects', exact: true })
        .click()
      await firstResourcePicker
        .getByTestId('project-resource-notebook-options-column:Projects')
        .getByRole('option', { name: /Projects\/Alpha Project/ })
        .click()
      await firstResourcePicker.getByRole('button', { name: 'Done', exact: true }).click()
      await resourceDialog.getByRole('button', { name: 'Add resource', exact: true }).click()
      await expect
        .poll(async () => {
          const settings = await page.evaluate(() => window.vaultApi.settings.get())
          return settings.projects[0]?.resourceRefs?.find(
            (resource) => resource.type === 'notebook'
          )?.canonicalUri
        })
        .toBe('xingularity://notebook/Projects%2FAlpha%20Project')

      await page.getByTestId('add-resource-button').click()
      await resourceDialog.getByTestId('project-resource-type:notebook').click()
      await resourceDialog.getByTestId('project-resource-notebook-picker').click()
      const secondResourcePicker = page.getByTestId('project-resource-notebook-options')
      await secondResourcePicker
        .getByTestId('project-resource-notebook-options-column:root')
        .getByRole('option', { name: 'Projects', exact: true })
        .click()
      const secondProjectsColumn = secondResourcePicker.getByTestId(
        'project-resource-notebook-options-column:Projects'
      )
      await expect(
        secondProjectsColumn.getByRole('option', { name: /Projects\/Alpha Project/ })
      ).toHaveAttribute('aria-disabled', 'true')
      await secondProjectsColumn.getByRole('option', { name: /Projects\/Shared/ }).click()
      await secondResourcePicker.getByRole('button', { name: 'Done', exact: true }).click()
      await resourceDialog.getByRole('button', { name: 'Add resource', exact: true }).click()
      await expect
        .poll(async () => {
          const settings = await page.evaluate(() => window.vaultApi.settings.get())
          return settings.projects[0]?.resourceRefs?.filter(
            (resource) => resource.type === 'notebook'
          ).length
        })
        .toBe(2)

      await resourcesPage.getByRole('button', { name: 'Open Alpha Project', exact: true }).click()
      await expect(page.getByTestId('notebook-card-browser')).toBeVisible()
      await expect(
        page.getByTestId('notebook-breadcrumb:current:Projects/Alpha Project')
      ).toBeVisible()
      await expect(page.getByText('brief', { exact: true })).toBeVisible()
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('posts, edits, and deletes project meetings without adding them to Activity', async () => {
    const vaultRoot = await createFixtureVault([createFixtureProject('project-1', 'Alpha Project')])
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openProjectHome(page)
      const projectViewTabs = page.getByTestId('project-view-tabs')
      await expect
        .poll(() => projectViewTabs.getByRole('tab').allTextContents())
        .toEqual(['Overview', 'Activity', 'Meeting', 'Resources'])

      await page.getByTestId('project-view-tab:meetings').click()
      const meetingPage = page.getByTestId('project-meeting-page')
      const meetingComposer = meetingPage.getByTestId('project-meeting-composer')
      const projectRightPanel = page.getByTestId('workspace-right-panel')
      await expect(meetingPage).toBeVisible()
      await expect(meetingPage.getByTestId('project-meeting-empty')).toBeVisible()
      await expect(projectRightPanel.getByTestId('project-activity-empty')).toBeVisible()

      await meetingComposer.getByTestId('project-meeting-type-select').click()
      await page.getByRole('option', { name: /^Planning/ }).click()
      await meetingComposer.getByTestId('project-meeting-outcome-select').click()
      await page.getByRole('option', { name: /^Follow-up needed/ }).click()
      await meetingComposer.locator('.ProseMirror').fill('## Decisions\n\nPrepare the launch brief.')
      await meetingComposer.getByRole('button', { name: 'Post meeting', exact: true }).click()

      await expect
        .poll(async () => {
          const settings = await page.evaluate(() => window.vaultApi.settings.get())
          return settings.projects[0]?.meetings?.[0]
        })
        .toMatchObject({
          type: 'planning',
          outcome: 'follow-up-needed',
          markdown: '## Decisions\n\nPrepare the launch brief.'
        })

      const meetingItem = meetingPage.locator('[data-testid^="project-meeting-feed-item:"]')
      await expect(meetingItem).toHaveCount(1)
      await expect(meetingItem).toContainText('Planning')
      await expect(meetingItem).toContainText('Follow-up needed')
      await expect(meetingItem).toContainText('Prepare the launch brief.')
      await expect(projectRightPanel.getByTestId('project-activity-empty')).toBeVisible()

      await meetingItem.getByTestId(/project-meeting-menu:/).click()
      await expect(
        page.getByRole('menuitem', { name: 'Create follow-up task', exact: true })
      ).toBeVisible()
      await page.getByRole('menuitem', { name: 'Create follow-up task', exact: true }).click()
      const taskDialog = page.getByTestId('task-center-dialog')
      await expect(taskDialog).toBeVisible()
      await taskDialog.getByRole('button', { name: 'Close task editor', exact: true }).click()
      await expect(taskDialog).toHaveCount(0)

      await meetingItem.getByTestId(/project-meeting-menu:/).click()
      await page.getByRole('menuitem', { name: 'Edit', exact: true }).click()
      await expect(meetingComposer.getByRole('button', { name: 'Meeting type: Planning' })).toBeVisible()
      await meetingComposer.getByTestId('project-meeting-type-select').click()
      await page.getByRole('option', { name: /^Review/ }).click()
      await meetingComposer.getByTestId('project-meeting-outcome-select').click()
      await page.getByRole('option', { name: /^Decisions made/ }).click()
      await meetingComposer.locator('.ProseMirror').fill('## Decisions\n\nLaunch brief approved.')
      await meetingComposer.getByRole('button', { name: 'Save changes', exact: true }).click()

      await expect
        .poll(async () => {
          const settings = await page.evaluate(() => window.vaultApi.settings.get())
          return settings.projects[0]?.meetings?.[0]
        })
        .toMatchObject({
          type: 'review',
          outcome: 'decisions-made',
          markdown: '## Decisions\n\nLaunch brief approved.'
        })

      await meetingItem.getByTestId(/project-meeting-menu:/).click()
      await page.getByRole('menuitem', { name: 'Delete', exact: true }).click()
      const deleteDialog = page.getByRole('alertdialog')
      await expect(deleteDialog).toBeVisible()
      await deleteDialog.getByRole('button', { name: 'Delete meeting', exact: true }).click()
      await expect(meetingItem).toHaveCount(0)
      await expect(meetingPage.getByTestId('project-meeting-empty')).toBeVisible()
      await expect
        .poll(async () => {
          const settings = await page.evaluate(() => window.vaultApi.settings.get())
          return settings.projects[0]?.meetings?.length ?? 0
        })
        .toBe(0)
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('collapses the project properties right-panel section', async () => {
    const vaultRoot = await createFixtureVault([createFixtureProject('project-1', 'Alpha Project')])
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await page.getByTestId('sidebar-page:projects').click()
      await page.getByTestId('all-project-row:project-1').click()

      const projectPropertiesPanel = page.getByTestId('project-properties-panel')
      const projectPropertiesToggle = projectPropertiesPanel.getByRole('button', {
        name: 'Project properties',
        exact: true
      })
      const projectPropertiesFavorite = projectPropertiesPanel.getByTestId(
        'project-property-favorite'
      )

      await expect(page.getByTestId('workspace-right-panel-content')).toHaveCSS(
        'overflow-y',
        'hidden'
      )
      await expect(page.getByTestId('projects-panel-stack')).toHaveCSS('overflow-y', 'auto')
      await expect(projectPropertiesToggle).toHaveAttribute('aria-expanded', 'true')

      await projectPropertiesToggle.focus()
      await projectPropertiesToggle.press('Enter')
      await expect(projectPropertiesToggle).toHaveAttribute('aria-expanded', 'false')
      await expect(projectPropertiesFavorite).toBeHidden()

      await projectPropertiesToggle.focus()
      await projectPropertiesToggle.press('Space')
      await expect(projectPropertiesFavorite).toBeVisible()
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('keeps long project sections in the shared panel scrollport', async () => {
    const now = '2026-08-20T00:00:00.000Z'
    const project = createFixtureProject('project-1', 'Alpha Project')
    project.milestones = Array.from({ length: 28 }, (_, index) => ({
      id: `milestone-${index + 1}`,
      title: `Milestone ${index + 1}`,
      endDate: '2026-09-30',
      createdAt: now,
      updatedAt: now
    }))
    project.updates = Array.from({ length: 28 }, (_, index) => ({
      id: `update-${index + 1}`,
      projectId: project.id,
      markdown: `Progress update ${index + 1}`,
      status: 'on-track',
      createdAt: now,
      updatedAt: now
    }))
    const vaultRoot = await createFixtureVault([project])
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openProjectHome(page)
      const panelStack = page.getByTestId('projects-panel-stack')
      await expect(panelStack).toBeVisible()
      await expectSingleRightPanelScrollport(page)
      await expect
        .poll(() => panelStack.evaluate((element) => element.scrollHeight > element.clientHeight))
        .toBe(true)

      const lastMilestone = page.getByTestId('project-milestone-panel-row:milestone-28')
      await lastMilestone.scrollIntoViewIfNeeded()
      await expect(lastMilestone).toBeVisible()
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('opens the All Projects end-date chip in the project calendar picker', async () => {
    const project = createFixtureProject('project-1', 'Alpha Project')
    project.endDate = '2026-08-31'
    const vaultRoot = await createFixtureVault([project])
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await page.getByTestId('sidebar-page:projects').click()
      const endDateChip = page.getByTestId('all-project-date-chip:end-date:project-1')
      await expect(endDateChip).toBeVisible()
      await endDateChip.click()

      const endDateInput = page.getByLabel('Project end date input', { exact: true })
      await expect(endDateInput).toBeFocused()
      await endDateInput.fill('2026-09-15')
      await endDateInput.press('Enter')

      await expect(endDateChip).toContainText('Sep 15')
      await expect
        .poll(async () => {
          const settings = await page.evaluate(() => window.vaultApi.settings.get())
          return settings.projects.find((item) => item.id === 'project-1')?.endDate
        })
        .toBe('2026-09-15')
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('edits project properties from the project detail and properties panel', async () => {
    const vaultRoot = await createFixtureVault([createFixtureProject('project-1', 'Alpha Project')])
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openProjectHome(page)
      const propertiesPanel = page.getByTestId('project-properties-panel')

      const favoriteTrigger = propertiesPanel.getByTestId('project-favorite-button')
      await favoriteTrigger.click()
      const favoritePopover = page.getByRole('dialog', {
        name: 'Project favorite options'
      })
      await expect(favoritePopover).toBeVisible()
      await favoritePopover.getByRole('option', { name: 'Favorite', exact: true }).click()
      await expect(favoriteTrigger).toHaveAttribute('aria-label', 'Project favorite: Favorite')
      const mainDetail = page.getByTestId('project-main-detail-panel')
      const projectTagEditor = propertiesPanel.getByTestId('project-tags-editor')
      await expect(
        mainDetail.getByRole('button', { name: 'Project tags selection', exact: true })
      ).toHaveCount(0)
      await projectTagEditor
        .getByRole('button', { name: 'Project tags selection', exact: true })
        .click()
      const projectTagPopover = page.getByTestId('project-tags-editor-popover')
      const projectTagSearch = page.getByRole('combobox', {
        name: 'Search or add tags',
        exact: true
      })
      await expect(projectTagPopover).toBeVisible()
      await expect(projectTagSearch).toBeFocused()
      await projectTagSearch.press('Escape')
      await expect(projectTagPopover).toBeHidden()
      await projectTagEditor
        .getByRole('button', { name: 'Project tags selection', exact: true })
        .click()
      await projectTagSearch.fill('launch')
      await projectTagSearch.press('Enter')
      await expect(projectTagPopover).toContainText('launch')
      await projectTagSearch.press('Escape')
      await page.getByTestId('project-view-tab:resources').click()
      const resourcesPage = page.getByTestId('project-resources-page')
      await expect(resourcesPage).toBeVisible()
      await expect(page.getByTestId('project-resources-panel')).toHaveCount(0)
      await page.getByTestId('add-resource-button').click()
      const resourceDialog = page.getByTestId('project-resource-dialog')
      await resourceDialog.getByLabel('URL').fill('https://github.com/')
      await resourceDialog.getByLabel('Display name').fill('GitHub')
      await resourceDialog.getByRole('button', { name: 'Add resource', exact: true }).click()

      await expect(resourcesPage.getByText('GitHub', { exact: true })).toBeVisible()

      const startDateGroup = propertiesPanel.getByTestId('project-property-start-date-group')
      const endDateGroup = propertiesPanel.getByTestId('project-property-end-date-group')
      for (const group of [startDateGroup, endDateGroup]) {
        await expect(group).toHaveClass(/rounded-\[var\(--radius-button-pill\)\]/)
        await expect(group).toHaveClass(/border-border/)
        await expect(group).toHaveClass(/bg-surface-subtle/)
        await expect(group).toHaveClass(/divide-x/)
      }

      const startDateTrigger = startDateGroup.getByRole('button', {
        name: 'Project start date',
        exact: true
      })
      await startDateTrigger.click()
      const startDateInput = page.getByLabel('Project start date input', { exact: true })
      await expect(startDateInput).toBeFocused()
      await startDateInput.fill('2026-08-01')
      await startDateInput.press('Enter')
      await expect(startDateTrigger).toContainText('Aug 1, 2026')

      const endDateTrigger = endDateGroup.getByRole('button', {
        name: 'Project end date',
        exact: true
      })
      await endDateTrigger.click()
      const endDateInput = page.getByLabel('Project end date input', { exact: true })
      await expect(endDateInput).toBeFocused()
      await endDateInput.fill('2026-07-31')
      await endDateInput.press('Enter')
      await expect(endDateTrigger).toContainText('Set end date')

      await endDateTrigger.click()
      await endDateInput.fill('2026-08-31')
      await endDateInput.press('Enter')
      await expect(endDateTrigger).toContainText('Aug 31, 2026')
      await expect(startDateGroup.getByRole('button')).toHaveCount(2)
      await expect(endDateGroup.getByRole('button')).toHaveCount(2)

      await endDateGroup.getByTestId('project-property-end-date-group-clear').click()
      await expect(endDateTrigger).toContainText('Set end date')

      const persistedSettings = await page.evaluate(() => window.vaultApi.settings.get())
      const persistedProject = persistedSettings.projects.find(
        (project) => project.id === 'project-1'
      )
      expect(persistedProject?.tags).toEqual(['launch'])
      expect(persistedProject?.resourceRefs?.some((resource) => resource.title === 'GitHub')).toBe(
        true
      )
      expect(persistedProject?.startDate).toBe('2026-08-01')
      expect(persistedProject?.endDate).toBeUndefined()
      expect(persistedSettings.favoriteProjectIds).toContain('project-1')
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('selects the first visible tag and creates new tags with Enter', async () => {
    const vaultRoot = await createFixtureVault([
      createFixtureProject('project-1', 'Alpha Project'),
      { ...createFixtureProject('project-2', 'Beta Project'), tags: ['alpha', 'zeta'] }
    ])
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openProjectHome(page)
      const propertiesPanel = page.getByTestId('project-properties-panel')
      await propertiesPanel
        .getByTestId('project-tags-editor')
        .getByRole('button', { name: 'Project tags selection', exact: true })
        .click()

      const tagInput = page.getByRole('combobox', {
        name: 'Search or add tags',
        exact: true
      })

      await expect(page.getByRole('option', { name: '#alpha', exact: true })).toBeVisible()
      await tagInput.press('Enter')
      await expect(
        page.getByRole('option', { name: '#alpha, selected', exact: true })
      ).toBeVisible()

      await tagInput.fill('alpha')
      await tagInput.press('Enter')
      await expect(page.getByRole('option', { name: '#alpha', exact: true })).toBeVisible()

      await tagInput.fill('')
      await tagInput.press('Enter')
      await expect(
        page.getByRole('option', { name: '#alpha, selected', exact: true })
      ).toBeVisible()

      await tagInput.fill('bad tag!')
      await expect(page.getByRole('alert')).toHaveText(
        'Use letters, numbers, dash, underscore, or a namespace colon.'
      )
      await tagInput.press('Enter')
      await expect(page.getByRole('alert')).toBeVisible()

      await tagInput.fill('fresh-tag')
      await tagInput.press('Enter')
      await expect(
        page.getByRole('option', { name: '#fresh-tag, selected', exact: true })
      ).toBeVisible()
      await expect(tagInput).toBeVisible()

      await tagInput.press('Escape')

      const persistedSettings = await page.evaluate(() => window.vaultApi.settings.get())
      const persistedProject = persistedSettings.projects.find(
        (project) => project.id === 'project-1'
      )
      expect(persistedProject?.tags).toEqual(['alpha', 'fresh-tag'])
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('creates a project and linked task from Project Details', async () => {
    const vaultRoot = await createFixtureVault([])
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await page.getByTestId('sidebar-page:projects').click()
      await page.getByTestId('new-project-button').click()

      await expect(page.getByLabel('Project name')).toHaveValue('Untitled Project')
      const projectDescription = page.getByTestId('project-main-detail-description-editor')
      await expect(projectDescription).toBeVisible()
      await expect(projectDescription.locator('.ProseMirror')).toHaveCount(1)
      await expect(projectDescription.getByRole('status')).toHaveCount(0)
      await page.getByRole('button', { name: 'Add new task', exact: true }).click()
      await fillNewTaskTitle(page, 'Prepare launch notes')
      await openTaskPageFromCenterDialog(page)
      const taskPage = page.getByTestId('task-page')

      const taskTags = page.getByTestId('task-tags-editor')
      await expect(taskTags).toBeVisible()
      const titleBox = await taskPage
        .getByRole('heading', { name: 'Prepare launch notes' })
        .boundingBox()
      const tagsBox = await taskTags.boundingBox()
      const projectBox = await page.getByTestId('task-property-project').boundingBox()
      if (!titleBox || !tagsBox || !projectBox) {
        throw new Error('Expected task title, tags, and project fields to have layout boxes')
      }
      expect(tagsBox.y).toBeGreaterThan(titleBox.y)
      expect(tagsBox.y).toBeGreaterThan(projectBox.y)

      await taskTags.getByRole('button', { name: 'Task tags selection', exact: true }).click()
      const tagInput = page.getByRole('combobox', {
        name: 'Search or add tags',
        exact: true
      })
      await tagInput.fill('release')
      await tagInput.press('Enter')
      await tagInput.fill('project:alpha')
      await tagInput.press('Enter')
      await tagInput.press('Escape')
      await expect(taskTags).toContainText('Tags')

      const settingsWhileEditing = await page.evaluate(() => window.vaultApi.settings.get())
      expect(
        settingsWhileEditing.calendarTasks.some((task) => task.title === 'Prepare launch notes')
      ).toBe(true)
      await page
        .getByRole('navigation', { name: 'breadcrumb' })
        .getByRole('button', { name: 'Projects', exact: true })
        .click()
      await expect(page.getByLabel('Project name')).toHaveValue('Untitled Project')
      const taskOpenButton = page.getByRole('button', { name: 'Open task: Prepare launch notes' })
      await expect(taskOpenButton).toBeVisible()
      await taskOpenButton.click()
      await openTaskPageFromCenterDialog(page)
      const editTaskTags = page.getByTestId('task-tags-editor')
      await editTaskTags.getByRole('button', { name: 'Task tags selection', exact: true }).click()
      const editTaskTagPopover = page.getByTestId('task-tags-editor-popover')
      await editTaskTagPopover
        .getByRole('option', { name: '#release, selected', exact: true })
        .click()
      await page.getByRole('combobox', { name: 'Search or add tags', exact: true }).press('Escape')
      await page
        .getByRole('navigation', { name: 'breadcrumb' })
        .getByRole('button', { name: 'Projects', exact: true })
        .click()
      await expect(page.getByLabel('Project name')).toHaveValue('Untitled Project')

      await page.getByTestId('new-project-button').click()
      await expect(page.getByLabel('Project name')).toHaveValue('Untitled Project 2')
      await page.getByTestId('projects-breadcrumb:all').click()
      await page
        .locator('[data-testid^="all-project-row:"]')
        .filter({ has: page.getByText('Untitled Project', { exact: true }) })
        .first()
        .click()
      await expect(page.getByLabel('Project name')).toHaveValue('Untitled Project')
      await expect(
        page.getByRole('button', { name: 'Open task: Prepare launch notes' })
      ).toBeVisible()

      const persistedSettings = await page.evaluate(() => window.vaultApi.settings.get())
      const persistedProject = persistedSettings.projects.find(
        (project) => project.name === 'Untitled Project'
      )
      const today = await page.evaluate(() => {
        const date = new Date()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        return `${date.getFullYear()}-${month}-${day}`
      })
      expect(persistedProject).toBeDefined()
      expect(persistedProject?.description).toBe('')
      expect(persistedProject?.startDate).toBe(today)
      const persistedTask = persistedSettings.calendarTasks.find(
        (task) => task.title === 'Prepare launch notes'
      )
      expect(persistedTask?.tags).toEqual(['project:alpha'])
      expect(
        persistedSettings.projects.some((project) => project.name === 'Untitled Project 2')
      ).toBe(true)
      expect(
        persistedSettings.calendarTasks.some(
          (task) => task.title === 'Prepare launch notes' && task.projectId === persistedProject?.id
        )
      ).toBe(true)
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('shows the current milestone and persists vertical keyboard reordering', async () => {
    const project: Project = {
      ...createFixtureProject('project-1', 'Alpha Project'),
      milestones: [
        {
          id: 'milestone-complete',
          title: 'Completed setup',
          createdAt: '2026-08-20T00:00:00.000Z',
          updatedAt: '2026-08-20T00:00:00.000Z'
        },
        {
          id: 'milestone-current',
          title: 'Current launch',
          createdAt: '2026-08-21T00:00:00.000Z',
          updatedAt: '2026-08-21T00:00:00.000Z'
        }
      ]
    }
    const completedTask = {
      ...createFixtureTask('task-complete', 'Finish setup', project.id, {
        milestoneId: 'milestone-complete'
      }),
      completed: true,
      status: 'completed' as const
    }
    const vaultRoot = await createFixtureVault([project], [completedTask])
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await page.getByTestId('sidebar-page:projects').click()
      await expect(page.getByRole('columnheader', { name: 'Current milestone' })).toHaveCount(0)
      await expect(page.getByTestId('all-project-row:project-1')).toContainText('Current launch')
      await expect(page.getByTestId('all-project-milestone-icon:project-1')).toBeVisible()

      await openProjectHome(page)
      const firstHandle = page.getByTestId('project-milestone-reorder-handle:milestone-complete')
      await firstHandle.press('ArrowDown')

      const milestoneRows = page.locator('[data-testid^="project-milestone-row:"]')
      await expect(milestoneRows.nth(0)).toHaveAttribute(
        'data-testid',
        'project-milestone-row:milestone-current'
      )

      await page.reload()
      await expect(page.getByTestId('sidebar-page:projects')).toBeVisible({ timeout: 20_000 })
      await openProjectHome(page)
      await expect(page.locator('[data-testid^="project-milestone-row:"]').nth(0)).toHaveAttribute(
        'data-testid',
        'project-milestone-row:milestone-current'
      )
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('uses a full vertical milestone drag preview without the reorder handle', async () => {
    const project: Project = {
      ...createFixtureProject('project-1', 'Alpha Project'),
      milestones: [
        {
          id: 'milestone-first',
          title: 'First milestone',
          createdAt: '2026-08-20T00:00:00.000Z',
          updatedAt: '2026-08-20T00:00:00.000Z'
        },
        {
          id: 'milestone-second',
          title: 'Second milestone',
          createdAt: '2026-08-21T00:00:00.000Z',
          updatedAt: '2026-08-21T00:00:00.000Z'
        },
        {
          id: 'milestone-third',
          title: 'Third milestone',
          createdAt: '2026-08-22T00:00:00.000Z',
          updatedAt: '2026-08-22T00:00:00.000Z'
        }
      ]
    }
    const task = createFixtureTask('task-first', 'First task', project.id, {
      milestoneId: 'milestone-first'
    })
    const vaultRoot = await createFixtureVault([project], [task])
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openProjectHome(page)
      await page.getByTestId('project-milestone-icon:milestone-first').click()
      const sourceRow = page.getByTestId('project-milestone-row:milestone-first')
      const secondRow = page.getByTestId('project-milestone-row:milestone-second')
      await expect(page.getByTestId('project-task-row:task-first')).toBeVisible()

      const initialMetrics = await page.evaluate(() => {
        const container = document.querySelector<HTMLElement>(
          '[data-testid="project-milestone-row:milestone-first"] > [data-drop-zone-variant="row"]'
        )
        const handle = document.querySelector<HTMLElement>(
          '[data-testid="project-milestone-reorder-handle:milestone-first"]'
        )
        if (!container || !handle) {
          throw new Error('Milestone drag preview fixtures are missing')
        }

        const containerRect = container.getBoundingClientRect()
        const handleRect = handle.getBoundingClientRect()
        const dataTransfer = new DataTransfer()
        handle.dispatchEvent(
          new DragEvent('dragstart', {
            bubbles: true,
            cancelable: true,
            dataTransfer,
            clientX: handleRect.left + handleRect.width / 2,
            clientY: handleRect.top + handleRect.height / 2
          })
        )
        return {
          left: containerRect.left,
          clientX: containerRect.left + containerRect.width + 240,
          clientY: containerRect.top + containerRect.height + 120
        }
      })

      const floatingPreview = page.locator('[data-floating-drag-preview="true"]')
      await expect(floatingPreview).toBeVisible()
      await expect(
        floatingPreview.locator('[data-testid^="project-milestone-reorder-handle:"]')
      ).toHaveCount(0)
      await expect(sourceRow).toHaveCSS('opacity', '0')
      await expect(floatingPreview).toHaveClass(/shadow-2xl/)

      const initialPreviewBox = await floatingPreview.boundingBox()
      expect(initialPreviewBox).not.toBeNull()
      if (!initialPreviewBox) {
        throw new Error('Milestone floating preview bounding box not available')
      }

      const previewTransition = await floatingPreview.evaluate((element) => ({
        transition: element.style.transition,
        axis: element.getAttribute('data-drag-preview-axis'),
        motion: element.getAttribute('data-drag-preview-motion'),
        elevation: element.getAttribute('data-drag-preview-elevation')
      }))
      expect(previewTransition.axis).toBe('y')
      expect(previewTransition.motion).toBe('smooth')
      expect(previewTransition.elevation).toBe('strong')
      expect(previewTransition.transition).toContain('top')
      expect(await floatingPreview.evaluate((element) => getComputedStyle(element).zIndex)).toBe(
        '2147483647'
      )

      await page.evaluate(({ clientX, clientY }) => {
        window.dispatchEvent(
          new DragEvent('dragover', {
            bubbles: true,
            cancelable: true,
            dataTransfer: new DataTransfer(),
            clientX,
            clientY
          })
        )
      }, initialMetrics)

      await expect
        .poll(async () => {
          const box = await floatingPreview.boundingBox()
          return box ? box.x : initialMetrics.left
        })
        .toBeGreaterThanOrEqual(initialMetrics.left - 1)
      await expect
        .poll(async () => {
          const box = await floatingPreview.boundingBox()
          return box ? box.x : initialMetrics.left
        })
        .toBeLessThanOrEqual(initialMetrics.left + 1)
      await expect
        .poll(async () => {
          const box = await floatingPreview.boundingBox()
          return box ? box.y : 0
        })
        .toBeGreaterThan(initialPreviewBox.y + 20)

      const secondRowContainer = secondRow.locator('[data-drop-zone-variant="row"]')
      const secondRowBox = await secondRowContainer.boundingBox()
      expect(secondRowBox).not.toBeNull()
      if (!secondRowBox) {
        throw new Error('Milestone drop target bounding box not available')
      }
      await page.evaluate(
        ({ clientX, clientY }) => {
          const target = document.querySelector<HTMLElement>(
            '[data-testid="project-milestone-row:milestone-second"] > [data-drop-zone-variant="row"]'
          )
          if (!target) {
            throw new Error('Milestone drop target is missing')
          }
          target.dispatchEvent(
            new DragEvent('dragover', {
              bubbles: true,
              cancelable: true,
              dataTransfer: new DataTransfer(),
              clientX,
              clientY
            })
          )
        },
        {
          clientX: secondRowBox.x + secondRowBox.width / 2,
          clientY: secondRowBox.y + secondRowBox.height
        }
      )
      await expect(floatingPreview).toBeVisible()
      await expect(floatingPreview).toHaveAttribute('data-drag-preview-axis', 'y')
      await expect
        .poll(() =>
          page
            .locator('[data-testid^="project-milestone-row:"]')
            .evaluateAll((rows) => rows.some((row) => row.getAnimations().length > 0))
        )
        .toBe(true)

      await page.evaluate(() => {
        const source = document.querySelector<HTMLElement>(
          '[data-testid="project-milestone-reorder-handle:milestone-first"]'
        )
        source?.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true }))
      })
      await expect(floatingPreview).toHaveCount(0)
      await expect(sourceRow).toHaveCSS('opacity', '1')
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('keeps the floating milestone preview visible during native pointer crossing', async () => {
    const project: Project = {
      ...createFixtureProject('project-1', 'Alpha Project'),
      milestones: [
        {
          id: 'milestone-first',
          title: 'First milestone',
          createdAt: '2026-08-20T00:00:00.000Z',
          updatedAt: '2026-08-20T00:00:00.000Z'
        },
        {
          id: 'milestone-second',
          title: 'Second milestone',
          createdAt: '2026-08-21T00:00:00.000Z',
          updatedAt: '2026-08-21T00:00:00.000Z'
        },
        {
          id: 'milestone-third',
          title: 'Third milestone',
          createdAt: '2026-08-22T00:00:00.000Z',
          updatedAt: '2026-08-22T00:00:00.000Z'
        }
      ]
    }
    const vaultRoot = await createFixtureVault([project])
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openProjectHome(page)
      const handle = page.getByTestId('project-milestone-reorder-handle:milestone-first')
      const secondRow = page.getByTestId('project-milestone-row:milestone-second')
      const thirdRow = page.getByTestId('project-milestone-row:milestone-third')
      await handle.hover()
      const handleBox = await handle.boundingBox()
      const secondBox = await secondRow.boundingBox()
      const thirdBox = await thirdRow.boundingBox()
      expect(handleBox).not.toBeNull()
      expect(secondBox).not.toBeNull()
      expect(thirdBox).not.toBeNull()
      if (!handleBox || !secondBox || !thirdBox) {
        throw new Error('Native milestone drag fixtures are missing')
      }

      await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2)
      await page.mouse.down()
      await page.mouse.move(
        handleBox.x + handleBox.width / 2,
        handleBox.y + handleBox.height / 2 + 8
      )
      await expect(handle).toHaveAttribute('data-dragging', 'true')
      const floatingPreview = page.locator('[data-floating-drag-preview="true"]')
      await expect(floatingPreview).toBeVisible()

      await page.mouse.move(secondBox.x + secondBox.width / 2, secondBox.y + secondBox.height / 2, {
        steps: 12
      })
      await expect(floatingPreview).toBeVisible()
      await page.mouse.move(thirdBox.x + thirdBox.width / 2, thirdBox.y + thirdBox.height / 2, {
        steps: 12
      })
      await expect(floatingPreview).toBeVisible()
      await page.mouse.up()
      await expect(floatingPreview).toHaveCount(0)
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('reorders to the top and bottom when dropped outside the milestone rows', async () => {
    const project: Project = {
      ...createFixtureProject('project-1', 'Alpha Project'),
      milestones: [
        {
          id: 'milestone-first',
          title: 'First milestone',
          createdAt: '2026-08-20T00:00:00.000Z',
          updatedAt: '2026-08-20T00:00:00.000Z'
        },
        {
          id: 'milestone-second',
          title: 'Second milestone',
          createdAt: '2026-08-21T00:00:00.000Z',
          updatedAt: '2026-08-21T00:00:00.000Z'
        },
        {
          id: 'milestone-third',
          title: 'Third milestone',
          createdAt: '2026-08-22T00:00:00.000Z',
          updatedAt: '2026-08-22T00:00:00.000Z'
        }
      ]
    }
    const vaultRoot = await createFixtureVault([project])
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    const dragToBoundary = async (
      milestoneId: string,
      boundary: 'top' | 'bottom'
    ): Promise<void> => {
      const handle = page.getByTestId(`project-milestone-reorder-handle:${milestoneId}`)
      await page.evaluate((id) => {
        const source = document.querySelector<HTMLElement>(
          `[data-testid="project-milestone-reorder-handle:${id}"]`
        )
        if (!source) {
          throw new Error(`Milestone handle is missing: ${id}`)
        }
        const rect = source.getBoundingClientRect()
        source.dispatchEvent(
          new DragEvent('dragstart', {
            bubbles: true,
            cancelable: true,
            dataTransfer: new DataTransfer(),
            clientX: rect.left + rect.width / 2,
            clientY: rect.top + rect.height / 2
          })
        )
      }, milestoneId)
      await expect(handle).toHaveAttribute('data-dragging', 'true')
      await expect(page.getByTestId('project-milestones')).toHaveAttribute(
        'data-drag-boundary-active',
        'true'
      )

      const boundaryPosition = await page.evaluate((direction) => {
        const list = document.querySelector<HTMLElement>('[data-testid="project-milestones"]')
        if (!list) {
          throw new Error('Milestone list is missing')
        }
        const rect = list.getBoundingClientRect()
        return {
          clientX: rect.left + rect.width / 2,
          clientY: direction === 'top' ? rect.top - 32 : rect.bottom + 32
        }
      }, boundary)

      await page.evaluate(({ clientX, clientY }) => {
        window.dispatchEvent(
          new DragEvent('dragover', {
            bubbles: true,
            cancelable: true,
            dataTransfer: new DataTransfer(),
            clientX,
            clientY
          })
        )
      }, boundaryPosition)

      const rows = page.locator('[data-testid^="project-milestone-row:"]')
      const expectedPosition = boundary === 'top' ? 0 : 2
      await expect(rows.nth(expectedPosition)).toHaveAttribute(
        'data-testid',
        `project-milestone-row:${milestoneId}`
      )

      await page.evaluate(({ clientX, clientY }) => {
        window.dispatchEvent(
          new DragEvent('drop', {
            bubbles: true,
            cancelable: true,
            dataTransfer: new DataTransfer(),
            clientX,
            clientY
          })
        )
      }, boundaryPosition)
      await page.evaluate((id) => {
        document
          .querySelector<HTMLElement>(`[data-testid="project-milestone-reorder-handle:${id}"]`)
          ?.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true }))
      }, milestoneId)
      await expect(page.getByTestId('project-milestones')).toHaveAttribute(
        'data-drag-boundary-active',
        'false'
      )
      await expect(handle).not.toBeDisabled()
    }

    try {
      await openProjectHome(page)
      await dragToBoundary('milestone-second', 'top')
      await dragToBoundary('milestone-second', 'bottom')

      await page.reload()
      await expect(page.getByTestId('sidebar-page:projects')).toBeVisible({ timeout: 20_000 })
      await openProjectHome(page)
      await expect(page.locator('[data-testid^="project-milestone-row:"]').last()).toHaveAttribute(
        'data-testid',
        'project-milestone-row:milestone-second'
      )
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('creates grouped milestones, derives completeness, and moves tasks on delete', async () => {
    const vaultRoot = await createFixtureVault([createFixtureProject('project-1', 'Alpha Project')])
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openProjectHome(page)
      await page.getByRole('button', { name: 'Add new milestone', exact: true }).click()

      const milestoneRow = page.locator('[data-testid^="project-milestone-row:"]').first()
      await expect(milestoneRow).toBeVisible()
      const milestoneInput = milestoneRow.locator('input')
      await expect(milestoneInput).toBeVisible()
      await milestoneInput.fill('Release')
      await milestoneInput.press('Enter')
      await expect(milestoneRow.getByRole('button', { name: 'Release', exact: true })).toBeVisible()
      const milestoneTestId = await milestoneRow.getAttribute('data-testid')
      if (!milestoneTestId) throw new Error('Expected milestone row test id')
      const milestoneId = milestoneTestId.split(':')[1]
      const milestoneChildren = page.getByTestId(`project-milestone-children:${milestoneId}`)
      await expect(milestoneChildren).toBeVisible()

      await milestoneRow.getByTestId(`project-milestone-icon:${milestoneId}`).click()
      await expect(milestoneChildren).toBeHidden()
      await milestoneRow.getByTestId(`project-milestone-icon:${milestoneId}`).click()
      await expect(milestoneChildren).toBeVisible()

      await milestoneRow.getByRole('button', { name: 'Release', exact: true }).click()
      const milestoneHeader = milestoneRow.getByTestId(`project-milestone-open:${milestoneId}`)
      const editingMilestoneInput = milestoneRow.locator('input')
      await expect(editingMilestoneInput).toBeVisible()
      await expect(milestoneHeader).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
      await expect(milestoneHeader).toHaveCSS('border-top-color', 'rgba(0, 0, 0, 0)')
      await expect(editingMilestoneInput).toHaveAttribute('size', '7')
      await expect(editingMilestoneInput).toHaveCSS('display', 'inline-block')
      await expect(editingMilestoneInput).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
      await expect(editingMilestoneInput).toHaveCSS('border-top-width', '0px')
      const inputContentMetrics = await editingMilestoneInput.evaluate((element) => {
        const input = element as HTMLInputElement
        const style = window.getComputedStyle(input)
        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d')
        if (!context) throw new Error('Expected canvas context for text measurement')
        context.font = style.font
        return {
          inputWidth: input.getBoundingClientRect().width,
          textWidth: context.measureText(input.value).width
        }
      })
      expect(inputContentMetrics.inputWidth).toBeGreaterThanOrEqual(inputContentMetrics.textWidth)
      expect(inputContentMetrics.inputWidth - inputContentMetrics.textWidth).toBeLessThan(4)
      const collapseIcon = milestoneHeader.locator('.motion-state-chevron')
      const taskCount = milestoneHeader.getByText('0 Tasks', { exact: true })
      const [milestoneInputBox, milestoneHeaderBox, collapseIconBox, taskCountBox] =
        await Promise.all([
          editingMilestoneInput.boundingBox(),
          milestoneHeader.boundingBox(),
          collapseIcon.boundingBox(),
          taskCount.boundingBox()
        ])
      if (!milestoneInputBox || !milestoneHeaderBox || !collapseIconBox || !taskCountBox) {
        throw new Error('Expected milestone title, chevron, task count, and row layout boxes')
      }
      expect(milestoneInputBox.x).toBeGreaterThanOrEqual(milestoneHeaderBox.x)
      expect(milestoneInputBox.x + milestoneInputBox.width).toBeLessThanOrEqual(
        milestoneHeaderBox.x + milestoneHeaderBox.width
      )
      expect(milestoneInputBox.width).toBeLessThan(200)
      expect(collapseIconBox.x).toBeGreaterThanOrEqual(
        milestoneInputBox.x + milestoneInputBox.width
      )
      expect(taskCountBox.x).toBeGreaterThanOrEqual(collapseIconBox.x + collapseIconBox.width + 4)
      await editingMilestoneInput.fill('Release candidate')
      await editingMilestoneInput.press('Enter')
      await expect(
        milestoneRow.getByRole('button', { name: 'Release candidate', exact: true })
      ).toBeVisible()

      await milestoneRow.getByTestId(`project-milestone-add-task-icon:${milestoneId}`).click()
      await fillNewTaskTitle(page, 'Prepare release')
      await openTaskPageFromCenterDialog(page)
      await expect(page.getByTestId('task-property-milestone')).toContainText('Release candidate')
      await page
        .getByRole('navigation', { name: 'breadcrumb' })
        .getByRole('button', { name: 'Projects', exact: true })
        .click()
      await openProjectHome(page)
      await milestoneRow.getByTestId(`project-milestone-icon:${milestoneId}`).click()
      await expect(milestoneChildren).toBeVisible()

      const taskOpenButton = page.getByRole('button', { name: 'Open task: Prepare release' })
      await expect(taskOpenButton).toBeVisible()
      const taskRow = page
        .locator('[data-testid^="project-task-row:"]')
        .filter({ hasText: 'Prepare release' })
      await expect(taskRow.getByText('Prepare release', { exact: true }).last()).toHaveClass(
        /text-base.*font-semibold/
      )
      await expect(milestoneRow).toContainText('1 Tasks')
      await expect(milestoneRow).toContainText('0%')
      await expect(milestoneRow.getByTestId(`project-milestone-delete:${milestoneId}`)).toHaveCount(
        0
      )
      await expect(page.getByTestId(`project-milestone-icon:${milestoneId}`)).toHaveAttribute(
        'data-completed',
        'false'
      )

      await taskOpenButton.click()
      await openTaskPageFromCenterDialog(page)
      const taskStatus = page.getByTestId('task-property-status').getByRole('button')
      await taskStatus.click()
      const statusPopover = page.getByRole('dialog', {
        name: 'Status for Prepare release options'
      })
      await statusPopover
        .getByRole('textbox', { name: 'Search status for prepare release' })
        .fill('completed')
      await statusPopover.getByText('Completed', { exact: true }).click()
      await page
        .getByRole('navigation', { name: 'breadcrumb' })
        .getByRole('button', { name: 'Projects', exact: true })
        .click()
      await openProjectHome(page)
      await expect(page.getByTestId(`project-milestone-icon:${milestoneId}`)).toHaveAttribute(
        'data-completed',
        'true'
      )

      await expect(milestoneRow).toContainText('100%')
      page.once('dialog', (dialog) => void dialog.accept())
      await milestoneRow
        .getByTestId(`project-milestone-open:${milestoneId}`)
        .click({ button: 'right' })
      await page
        .getByTestId(`project-milestone-context-menu:${milestoneId}`)
        .getByRole('menuitem', {
          name: 'Delete milestone'
        })
        .click()
      await expect(page.getByTestId(`project-milestone-row:${milestoneId}`)).toHaveCount(0)
      await expect(page.locator('[data-testid^="project-task-row:"]')).toHaveCount(1)
      await expect(page.getByRole('button', { name: 'Open task: Prepare release' })).toBeVisible()

      const persistedSettings = await page.evaluate(() => window.vaultApi.settings.get())
      expect(persistedSettings.projects[0]?.milestones).toEqual([])
      expect(
        persistedSettings.calendarTasks.find((task) => task.title === 'Prepare release')
          ?.milestoneId
      ).toBeUndefined()
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('keeps task and milestone rows on one line across responsive widths', async () => {
    const project = createFixtureProject('project-1', 'Alpha Project')
    project.milestones = [
      {
        id: 'milestone-1',
        title: 'Release milestone',
        createdAt: '2026-08-20T00:00:00.000Z',
        updatedAt: '2026-08-20T00:00:00.000Z'
      }
    ]
    const vaultRoot = await createFixtureVault(
      [project],
      [
        createFixtureTask('task-direct', 'Direct task with tags', 'project-1', {
          tags: ['release', 'project:alpha'],
          date: '2026-08-20',
          time: '09:00',
          endDate: '2026-08-21',
          endTime: '10:30'
        }),
        createFixtureTask('task-milestone', 'Milestone task', 'project-1', {
          milestoneId: 'milestone-1'
        })
      ]
    )
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openProjectHome(page)
      const directTaskRow = page.getByTestId('project-task-row:task-direct')
      const milestoneToggle = page.getByTestId('project-milestone-toggle:milestone-1')
      const milestoneChildren = page.getByTestId('project-milestone-children:milestone-1')
      const milestoneHeader = page.getByTestId('project-milestone-open:milestone-1')

      await expect(directTaskRow.getByTestId('task-tags-summary')).toHaveCount(0)
      await expect(
        directTaskRow.getByTestId('project-task-schedule-chip:task-direct:start-date')
      ).toContainText('Aug 20, 2026')
      await expect(
        directTaskRow.getByTestId('project-task-schedule-chip:task-direct:start-time')
      ).toContainText('9:00 AM')
      await expect(
        directTaskRow.getByTestId('project-task-schedule-chip:task-direct:end-date')
      ).toContainText('Aug 21, 2026')
      await expect(
        directTaskRow.getByTestId('project-task-schedule-chip:task-direct:end-time')
      ).toContainText('10:30 AM')
      const startDateChip = directTaskRow.getByTestId(
        'project-task-schedule-chip:task-direct:start-date'
      )
      await expect(startDateChip).toHaveClass(/bg-transparent/)
      await expect(startDateChip).toHaveClass(/hover:bg-muted/)
      await expect(startDateChip).toHaveClass(/min-w-max/)
      await expect(startDateChip).toHaveClass(/max-w-none/)
      await milestoneToggle.focus()
      await milestoneToggle.press('Enter')
      await expect(milestoneChildren).toBeVisible()
      await milestoneToggle.press('Space')
      await expect(milestoneChildren).toBeHidden()
      await milestoneToggle.press('Enter')
      await expect(milestoneChildren).toBeVisible()

      const milestoneTaskRow = page.getByTestId('project-task-row:task-milestone')
      for (const width of [1280, 560]) {
        await page.setViewportSize({ width, height: 800 })
        await expect(directTaskRow).toBeVisible()
        await expect(milestoneTaskRow).toBeVisible()

        const directMetrics = await readTaskRowMetrics(directTaskRow)
        const milestoneTaskMetrics = await readTaskRowMetrics(milestoneTaskRow)
        const milestoneHeaderBox = await milestoneHeader.boundingBox()

        expect(directMetrics.height).toBeLessThan(48)
        expect(directMetrics.centerSpread).toBeLessThan(4)
        expect(milestoneTaskMetrics.height).toBeLessThan(48)
        expect(milestoneTaskMetrics.centerSpread).toBeLessThan(4)
        expect(milestoneHeaderBox?.height ?? Number.POSITIVE_INFINITY).toBeLessThan(48)
      }
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('opens milestone and task context menus from project rows', async () => {
    const vaultRoot = await createFixtureVault([createFixtureProject('project-1', 'Alpha Project')])
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openProjectHome(page)
      await page.getByRole('button', { name: 'Add new milestone', exact: true }).click()

      const milestoneRow = page.locator('[data-testid^="project-milestone-row:"]').first()
      const milestoneInput = milestoneRow.locator('input')
      await expect(milestoneInput).toBeVisible()
      await milestoneInput.fill('Release')
      await milestoneInput.press('Enter')
      await expect(milestoneRow.getByRole('button', { name: 'Release', exact: true })).toBeVisible()
      const milestoneTestId = await milestoneRow.getAttribute('data-testid')
      if (!milestoneTestId) throw new Error('Expected milestone row test id')
      const milestoneId = milestoneTestId.split(':')[1]

      await page.getByTestId(`project-milestone-open:${milestoneId}`).click({ button: 'right' })
      const milestoneMenu = page.getByTestId(`project-milestone-context-menu:${milestoneId}`)
      await expect(milestoneMenu).toBeVisible()
      await expect(
        milestoneMenu.getByRole('menuitem', { name: 'Add task to milestone', exact: true })
      ).toBeVisible()
      await expect(
        milestoneMenu.getByRole('menuitem', { name: 'Edit milestone', exact: true })
      ).toBeVisible()
      await expect(
        milestoneMenu.getByRole('menuitem', { name: 'Delete milestone', exact: true })
      ).toBeVisible()

      await milestoneMenu
        .getByRole('menuitem', { name: 'Add task to milestone', exact: true })
        .click()
      await fillNewTaskTitle(page, 'Prepare release')
      await openTaskPageFromCenterDialog(page)
      await page
        .getByRole('navigation', { name: 'breadcrumb' })
        .getByRole('button', { name: 'Projects', exact: true })
        .click()
      await openProjectHome(page)
      await milestoneRow.getByTestId(`project-milestone-icon:${milestoneId}`).click()
      await expect(page.getByTestId(`project-milestone-children:${milestoneId}`)).toBeVisible()

      const taskRow = page
        .locator('[data-testid^="project-task-row:"]')
        .filter({ hasText: 'Prepare release' })
      const taskTestId = await taskRow.getAttribute('data-testid')
      if (!taskTestId) throw new Error('Expected task row test id')
      const taskId = taskTestId.split(':')[1]

      await taskRow.getByTestId(`project-task-menu:${taskId}`).click()
      const taskMenu = page.getByTestId(`task-context-menu:${taskId}`)
      await expect(taskMenu).toBeVisible()
      await expect(
        taskMenu.getByRole('menuitem', { name: 'Set status', exact: true })
      ).toBeVisible()
      await expect(taskMenu.getByRole('menuitem', { name: /Mark as/ })).toHaveCount(0)
      await expect(taskMenu.getByRole('menuitem', { name: 'Edit task', exact: true })).toHaveCount(
        0
      )
      await expect(taskMenu.getByRole('menuitem', { name: 'Rename', exact: true })).toHaveCount(0)
      await expect(taskMenu.getByRole('menuitem', { name: 'Set type', exact: true })).toBeVisible()
      await expect(
        taskMenu.getByRole('menuitem', { name: 'Set priority', exact: true })
      ).toBeVisible()
      await expect(taskMenu.getByRole('menuitem', { name: 'Set time', exact: true })).toBeVisible()
      await expect(
        taskMenu.getByRole('menuitem', { name: 'Manage reminders', exact: true })
      ).toBeVisible()
      await expect(taskMenu.getByRole('menuitem', { name: /Delete task/ })).toBeVisible()
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('keeps task status popovers interactive after opening the context menu', async () => {
    const vaultRoot = await createFixtureVault([createFixtureProject('project-1', 'Alpha Project')])
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openProjectHome(page)
      await page.getByRole('button', { name: 'Add new task', exact: true }).click()
      await fillNewTaskTitle(page, 'Status task')
      const taskDialog = page.getByTestId('task-center-dialog')
      await taskDialog.getByRole('button', { name: 'Save changes', exact: true }).click()
      await expect(taskDialog).toHaveCount(0)

      const taskRow = page.locator('[data-testid^="project-task-row:"]').filter({
        hasText: 'Status task'
      })
      await expect(taskRow).toBeVisible()
      const taskTestId = await taskRow.getAttribute('data-testid')
      if (!taskTestId) throw new Error('Expected task row test id')
      const taskId = taskTestId.split(':')[1]

      await taskRow.getByTestId(`project-task-menu:${taskId}`).click()
      await expect(page.getByTestId(`task-context-menu:${taskId}`)).toBeVisible()

      const statusChip = taskRow.getByTestId(`project-task-status-chip:${taskId}`)
      await statusChip.click()
      const statusPopover = page.getByRole('dialog', {
        name: 'Status for Status task options'
      })
      await expect(statusPopover).toBeVisible()
      await statusPopover.getByText('Completed', { exact: true }).click()
      await expect(statusChip).toContainText('Completed')
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('discards a new task when its title is left blank', async () => {
    const vaultRoot = await createFixtureVault([createFixtureProject('project-1', 'Alpha Project')])
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openProjectHome(page)
      const before = await page.evaluate(() => window.vaultApi.settings.get())
      await page.getByRole('button', { name: 'Add new task', exact: true }).click()

      const taskDialog = page.getByTestId('task-center-dialog')
      await expect(taskDialog.getByLabel('Task name')).toBeFocused()
      await taskDialog.getByRole('button', { name: 'Close task editor', exact: true }).click()
      await expect(taskDialog).toHaveCount(0)

      await expect
        .poll(
          async () =>
            (await page.evaluate(() => window.vaultApi.settings.get())).calendarTasks.length
        )
        .toBe(before.calendarTasks.length)
      await expect(page.locator('[data-testid^="project-task-row:"]')).toHaveCount(0)
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('filters projects by favorite and archive state and persists archive changes', async () => {
    const vaultRoot = await createFixtureVault([
      createFixtureProject('project-1', 'Alpha Project'),
      createFixtureProject('project-2', 'Archived Project', 'archived')
    ])
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await page.getByTestId('sidebar-page:projects').click()

      await expect(page.getByTestId('project-filter')).toBeVisible()
      const secondaryHeader = page.locator('[data-workspace-header-row="secondary"]')
      const secondaryHeaderLeft = secondaryHeader.locator(':scope > div').first()
      const secondaryHeaderRight = secondaryHeader.locator(':scope > div').nth(1)
      await expect(secondaryHeaderLeft.getByTestId('project-filter')).toBeVisible()
      await expect(secondaryHeaderRight.getByTestId('project-filter')).toHaveCount(0)
      await expect(page.getByTestId('all-project-row:project-1')).toBeVisible()
      await expect(page.getByTestId('all-project-row:project-2')).toHaveCount(0)

      await page.getByTestId('all-project-row:project-1').click()
      const propertiesPanel = page.getByTestId('project-properties-panel')
      const favoriteTrigger = propertiesPanel.getByTestId('project-favorite-button')
      await favoriteTrigger.click()
      const favoritePopover = page.getByRole('dialog', {
        name: 'Project favorite options'
      })
      await expect(favoritePopover).toBeVisible()
      await favoritePopover.getByRole('option', { name: 'Favorite', exact: true }).click()
      await expect(favoriteTrigger).toHaveAttribute('aria-label', 'Project favorite: Favorite')
      await page.getByTestId('projects-breadcrumb:all').click()

      await page
        .getByTestId('project-filter')
        .getByRole('tab', { name: 'Favorite', exact: true })
        .click()
      await expect(page.getByTestId('all-project-row:project-1')).toBeVisible()

      const selectProjectArchiveState = async (state: 'Active' | 'Archived'): Promise<void> => {
        await propertiesPanel.getByTestId('project-archive-button').click()
        const archivePopover = page.getByRole('dialog', {
          name: 'Project archive state options'
        })
        await expect(archivePopover).toBeVisible()
        await archivePopover.getByRole('option', { name: state, exact: true }).click()
      }

      await page
        .getByTestId('project-filter')
        .getByRole('tab', { name: 'All', exact: true })
        .click()
      await page.getByTestId('all-project-row:project-1').click()
      await selectProjectArchiveState('Archived')
      await page.getByTestId('projects-breadcrumb:all').click()
      await expect(page.getByTestId('all-project-row:project-1')).toHaveCount(0)

      await page
        .getByTestId('project-filter')
        .getByRole('tab', { name: 'Archive', exact: true })
        .click()
      await expect(page.getByTestId('all-project-row:project-1')).toBeVisible()
      await page.getByTestId('all-project-row:project-1').click()
      await expect(propertiesPanel.getByTestId('project-archive-button')).toHaveText('Archived')
      await selectProjectArchiveState('Active')
      await page.getByTestId('projects-breadcrumb:all').click()
      await expect(page.getByTestId('all-project-row:project-1')).toHaveCount(0)

      await page
        .getByTestId('project-filter')
        .getByRole('tab', { name: 'All', exact: true })
        .click()
      await page.getByTestId('all-project-row:project-1').click()
      await selectProjectArchiveState('Archived')

      await page.getByTestId('projects-breadcrumb:all').click()

      await page
        .getByTestId('project-filter')
        .getByRole('tab', { name: 'Archive', exact: true })
        .click()
      await expect(page.getByTestId('all-project-row:project-1')).toBeVisible()
      const persistedSettings = await page.evaluate(() => window.vaultApi.settings.get())
      expect(persistedSettings.projects.find((project) => project.id === 'project-1')?.state).toBe(
        'archived'
      )
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('opens task rows in the full-page editor and saves the title on close', async () => {
    const vaultRoot = await createFixtureVault([createFixtureProject('project-1', 'Alpha Project')])
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openProjectHome(page)
      await page.getByRole('button', { name: 'Add new task', exact: true }).click()
      await fillNewTaskTitle(page, 'Close saved task')
      await openTaskPageFromCenterDialog(page)

      const afterClose = await page.evaluate(() => window.vaultApi.settings.get())
      expect(afterClose.calendarTasks.some((task) => task.title === 'Close saved task')).toBe(true)

      await page
        .getByRole('navigation', { name: 'breadcrumb' })
        .getByRole('button', { name: 'Projects', exact: true })
        .click()
      await openProjectHome(page)
      const taskButton = page.getByRole('button', { name: 'Open task: Close saved task' })
      await taskButton.click()
      await openTaskPageFromCenterDialog(page)
      const descriptionEditor = page.locator('.ProseMirror').first()
      await expect(descriptionEditor).toBeVisible()
      await descriptionEditor.fill('Description saved from the full task page')
      await expect
        .poll(async () => {
          const settings = await page.evaluate(() => window.vaultApi.settings.get())
          return settings.calendarTasks
            .find((task) => task.title === 'Close saved task')
            ?.description?.trim()
        })
        .toBe('Description saved from the full task page')
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('edits the task title and saves Markdown from the task dialog', async () => {
    const project = createFixtureProject(
      'project-1',
      'A project name long enough to wrap in a chip'
    )
    const task = {
      ...createFixtureTask('task-dialog-1', 'Prepare release', 'project-1'),
      description: '# Initial description'
    }
    const vaultRoot = await createFixtureVault([project], [task])
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openProjectHome(page)
      await page.getByRole('button', { name: 'Open task: Prepare release', exact: true }).click()

      const taskDialog = page.getByTestId('task-center-dialog')
      await expect(taskDialog).toBeVisible()
      await expect(taskDialog.getByText('Edit Task', { exact: true })).toBeVisible()
      await expect(taskDialog.getByTestId('task-dialog-title')).toHaveText('Prepare release')
      await expect(taskDialog.getByTestId('task-dialog-close')).toBeVisible()
      const saveChangesButton = taskDialog.getByRole('button', {
        name: 'Save changes',
        exact: true
      })
      await expect(saveChangesButton).toContainText('Save changes')
      await expect(saveChangesButton).toHaveClass(/bg-accent/)
      await expect(taskDialog.locator('input[id^="task-title-"]')).toHaveCount(1)
      const taskTitleInput = taskDialog.getByLabel('Task name')
      await expect(taskTitleInput).toHaveValue('Prepare release')
      await expect(taskTitleInput).toHaveClass(/border-0/)
      await expect(taskTitleInput).toHaveClass(/bg-transparent/)
      await expect(taskTitleInput).toHaveClass(/hover:bg-transparent/)
      await expect(taskTitleInput).toHaveClass(/focus-visible:ring-0/)
      await expect(taskDialog.getByText('Title', { exact: true })).toHaveCount(0)
      await expect(taskDialog.getByTestId('task-description-editor')).toBeVisible()
      await expect(taskDialog.getByTestId('note-block-editor')).toHaveAttribute(
        'data-editor-density',
        'compact'
      )
      const descriptionEditor = taskDialog.locator('.ProseMirror')
      await expect(descriptionEditor).toHaveCount(1)
      await expect(descriptionEditor).toHaveCSS('padding-top', '8px')
      await expect(descriptionEditor).toHaveCSS('padding-left', '0px')
      const taskProperties = taskDialog.getByTestId('task-dialog-properties')
      await expect(taskProperties).toBeVisible()
      const propertyOrder = await taskProperties.evaluate((element) =>
        Array.from(element.children).map((child) => child.getAttribute('data-testid'))
      )
      expect(propertyOrder).toEqual([
        'task-dialog-status-chip',
        'task-dialog-task-type-chip',
        'task-dialog-priority-chip',
        'task-dialog-start-datetime-group',
        null,
        'task-dialog-end-datetime-group',
        'task-dialog-project-milestone-group',
        'task-tags-editor'
      ])
      await expect(
        taskProperties.getByTestId('task-dialog-project-milestone-group')
      ).toHaveAttribute('aria-label', 'Task project and milestone for Prepare release')
      for (const testId of [
        'task-dialog-project-milestone-group',
        'task-dialog-start-datetime-group',
        'task-dialog-end-datetime-group'
      ]) {
        const group = taskProperties.getByTestId(testId)
        await expect(group).toHaveClass(/rounded-\[var\(--radius-button-pill\)\]/)
        await expect(group).toHaveClass(/border-border/)
        await expect(group).toHaveClass(/bg-surface-subtle/)
        await expect(group).toHaveClass(/divide-x/)
        await expect(group).toHaveClass(/divide-foreground\/30/)
        await expect(group).toHaveClass(/\[&>\*:hover\]:!bg-surface-subtle-hover/)
      }
      await expect(
        taskProperties.getByTestId('task-dialog-start-datetime-group').locator('input')
      ).toHaveCount(0)
      await expect(
        taskProperties.getByTestId('task-dialog-end-datetime-group').locator('input')
      ).toHaveCount(0)
      await expect(
        taskProperties.getByTestId('task-dialog-start-datetime-group').getByRole('button')
      ).toHaveCount(2)
      await expect(
        taskProperties.getByTestId('task-dialog-end-datetime-group').getByRole('button')
      ).toHaveCount(2)
      await expect(taskProperties.getByText('→', { exact: true })).toBeVisible()
      await expect(
        taskProperties.getByRole('button', { name: 'Task start date', exact: true })
      ).toContainText('Start date')
      await expect(
        taskProperties.getByRole('button', { name: 'Task start time', exact: true })
      ).toContainText('Start time')
      await expect(
        taskProperties.getByRole('button', { name: 'Task due date', exact: true })
      ).toContainText('End date')
      await expect(
        taskProperties.getByRole('button', { name: 'Task due time', exact: true })
      ).toContainText('End time')
      await expect(
        taskProperties
          .getByRole('button', { name: 'Task start time', exact: true })
          .locator('svg.icon-tabler-clock-off')
      ).toHaveCount(1)
      await expect(
        taskProperties
          .getByRole('button', { name: 'Task due time', exact: true })
          .locator('svg.icon-tabler-clock-off')
      ).toHaveCount(1)

      const projectChip = taskProperties.getByTestId('task-dialog-project-chip')
      await expect(projectChip).toHaveClass(/whitespace-normal/)
      await expect(projectChip).toHaveClass(/border-0/)
      await expect(projectChip).toHaveClass(/bg-transparent/)
      for (const testId of [
        'task-dialog-status-chip',
        'task-dialog-task-type-chip',
        'task-dialog-project-chip',
        'task-dialog-milestone-chip',
        'task-dialog-priority-chip'
      ]) {
        await expect(taskProperties.getByTestId(testId)).toHaveClass(
          /rounded-\[var\(--radius-button-pill\)\]/
        )
      }

      const startDateTrigger = taskProperties.getByRole('button', {
        name: 'Task start date',
        exact: true
      })
      await startDateTrigger.click()
      const startDateInput = page.getByLabel('Task start date input', { exact: true })
      await expect(startDateInput).toBeFocused()
      await startDateInput.fill('14 Feb')
      await startDateInput.press('Enter')
      await expect(startDateTrigger).toContainText('Feb 14, 2026')

      const startTimeTrigger = taskProperties.getByRole('button', {
        name: 'Task start time',
        exact: true
      })
      await startTimeTrigger.click()
      const startTimeInput = page.getByLabel('Task start time input', { exact: true })
      await expect(startTimeInput).toBeFocused()
      const timeEditor = page.getByRole('dialog', { name: 'Task start time editor' })
      const timeScrollports = timeEditor.locator('[data-time-part] > div')
      await expect(timeScrollports).toHaveCount(2)
      const timeColumnMetrics = await timeEditor
        .locator('[data-time-columns="true"]')
        .locator('[data-time-part]')
        .evaluateAll((elements) => {
          const grid = elements[0]?.parentElement
          if (!(grid instanceof HTMLElement)) {
            return null
          }

          const styles = getComputedStyle(grid)
          const padding =
            Number.parseFloat(styles.paddingLeft) + Number.parseFloat(styles.paddingRight)
          const gap = Number.parseFloat(styles.columnGap)
          const widths = elements.map((element) => element.getBoundingClientRect().width)

          return {
            availableWidth: grid.clientWidth - padding,
            gap,
            widths
          }
        })
      expect(timeColumnMetrics).not.toBeNull()
      expect(timeColumnMetrics?.widths).toHaveLength(2)
      expect(
        Math.abs((timeColumnMetrics?.widths[0] ?? 0) - (timeColumnMetrics?.widths[1] ?? 0))
      ).toBeLessThanOrEqual(1)
      expect(
        Math.abs(
          (timeColumnMetrics?.widths[0] ?? 0) +
            (timeColumnMetrics?.widths[1] ?? 0) +
            (timeColumnMetrics?.gap ?? 0) -
            (timeColumnMetrics?.availableWidth ?? 0)
        )
      ).toBeLessThanOrEqual(1)
      const timeScrollportMetrics = await timeScrollports.evaluateAll((elements) =>
        elements.map((element) => {
          const scrollport = element as HTMLElement
          return {
            clientHeight: scrollport.clientHeight,
            scrollHeight: scrollport.scrollHeight,
            overflowY: getComputedStyle(scrollport).overflowY
          }
        })
      )
      expect(timeScrollportMetrics).toHaveLength(2)
      expect(
        timeScrollportMetrics.every(
          ({ clientHeight, scrollHeight, overflowY }) =>
            clientHeight >= 300 && scrollHeight > clientHeight && overflowY === 'scroll'
        )
      ).toBe(true)
      expect(
        await page.evaluate(() =>
          getComputedStyle(document.documentElement).getPropertyValue('--scrollbar-size').trim()
        )
      ).toBe('5px')
      await startTimeInput.fill('11am')
      await startTimeInput.press('Enter')
      await expect(startTimeTrigger).toContainText('11:00 AM')
      await expect(startTimeTrigger.locator('svg.icon-tabler-clock-check')).toHaveCount(1)

      await taskDialog.getByLabel('Task name').fill('Prepare launch')
      await expect(taskDialog.getByTestId('task-dialog-title')).toHaveText('Prepare launch')
      await taskDialog.locator('.ProseMirror').fill('Updated description')
      await taskDialog.getByRole('button', { name: 'Save changes', exact: true }).click()
      await expect(taskDialog).toHaveCount(0)

      await expect
        .poll(async () => {
          const settings = await page.evaluate(() => window.vaultApi.settings.get())
          return settings.calendarTasks.find((item) => item.id === task.id)?.description
        })
        .toBe('# Updated description\n')
      await expect
        .poll(async () => {
          const settings = await page.evaluate(() => window.vaultApi.settings.get())
          return settings.calendarTasks.find((item) => item.id === task.id)?.title
        })
        .toBe('Prepare launch')
      await expect
        .poll(async () => {
          const settings = await page.evaluate(() => window.vaultApi.settings.get())
          const savedTask = settings.calendarTasks.find((item) => item.id === task.id)
          return { date: savedTask?.date, time: savedTask?.time }
        })
        .toEqual({ date: '2026-02-14', time: '11:00' })
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('finishes task dialog editing with the platform primary-action shortcut', async () => {
    const project = createFixtureProject('project-1', 'Alpha Project')
    const task = {
      ...createFixtureTask('task-shortcut-1', 'Prepare release', 'project-1'),
      description: '# Initial description'
    }
    const vaultRoot = await createFixtureVault([project], [task])
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openProjectHome(page)
      await page.getByRole('button', { name: 'Open task: Prepare release', exact: true }).click()

      const taskDialog = page.getByTestId('task-center-dialog')
      const descriptionEditor = taskDialog.locator('.ProseMirror')
      await taskDialog.getByLabel('Task name').fill('Prepare launch')
      await descriptionEditor.fill('Updated description')
      await descriptionEditor.press('Enter')
      await expect(taskDialog).toBeVisible()

      await descriptionEditor.press(process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter')
      await expect(taskDialog).toHaveCount(0)
      await expect
        .poll(async () => {
          const settings = await page.evaluate(() => window.vaultApi.settings.get())
          return settings.calendarTasks.find((item) => item.id === task.id)
        })
        .toMatchObject({
          title: 'Prepare launch',
          description: '# Updated description\n\n'
        })
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('reassigns a linked task from the project detail view', async () => {
    const vaultRoot = await createFixtureVault([
      createFixtureProject('project-1', 'Alpha Project'),
      createFixtureProject('project-2', 'Beta Project')
    ])
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await openProjectHome(page)
      await page.getByRole('button', { name: 'Add new task', exact: true }).click()
      await fillNewTaskTitle(page, 'Shared task')
      await openTaskPageFromCenterDialog(page)
      await page
        .getByRole('navigation', { name: 'breadcrumb' })
        .getByRole('button', { name: 'Projects', exact: true })
        .click()
      await openProjectHome(page)
      await expect(page.getByRole('button', { name: 'Open task: Shared task' })).toBeVisible()

      const statusChip = page.getByRole('button', { name: /Status for Shared task:/ })
      await statusChip.click()
      await page
        .getByRole('dialog', { name: 'Status for Shared task options' })
        .getByText('Blocked', { exact: true })
        .click()

      await statusChip.click()
      await page
        .getByRole('dialog', { name: 'Status for Shared task options' })
        .getByText('Backlog', { exact: true })
        .click()

      await page.getByRole('button', { name: 'Open task: Shared task' }).click()
      await openTaskPageFromCenterDialog(page)
      const taskProject = page.getByRole('button', {
        name: /Task project for Shared task:/
      })
      await taskProject.click()
      await page
        .getByRole('dialog', { name: 'Task project for Shared task options' })
        .getByText('Beta Project', { exact: true })
        .click()
      await page
        .getByRole('navigation', { name: 'breadcrumb' })
        .getByRole('button', { name: 'Projects', exact: true })
        .click()
      await openProjectHome(page, 'project-2')
      await expect(page.getByRole('heading', { name: 'No tasks in this project' })).toHaveCount(0)

      await expect(page.getByRole('button', { name: 'Open task: Shared task' })).toBeVisible()
      await expect(page.locator('[data-testid^="project-task-project-chip:"]')).toHaveCount(0)
      const persistedSettings = await page.evaluate(() => window.vaultApi.settings.get())
      const persistedTask = persistedSettings.calendarTasks.find(
        (task) => task.title === 'Shared task'
      )
      expect(persistedTask?.status).toBe('backlog')
      expect(persistedTask?.projectId).toBe('project-2')
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })
})
