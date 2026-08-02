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
    status: 'on-track',
    updatedAt: '2026-04-02T00:00:00.000Z',
    progress: 0,
    milestones: [],
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
      await expect(page.getByTestId('projects-sidebar-item:project-1')).toBeVisible()
      await expect(page.getByTestId('projects-sidebar-item:project-2')).toBeVisible()
      await expect(page.getByLabel('Project name')).toHaveValue('Alpha Project')
      await expect(page.getByTestId('project-detail-header')).toBeVisible()
      await expect(page.getByTestId('project-detail-icon-row')).toBeVisible()
      await expect(page.getByTestId('project-detail-name-row')).toBeVisible()
      await expect(page.getByTestId('project-detail-description-row')).toBeVisible()
      await expect(page.getByTestId('project-detail-header-actions')).toBeVisible()
      await expect(page.getByTestId('projects-list-panel')).toBeVisible()
      await expect(page.getByTestId('project-properties-panel')).toBeVisible()
      const projectListBox = await page.getByTestId('projects-list-panel').boundingBox()
      const projectPropertiesBox = await page.getByTestId('project-properties-panel').boundingBox()
      const projectActionsBox = await page
        .getByTestId('project-detail-header-actions')
        .boundingBox()
      if (!projectListBox || !projectPropertiesBox || !projectActionsBox) {
        throw new Error('Expected project panels and actions to have layout boxes')
      }
      expect(projectPropertiesBox.y).toBeGreaterThan(projectListBox.y + projectListBox.height)
      expect(projectActionsBox.x).toBeGreaterThanOrEqual(projectPropertiesBox.x)
      expect(projectActionsBox.x + projectActionsBox.width).toBeLessThanOrEqual(
        projectPropertiesBox.x + projectPropertiesBox.width
      )
      await expect(page.getByText('Tasks')).toBeVisible()
      await expect(page.getByText('Project Board')).toHaveCount(0)
      await expect(page.getByText('Task List')).toHaveCount(0)

      await page.getByTestId('projects-sidebar-item:project-2').click()
      await expect(page.getByLabel('Project name')).toHaveValue('Beta Project')
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
      await page.getByRole('button', { name: 'New Project', exact: true }).click()
      await page.getByLabel('Name').fill('Gamma Project')
      await page.getByLabel('Description').fill('A linked-task project')
      await page.getByRole('button', { name: 'Create', exact: true }).click()

      await expect(page.getByLabel('Project name')).toHaveValue('Gamma Project')
      await page.getByLabel('New task title').fill('Prepare launch notes')
      await page.getByRole('button', { name: 'Add task', exact: true }).click()

      await expect(page.getByLabel('Task title: Prepare launch notes')).toHaveValue(
        'Prepare launch notes'
      )
      await expect(page.getByLabel('Project name')).toHaveValue('Gamma Project')

      await page.getByRole('button', { name: 'New Project', exact: true }).click()
      await page.getByLabel('Name').fill('Delta Project')
      await page.getByRole('button', { name: 'Create', exact: true }).click()
      await expect(page.getByLabel('Project name')).toHaveValue('Delta Project')
      const projectSidebar = page.getByTestId('projects-workspace-sidebar')
      await expect(projectSidebar.getByText('Gamma Project', { exact: true })).toBeVisible()
      await expect(projectSidebar.getByText('Delta Project', { exact: true })).toBeVisible()
      await projectSidebar.getByText('Gamma Project', { exact: true }).click()
      await expect(page.getByLabel('Project name')).toHaveValue('Gamma Project')
      await expect(page.getByLabel('Task title: Prepare launch notes')).toBeVisible()

      const persistedSettings = await page.evaluate(() => window.vaultApi.settings.get())
      const persistedProject = persistedSettings.projects.find(
        (project) => project.name === 'Gamma Project'
      )
      expect(persistedProject).toBeDefined()
      expect(persistedSettings.projects.some((project) => project.name === 'Delta Project')).toBe(
        true
      )
      expect(
        persistedSettings.calendarTasks.some(
          (task) =>
            task.title === 'Prepare launch notes' && task.projectId === persistedProject?.id
        )
      ).toBe(true)
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

      await page.getByRole('button', { name: 'Favorite', exact: true }).click()
      await expect(page.getByTestId('projects-sidebar-item:project-1')).toHaveCount(0)

      await page.getByRole('button', { name: 'All', exact: true }).click()
      await page.getByRole('button', { name: 'Add favorite', exact: true }).click()
      await page.getByRole('button', { name: 'Favorite', exact: true }).click()
      await expect(page.getByTestId('projects-sidebar-item:project-1')).toBeVisible()

      await page.getByRole('button', { name: 'Archive', exact: true }).click()
      await expect(page.getByTestId('projects-sidebar-item:project-2')).toBeVisible()
      await expect(page.getByLabel('Project name')).toHaveValue('Archived Project')

      await page.getByRole('button', { name: 'Unarchive project', exact: true }).click()
      await expect(page.getByTestId('projects-sidebar-item:project-2')).toHaveCount(0)

      await page.getByRole('button', { name: 'All', exact: true }).click()
      await page.getByTestId('projects-sidebar-item:project-1').click()
      await page.getByRole('button', { name: 'Archive project', exact: true }).click()

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

  test('reassigns a linked task from the project detail view', async () => {
    const vaultRoot = await createFixtureVault([
      createFixtureProject('project-1', 'Alpha Project'),
      createFixtureProject('project-2', 'Beta Project')
    ])
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await page.getByTestId('sidebar-page:projects').click()
      await page.getByLabel('New task title').fill('Shared task')
      await page.getByRole('button', { name: 'Add task', exact: true }).click()
      await expect(page.getByLabel('Task title: Shared task')).toBeVisible()

      await page.getByLabel('Project for Shared task').click()
      await page.getByRole('option', { name: 'Beta Project' }).click()
      await expect(page.getByText('No tasks in this project')).toBeVisible()

      await page.getByTestId('projects-sidebar-item:project-2').click()
      await expect(page.getByLabel('Task title: Shared task')).toBeVisible()
      await expect(page.getByLabel('Project for Shared task')).toHaveText('Beta Project')
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })
})
