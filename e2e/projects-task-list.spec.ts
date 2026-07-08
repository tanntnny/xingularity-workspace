import { test, expect, Page } from '@playwright/test'
import { _electron as electron, ElectronApplication } from 'playwright'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { AppSettings, Project } from '../src/shared/types'

declare global {
  interface Window {
    vaultApi: {
      vault: {
        restoreLast: () => Promise<unknown>
      }
    }
  }
}

const FIXTURE_PROJECT_ID = 'project-orbit'
const FIXTURE_MILESTONE_ID = 'milestone-launch'
const FIXTURE_SUBTASK_ID = 'subtask-qa-signoff'

function createFixtureProject(nowIso: string): Project {
  return {
    id: FIXTURE_PROJECT_ID,
    name: 'Orbit Launch',
    summary: 'Launch readiness tracker',
    status: 'on-track',
    updatedAt: nowIso,
    progress: 0,
    icon: {
      set: 'shape',
      glyph: 'circle',
      variant: 'filled',
      color: '#0ea5e9'
    },
    milestones: [
      {
        id: FIXTURE_MILESTONE_ID,
        title: 'Launch checklist',
        status: 'in-progress',
        dueDate: '2026-07-12',
        subtasks: [
          {
            id: FIXTURE_SUBTASK_ID,
            title: 'QA signoff',
            completed: false,
            createdAt: nowIso
          }
        ]
      }
    ]
  }
}

function createFixtureSettings(vaultRoot: string): AppSettings {
  const nowIso = '2026-07-08T10:00:00.000Z'
  const project = createFixtureProject(nowIso)

  return {
    isSidebarCollapsed: false,
    lastVaultPath: vaultRoot,
    lastOpenedNotePath: 'alpha.md',
    lastOpenedProjectId: project.id,
    favoriteNotePaths: [],
    favoriteProjectIds: [],
    profile: {
      name: '',
      color: 'atmosphere'
    },
    ai: {
      mistralApiKey: ''
    },
    fontFamily: "'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', Palatino, serif",
    workspaceVibrancyEnabled: true,
    editorVimModeEnabled: false,
    editorVimKeyMappings: [],
    calendarTasks: [],
    projectIcons: {
      [project.id]: project.icon
    },
    projects: [project],
    gridBoard: {
      viewport: {
        x: 0,
        y: 0,
        zoom: 1
      },
      items: []
    }
  }
}

async function createFixtureVault(): Promise<string> {
  const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-projects-e2e-vault-'))
  await fs.mkdir(path.join(rootPath, 'notes'), { recursive: true })
  await fs.mkdir(path.join(rootPath, 'attachments'), { recursive: true })
  await fs.writeFile(path.join(rootPath, 'notes', 'alpha.md'), 'alpha body\n', 'utf-8')
  await fs.writeFile(
    path.join(rootPath, 'settings.json'),
    JSON.stringify(createFixtureSettings(rootPath), null, 2),
    'utf-8'
  )
  return rootPath
}

async function launchWithFixture(vaultRoot: string): Promise<{
  electronApp: ElectronApplication
  page: Page
  userDataPath: string
}> {
  const userDataPath = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-projects-e2e-user-'))
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
            // Retry until the temporary fixture vault is fully restorable.
          }

          const notesButton = document.querySelector<HTMLButtonElement>(
            '[data-testid="sidebar-page:notes"]'
          )

          if (!notesButton) {
            return 'missing'
          }

          return notesButton.disabled ? 'disabled' : 'enabled'
        }),
      { timeout: 30_000 }
    )
    .toBe('enabled')

  return { electronApp, page, userDataPath }
}

async function openProjectTaskList(page: Page): Promise<void> {
  await page.getByTestId('sidebar-page:projects').click()
  await expect(page.getByRole('radio', { name: 'Task List' })).toBeVisible()
  await page.getByRole('radio', { name: 'Task List' }).click()
  await expect(page.getByRole('radio', { name: 'Show Completed' })).toBeVisible()
  await expect(
    page.getByTestId(
      `project-task-list-milestone-control:${FIXTURE_PROJECT_ID}:${FIXTURE_MILESTONE_ID}`
    )
  ).toBeVisible()
  await expect(
    page.getByTestId(
      `project-task-list-subtask-toggle:${FIXTURE_PROJECT_ID}:${FIXTURE_MILESTONE_ID}:${FIXTURE_SUBTASK_ID}`
    )
  ).toBeVisible()
}

function parseMatrixValues(transform: string): number[] {
  const match = transform.match(/matrix\(([^)]+)\)/)
  if (!match) {
    throw new Error(`Expected a CSS matrix transform, received: ${transform}`)
  }

  return match[1].split(',').map((value) => Number.parseFloat(value.trim()))
}

test.describe('projects task list', () => {
  test('renders a true subtask circle, a 45-degree milestone diamond, and instant check toggles', async () => {
    const vaultRoot = await createFixtureVault()
    let electronApp: ElectronApplication | null = null
    let userDataPath: string | null = null

    try {
      const launched = await launchWithFixture(vaultRoot)
      electronApp = launched.electronApp
      userDataPath = launched.userDataPath
      const { page } = launched

      await openProjectTaskList(page)

      const subtaskToggle = page.getByTestId(
        `project-task-list-subtask-toggle:${FIXTURE_PROJECT_ID}:${FIXTURE_MILESTONE_ID}:${FIXTURE_SUBTASK_ID}`
      )
      const subtaskRing = page.getByTestId(
        `project-task-list-subtask-ring:${FIXTURE_PROJECT_ID}:${FIXTURE_MILESTONE_ID}:${FIXTURE_SUBTASK_ID}`
      )
      const subtaskCheck = page.getByTestId(
        `project-task-list-subtask-check:${FIXTURE_PROJECT_ID}:${FIXTURE_MILESTONE_ID}:${FIXTURE_SUBTASK_ID}`
      )
      const milestoneRing = page.getByTestId(
        `project-task-list-milestone-ring:${FIXTURE_PROJECT_ID}:${FIXTURE_MILESTONE_ID}`
      )

      const subtaskGeometry = await subtaskRing.evaluate((element) => {
        const node = element as HTMLElement
        const rect = node.getBoundingClientRect()
        const styles = window.getComputedStyle(node)
        return {
          width: rect.width,
          height: rect.height,
          borderRadius: Number.parseFloat(styles.borderTopLeftRadius)
        }
      })

      expect(Math.abs(subtaskGeometry.width - subtaskGeometry.height)).toBeLessThanOrEqual(0.25)
      expect(subtaskGeometry.borderRadius).toBeGreaterThanOrEqual(subtaskGeometry.width / 2 - 1)

      const milestoneTransform = await milestoneRing.evaluate(
        (element) => window.getComputedStyle(element as HTMLElement).transform
      )
      const [a, b] = parseMatrixValues(milestoneTransform)
      expect(Math.abs(Math.abs(a) - Math.SQRT1_2)).toBeLessThan(0.03)
      expect(Math.abs(Math.abs(b) - Math.SQRT1_2)).toBeLessThan(0.03)

      const subtaskCheckBefore = await subtaskCheck.evaluate((element) => {
        const styles = window.getComputedStyle(element as HTMLElement)
        return {
          opacity: styles.opacity,
          transitionDuration: styles.transitionDuration
        }
      })

      expect(subtaskCheckBefore.opacity).toBe('0')
      expect(subtaskCheckBefore.transitionDuration).toBe('0s')

      await subtaskToggle.click()

      await expect(subtaskToggle).toHaveAttribute('aria-label', 'Mark subtask as pending')

      const subtaskCheckAfter = await subtaskCheck.evaluate((element) => {
        const styles = window.getComputedStyle(element as HTMLElement)
        return {
          opacity: styles.opacity,
          transitionDuration: styles.transitionDuration
        }
      })

      expect(subtaskCheckAfter.opacity).toBe('1')
      expect(subtaskCheckAfter.transitionDuration).toBe('0s')
    } finally {
      if (electronApp) {
        await electronApp.close()
      }
      if (userDataPath) {
        await fs.rm(userDataPath, { recursive: true, force: true })
      }
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })

  test('saves task-list drawer edits when dismissed by clicking outside', async () => {
    const vaultRoot = await createFixtureVault()
    let electronApp: ElectronApplication | null = null
    let userDataPath: string | null = null

    try {
      const launched = await launchWithFixture(vaultRoot)
      electronApp = launched.electronApp
      userDataPath = launched.userDataPath
      const { page } = launched

      await openProjectTaskList(page)

      await page.getByText('QA signoff').click()

      const drawer = page.getByRole('dialog')
      await expect(drawer.getByText('Edit subtask details for Launch checklist.')).toBeVisible()

      const description = drawer.getByLabel('Description')
      await description.fill('Ready for final release.')

      await page.locator('.drawer-glass-overlay').click({ position: { x: 24, y: 24 } })
      await expect(drawer).toHaveCount(0)

      await page.getByText('QA signoff').click()
      await expect(drawer.getByLabel('Description')).toHaveValue('Ready for final release.')
    } finally {
      if (electronApp) {
        await electronApp.close()
      }
      if (userDataPath) {
        await fs.rm(userDataPath, { recursive: true, force: true })
      }
      await fs.rm(vaultRoot, { recursive: true, force: true })
    }
  })
})
