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
  await fs.mkdir(path.join(rootPath, 'notes', 'Projects', 'Alpha Project'), { recursive: true })
  await fs.mkdir(path.join(rootPath, 'attachments'), { recursive: true })
  await fs.mkdir(path.join(rootPath, '.xingularity'), { recursive: true })

  await fs.writeFile(
    path.join(rootPath, 'notes', 'Projects', 'Alpha Project', 'in-folder.md'),
    serializeStoredNoteDocument(createStoredNoteDocumentFromText('Inside folder\n')),
    'utf-8'
  )
  await fs.writeFile(
    path.join(rootPath, 'notes', 'outside-note.md'),
    serializeStoredNoteDocument(createStoredNoteDocumentFromText('Outside note\n')),
    'utf-8'
  )
  await fs.writeFile(
    path.join(rootPath, '.xingularity', 'settings.json'),
    JSON.stringify(
      {
        projects: [
          {
            id: 'project-1',
            name: 'Alpha Project',
            summary: '',
            status: 'on-track',
            updatedAt: '2026-04-02T00:00:00.000Z',
            progress: 0,
            milestones: [],
            icon: {
              shape: 'circle',
              variant: 'filled',
              color: '#000000'
            }
          }
        ]
      },
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

test.describe('project page notes tab', () => {
  test('uses project folder membership instead of tag linking UI', async () => {
    const vaultRoot = await createFixtureVault()
    const { electronApp, page } = await launchWithFixture(vaultRoot)

    try {
      await page.getByTestId('sidebar-page:projects').click()
      await expect(page.getByTestId('sidebar-page:projects')).toHaveAttribute('data-active', 'true')

      await expect(page.getByText('Alpha Project').first()).toBeVisible()
      await page.getByText('Project Notes').click()

      await expect(page.getByText('in-folder.md')).toBeVisible()
      await expect(page.getByText('outside-note.md')).toHaveCount(0)
      await expect(page.getByText('Link existing note')).toHaveCount(0)
      await expect(page.getByText('Unlink')).toHaveCount(0)
    } finally {
      await electronApp.close()
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })
})
