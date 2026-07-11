import { test, expect, Page } from '@playwright/test'
import { _electron as electron, ElectronApplication } from 'playwright'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  createStoredNoteDocumentFromText,
  serializeStoredNoteDocument
} from '../src/shared/noteDocument'

interface FixtureProject {
  id: string
  name: string
  summary: string
  status: 'on-track' | 'at-risk' | 'off-track' | 'completed'
  updatedAt: string
  progress: number
  milestones: Array<{
    id: string
    title: string
    description: string
    dueDate: string
    priority: 'low' | 'medium' | 'high'
    status: 'pending' | 'in-progress' | 'completed'
    subtasks: Array<{
      id: string
      title: string
      description: string
      completed: boolean
      priority: 'low' | 'medium' | 'high'
      createdAt: string
      dueDate: string
    }>
  }>
  icon: {
    shape: 'circle' | 'square'
    variant: 'filled'
    color: string
  }
}

function buildDefaultFixtureProjects(): FixtureProject[] {
  return [
    {
      id: 'project-1',
      name: 'Alpha Project',
      summary: '',
      status: 'on-track',
      updatedAt: '2026-04-02T00:00:00.000Z',
      progress: 25,
      milestones: [
        {
          id: 'milestone-1',
          title: 'Launch',
          description: '',
          dueDate: '2026-07-10',
          priority: 'high',
          status: 'pending',
          subtasks: [
            {
              id: 'subtask-1',
              title: 'Write copy',
              description: '',
              completed: false,
              priority: 'medium',
              createdAt: '2026-07-01T00:00:00.000Z',
              dueDate: '2026-07-09'
            }
          ]
        }
      ],
      icon: {
        shape: 'circle',
        variant: 'filled',
        color: '#000000'
      }
    },
    {
      id: 'project-2',
      name: 'Beta Project',
      summary: '',
      status: 'on-track',
      updatedAt: '2026-04-03T00:00:00.000Z',
      progress: 0,
      milestones: [],
      icon: {
        shape: 'square',
        variant: 'filled',
        color: '#2563eb'
      }
    }
  ]
}

function buildScrollableBoardProjects(count: number): FixtureProject[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `project-${index + 1}`,
    name: `Project ${index + 1}`,
    summary: `Board card ${index + 1}`,
    status: 'on-track',
    updatedAt: `2026-04-${String((index % 28) + 1).padStart(2, '0')}T00:00:00.000Z`,
    progress: (index * 7) % 100,
    milestones: [],
    icon: {
      shape: index % 2 === 0 ? 'circle' : 'square',
      variant: 'filled',
      color: index % 2 === 0 ? '#000000' : '#2563eb'
    }
  }))
}

async function createFixtureVault(
  projects: FixtureProject[] = buildDefaultFixtureProjects()
): Promise<string> {
  const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-project-page-e2e-vault-'))
  await fs.mkdir(path.join(rootPath, 'notebooks', 'Projects', 'Alpha Project'), {
    recursive: true
  })
  await fs.mkdir(path.join(rootPath, 'notebooks', 'Projects', 'Beta Project'), {
    recursive: true
  })
  await fs.mkdir(path.join(rootPath, 'attachments'), { recursive: true })

  await fs.writeFile(
    path.join(rootPath, 'notebooks', 'Projects', 'Alpha Project', 'in-folder.md'),
    serializeStoredNoteDocument(createStoredNoteDocumentFromText('Inside folder\n')),
    'utf-8'
  )
  await fs.writeFile(
    path.join(rootPath, 'notebooks', 'outside-note.md'),
    serializeStoredNoteDocument(createStoredNoteDocumentFromText('Outside note\n')),
    'utf-8'
  )
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
  test('shows the board shell, supports board controls, and opens the project drawer from the board', async () => {
    const vaultRoot = await createFixtureVault()
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await page.getByTestId('sidebar-page:projects').click()
      await expect(page.getByTestId('sidebar-page:projects')).toHaveAttribute('data-active', 'true')

      await expect(page.getByText('Alpha Project').first()).toBeVisible()
      await expect(page.getByText('Project Board')).toBeVisible()
      await expect(page.getByText('Task List')).toBeVisible()
      await expect(page.getByText('Project Notes')).toHaveCount(0)

      await page.getByText('Project Board').click()
      const boardShell = page.getByTestId('projects-board-shell')
      await expect(boardShell).toBeVisible()
      await expect(page.getByTestId('projects-board-toolbar')).toBeVisible()
      await expect(page.getByTestId('project-board-group:status:on-track')).toBeVisible()
      await expect(page.getByTestId('project-board-group:status:completed')).toBeVisible()

      await page.getByRole('button', { name: 'Board grouping: Group by Status' }).click()
      await page.getByRole('menuitemradio', { name: 'Group by Recent Activity' }).click()
      await expect(page.getByTestId('project-board-group:updatedAt:today')).toBeVisible()
      await expect(page.getByTestId('project-board-group:updatedAt:older')).toBeVisible()

      await page.getByText('Favorites').click()
      await expect(boardShell.locator('article').filter({ hasText: 'Alpha Project' })).toHaveCount(
        0
      )

      await page.getByText('All').click()
      await page.getByRole('button', { name: 'Board grouping: Group by Recent Activity' }).click()
      await page.getByRole('menuitemradio', { name: 'Group by Status' }).click()

      await boardShell
        .locator('article')
        .filter({ hasText: 'Alpha Project' })
        .first()
        .locator('button')
        .first()
        .click()
      await expect(page.getByText('Edit project details and workspace actions.')).toBeVisible()
      const drawer = page.getByRole('dialog')
      await expect(drawer.getByRole('button', { name: 'Close', exact: true })).toHaveCount(0)
      await drawer.getByLabel('Project name').fill('Alpha Project Updated')
      await page.keyboard.press('Escape')
      await expect(page.getByText('Edit project details and workspace actions.')).toHaveCount(0)
      await expect(page.getByText('Alpha Project Updated').first()).toBeVisible()

      await boardShell
        .locator('article')
        .filter({ hasText: 'Alpha Project Updated' })
        .first()
        .locator('button')
        .first()
        .click()
      await expect(drawer.getByLabel('Project name')).toHaveValue('Alpha Project Updated')
      await page.keyboard.press('Escape')

      await page.getByText('Task List').click()
      await expect(page.getByText('No project work matches the current filter.')).toHaveCount(0)
      await expect(page.getByRole('button', { name: /Alpha Project .*items/ })).toBeVisible()
      await expect(page.getByRole('button', { name: /Beta Project .*items/ })).toBeVisible()
      await expect(
        page.getByRole('button', { name: 'Add milestone to Beta Project' })
      ).toBeVisible()
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('shows task-list create rows in project and due-date grouping', async () => {
    const vaultRoot = await createFixtureVault()
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await page.getByTestId('sidebar-page:projects').click()
      await page.getByText('Task List').click()

      await expect(page.getByRole('button', { name: 'Add subtask to Launch' })).toBeVisible()
      await expect(page.getByRole('button', { name: /Add milestone to/ })).toHaveCount(2)

      await page.getByRole('button', { name: 'Add milestone to Beta Project' }).click()
      await expect(page.getByText('Add a milestone to Beta Project.')).toBeVisible()
      await page.getByRole('button', { name: 'Cancel' }).click()

      await page.getByRole('button', { name: 'Add subtask to Launch' }).click()
      await expect(page.getByText('Add a subtask to Launch.')).toBeVisible()
      await page.getByRole('button', { name: 'Cancel' }).click()

      await page.getByRole('button', { name: 'Task list grouping: Group by Project' }).click()
      await page.getByRole('menuitemradio', { name: 'Group by Due Date' }).click()

      await expect(page.getByRole('button', { name: /Add milestone to/ })).toHaveCount(0)
      await expect(page.getByRole('button', { name: 'Add subtask to Launch' })).toBeVisible()
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('keeps board column scrolling inside each group', async () => {
    const vaultRoot = await createFixtureVault(buildScrollableBoardProjects(18))
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await page.setViewportSize({ width: 1280, height: 720 })
      await page.getByTestId('sidebar-page:projects').click()
      await page.getByText('Project Board').click()

      const workspaceContent = page.getByTestId('projects-workspace-content')
      const groupScroller = page.getByTestId('project-board-group-scroll:status:on-track')

      await expect(groupScroller).toBeVisible()

      const workspaceOverflowY = await workspaceContent.evaluate(
        (element) => window.getComputedStyle(element).overflowY
      )
      expect(workspaceOverflowY).toBe('hidden')

      const scrollMetrics = await groupScroller.evaluate((element) => ({
        clientHeight: element.clientHeight,
        overflowY: window.getComputedStyle(element).overflowY,
        scrollHeight: element.scrollHeight
      }))

      expect(scrollMetrics.overflowY).toBe('auto')
      expect(scrollMetrics.scrollHeight).toBeGreaterThan(scrollMetrics.clientHeight)
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })
})
