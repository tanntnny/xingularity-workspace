import { app } from 'electron'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { ScheduleJob, ScheduleRunRecord } from '../shared/scheduleTypes'
import {
  getLegacyVaultScheduleJobsPath,
  getLegacyVaultScheduleRunsPath,
  getVaultScheduleJobsPath,
  getVaultScheduleRunsPath
} from './vaultData'

const MAX_RUNS_PER_JOB = 100

export class ScheduleStore {
  private readonly jobsPath: string
  private readonly runsPath: string
  private readonly legacyJobsPath: string
  private readonly legacyRunsPath: string
  private readonly deviceLegacyJobsPath: string
  private readonly deviceLegacyRunsPath: string

  constructor(vaultRoot: string) {
    this.jobsPath = getVaultScheduleJobsPath(vaultRoot)
    this.runsPath = getVaultScheduleRunsPath(vaultRoot)
    this.legacyJobsPath = getLegacyVaultScheduleJobsPath(vaultRoot)
    this.legacyRunsPath = getLegacyVaultScheduleRunsPath(vaultRoot)
    this.deviceLegacyJobsPath = path.join(app.getPath('userData'), 'schedule-jobs.json')
    this.deviceLegacyRunsPath = path.join(app.getPath('userData'), 'schedule-runs.json')
  }

  async readJobs(): Promise<ScheduleJob[]> {
    return this.readJsonFile<ScheduleJob[]>(
      this.jobsPath,
      [this.legacyJobsPath, this.deviceLegacyJobsPath],
      []
    )
  }

  async writeJobs(jobs: ScheduleJob[]): Promise<void> {
    await this.writeJsonFile(this.jobsPath, jobs)
  }

  async upsertJob(job: ScheduleJob): Promise<void> {
    const jobs = await this.readJobs()
    const idx = jobs.findIndex((j) => j.id === job.id)
    if (idx >= 0) {
      jobs[idx] = job
    } else {
      jobs.push(job)
    }
    await this.writeJobs(jobs)
  }

  async deleteJob(id: string): Promise<void> {
    const jobs = await this.readJobs()
    await this.writeJobs(jobs.filter((j) => j.id !== id))
    const runs = await this.readRuns()
    await this.writeRuns(runs.filter((r) => r.jobId !== id))
  }

  async readRuns(): Promise<ScheduleRunRecord[]> {
    return this.readJsonFile<ScheduleRunRecord[]>(
      this.runsPath,
      [this.legacyRunsPath, this.deviceLegacyRunsPath],
      []
    )
  }

  async writeRuns(runs: ScheduleRunRecord[]): Promise<void> {
    await this.writeJsonFile(this.runsPath, runs)
  }

  async readRunsForJob(jobId: string): Promise<ScheduleRunRecord[]> {
    const all = await this.readRuns()
    return all
      .filter((r) => r.jobId === jobId)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  }

  async upsertRun(run: ScheduleRunRecord): Promise<void> {
    const all = await this.readRuns()
    const idx = all.findIndex((r) => r.id === run.id)
    if (idx >= 0) {
      all[idx] = run
    } else {
      all.push(run)
    }
    const jobRuns = all
      .filter((r) => r.jobId === run.jobId)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    const toKeep = new Set(jobRuns.slice(0, MAX_RUNS_PER_JOB).map((r) => r.id))
    const pruned = all.filter((r) => r.jobId !== run.jobId || toKeep.has(r.id))
    await this.writeRuns(pruned)
  }

  async findRun(runId: string): Promise<ScheduleRunRecord | null> {
    const all = await this.readRuns()
    return all.find((r) => r.id === runId) ?? null
  }

  private async readJsonFile<T>(filePath: string, legacyPaths: string[], fallback: T): Promise<T> {
    try {
      const raw = await fs.readFile(filePath, 'utf-8')
      return JSON.parse(raw) as T
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('Failed to read schedule store:', error)
      }

      for (const legacyPath of legacyPaths) {
        try {
          const legacyRaw = await fs.readFile(legacyPath, 'utf-8')
          const parsed = JSON.parse(legacyRaw) as T
          await this.writeJsonFile(filePath, parsed)
          return parsed
        } catch (legacyError) {
          if ((legacyError as NodeJS.ErrnoException).code !== 'ENOENT') {
            console.error('Failed to read legacy schedule store:', legacyError)
          }
        }
      }

      return fallback
    }
  }

  private async writeJsonFile(filePath: string, data: unknown): Promise<void> {
    const dir = path.dirname(filePath)
    const tmp = `${filePath}.tmp-${process.pid}-${randomUUID()}`
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf-8')
    await fs.rename(tmp, filePath)
  }
}
