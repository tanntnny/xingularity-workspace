import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: {
    getPath: () => os.tmpdir()
  }
}))

import { SettingsStore } from '../src/main/settingsStore'

const tempRoots: string[] = []

function trackTempRoot(root: string): string {
  tempRoots.push(root)
  return root
}

afterEach(async () => {
  await Promise.all(
    tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))
  )
})

describe('SettingsStore', () => {
  it('migrates legacy vault settings files into page-aligned canonical paths', async () => {
    const root = trackTempRoot(await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-settings-')))
    const legacyDir = path.join(root, '.xingularity')
    await fs.mkdir(legacyDir, { recursive: true })
    await fs.writeFile(
      path.join(legacyDir, 'settings.json'),
      JSON.stringify(
        {
          profile: { name: 'Amy', color: 'indigo' },
          fontFamily: 'Iowan',
          workspaceVibrancyEnabled: false,
          editorVimModeEnabled: true,
          editorVimKeyMappings: [
            {
              id: 'escape-ij',
              mode: 'insert',
              sequence: 'ij',
              action: 'enterNormalMode'
            },
            {
              id: 'visual-yank',
              mode: 'visual',
              sequence: 'Y',
              action: 'yankSelection'
            }
          ]
        },
        null,
        2
      ),
      'utf-8'
    )
    await fs.writeFile(
      path.join(legacyDir, 'projects.json'),
      JSON.stringify(
        {
          projects: [
            {
              id: 'project-1',
              name: 'Migration',
              summary: 'Legacy project',
              status: 'on-track',
              updatedAt: '2026-05-01T00:00:00.000Z',
              progress: 0,
              milestones: [],
              icon: { shape: 'circle', variant: 'filled', color: '#000000' }
            }
          ],
          projectIcons: {}
        },
        null,
        2
      ),
      'utf-8'
    )
    await fs.writeFile(
      path.join(legacyDir, 'tasks.json'),
      JSON.stringify(
        {
          calendarTasks: [
            {
              id: 'task-1',
              title: 'Legacy task',
              completed: false,
              createdAt: '2026-05-01T00:00:00.000Z',
              priority: 'medium',
              reminders: []
            }
          ]
        },
        null,
        2
      ),
      'utf-8'
    )

    const store = new SettingsStore()
    const settings = await store.readVault(root)

    expect(settings.profile.name).toBe('Amy')
    expect(settings.editorVimModeEnabled).toBe(true)
    expect(settings.editorVimKeyMappings).toEqual([
      {
        id: 'escape-ij',
        mode: 'insert',
        sequence: 'ij',
        action: 'enterNormalMode'
      },
      {
        id: 'visual-yank',
        mode: 'visual',
        sequence: 'Y',
        action: 'yankSelection'
      }
    ])
    expect(settings.projects).toHaveLength(1)
    expect(settings.calendarTasks).toHaveLength(1)

    await expect(fs.readFile(path.join(root, 'settings.json'), 'utf-8')).resolves.toContain(
      '"fontFamily": "Iowan"'
    )
    await expect(
      fs.readFile(path.join(root, 'projects', 'index.json'), 'utf-8')
    ).resolves.toContain('"name": "Migration"')
    await expect(
      fs.readFile(path.join(root, 'calendar', 'tasks.json'), 'utf-8')
    ).resolves.toContain('"title": "Legacy task"')
  })

  it('prefers populated legacy files over empty migrated visible files', async () => {
    const root = trackTempRoot(await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-settings-')))
    const visibleProjectsDir = path.join(root, 'projects')
    const visibleCalendarDir = path.join(root, 'calendar')
    const legacyDir = path.join(root, '.xingularity')
    await fs.mkdir(visibleProjectsDir, { recursive: true })
    await fs.mkdir(visibleCalendarDir, { recursive: true })
    await fs.mkdir(legacyDir, { recursive: true })

    await fs.writeFile(
      path.join(root, 'settings.json'),
      JSON.stringify(
        {
          profile: { name: '', color: 'monotone' },
          favoriteNotePaths: [],
          favoriteProjectIds: [],
          lastOpenedNotePath: null,
          lastOpenedProjectId: null,
          gridBoard: { viewport: { x: 0, y: 0, zoom: 1 }, items: [] }
        },
        null,
        2
      ),
      'utf-8'
    )
    await fs.writeFile(
      path.join(visibleProjectsDir, 'index.json'),
      JSON.stringify({ projects: [], projectIcons: {} }, null, 2),
      'utf-8'
    )
    await fs.writeFile(
      path.join(visibleCalendarDir, 'tasks.json'),
      JSON.stringify({ calendarTasks: [] }, null, 2),
      'utf-8'
    )

    await fs.writeFile(
      path.join(legacyDir, 'settings.json'),
      JSON.stringify(
        {
          profile: { name: 'Amy', color: 'monotone' },
          favoriteNotePaths: ['alpha.md'],
          favoriteProjectIds: ['project-1'],
          lastOpenedNotePath: 'alpha.md',
          lastOpenedProjectId: 'project-1',
          gridBoard: {
            viewport: { x: 0, y: 0, zoom: 1 },
            items: [
              { id: 'a', kind: 'text', position: { x: 1, y: 2 }, zIndex: 1, textContent: 'hello' }
            ]
          }
        },
        null,
        2
      ),
      'utf-8'
    )
    await fs.writeFile(
      path.join(legacyDir, 'projects.json'),
      JSON.stringify(
        {
          projects: [
            {
              id: 'project-1',
              name: 'Migration',
              summary: 'Legacy project',
              status: 'on-track',
              updatedAt: '2026-05-01T00:00:00.000Z',
              progress: 0,
              milestones: [],
              icon: { shape: 'circle', variant: 'filled', color: '#000000' }
            }
          ],
          projectIcons: {}
        },
        null,
        2
      ),
      'utf-8'
    )
    await fs.writeFile(
      path.join(legacyDir, 'tasks.json'),
      JSON.stringify(
        {
          calendarTasks: [
            {
              id: 'task-1',
              title: 'Legacy task',
              completed: false,
              createdAt: '2026-05-01T00:00:00.000Z',
              priority: 'medium',
              reminders: []
            }
          ]
        },
        null,
        2
      ),
      'utf-8'
    )

    const store = new SettingsStore()
    const settings = await store.readVault(root)

    expect(settings.profile.name).toBe('Amy')
    expect(settings.lastOpenedNotePath).toBe('alpha.md')
    expect(settings.projects).toHaveLength(1)
    expect(settings.calendarTasks).toHaveLength(1)

    await expect(fs.readFile(path.join(root, 'settings.json'), 'utf-8')).resolves.toContain(
      '"lastOpenedNotePath": "alpha.md"'
    )
    await expect(
      fs.readFile(path.join(root, 'projects', 'index.json'), 'utf-8')
    ).resolves.toContain('"name": "Migration"')
    await expect(
      fs.readFile(path.join(root, 'calendar', 'tasks.json'), 'utf-8')
    ).resolves.toContain('"title": "Legacy task"')
  })
})
