import { test, expect, Page } from '@playwright/test'
import { _electron as electron, ElectronApplication } from 'playwright'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  createStoredNoteDocumentFromText,
  serializeStoredNoteDocument
} from '../src/shared/noteDocument'

async function createFixtureVault(): Promise<string> {
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
    JSON.stringify(
      [
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
      ],
      null,
      2
    ),
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
  test('shows board and task list tabs and opens the project drawer from the board', async () => {
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
      await page
        .locator('article')
        .filter({ hasText: 'Alpha Project' })
        .first()
        .locator('button')
        .first()
        .click()
      await expect(page.getByText('Edit project details and workspace actions.')).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(page.getByText('Edit project details and workspace actions.')).toHaveCount(0)

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
})
