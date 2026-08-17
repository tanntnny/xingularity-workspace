import { test, expect, Page } from '@playwright/test'
import { _electron as electron, ElectronApplication } from 'playwright'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { Project } from '../src/shared/types'

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

async function createFixtureVault(projects: Project[]): Promise<string> {
  const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-project-page-e2e-vault-'))
  await fs.mkdir(path.join(rootPath, 'notebooks'), { recursive: true })
  await fs.mkdir(path.join(rootPath, 'attachments'), { recursive: true })
  await fs.writeFile(
    path.join(rootPath, 'projects.json'),
    JSON.stringify(projects, null, 2),
    'utf-8'
  )
  return rootPath
}

async function launchWithFixture(vaultRoot: string): Promise<{
  electronApp: ElectronApplication
  page: Page
}> {
  const electronApp = await electron.launch({
    args: ['.'],
    cwd: process.cwd(),
    env: {
      ...process.env,
      CI: '1'
    }
  })

  const userDataPath = await electronApp.evaluate(({ app }) => app.getPath('userData'))
  await fs.mkdir(userDataPath, { recursive: true })
  await fs.writeFile(
    path.join(userDataPath, 'settings.json'),
    JSON.stringify({ lastVaultPath: vaultRoot }, null, 2),
    'utf-8'
  )

  const page = await electronApp.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  await expect(page.getByTestId('sidebar-page:projects')).toBeVisible({ timeout: 20_000 })
  return { electronApp, page }
}

async function openTaskPageFromCenterDialog(page: Page): Promise<void> {
  const taskDialog = page.getByTestId('task-center-dialog')
  await expect(taskDialog).toBeVisible()
  await expect(taskDialog.locator('.ProseMirror')).toHaveCount(0)
  await taskDialog.getByRole('button', { name: 'Open full page', exact: true }).click()
  await expect(page.getByTestId('task-page')).toBeVisible()
}

test.describe('projects workspace', () => {
  test('opens directly to the linked-task project detail view', async () => {
    const vaultRoot = await createFixtureVault([
      createFixtureProject('project-1', 'Alpha Project'),
      createFixtureProject('project-2', 'Beta Project')
    ])
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await page.getByTestId('sidebar-page:projects').click()

      await expect(page.getByTestId('projects-workspace-sidebar')).toBeVisible()
      const workspaceTab = page.getByTestId('workspace-tab:workspace-tab-1')
      await expect(workspaceTab).toContainText('Alpha Project')
      await expect(page.getByTestId('workspace-tab-icon:workspace-tab-1')).toBeVisible()
      await expect(page.getByTestId('projects-sidebar-item:project-1')).toBeVisible()
      await expect(page.getByTestId('projects-sidebar-item:project-2')).toBeVisible()
      await expect(page.getByLabel('Project name')).toHaveValue('Alpha Project')
      const projectDescription = page.getByLabel('Project description')
      const descriptionStyles = await projectDescription.evaluate((element) => {
        const styles = window.getComputedStyle(element)
        return {
          borderTopWidth: styles.borderTopWidth,
          borderTopLeftRadius: styles.borderTopLeftRadius
        }
      })
      expect(Number.parseFloat(descriptionStyles.borderTopWidth)).toBeGreaterThan(0)
      expect(Number.parseFloat(descriptionStyles.borderTopLeftRadius)).toBeGreaterThan(0)
      await expect(page.getByTestId('project-main-detail-header')).toBeVisible()
      await expect(page.getByTestId('project-main-detail-actions')).toHaveCount(0)
      await expect(page.getByTestId('project-main-detail-icon-row')).toBeVisible()
      await expect(page.getByTestId('project-main-detail-name-row')).toBeVisible()
      await expect(page.getByTestId('project-main-detail-description-row')).toBeVisible()
      await expect(page.getByTestId('project-workspace-header-actions')).toBeVisible()
      await expect(page.getByTestId('projects-list-panel')).toBeVisible()
      await expect(page.getByTestId('project-properties-panel')).toBeVisible()
      const projectListBox = await page.getByTestId('projects-list-panel').boundingBox()
      const projectPropertiesBox = await page.getByTestId('project-properties-panel').boundingBox()
      const projectActionsBox = await page
        .getByTestId('project-workspace-header-actions')
        .boundingBox()
      const newProjectBox = await page.getByTestId('new-project-button').boundingBox()
      if (!projectListBox || !projectPropertiesBox || !projectActionsBox || !newProjectBox) {
        throw new Error('Expected project panels and actions to have layout boxes')
      }
      expect(projectPropertiesBox.y).toBeGreaterThan(projectListBox.y + projectListBox.height)
      expect(projectActionsBox.x).toBeGreaterThanOrEqual(newProjectBox.x + newProjectBox.width)
      await expect(page.getByRole('heading', { name: 'Project Tasks' })).toBeVisible()
      await expect(page.getByText('Project Board')).toHaveCount(0)
      await expect(page.getByText('Task List')).toHaveCount(0)

      await page.getByTestId('workspace-tab-add').click()
      const secondWorkspaceTab = page.getByTestId('workspace-tab:workspace-tab-2')
      await expect(secondWorkspaceTab).toBeVisible()
      await page.getByTestId('sidebar-page:projects').click()
      await expect(secondWorkspaceTab).toContainText('Alpha Project')
      await page.getByTestId('projects-sidebar-item:project-2').click()
      await expect(secondWorkspaceTab).toContainText('Beta Project')

      await workspaceTab.click()
      await expect(page.getByLabel('Project name')).toHaveValue('Alpha Project')
      await expect(workspaceTab).toContainText('Alpha Project')

      await page.getByTestId('projects-sidebar-item:project-2').click()
      await expect(page.getByLabel('Project name')).toHaveValue('Beta Project')
      await expect(workspaceTab).toContainText('Beta Project')
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

      const iconTrigger = page.getByTestId('project-main-detail-icon-trigger')
      await iconTrigger.click()

      const popover = page.getByRole('dialog', { name: 'Choose project icon' })
      await expect(popover).toBeVisible()
      await expect(popover.getByPlaceholder('Search icon names...')).toBeVisible()
      await expect(popover.locator('[role="separator"]')).toHaveCount(2)
      await expect(popover.getByText('Color', { exact: true })).toBeVisible()

      await popover.getByPlaceholder('Search icon names...').fill('rocket')
      await expect(popover.getByTestId('project-icon-option:rocket')).toBeVisible()
      await expect(popover.getByTestId('project-icon-option:briefcase')).toHaveCount(0)

      await popover.getByTestId('project-icon-option:rocket').click()
      await expect(popover).toBeVisible()
      await expect(popover.getByTestId('project-icon-option:rocket')).toHaveAttribute(
        'data-current',
        'true'
      )

      const colorOption = popover.getByRole('button', {
        name: 'Select #db2777 icon color'
      })
      await colorOption.click()
      await expect(popover).toBeVisible()
      await expect(popover.getByTestId('project-icon-option:rocket')).toHaveAttribute(
        'data-current',
        'true'
      )
      await expect(
        popover.getByRole('button', { name: 'Select #db2777 icon color' })
      ).toHaveAttribute('data-state', 'on')
      await page.keyboard.press('Escape')

      await page.reload()
      await expect(page.getByTestId('sidebar-page:projects')).toBeVisible({ timeout: 20_000 })
      await page.getByTestId('sidebar-page:projects').click()
      await page.getByTestId('project-main-detail-icon-trigger').click()
      const afterReloadPopover = page.getByRole('dialog', { name: 'Choose project icon' })
      await expect(afterReloadPopover.getByTestId('project-icon-option:rocket')).toHaveAttribute(
        'data-current',
        'true'
      )
      await expect(
        afterReloadPopover.getByRole('button', { name: 'Select #db2777 icon color' })
      ).toHaveAttribute('data-state', 'on')
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('collapses project right-panel sections independently', async () => {
    const vaultRoot = await createFixtureVault([createFixtureProject('project-1', 'Alpha Project')])
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await page.getByTestId('sidebar-page:projects').click()

      const projectListPanel = page.getByTestId('projects-list-panel')
      const projectPropertiesPanel = page.getByTestId('project-properties-panel')
      const projectListToggle = projectListPanel.getByRole('button', {
        name: 'Project list',
        exact: true
      })
      const projectPropertiesToggle = projectPropertiesPanel.getByRole('button', {
        name: 'Project properties',
        exact: true
      })
      const projectPropertiesFavorite = projectPropertiesPanel.getByTestId(
        'project-property-favorite'
      )

      await expect(projectListToggle).toHaveAttribute('aria-expanded', 'true')
      await expect(projectPropertiesToggle).toHaveAttribute('aria-expanded', 'true')

      await projectListToggle.focus()
      await projectListToggle.press('Space')
      await expect(projectListToggle).toHaveAttribute('aria-expanded', 'false')
      await expect(page.getByTestId('projects-sidebar-item:project-1')).toBeHidden()
      await expect(projectPropertiesFavorite).toBeVisible()

      await projectPropertiesToggle.focus()
      await projectPropertiesToggle.press('Enter')
      await expect(projectPropertiesToggle).toHaveAttribute('aria-expanded', 'false')
      await expect(projectPropertiesFavorite).toBeHidden()

      await projectListToggle.focus()
      await projectListToggle.press('Enter')
      await expect(page.getByTestId('projects-sidebar-item:project-1')).toBeVisible()
      await expect(projectPropertiesToggle).toHaveAttribute('aria-expanded', 'false')

      await projectPropertiesToggle.focus()
      await projectPropertiesToggle.press('Space')
      await expect(projectPropertiesStatus).toBeVisible()
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('edits project properties from the main detail and right panel', async () => {
    const vaultRoot = await createFixtureVault([createFixtureProject('project-1', 'Alpha Project')])
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await page.getByTestId('sidebar-page:projects').click()
      const propertiesPanel = page.getByTestId('project-properties-panel')

      await propertiesPanel.getByTestId('project-status-chip').click()
      await page.getByRole('dialog').getByRole('radio', { name: 'Blocked', exact: true }).click()
      await propertiesPanel.getByTestId('project-favorite-button').click()
      await expect(propertiesPanel.getByTestId('project-favorite-button')).toHaveAttribute(
        'aria-pressed',
        'true'
      )
      const mainDetail = page.getByTestId('project-main-detail-panel')
      await mainDetail.getByRole('button', { name: 'Add tag', exact: true }).click()
      await mainDetail.getByLabel('Add tag').press('Escape')
      await expect(mainDetail.getByLabel('Add tag')).toHaveCount(0)
      await mainDetail.getByRole('button', { name: 'Add tag', exact: true }).click()
      await mainDetail.getByLabel('Add tag').fill('launch')
      await mainDetail.getByLabel('Add tag').press('Enter')
      await mainDetail.getByRole('button', { name: 'Add resource', exact: true }).click()
      await mainDetail.getByLabel('Add resource').fill('GitHub')
      await mainDetail.getByLabel('Add resource').press('Enter')

      await expect(mainDetail.getByTestId('project-main-detail-tags-row')).toContainText('launch')
      await expect(mainDetail.getByTestId('project-main-detail-resources-row')).toContainText(
        'GitHub'
      )

      const persistedSettings = await page.evaluate(() => window.vaultApi.settings.get())
      const persistedProject = persistedSettings.projects.find(
        (project) => project.id === 'project-1'
      )
      expect(persistedProject?.status).toBe('blocked')
      expect(persistedProject?.tags).toEqual(['launch'])
      expect(persistedProject?.resources).toEqual(['GitHub'])
      expect(persistedSettings.favoriteProjectIds).toContain('project-1')
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
      await expect(page.getByLabel('Project description')).toHaveValue('Add project details here.')
      await expect(page.getByLabel('Name')).toHaveCount(0)
      await expect(page.getByRole('button', { name: 'Create', exact: true })).toHaveCount(0)
      await page.getByRole('button', { name: 'Add new task', exact: true }).click()
      await openTaskPageFromCenterDialog(page)
      const taskPage = page.getByTestId('task-page')
      const newTaskTitle = taskPage.getByRole('button', { name: 'New Task', exact: true })
      await newTaskTitle.click()
      const taskTitleInput = taskPage.locator('input[type="text"]').first()
      await taskTitleInput.fill('Prepare launch notes')
      await taskTitleInput.press('Enter')

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
      expect(tagsBox.y).toBeLessThan(projectBox.y)

      await taskTags.getByRole('button', { name: 'Add tag', exact: true }).click()
      const tagInput = taskTags.getByLabel('Add tag')
      await tagInput.fill('release')
      await tagInput.press('Enter')
      await tagInput.fill('project:alpha')
      await tagInput.press('Enter')
      await expect(taskTags).toContainText('release')
      await expect(taskTags).toContainText('project:alpha')

      const settingsWhileEditing = await page.evaluate(() => window.vaultApi.settings.get())
      expect(
        settingsWhileEditing.calendarTasks.some((task) => task.title === 'Prepare launch notes')
      ).toBe(true)
      await page
        .getByRole('navigation', { name: 'breadcrumb' })
        .getByRole('button', { name: 'Projects', exact: true })
        .click()
      const taskOpenButton = page.getByRole('button', { name: 'Open task: Prepare launch notes' })
      await expect(taskOpenButton).toBeVisible()
      await taskOpenButton.click()
      await openTaskPageFromCenterDialog(page)
      const editTaskTags = page.getByTestId('task-tags-editor')
      await expect(editTaskTags.getByRole('button', { name: 'Remove tag release' })).toBeVisible()
      await editTaskTags.getByRole('button', { name: 'Remove tag release' }).click()
      await page
        .getByRole('navigation', { name: 'breadcrumb' })
        .getByRole('button', { name: 'Projects', exact: true })
        .click()
      await expect(page.getByLabel('Project name')).toHaveValue('Untitled Project')

      await page.getByTestId('new-project-button').click()
      await expect(page.getByLabel('Project name')).toHaveValue('Untitled Project 2')
      const projectSidebar = page.getByTestId('projects-workspace-sidebar')
      await expect(projectSidebar.getByText('Untitled Project', { exact: true })).toBeVisible()
      await expect(projectSidebar.getByText('Untitled Project 2', { exact: true })).toBeVisible()
      await projectSidebar.getByText('Untitled Project', { exact: true }).click()
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
      expect(persistedProject?.description).toBe('Add project details here.')
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

  test('creates grouped milestones, derives completeness, and moves tasks on delete', async () => {
    const vaultRoot = await createFixtureVault([createFixtureProject('project-1', 'Alpha Project')])
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await page.getByTestId('sidebar-page:projects').click()
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
      await milestoneRow.locator('input').fill('Release candidate')
      await milestoneRow.locator('input').press('Enter')
      await expect(
        milestoneRow.getByRole('button', { name: 'Release candidate', exact: true })
      ).toBeVisible()

      await milestoneRow.getByTestId(`project-milestone-add-task-icon:${milestoneId}`).click()
      await openTaskPageFromCenterDialog(page)
      const taskPage = page.getByTestId('task-page')
      await taskPage.getByRole('button', { name: 'New Task', exact: true }).click()
      const taskTitleInput = taskPage.locator('input[type="text"]').first()
      await taskTitleInput.fill('Prepare release')
      await taskTitleInput.press('Enter')
      await expect(page.getByTestId('task-property-milestone')).toContainText('Release candidate')
      await page
        .getByRole('navigation', { name: 'breadcrumb' })
        .getByRole('button', { name: 'Projects', exact: true })
        .click()

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
      await page.getByRole('option', { name: 'Completed' }).click()
      await page
        .getByRole('navigation', { name: 'breadcrumb' })
        .getByRole('button', { name: 'Projects', exact: true })
        .click()
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

  test('opens milestone and task context menus from project rows', async () => {
    const vaultRoot = await createFixtureVault([createFixtureProject('project-1', 'Alpha Project')])
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await page.getByTestId('sidebar-page:projects').click()
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
      await openTaskPageFromCenterDialog(page)
      const taskPage = page.getByTestId('task-page')
      await taskPage.getByRole('button', { name: 'New Task', exact: true }).click()
      const taskTitleInput = taskPage.locator('input[type="text"]').first()
      await taskTitleInput.fill('Prepare release')
      await taskTitleInput.press('Enter')
      await page
        .getByRole('navigation', { name: 'breadcrumb' })
        .getByRole('button', { name: 'Projects', exact: true })
        .click()

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
      await page.getByTestId('sidebar-page:projects').click()
      await page.getByRole('button', { name: 'Add new task', exact: true }).click()

      const taskRow = page.locator('[data-testid^="project-task-row:"]').filter({
        hasText: 'New Task'
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
        name: 'Status for New Task options'
      })
      await expect(statusPopover).toBeVisible()
      await statusPopover.getByText('Completed', { exact: true }).click()
      await expect(statusChip).toContainText('Completed')
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
      await expect(page.getByTestId('projects-sidebar-item:project-1')).toBeVisible()
      await expect(page.getByTestId('projects-sidebar-item:project-2')).toHaveCount(0)

      await page
        .getByTestId('project-filter')
        .getByRole('radio', { name: 'Favorite', exact: true })
        .click()
      await expect(page.getByTestId('projects-sidebar-item:project-1')).toHaveCount(0)

      await page
        .getByTestId('project-filter')
        .getByRole('radio', { name: 'All', exact: true })
        .click()
      const propertiesPanel = page.getByTestId('project-properties-panel')
      await propertiesPanel.getByTestId('project-favorite-button').click()
      await expect(propertiesPanel.getByTestId('project-favorite-button')).toHaveAttribute(
        'aria-pressed',
        'true'
      )
      await page
        .getByTestId('project-filter')
        .getByRole('radio', { name: 'Favorite', exact: true })
        .click()
      await expect(page.getByTestId('projects-sidebar-item:project-1')).toBeVisible()

      await page
        .getByTestId('project-filter')
        .getByRole('radio', { name: 'All', exact: true })
        .click()
      await propertiesPanel.getByTestId('project-archive-button').click()
      await expect(page.getByTestId('projects-sidebar-item:project-1')).toHaveCount(0)

      await page
        .getByTestId('project-filter')
        .getByRole('radio', { name: 'Archive', exact: true })
        .click()
      await expect(page.getByTestId('projects-sidebar-item:project-1')).toBeVisible()
      await page.getByTestId('projects-sidebar-item:project-1').click()
      await expect(propertiesPanel.getByTestId('project-archive-button')).toHaveText('Archived')
      await expect(propertiesPanel.getByTestId('project-archive-button')).toHaveAttribute(
        'aria-pressed',
        'true'
      )
      await propertiesPanel.getByTestId('project-archive-button').click()
      await expect(page.getByTestId('projects-sidebar-item:project-1')).toHaveCount(0)

      await page
        .getByTestId('project-filter')
        .getByRole('radio', { name: 'All', exact: true })
        .click()
      await page.getByTestId('projects-sidebar-item:project-1').click()
      await page.getByTestId('project-archive-button').click()

      await expect(page.getByTestId('projects-sidebar-item:project-1')).toHaveCount(0)
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
      await page.getByTestId('sidebar-page:projects').click()
      await page.getByRole('button', { name: 'Add new task', exact: true }).click()
      await openTaskPageFromCenterDialog(page)

      const taskPage = page.getByTestId('task-page')
      await taskPage.getByRole('button', { name: 'New Task', exact: true }).click()
      const titleInput = taskPage.locator('input[type="text"]').first()
      await titleInput.fill('Close saved task')
      await titleInput.press('Enter')

      const afterClose = await page.evaluate(() => window.vaultApi.settings.get())
      expect(afterClose.calendarTasks.some((task) => task.title === 'Close saved task')).toBe(true)

      await page
        .getByRole('navigation', { name: 'breadcrumb' })
        .getByRole('button', { name: 'Projects', exact: true })
        .click()
      const taskButton = page.getByRole('button', { name: 'Open task: Close saved task' })
      await taskButton.click()
      await openTaskPageFromCenterDialog(page)
      const descriptionEditor = page.locator('.ProseMirror').first()
      await expect(descriptionEditor).toBeVisible()
      await descriptionEditor.fill('Description saved from the full task page')
      await expect
        .poll(async () => {
          const settings = await page.evaluate(() => window.vaultApi.settings.get())
          return settings.calendarTasks.find((task) => task.title === 'Close saved task')
            ?.description
        })
        .toBe('Description saved from the full task page')
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
      await page.getByTestId('sidebar-page:projects').click()
      await page.getByRole('button', { name: 'Add new task', exact: true }).click()
      await openTaskPageFromCenterDialog(page)
      const taskPage = page.getByTestId('task-page')
      await taskPage.getByRole('button', { name: 'New Task', exact: true }).click()
      const newTaskTitle = taskPage.locator('input[type="text"]').first()
      await newTaskTitle.fill('Shared task')
      await newTaskTitle.press('Enter')
      await page
        .getByRole('navigation', { name: 'breadcrumb' })
        .getByRole('button', { name: 'Projects', exact: true })
        .click()
      await expect(page.getByRole('button', { name: 'Open task: Shared task' })).toBeVisible()

      const statusChip = page.getByRole('button', { name: /Status for Shared task:/ })
      await statusChip.click()
      await page
        .getByRole('dialog', { name: 'Status for Shared task options' })
        .getByRole('radio', { name: 'Blocked', exact: true })
        .click()

      await statusChip.click()
      await page
        .getByRole('dialog', { name: 'Status for Shared task options' })
        .getByRole('radio', { name: 'Backlog', exact: true })
        .click()

      await page.getByRole('button', { name: 'Open task: Shared task' }).click()
      await openTaskPageFromCenterDialog(page)
      const taskProject = page.getByTestId('task-property-project').getByRole('button')
      await taskProject.click()
      await page.getByRole('option', { name: 'Beta Project', exact: true }).click()
      await page
        .getByRole('navigation', { name: 'breadcrumb' })
        .getByRole('button', { name: 'Projects', exact: true })
        .click()
      await expect(page.getByRole('heading', { name: 'No tasks in this project' })).toHaveCount(0)

      await page.getByTestId('projects-sidebar-item:project-2').click()
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
