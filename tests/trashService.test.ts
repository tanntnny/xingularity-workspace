import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { TrashService } from '../src/main/trashService'
import type { AppSettings, Project } from '../src/shared/types'

const tempDirs: string[] = []

async function makeVault(): Promise<{
  rootDir: string
  notesDir: string
  trash: TrashService
}> {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-trash-'))
  tempDirs.push(rootDir)
  const notesDir = path.join(rootDir, 'notes')
  await fs.mkdir(notesDir, { recursive: true })
  return {
    rootDir,
    notesDir,
    trash: new TrashService(rootDir, notesDir)
  }
}

describe('TrashService', () => {
  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })))
  })

  it('moves a note into vault .trash and restores it to the original path', async () => {
    const { notesDir, trash } = await makeVault()
    await fs.mkdir(path.join(notesDir, 'projects'), { recursive: true })
    await fs.writeFile(path.join(notesDir, 'projects', 'plan.md'), 'Plan', 'utf-8')

    const entry = await trash.moveEntryToTrash('projects/plan.md')

    await expect(fs.stat(path.join(notesDir, 'projects', 'plan.md'))).rejects.toThrow()
    await expect(
      fs.stat(path.join(notesDir, '..', '.trash', entry.trashRelPath))
    ).resolves.toBeTruthy()

    const restoredPath = await trash.restoreEntry(entry)

    expect(restoredPath).toBe('projects/plan.md')
    await expect(fs.readFile(path.join(notesDir, 'projects', 'plan.md'), 'utf-8')).resolves.toBe(
      'Plan'
    )
  })

  it('restores to a safe suffixed path when the original path is occupied', async () => {
    const { notesDir, trash } = await makeVault()
    await fs.writeFile(path.join(notesDir, 'idea.md'), 'Original', 'utf-8')

    const entry = await trash.moveEntryToTrash('idea.md')
    await fs.writeFile(path.join(notesDir, 'idea.md'), 'Replacement', 'utf-8')

    const restoredPath = await trash.restoreEntry(entry)

    expect(restoredPath).toBe('idea restored.md')
    await expect(fs.readFile(path.join(notesDir, 'idea.md'), 'utf-8')).resolves.toBe('Replacement')
    await expect(fs.readFile(path.join(notesDir, 'idea restored.md'), 'utf-8')).resolves.toBe(
      'Original'
    )
  })

  it('archives settings-backed project, milestone, subtask, task, and grid deletes', async () => {
    const { rootDir, trash } = await makeVault()
    const project = makeProject()
    const before: AppSettings = {
      ...makeSettings(),
      projects: [project],
      projectIcons: { [project.id]: project.icon },
      favoriteProjectIds: [project.id],
      calendarTasks: [
        {
          id: 'task-1',
          title: 'Task',
          completed: false,
          createdAt: '2026-04-19T00:00:00.000Z',
          priority: 'medium',
          reminders: []
        }
      ],
      gridBoard: {
        viewport: { x: 0, y: 0, zoom: 1 },
        items: [
          {
            id: 'grid-1',
            kind: 'project',
            projectId: project.id,
            position: { x: 0, y: 0 },
            zIndex: 1
          }
        ]
      }
    }
    const after: AppSettings = {
      ...before,
      projects: [
        {
          ...project,
          milestones: [
            {
              ...project.milestones[0]!,
              subtasks: []
            }
          ]
        }
      ],
      calendarTasks: [],
      gridBoard: {
        ...before.gridBoard,
        items: []
      }
    }

    await trash.archiveSettingsDeletes(before, after)
    await trash.archiveSettingsDeletes(before, {
      ...before,
      projects: [{ ...project, milestones: [] }]
    })
    await trash.archiveSettingsDeletes(before, {
      ...before,
      projects: [],
      projectIcons: {},
      favoriteProjectIds: []
    })

    const records = await fs.readdir(path.join(rootDir, '.trash', 'records'))
    expect(records.some((record) => record.includes('project-delete'))).toBe(true)
    expect(records.some((record) => record.includes('milestone-delete'))).toBe(true)
    expect(records.some((record) => record.includes('subtask-delete'))).toBe(true)
    expect(records.some((record) => record.includes('calendar-task-delete'))).toBe(true)
    expect(records.some((record) => record.includes('grid-item-delete'))).toBe(true)
  })
})

function makeProject(): Project {
  return {
    id: 'project-1',
    name: 'Project',
    summary: '',
    status: 'on-track',
    updatedAt: '2026-04-19T00:00:00.000Z',
    progress: 0,
    icon: {
      shape: 'circle',
      variant: 'filled',
      color: '#000000'
    },
    milestones: [
      {
        id: 'milestone-1',
        title: 'Milestone',
        status: 'pending',
        subtasks: [
          {
            id: 'subtask-1',
            title: 'Subtask',
            completed: false,
            createdAt: '2026-04-19T00:00:00.000Z'
          }
        ]
      }
    ]
  }
}

function makeSettings(): AppSettings {
  return {
    isSidebarCollapsed: false,
    lastVaultPath: null,
    lastOpenedNotePath: null,
    lastOpenedProjectId: null,
    favoriteNotePaths: [],
    favoriteProjectIds: [],
    profile: { name: '', color: 'indigo' },
    ai: { mistralApiKey: '' },
    fontFamily: 'serif',
    workspaceVibrancyEnabled: true,
    calendarTasks: [],
    projectIcons: {},
    projects: [],
    gridBoard: {
      viewport: { x: 0, y: 0, zoom: 1 },
      items: []
    }
  }
}
