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
import { ProjectStore } from '../src/main/projectStore'
import { TaskStore } from '../src/main/taskStore'
import type { Project } from '../src/shared/types'
import type { RecentPageTarget } from '../src/shared/recentPages'
import { createWorkspaceView } from '../src/shared/workspaceViews'

const tempRoots: string[] = []

function trackTempRoot(root: string): string {
  tempRoots.push(root)
  return root
}

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(
    tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))
  )
})

describe('SettingsStore', () => {
  it('round-trips target-level recent pages in the vault core settings file', async () => {
    const root = trackTempRoot(await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-settings-')))
    const store = new SettingsStore()
    const recentPageTargets: RecentPageTarget[] = [
      { kind: 'project', projectId: 'project-1' },
      { kind: 'note', path: 'notes/alpha.md' },
      { kind: 'drawing', path: 'drawings/board.excalidraw' },
      { kind: 'view', viewId: 'view-tasks' }
    ]

    const updated = await store.updateVault(root, { recentPageTargets })

    expect(updated.recentPageTargets).toEqual(recentPageTargets)
    await expect(store.readVault(root)).resolves.toEqual(
      expect.objectContaining({ recentPageTargets })
    )
    await expect(fs.readFile(path.join(root, 'settings.json'), 'utf-8')).resolves.toContain(
      '"recentPageTargets"'
    )
  })

  it('seeds target-level recents from legacy notebook history', async () => {
    const root = trackTempRoot(await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-settings-')))
    await fs.writeFile(
      path.join(root, 'settings.json'),
      JSON.stringify({ recentNotebookPaths: ['notes/alpha.md', 'drawings/board.excalidraw'] }),
      'utf-8'
    )

    const settings = await new SettingsStore().readVault(root)

    expect(settings.recentPageTargets).toEqual([
      { kind: 'note', path: 'notes/alpha.md' },
      { kind: 'drawing', path: 'drawings/board.excalidraw' }
    ])
    await expect(fs.readFile(path.join(root, 'settings.json'), 'utf-8')).resolves.toContain(
      '"recentPageTargets"'
    )
  })

  it('round-trips workspace views in the vault core settings file', async () => {
    const root = trackTempRoot(await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-settings-')))
    const store = new SettingsStore()
    const view = createWorkspaceView('view-tasks', 'tasks', [], '2026-08-29T10:00:00.000Z')

    const updated = await store.updateVault(root, { workspaceViews: [view] })

    expect(updated.workspaceViews).toEqual([view])
    await expect(store.readVault(root)).resolves.toEqual(
      expect.objectContaining({ workspaceViews: [view] })
    )
    await expect(fs.readFile(path.join(root, 'settings.json'), 'utf-8')).resolves.toContain(
      '"workspaceViews"'
    )
  })

  it('migrates legacy vault settings files into root-level canonical paths', async () => {
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
              updatedAt: '2026-05-01T00:00:00.000Z',
              icon: { shape: 'circle', variant: 'filled', color: '#000000' },
              updates: [
                {
                  id: 'legacy-update',
                  projectId: 'project-1',
                  title: 'Legacy title is ignored',
                  markdown: 'Legacy update content',
                  status: 'published',
                  createdAt: '2026-04-30T00:00:00.000Z',
                  updatedAt: '2026-05-01T00:00:00.000Z',
                  publishedAt: '2026-05-01T00:00:00.000Z'
                }
              ]
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
              taskType: 'call',
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
    expect(settings.projects[0].state).toBe('active')
    expect(settings.projects[0].tags).toEqual([])
    expect(settings.projects[0].resourceRefs ?? []).toEqual([])
    expect(settings.projects[0].startDate).toBeUndefined()
    expect(settings.projects[0].endDate).toBeUndefined()
    expect(settings.projects[0].updates).toEqual([
      {
        id: 'legacy-update',
        projectId: 'project-1',
        markdown: 'Legacy update content',
        status: 'on-track',
        createdAt: '2026-04-30T00:00:00.000Z',
        updatedAt: '2026-05-01T00:00:00.000Z'
      }
    ])
    expect(settings.projects[0].meetings).toEqual([])
    expect(settings.calendarTasks).toHaveLength(1)
    expect(settings.calendarTasks[0].taskType).toBe('follow-up')
    expect(settings.calendarTasks[0].status).toBe('pending')
    expect(settings.calendarTasks[0].tags).toEqual([])

    await expect(fs.readFile(path.join(root, 'settings.json'), 'utf-8')).resolves.toContain(
      '"fontFamily": "Iowan"'
    )
    const canonicalSettings = JSON.parse(
      await fs.readFile(path.join(root, 'settings.json'), 'utf-8')
    ) as Record<string, unknown>
    expect(canonicalSettings).not.toHaveProperty('performanceModeEnabled')
    expect(canonicalSettings).not.toHaveProperty('workspaceVibrancyEnabled')
    expect(canonicalSettings.profile).toEqual({ name: 'Amy' })
    await expect(
      fs.readFile(path.join(root, 'projects', 'project-1.json'), 'utf-8')
    ).resolves.toContain('"name": "Migration"')
    const canonicalTask = JSON.parse(
      await fs.readFile(path.join(root, 'tasks', 'task-1.json'), 'utf-8')
    ) as { title: string; taskType?: string }
    expect(canonicalTask).toEqual(
      expect.objectContaining({ title: 'Legacy task', taskType: 'follow-up', tags: [] })
    )
    await expect(fs.access(path.join(legacyDir, 'settings.json'))).rejects.toThrow()
    await expect(fs.access(path.join(legacyDir, 'projects.json'))).rejects.toThrow()
    await expect(fs.access(path.join(legacyDir, 'tasks.json'))).rejects.toThrow()
  })

  it('prefers populated legacy files over empty migrated visible files', async () => {
    const root = trackTempRoot(await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-settings-')))
    const legacyDir = path.join(root, '.xingularity')
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
    await fs.writeFile(path.join(root, 'projects.json'), JSON.stringify([], null, 2), 'utf-8')
    await fs.writeFile(path.join(root, 'project-icons.json'), JSON.stringify({}, null, 2), 'utf-8')
    await fs.writeFile(path.join(root, 'tasks.json'), JSON.stringify([], null, 2), 'utf-8')

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
              updatedAt: '2026-05-01T00:00:00.000Z',
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
    expect(settings.projects[0].state).toBe('active')
    expect(settings.calendarTasks).toHaveLength(1)

    await expect(fs.readFile(path.join(root, 'settings.json'), 'utf-8')).resolves.toContain(
      '"lastOpenedNotePath": "alpha.md"'
    )
    await expect(
      fs.readFile(path.join(root, 'projects', 'project-1.json'), 'utf-8')
    ).resolves.toContain('"name": "Migration"')
    await expect(fs.readFile(path.join(root, 'tasks', 'task-1.json'), 'utf-8')).resolves.toContain(
      '"title": "Legacy task"'
    )
  })

  it('removes legacy profile colors from canonical settings', async () => {
    const root = trackTempRoot(await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-settings-')))

    await fs.writeFile(
      path.join(root, 'settings.json'),
      JSON.stringify(
        {
          profile: { name: 'Amy', color: 'emerald' },
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
    await fs.writeFile(path.join(root, 'projects.json'), JSON.stringify([], null, 2), 'utf-8')
    await fs.writeFile(path.join(root, 'project-icons.json'), JSON.stringify({}, null, 2), 'utf-8')
    await fs.writeFile(path.join(root, 'tasks.json'), JSON.stringify([], null, 2), 'utf-8')

    const store = new SettingsStore()
    const settings = await store.readVault(root)

    expect(settings.profile.name).toBe('Amy')
    const canonicalSettings = JSON.parse(
      await fs.readFile(path.join(root, 'settings.json'), 'utf-8')
    ) as Record<string, unknown>
    expect(canonicalSettings.profile).toEqual({ name: 'Amy' })
  })

  it('preserves projects when tasks are persisted in a later update', async () => {
    const root = trackTempRoot(await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-settings-')))
    const store = new SettingsStore()
    const project = {
      id: 'project-1',
      name: 'Gamma Project',
      summary: 'Linked task project',
      description: 'Linked task project',
      state: 'active' as const,
      updatedAt: '2026-08-02T00:00:00.000Z',
      icon: { shape: 'circle' as const, variant: 'filled' as const, color: '#000000' }
    }
    const task = {
      id: 'task-1',
      title: 'Prepare launch notes',
      projectId: project.id,
      tags: [],
      completed: false,
      status: 'pending' as const,
      createdAt: '2026-08-02T00:00:00.000Z',
      priority: 'low' as const,
      taskType: 'assignment' as const,
      reminders: []
    }

    await store.updateVault(root, { projects: [project] })
    const afterTaskUpdate = await store.updateVault(root, {
      tasks: [task],
      calendarTasks: [task]
    })

    expect(afterTaskUpdate.projects).toEqual([expect.objectContaining({ id: project.id })])
    expect(afterTaskUpdate.calendarTasks).toEqual([expect.objectContaining({ id: task.id })])
    await expect(store.readVault(root)).resolves.toEqual(
      expect.objectContaining({
        projects: [expect.objectContaining({ id: project.id })],
        calendarTasks: [expect.objectContaining({ projectId: project.id })]
      })
    )
  })

  it('persists the selected Conda environment path', async () => {
    const root = trackTempRoot(await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-settings-')))
    const store = new SettingsStore()

    const updated = await store.updateVault(root, {
      pythonCondaEnvironmentPath: '  /opt/conda/envs/automation  ',
      pythonCondaExecutablePath: '  /opt/conda/bin/conda  '
    })

    expect(updated.pythonCondaEnvironmentPath).toBe('/opt/conda/envs/automation')
    expect(updated.pythonCondaExecutablePath).toBe('/opt/conda/bin/conda')
    await expect(store.readVault(root)).resolves.toEqual(
      expect.objectContaining({
        pythonCondaEnvironmentPath: '/opt/conda/envs/automation',
        pythonCondaExecutablePath: '/opt/conda/bin/conda'
      })
    )
  })

  it('writes only the persistence domain changed by an incremental update', async () => {
    const root = trackTempRoot(await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-settings-')))
    const store = new SettingsStore()
    await store.readVault(root)
    const projectStoreWrite = vi.spyOn(ProjectStore.prototype, 'writeAll')
    const taskStoreWrite = vi.spyOn(TaskStore.prototype, 'writeAll')

    await store.updateVault(root, { lastOpenedProjectId: 'project-1' })
    expect(projectStoreWrite).not.toHaveBeenCalled()
    expect(taskStoreWrite).not.toHaveBeenCalled()

    const project = {
      id: 'project-1',
      name: 'Project One',
      summary: '',
      description: '',
      state: 'active' as const,
      updatedAt: '2026-08-02T00:00:00.000Z',
      icon: { shape: 'circle' as const, variant: 'filled' as const, color: '#000000' }
    }
    await store.updateVault(root, { projects: [project] })
    expect(projectStoreWrite).toHaveBeenCalledTimes(1)
    expect(taskStoreWrite).not.toHaveBeenCalled()

    projectStoreWrite.mockClear()
    await store.updateVault(root, { tasks: [], calendarTasks: [] })
    expect(projectStoreWrite).not.toHaveBeenCalled()
    expect(taskStoreWrite).toHaveBeenCalledTimes(1)
  })

  it('preserves every canonical project while changing project selection', async () => {
    const root = trackTempRoot(await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-settings-')))
    const store = new SettingsStore()
    const makeProject = (id: string, name: string): Project => ({
      id,
      name,
      summary: '',
      description: '',
      state: 'active' as const,
      updatedAt: '2026-08-02T00:00:00.000Z',
      icon: { shape: 'circle' as const, variant: 'filled' as const, color: '#000000' }
    })

    await store.updateVault(root, {
      projects: [makeProject('project-1', 'Alpha'), makeProject('project-2', 'Beta')]
    })
    await store.updateVault(root, { lastOpenedProjectId: 'project-2' })
    await store.updateVault(root, { lastOpenedProjectId: 'project-1' })

    const settings = await store.readVault(root)
    expect(settings.projects.map((project) => project.id).sort()).toEqual([
      'project-1',
      'project-2'
    ])
    await expect(fs.access(path.join(root, 'projects', 'project-1.json'))).resolves.toBeUndefined()
    await expect(fs.access(path.join(root, 'projects', 'project-2.json'))).resolves.toBeUndefined()
  })

  it('persists milestones and clears invalid task milestone links', async () => {
    const root = trackTempRoot(await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-settings-')))
    const store = new SettingsStore()
    const project = {
      id: 'project-1',
      name: 'Milestone Project',
      summary: '',
      description: '',
      state: 'active' as const,
      updatedAt: '2026-08-13T00:00:00.000Z',
      milestones: [
        {
          id: 'milestone-1',
          title: 'Launch',
          endDate: '2026-08-31',
          createdAt: '2026-08-13T00:00:00.000Z',
          updatedAt: '2026-08-13T00:00:00.000Z'
        }
      ],
      icon: { shape: 'circle' as const, variant: 'filled' as const, color: '#000000' }
    }
    const validTask = {
      id: 'task-valid',
      title: 'Valid task',
      projectId: project.id,
      milestoneId: 'milestone-1',
      tags: [],
      completed: false,
      status: 'pending' as const,
      createdAt: '2026-08-13T00:00:00.000Z',
      priority: 'low' as const,
      taskType: 'assignment' as const,
      reminders: []
    }
    const invalidTask = { ...validTask, id: 'task-invalid', milestoneId: 'missing-milestone' }

    await store.updateVault(root, { projects: [project] })
    const settings = await store.updateVault(root, {
      tasks: [validTask, invalidTask],
      calendarTasks: [validTask, invalidTask]
    })

    expect(settings.projects[0].milestones).toEqual(project.milestones)
    expect(settings.projects[0].milestones?.[0]?.endDate).toBe('2026-08-31')
    expect(settings.calendarTasks).toEqual([
      expect.objectContaining({ id: 'task-valid', milestoneId: 'milestone-1' }),
      expect.objectContaining({ id: 'task-invalid', milestoneId: undefined })
    ])
    await expect(
      fs.readFile(path.join(root, 'projects', 'project-1.json'), 'utf-8')
    ).resolves.toContain('"title": "Launch"')
  })

  it('normalizes canceled tasks as completed for persistence compatibility', async () => {
    const root = trackTempRoot(await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-settings-')))
    const store = new SettingsStore()
    const canceledTask = {
      id: 'task-canceled',
      title: 'Canceled task',
      tags: [],
      completed: false,
      status: 'canceled' as const,
      createdAt: '2026-08-13T00:00:00.000Z',
      priority: 'low' as const,
      taskType: 'assignment' as const,
      reminders: []
    }

    const settings = await store.updateVault(root, {
      tasks: [canceledTask],
      calendarTasks: [canceledTask]
    })

    expect(settings.calendarTasks[0]).toMatchObject({
      status: 'canceled',
      completed: true
    })
    await expect(
      fs.readFile(path.join(root, 'tasks', 'task-canceled.json'), 'utf-8')
    ).resolves.toMatch(/"status": "canceled"/)
    await expect(store.readVault(root)).resolves.toEqual(
      expect.objectContaining({
        calendarTasks: [expect.objectContaining({ status: 'canceled', completed: true })]
      })
    )
  })
})
