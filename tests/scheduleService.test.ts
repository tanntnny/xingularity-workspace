import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FileService } from '../src/main/fileService'
import { ScheduleService } from '../src/main/scheduleService'
import { buildCalendarEvents } from '../src/renderer/src/lib/calendarTasks'
import type { AppSettings, AppSettingsUpdate } from '../src/shared/types'

vi.mock('electron', () => ({
  app: {
    getPath: () => os.tmpdir()
  }
}))

function createDefaultSettings(): AppSettings {
  return {
    isSidebarCollapsed: false,
    lastVaultPath: null,
    lastOpenedNotePath: null,
    lastOpenedProjectId: null,
    favoriteNotePaths: [],
    favoriteProjectIds: [],
    profile: { name: '', color: 'indigo' },
    ai: { mistralApiKey: '' },
    fontFamily: 'Inter',
    workspaceVibrancyEnabled: true,
    calendarTasks: [],
    projectIcons: {},
    projects: [],
    gridBoard: {
      items: [],
      viewport: { x: 0, y: 0, zoom: 1 }
    }
  }
}

class MockRuntime {
  private readonly fileService: FileService
  private settings: AppSettings = createDefaultSettings()
  private readonly ready: Promise<void>

  constructor(rootPath: string) {
    const notesRoot = path.join(rootPath, 'notes')
    const attachmentsRoot = path.join(rootPath, 'attachments')
    this.fileService = new FileService(notesRoot, attachmentsRoot, () => {})
    this.ready = Promise.all([
      fs.mkdir(notesRoot, { recursive: true }),
      fs.mkdir(attachmentsRoot, { recursive: true })
    ]).then(() => undefined)
  }

  async getSettings(): Promise<AppSettings> {
    return this.settings
  }

  async updateSettings(next: AppSettingsUpdate): Promise<AppSettings> {
    this.settings = {
      ...this.settings,
      ...next,
      profile: next.profile ? { ...this.settings.profile, ...next.profile } : this.settings.profile,
      ai: next.ai ? { ...this.settings.ai, ...next.ai } : this.settings.ai
    }
    return this.settings
  }

  listNotes() {
    return this.ready.then(() => this.fileService.listNotes())
  }

  readNote(relPath: string) {
    return this.ready.then(() => this.fileService.readNote(relPath))
  }

  createNote(name: string) {
    return this.ready.then(() => this.fileService.createNote(name))
  }

  writeNote(relPath: string, content: string) {
    return this.ready.then(() => this.fileService.writeNote(relPath, content))
  }
}

describe('ScheduleService action application', () => {
  let tempRoot: string

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-schedule-test-'))
  })

  afterEach(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true })
  })

  it('applies task.create into calendarTasks so the task appears in calendar data', async () => {
    const runtime = new MockRuntime(tempRoot)
    const service = new ScheduleService(runtime as never)
    await service.handleVaultChange(tempRoot)

    const job = await service.saveJob({
      name: 'Create scheduled task',
      enabled: true,
      trigger: { type: 'manual' },
      runtime: 'javascript',
      outputMode: 'auto_apply',
      permissions: ['createTasks'],
      code: `beacon.emit([
        {
          type: 'task.create',
          title: 'Scheduled planning task',
          date: '2026-04-04',
          priority: 'high',
          taskType: 'assignment',
          automationSource: 'test-schedule',
          automationSourceKey: '2026-04-04:planning'
        }
      ])`
    })

    const run = await service.runNow(job.id)
    const settings = await runtime.getSettings()

    expect(run.status).toBe('success')
    expect(settings.calendarTasks).toHaveLength(1)
    expect(settings.calendarTasks[0]).toMatchObject({
      title: 'Scheduled planning task',
      date: '2026-04-04',
      priority: 'high',
      taskType: 'assignment',
      automationSource: 'test-schedule',
      automationSourceKey: '2026-04-04:planning'
    })

    expect(buildCalendarEvents(settings.calendarTasks)).toEqual([
      {
        id: settings.calendarTasks[0].id,
        title: 'Scheduled planning task',
        start: '2026-04-04',
        end: undefined,
        allDay: true,
        extendedProps: {
          source: 'task',
          taskId: settings.calendarTasks[0].id
        }
      }
    ])
  })

  it('applies note.create by creating a readable note in the vault', async () => {
    const runtime = new MockRuntime(tempRoot)
    const service = new ScheduleService(runtime as never)
    await service.handleVaultChange(tempRoot)

    const job = await service.saveJob({
      name: 'Create note from schedule',
      enabled: true,
      trigger: { type: 'manual' },
      runtime: 'javascript',
      outputMode: 'auto_apply',
      permissions: ['createNotes'],
      code: `beacon.emit([
        {
          type: 'note.create',
          name: 'Schedule Test Note',
          body: 'This note was created by a schedule run.',
          tags: ['automation', 'test'],
          automationSource: 'test-schedule',
          automationSourceKey: 'note-create'
        }
      ])`
    })

    const run = await service.runNow(job.id)
    const notes = await runtime.listNotes()

    expect(run.status).toBe('success')
    expect(notes).toHaveLength(1)
    expect(notes[0]?.name).toBe('schedule-test-note.md')

    const content = await runtime.readNote(notes[0]!.relPath)
    expect(content).toContain('This note was created by a schedule run.')
  })
})
