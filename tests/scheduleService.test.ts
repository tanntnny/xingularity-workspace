import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FileService } from '../src/main/fileService'
import { computeNextRunAt, ScheduleService } from '../src/main/scheduleService'
import { ScheduleStore } from '../src/main/scheduleStore'
import { buildCalendarEvents } from '../src/renderer/src/lib/calendarTasks'
import type { AppSettings, AppSettingsUpdate } from '../src/shared/types'
import type { ScheduleJob } from '../src/shared/scheduleTypes'

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
    recentNotebookPaths: [],
    lastOpenedProjectId: null,
    favoriteNotePaths: [],
    favoriteProjectIds: [],
    profile: { name: '' },
    ai: { mistralApiKey: '' },
    fontFamily: 'Inter',
    codeFontFamily: 'jetbrains-mono',
    pythonCondaEnvironmentPath: null,
    pythonCondaExecutablePath: null,
    editorVimModeEnabled: false,
    editorVimKeyMappings: [],
    calendarTasks: [],
    workspaceViews: [],
    folderColors: {},
    projectIcons: {},
    projects: [],
    gridBoard: {
      items: [],
      viewport: { x: 0, y: 0, zoom: 1 }
    },
    stickyNoteBoard: {
      notes: [],
      viewport: { x: 0, y: 0, zoom: 1 }
    }
  }
}

class MockRuntime {
  private readonly fileService: FileService
  private settings: AppSettings = createDefaultSettings()
  private readonly ready: Promise<void>
  private vaultReady: Promise<boolean> = Promise.resolve(true)

  constructor(rootPath: string) {
    const notesRoot = path.join(rootPath, 'notebooks')
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

  async waitForVaultReady(): Promise<boolean> {
    await this.ready
    return this.vaultReady
  }

  setVaultReady(vaultReady: Promise<boolean>): void {
    this.vaultReady = vaultReady
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

  async mutateSettings<T>(
    updater: (
      settings: AppSettings
    ) => Promise<{ next: AppSettingsUpdate; result: T }> | { next: AppSettingsUpdate; result: T }
  ): Promise<T> {
    const { next, result } = await updater(this.settings)
    await this.updateSettings(next)
    return result
  }

  listNotes(): ReturnType<FileService['listNotes']> {
    return this.ready.then(() => this.fileService.listNotes())
  }

  readNote(relPath: string): ReturnType<FileService['readNote']> {
    return this.ready.then(() => this.fileService.readNote(relPath))
  }

  createNote(name: string): ReturnType<FileService['createNote']> {
    return this.ready.then(() => this.fileService.createNote(name))
  }

  writeNote(relPath: string, content: string): ReturnType<FileService['writeNote']> {
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
          tags: ['mcv'],
          automationSource: 'test-schedule',
          automationSourceKey: '2026-04-04:planning'
        }
      ])`
    })

    expect(job.outputMode).toBe('auto_apply')
    const run = await service.runNow(job.id)
    expect(run.status).toBe('success')
    const resolvedRun = (await service.listRuns(job.id))[0]!
    const settings = await runtime.getSettings()

    expect(resolvedRun.status).toBe('success')
    expect(resolvedRun.appliedActions).toHaveLength(1)
    expect(settings.calendarTasks).toHaveLength(1)
    expect(settings.calendarTasks[0]).toMatchObject({
      title: 'Scheduled planning task',
      date: '2026-04-04',
      priority: 'high',
      taskType: 'assignment',
      tags: ['mcv'],
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
        durationEditable: true,
        extendedProps: {
          source: 'task',
          taskId: settings.calendarTasks[0].id,
          taskType: 'assignment',
          priority: 'high',
          status: 'pending',
          completed: false
        }
      }
    ])
  })

  it('applies canceled task actions as done tasks', async () => {
    const runtime = new MockRuntime(tempRoot)
    const service = new ScheduleService(runtime as never)
    await service.handleVaultChange(tempRoot)

    const job = await service.saveJob({
      name: 'Cancel scheduled task',
      enabled: true,
      trigger: { type: 'manual' },
      runtime: 'javascript',
      outputMode: 'auto_apply',
      permissions: ['createTasks'],
      code: `beacon.emit({
        type: 'task.create',
        title: 'Canceled scheduled task',
        status: 'canceled',
        automationSource: 'test-schedule',
        automationSourceKey: 'canceled-task'
      })`
    })

    const run = await service.runNow(job.id)
    expect(run.status).toBe('success')
    const settings = await runtime.getSettings()

    expect(settings.calendarTasks[0]).toMatchObject({
      title: 'Canceled scheduled task',
      status: 'canceled',
      completed: true
    })
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
    expect(run.status).toBe('success')
    const resolvedRun = (await service.listRuns(job.id))[0]!
    const notes = await runtime.listNotes()

    expect(resolvedRun.status).toBe('success')
    expect(notes).toHaveLength(1)
    expect(notes[0]?.name).toBe('schedule-test-note.md')

    const content = await runtime.readNote(notes[0]!.relPath)
    expect(content).toContain('This note was created by a schedule run.')
  })

  it('applies an end-date-only task.create action as a deadline-only task', async () => {
    const runtime = new MockRuntime(tempRoot)
    const service = new ScheduleService(runtime as never)
    await service.handleVaultChange(tempRoot)

    const job = await service.saveJob({
      name: 'Create deadline task',
      enabled: true,
      trigger: { type: 'manual' },
      runtime: 'javascript',
      outputMode: 'auto_apply',
      permissions: ['createTasks'],
      code: `beacon.emit({
        type: 'task.create',
        title: 'Submit final report',
        endDate: '2026-04-08',
        automationSource: 'test-schedule',
        automationSourceKey: 'deadline-only'
      })`
    })

    const run = await service.runNow(job.id)
    expect(run.status).toBe('success')
    const resolvedRun = (await service.listRuns(job.id))[0]!
    const settings = await runtime.getSettings()

    expect(resolvedRun.status).toBe('success')
    expect(settings.calendarTasks[0]).toMatchObject({
      title: 'Submit final report',
      date: undefined,
      endDate: '2026-04-08'
    })
    expect(buildCalendarEvents(settings.calendarTasks)[0]).toMatchObject({
      start: '2026-04-08',
      end: undefined,
      extendedProps: { deadlineOnly: true }
    })
  })

  it('reconciles an existing task and marks the MCV assignment completed', async () => {
    const runtime = new MockRuntime(tempRoot)
    const service = new ScheduleService(runtime as never)
    await service.handleVaultChange(tempRoot)

    const job = await service.saveJob({
      name: 'Reconcile MCV assignment',
      enabled: true,
      trigger: { type: 'manual' },
      runtime: 'javascript',
      outputMode: 'auto_apply',
      permissions: ['createTasks', 'updateTasks'],
      code: `beacon.emit([
        {
          type: 'task.create',
          title: 'Submit MCV assignment',
          date: '2026-04-06',
          endTime: '23:59',
          tags: ['mcv'],
          automationSource: 'mcv',
          automationSourceKey: 'assignment:abc-123'
        },
        {
          type: 'task.update',
          title: 'Submit MCV assignment',
          endDate: '2026-04-08',
          endTime: '22:30',
          status: 'completed',
          tags: ['mcv'],
          automationSource: 'mcv',
          automationSourceKey: 'assignment:abc-123'
        }
      ])`
    })

    const run = await service.runNow(job.id)
    expect(run.status).toBe('success')
    const resolvedRun = (await service.listRuns(job.id))[0]!
    const settings = await runtime.getSettings()

    expect(resolvedRun.status).toBe('success')
    expect(resolvedRun.actionErrors).toEqual([])
    expect(settings.calendarTasks).toHaveLength(1)
    expect(settings.calendarTasks[0]).toMatchObject({
      title: 'Submit MCV assignment',
      status: 'completed',
      completed: true,
      endDate: '2026-04-08',
      endTime: '22:30',
      tags: ['mcv'],
      automationSource: 'mcv',
      automationSourceKey: 'assignment:abc-123'
    })

    const repeatRun = await service.runNow(job.id)
    expect(repeatRun.status).toBe('success')
    const resolvedRepeatRun = (await service.listRuns(job.id))[0]!
    const repeatedSettings = await runtime.getSettings()

    expect(resolvedRepeatRun.status).toBe('success')
    expect(resolvedRepeatRun.actionErrors).toEqual([])
    expect(repeatedSettings.calendarTasks).toHaveLength(1)
  })

  it('backfills endTime on an existing automation task during task.create', async () => {
    const runtime = new MockRuntime(tempRoot)
    await runtime.updateSettings({
      calendarTasks: [
        {
          id: 'task-existing-mcv',
          title: 'Submit MCV assignment',
          tags: ['mcv'],
          date: '2026-04-08',
          completed: false,
          status: 'pending',
          createdAt: '2026-04-01T00:00:00.000Z',
          priority: 'medium',
          taskType: 'assignment',
          reminders: [],
          automationSource: 'mcv',
          automationSourceKey: 'assignment:abc-123'
        }
      ]
    })

    const service = new ScheduleService(runtime as never)
    await service.handleVaultChange(tempRoot)

    const job = await service.saveJob({
      name: 'Backfill MCV end time',
      enabled: true,
      trigger: { type: 'manual' },
      runtime: 'javascript',
      outputMode: 'auto_apply',
      permissions: ['createTasks', 'updateTasks'],
      code: `beacon.emit({
        type: 'task.create',
        title: 'Submit MCV assignment',
        endDate: '2026-04-08',
        endTime: '23:59',
        automationSource: 'mcv',
        automationSourceKey: 'assignment:abc-123'
      })`
    })

    const run = await service.runNow(job.id)
    expect(run.status).toBe('success')

    const settings = await runtime.getSettings()
    expect(settings.calendarTasks).toHaveLength(1)
    expect(settings.calendarTasks[0]).toMatchObject({
      id: 'task-existing-mcv',
      endTime: '23:59'
    })
  })

  it('runs Python jobs and applies their JSON action output', async () => {
    const runtime = new MockRuntime(tempRoot)
    const service = new ScheduleService(runtime as never)
    await service.handleVaultChange(tempRoot)

    const job = await service.saveJob({
      name: 'Python scheduled task',
      enabled: true,
      trigger: { type: 'manual' },
      runtime: 'python',
      outputMode: 'auto_apply',
      permissions: ['createTasks'],
      code: `import json
print(json.dumps({"actions": [{
  "type": "task.create",
  "title": "Python planning task",
  "date": "2026-04-05",
  "automationSource": "python-test",
  "automationSourceKey": "python-task"
}]}))`
    })

    const run = await service.runNow(job.id)
    expect(run.status).toBe('success')
    const resolvedRun = (await service.listRuns(job.id))[0]!
    const settings = await runtime.getSettings()

    expect(resolvedRun.status).toBe('success')
    expect(settings.calendarTasks[0]).toMatchObject({
      title: 'Python planning task',
      date: '2026-04-05',
      automationSource: 'python-test'
    })
  })

  it('keeps the job review status synchronized after resolving runs', async () => {
    const runtime = new MockRuntime(tempRoot)
    const service = new ScheduleService(runtime as never)
    await service.handleVaultChange(tempRoot)

    const job = await service.saveJob({
      name: 'Review scheduled task',
      enabled: false,
      trigger: { type: 'manual' },
      runtime: 'javascript',
      outputMode: 'review_before_apply',
      permissions: ['createTasks'],
      code: `beacon.emit({
        type: 'task.create',
        title: 'Review this task',
        automationSource: 'review-test',
        automationSourceKey: 'review-task'
      })`
    })

    const firstRun = await service.runNow(job.id)
    const secondRun = await service.runNow(job.id)

    expect(firstRun.status).toBe('review')
    expect(secondRun.status).toBe('review')
    expect((await service.listJobs())[0]?.lastStatus).toBe('review')

    await service.dismissRun(firstRun.id)
    expect((await service.listJobs())[0]?.lastStatus).toBe('review')

    await service.dismissRun(secondRun.id)
    expect((await service.listJobs())[0]?.lastStatus).toBe('cancelled')

    const appliedRun = await service.runNow(job.id)
    expect(appliedRun.status).toBe('review')
    await service.applyActions(appliedRun.id)
    expect((await service.listJobs())[0]?.lastStatus).toBe('success')
  })
})

describe('ScheduleService vault transitions', () => {
  let tempRoot: string

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-schedule-transition-test-'))
  })

  afterEach(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true })
  })

  it('waits for the destination vault before listing jobs during a switch', async () => {
    const runtime = new MockRuntime(tempRoot)
    const service = new ScheduleService(runtime as never)
    const destinationRoot = path.join(tempRoot, 'destination-vault')
    const destinationJob: ScheduleJob = {
      id: 'destination-job',
      name: 'Destination job',
      enabled: false,
      trigger: { type: 'manual' },
      runtime: 'javascript',
      code: '',
      permissions: [],
      outputMode: 'review_before_apply',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    }

    await new ScheduleStore(destinationRoot).writeJobs([destinationJob])

    let releaseReady!: (ready: boolean) => void
    runtime.setVaultReady(
      new Promise<boolean>((resolve) => {
        releaseReady = resolve
      })
    )

    try {
      await service.handleVaultChange(tempRoot)
      await service.handleVaultChange(null)

      const jobsPromise = service.listJobs()
      await service.handleVaultChange(destinationRoot)
      releaseReady(true)

      await expect(jobsPromise).resolves.toEqual([destinationJob])
    } finally {
      service.destroy()
    }
  })

  it('returns empty reads after the final vault is closed', async () => {
    const runtime = new MockRuntime(tempRoot)
    const service = new ScheduleService(runtime as never)

    try {
      await service.handleVaultChange(tempRoot)
      await service.handleVaultChange(null)

      await expect(service.listJobs()).resolves.toEqual([])
      await expect(service.listRuns('missing-job')).resolves.toEqual([])
      await expect(service.deleteJob('missing-job')).rejects.toThrow(
        'No vault selected for schedule operations'
      )
    } finally {
      service.destroy()
    }
  })
})

describe('computeNextRunAt', () => {
  it('uses the selected timezone for daily triggers', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-18T12:00:00.000Z'))

    try {
      expect(computeNextRunAt({ type: 'daily', time: '09:00', timezone: 'Asia/Bangkok' })).toBe(
        '2026-08-19T02:00:00.000Z'
      )
    } finally {
      vi.useRealTimers()
    }
  })
})
