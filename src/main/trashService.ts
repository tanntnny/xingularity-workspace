import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { assertSafeRelativePath, ensureWithinBase, joinSafe } from '../shared/pathSafety'
import type { AppSettings, WeeklyPlanState } from '../shared/types'

export interface TrashedEntry {
  originalRelPath: string
  trashRelPath: string
  kind: 'file' | 'folder'
  deletedAt: string
}

export class TrashService {
  private readonly trashRoot: string

  constructor(
    vaultRoot: string,
    private readonly notesRoot?: string
  ) {
    this.trashRoot = path.join(vaultRoot, '.trash')
  }

  async moveEntryToTrash(relPathInput: string): Promise<TrashedEntry> {
    if (!this.notesRoot) {
      throw new Error('Notes root is required for file trash operations')
    }

    const relPath = assertSafeRelativePath(relPathInput)
    const sourcePath = joinSafe(this.notesRoot, relPath)
    const stats = await fs.stat(sourcePath)
    const kind = stats.isDirectory() ? 'folder' : 'file'
    const deletedAt = new Date().toISOString()
    const entryId = `${formatTimestampForPath(deletedAt)}-${safeName(path.basename(relPath))}-${randomUUID().slice(0, 8)}`
    const trashRelPath = path.posix.join('files', entryId, relPath)
    const targetPath = this.resolveTrashPath(trashRelPath)

    await fs.mkdir(path.dirname(targetPath), { recursive: true })
    await fs.rename(sourcePath, targetPath)
    await this.writeJson(path.join(this.trashRoot, 'files', entryId, 'metadata.json'), {
      type: 'file-delete',
      originalRelPath: relPath,
      trashRelPath,
      kind,
      deletedAt
    })

    return {
      originalRelPath: relPath,
      trashRelPath,
      kind,
      deletedAt
    }
  }

  async restoreEntry(entry: TrashedEntry): Promise<string> {
    if (!this.notesRoot) {
      throw new Error('Notes root is required for file restore operations')
    }

    const sourcePath = this.resolveTrashPath(entry.trashRelPath)
    const restoreRelPath = await this.findAvailableRestorePath(entry.originalRelPath, entry.kind)
    const targetPath = joinSafe(this.notesRoot, restoreRelPath)
    await fs.mkdir(path.dirname(targetPath), { recursive: true })
    await fs.rename(sourcePath, targetPath)
    return restoreRelPath
  }

  async archiveSettingsDeletes(previous: AppSettings, next: AppSettings): Promise<void> {
    const records: Array<{ type: string; payload: unknown }> = []
    const nextProjectsById = new Map(next.projects.map((project) => [project.id, project]))

    for (const project of previous.projects) {
      if (!nextProjectsById.has(project.id)) {
        records.push({
          type: 'project-delete',
          payload: {
            project,
            icon: previous.projectIcons[project.id],
            wasFavorite: previous.favoriteProjectIds.includes(project.id),
            wasLastOpened: previous.lastOpenedProjectId === project.id
          }
        })
      }
    }

    for (const previousProject of previous.projects) {
      const nextProject = nextProjectsById.get(previousProject.id)
      if (!nextProject) {
        continue
      }

      const nextMilestonesById = new Map(
        nextProject.milestones.map((milestone) => [milestone.id, milestone])
      )
      previousProject.milestones.forEach((milestone, index) => {
        if (!nextMilestonesById.has(milestone.id)) {
          records.push({
            type: 'milestone-delete',
            payload: {
              projectId: previousProject.id,
              index,
              milestone
            }
          })
        }
      })

      for (const previousMilestone of previousProject.milestones) {
        const nextMilestone = nextMilestonesById.get(previousMilestone.id)
        if (!nextMilestone) {
          continue
        }

        const nextSubtasksById = new Set(nextMilestone.subtasks.map((subtask) => subtask.id))
        previousMilestone.subtasks.forEach((subtask, index) => {
          if (!nextSubtasksById.has(subtask.id)) {
            records.push({
              type: 'subtask-delete',
              payload: {
                projectId: previousProject.id,
                milestoneId: previousMilestone.id,
                index,
                subtask
              }
            })
          }
        })
      }
    }

    const nextTaskIds = new Set(next.calendarTasks.map((task) => task.id))
    previous.calendarTasks.forEach((task, index) => {
      if (!nextTaskIds.has(task.id)) {
        records.push({
          type: 'calendar-task-delete',
          payload: {
            index,
            task
          }
        })
      }
    })

    const nextGridItemIds = new Set(next.gridBoard.items.map((item) => item.id))
    previous.gridBoard.items.forEach((item, index) => {
      if (!nextGridItemIds.has(item.id)) {
        records.push({
          type: 'grid-item-delete',
          payload: {
            index,
            item
          }
        })
      }
    })

    await Promise.all(records.map((record) => this.archiveRecord(record.type, record.payload)))
  }

  async archiveWeeklyPlanDeletes(previous: WeeklyPlanState, next: WeeklyPlanState): Promise<void> {
    const records: Array<{ type: string; payload: unknown }> = []
    const nextWeekIds = new Set(next.weeks.map((week) => week.id))
    const nextPriorityIds = new Set(next.priorities.map((priority) => priority.id))
    const nextReviewIds = new Set(next.reviews.map((review) => review.id))

    previous.weeks.forEach((week, index) => {
      if (!nextWeekIds.has(week.id)) {
        records.push({
          type: 'weekly-plan-week-delete',
          payload: {
            index,
            week,
            priorities: previous.priorities.filter((priority) => priority.weekId === week.id),
            reviews: previous.reviews.filter((review) => review.weekId === week.id)
          }
        })
      }
    })

    previous.priorities.forEach((priority, index) => {
      if (!nextPriorityIds.has(priority.id) && nextWeekIds.has(priority.weekId)) {
        records.push({
          type: 'weekly-plan-priority-delete',
          payload: {
            index,
            priority
          }
        })
      }
    })

    previous.reviews.forEach((review, index) => {
      if (!nextReviewIds.has(review.id) && nextWeekIds.has(review.weekId)) {
        records.push({
          type: 'weekly-plan-review-delete',
          payload: {
            index,
            review
          }
        })
      }
    })

    await Promise.all(records.map((record) => this.archiveRecord(record.type, record.payload)))
  }

  private async archiveRecord(type: string, payload: unknown): Promise<void> {
    const deletedAt = new Date().toISOString()
    const fileName = `${formatTimestampForPath(deletedAt)}-${safeName(type)}-${randomUUID().slice(0, 8)}.json`
    await this.writeJson(path.join(this.trashRoot, 'records', fileName), {
      type,
      deletedAt,
      payload
    })
  }

  private async findAvailableRestorePath(
    relPathInput: string,
    kind: TrashedEntry['kind']
  ): Promise<string> {
    const relPath = assertSafeRelativePath(relPathInput)
    if (await this.isRestorePathAvailable(relPath)) {
      return relPath
    }

    const dir = path.posix.dirname(relPath)
    const base = path.posix.basename(relPath)
    const ext = kind === 'file' ? path.posix.extname(base) : ''
    const stem = ext ? base.slice(0, -ext.length) : base
    for (let index = 1; index <= 1000; index += 1) {
      const nextBase = `${stem} restored${index === 1 ? '' : ` ${index}`}${ext}`
      const candidate = dir === '.' ? nextBase : path.posix.join(dir, nextBase)
      if (await this.isRestorePathAvailable(candidate)) {
        return candidate
      }
    }

    throw new Error(`Could not restore ${relPath}: no available path`)
  }

  private async isRestorePathAvailable(relPath: string): Promise<boolean> {
    if (!this.notesRoot) {
      return false
    }

    try {
      await fs.access(joinSafe(this.notesRoot, relPath))
      return false
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return true
      }
      throw error
    }
  }

  private resolveTrashPath(relPathInput: string): string {
    const relPath = assertSafeRelativePath(relPathInput)
    const targetPath = path.resolve(this.trashRoot, relPath)
    ensureWithinBase(this.trashRoot, targetPath)
    return targetPath
  }

  private async writeJson(filePath: string, data: unknown): Promise<void> {
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
  }
}

function formatTimestampForPath(input: string): string {
  return input.replace(/[:.]/g, '-')
}

function safeName(input: string): string {
  return (
    input
      .trim()
      .replace(/[^a-zA-Z0-9._-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'item'
  )
}
