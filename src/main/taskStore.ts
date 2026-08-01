import fs from 'node:fs/promises'
import path from 'node:path'
import type { CalendarTask } from '../shared/types'
import { getVaultTaskPath, getVaultTasksDir } from './vaultData'

export class TaskStore {
  private readonly tasksDir: string

  constructor(private readonly vaultRoot: string) {
    this.tasksDir = getVaultTasksDir(vaultRoot)
  }

  async read(): Promise<CalendarTask[]> {
    try {
      const entries = await fs.readdir(this.tasksDir, { withFileTypes: true })
      const tasks: CalendarTask[] = []

      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith('.json')) {
          continue
        }

        try {
          const raw = await fs.readFile(path.join(this.tasksDir, entry.name), 'utf-8')
          const task = JSON.parse(raw) as CalendarTask
          if (typeof task.id === 'string' && typeof task.title === 'string') {
            tasks.push(task)
          }
        } catch (error) {
          console.error(`[TaskStore] Failed to read ${entry.name}`, error)
        }
      }

      return tasks.sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('[TaskStore] Failed to list task files', error)
      }
      return []
    }
  }

  async writeAll(tasks: CalendarTask[]): Promise<void> {
    await fs.mkdir(this.tasksDir, { recursive: true })
    const existingEntries = await fs.readdir(this.tasksDir, { withFileTypes: true })
    const nextNames = new Set<string>()

    await Promise.all(
      tasks.map(async (task) => {
        const targetPath = getVaultTaskPath(this.vaultRoot, task.id)
        nextNames.add(path.basename(targetPath))
        await writeJsonAtomically(targetPath, task)
      })
    )

    await Promise.all(
      existingEntries
        .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
        .filter((entry) => !nextNames.has(entry.name))
        .map((entry) => fs.unlink(path.join(this.tasksDir, entry.name)))
    )
  }
}

async function writeJsonAtomically(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  const tempPath = `${filePath}.tmp-${process.pid}`
  await fs.writeFile(tempPath, JSON.stringify(value, null, 2), 'utf-8')
  await fs.rename(tempPath, filePath)
}
