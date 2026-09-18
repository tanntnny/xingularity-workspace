import { _electron as electron, type ElectronApplication, type Page } from 'playwright'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import { createVaultManifest } from '../src/main/vaultManifest'
import {
  createStoredNoteDocumentFromText,
  serializeStoredNoteDocument
} from '../src/shared/noteDocument'
import type { CalendarTask, Project, StickyNoteBoardState } from '../src/shared/types'

declare global {
  interface Window {
    vaultApi?: {
      vault: {
        restoreLast: () => Promise<unknown>
      }
    }
  }
}

type ProfileName = 'smoke' | 'baseline'
type GpuMode = 'normal' | 'disabled'
type ScenarioStatus = 'ok' | 'skipped' | 'error'

interface ProfileDefinition {
  noteCount: number
  projectCount: number
  taskCount: number
  stickyNoteCount: number
  scheduleCount: number
  externalUpdateCount: number
  defaultIdleMs: number
}

const PROFILES: Record<ProfileName, ProfileDefinition> = {
  smoke: {
    noteCount: 12,
    projectCount: 2,
    taskCount: 24,
    stickyNoteCount: 5,
    scheduleCount: 2,
    externalUpdateCount: 8,
    defaultIdleMs: 1_000
  },
  baseline: {
    noteCount: 1_000,
    projectCount: 100,
    taskCount: 2_000,
    stickyNoteCount: 100,
    scheduleCount: 20,
    externalUpdateCount: 40,
    defaultIdleMs: 60_000
  }
}

interface AuditOptions {
  profile: ProfileName
  gpuMode: GpuMode
  trace: boolean
  noDocs: boolean
  idleMs: number
  repeats: number
  fixtureRoot?: string
}

interface FixtureInfo {
  rootPath: string
  owned: boolean
  firstNotePath: string | null
  drawingPath: string | null
  counts: {
    notes: number | null
    projects: number | null
    tasks: number | null
    stickyNotes: number | null
    schedules: number | null
  }
}

interface ProcessMetricSnapshot {
  type: string
  name: string
  pid: number
  cpu: {
    percentCPUUsage: number
    idleWakeupsPerSecond: number
  }
  memory: {
    workingSetSize: number
    peakWorkingSetSize: number
    privateBytes: number
    sharedBytes: number
  }
}

interface MainSnapshot {
  timestampMs: number
  metrics: ProcessMetricSnapshot[]
  rendererPids: number[]
  gpu: {
    hardwareAcceleration: boolean | null
    featureStatus: Record<string, unknown>
    completeInfo?: unknown
  }
}

interface ProcessSummary {
  totalCpuPercent: number
  browserCpuPercent: number
  rendererCpuPercent: number
  gpuProcessCpuPercent: number
  totalWorkingSetMb: number
  rendererWorkingSetMb: number
  gpuWorkingSetMb: number
  processCount: number
}

interface RendererProbeResult {
  durationMs: number
  frameCount: number
  maxFrameGapMs: number
  estimatedDroppedFrames: number
  longTaskCount: number
  longTaskTotalMs: number
  maxLongTaskMs: number
  mutationCount: number
  domNodeCount: number
}

interface ScenarioResult {
  id: string
  category: string
  label: string
  status: ScenarioStatus
  wallMs?: number
  process?: {
    sampleIntervalMs: number
    summary: ProcessSummary
  }
  renderer?: RendererProbeResult
  error?: string
  trace?: TraceSummary
}

interface ScenarioDefinition {
  id: string
  category: string
  label: string
  enabled?: boolean
  availabilitySelector?: string
  before?: () => Promise<void>
  action: () => Promise<void>
  settleMs?: number
  tracePath?: string
}

interface TraceSummary {
  captured: boolean
  path?: string
  eventCount?: number
  gpuRelatedEventCount?: number
  gpuRelatedDurationMs?: number
  frameEventCount?: number
  rasterEventCount?: number
}

interface AuditReport {
  runId: string
  startedAt: string
  finishedAt: string
  platform: NodeJS.Platform
  arch: string
  electronVersion: string
  options: AuditOptions
  fixture: FixtureInfo['counts'] & { source: 'generated' | 'provided' }
  startup: {
    readyWallMs: number
    process: {
      sampleIntervalMs: number
      summary: ProcessSummary
    }
  }
  gpu: MainSnapshot['gpu']
  scenarios: ScenarioResult[]
  artifacts: {
    directory: string
    reportPath: string
  }
}

interface LaunchResult {
  electronApp: ElectronApplication
  page: Page
  startup: AuditReport['startup']
  gpu: MainSnapshot['gpu']
  electronVersion: string
}

const repoRoot = path.resolve(process.cwd())

function parseInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

function parseOptions(argv: string[]): AuditOptions {
  const profileValue = process.env.XINGULARITY_PERF_PROFILE ?? 'baseline'
  const profile: ProfileName = profileValue === 'smoke' ? 'smoke' : 'baseline'
  const args = new Set(argv)
  const profileArg = argv.find((arg) => arg.startsWith('--profile='))?.split('=')[1]
  const requestedProfile: ProfileName = profileArg === 'smoke' ? 'smoke' : profile
  const smoke = args.has('--smoke') || requestedProfile === 'smoke'
  const traceEnv = process.env.XINGULARITY_PERF_TRACE
  const trace = args.has('--trace') || (!args.has('--no-trace') && traceEnv !== '0' && !smoke)
  const gpuMode: GpuMode =
    argv.find((arg) => arg.startsWith('--gpu='))?.split('=')[1] === 'disabled' ||
    process.env.XINGULARITY_PERF_GPU === 'disabled'
      ? 'disabled'
      : 'normal'

  return {
    profile: smoke ? 'smoke' : requestedProfile,
    gpuMode,
    trace,
    noDocs: args.has('--no-docs'),
    idleMs: parseInteger(
      argv.find((arg) => arg.startsWith('--idle-ms='))?.split('=')[1] ??
        process.env.XINGULARITY_PERF_IDLE_MS,
      PROFILES[smoke ? 'smoke' : requestedProfile].defaultIdleMs
    ),
    repeats: Math.max(
      1,
      parseInteger(
        argv.find((arg) => arg.startsWith('--repeats='))?.split('=')[1] ??
          process.env.XINGULARITY_PERF_REPEATS,
        1
      )
    ),
    fixtureRoot:
      argv.find((arg) => arg.startsWith('--vault-root='))?.slice('--vault-root='.length) ??
      process.env.XINGULARITY_PERF_VAULT_ROOT
  }
}

function cssTestId(testId: string): string {
  return `[data-testid="${testId}"]`
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function offsetDate(days: number): string {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + days)
  return toDateOnly(date)
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, '0')
}

function createRunId(date = new Date()): string {
  return `RUN-${date.getFullYear()}${pad(date.getMonth() + 1, 2)}${pad(date.getDate(), 2)}-${pad(date.getHours(), 2)}${pad(date.getMinutes(), 2)}${pad(date.getSeconds(), 2)}`
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`${label} timed out after ${timeoutMs} ms`))
        }, timeoutMs)
      })
    ])
  } finally {
    if (timer) {
      clearTimeout(timer)
    }
  }
}

async function closeElectronApp(electronApp: ElectronApplication | null): Promise<void> {
  if (!electronApp) {
    return
  }

  const child = electronApp.process()
  try {
    await withTimeout(electronApp.close(), 5_000, 'Electron shutdown')
  } catch {
    // Fall through to process cleanup when Electron cannot answer the close
    // request because the main or renderer process is unresponsive.
  }
  if (child.exitCode === null && !child.killed) {
    await delay(250)
    if (child.exitCode === null && !child.killed) {
      child.kill('SIGTERM')
      await delay(250)
    }
  }
  if (child.exitCode === null && !child.killed) {
    child.kill('SIGKILL')
  }
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

async function writeJsonBatch(entries: Array<[string, unknown]>, batchSize = 200): Promise<void> {
  for (let start = 0; start < entries.length; start += batchSize) {
    const batch = entries.slice(start, start + batchSize)
    await Promise.all(batch.map(([filePath, value]) => writeJson(filePath, value)))
  }
}

function createProject(index: number, updatedAt: string): Project {
  return {
    id: `perf-project-${index}`,
    name: `Performance project ${index + 1}`,
    summary: `Synthetic project ${index + 1} used by the performance audit.`,
    description: `Synthetic project ${index + 1} used by the performance audit.`,
    state: 'active',
    tags: ['performance', index % 2 === 0 ? 'active' : 'planning'],
    updatedAt,
    icon: {
      set: 'tabler',
      glyph: 'briefcase',
      variant: 'filled',
      color: '#38bdf8'
    }
  }
}

function createTask(index: number, projectCount: number, createdAt: string): CalendarTask {
  const scheduled = index % 9 !== 0
  const projectId = projectCount > 0 ? `perf-project-${index % projectCount}` : undefined
  return {
    id: `perf-task-${index}`,
    title: `Performance task ${index + 1}`,
    description: 'Synthetic task for performance measurement.',
    projectId,
    tags: ['performance', index % 3 === 0 ? 'deep-work' : 'follow-up'],
    date: scheduled ? offsetDate((index % 29) - 14) : undefined,
    endDate: scheduled && index % 13 === 0 ? offsetDate((index % 29) - 12) : undefined,
    completed: index % 17 === 0,
    status: index % 17 === 0 ? 'completed' : 'pending',
    createdAt,
    priority: index % 5 === 0 ? 'high' : index % 2 === 0 ? 'medium' : 'low',
    taskType: index % 4 === 0 ? 'deep-work' : 'assignment',
    reminders: [],
    time: scheduled && index % 4 === 0 ? '09:00' : undefined,
    endTime: scheduled && index % 4 === 0 ? '10:00' : undefined
  }
}

function createStickyNoteBoard(count: number): StickyNoteBoardState {
  return {
    viewport: { x: 0, y: 0, zoom: 1 },
    notes: Array.from({ length: count }, (_, index) => ({
      id: `sticky-note:performance-${index}`,
      text: `Synthetic sticky note ${index + 1}`,
      color: (['yellow', 'blue', 'green', 'pink', 'orange', 'purple'] as const)[index % 6],
      position: {
        x: (index % 10) * 300,
        y: Math.floor(index / 10) * 260
      },
      size: { width: 260, height: 220 },
      zIndex: count - index
    }))
  }
}

function createSchedule(index: number, updatedAt: string): Record<string, unknown> {
  return {
    id: `perf-schedule-${index}`,
    name: `Performance automation ${index + 1}`,
    enabled: false,
    trigger: { type: 'daily', time: '08:00', timezone: 'local' },
    runtime: 'javascript',
    code: 'print({})',
    permissions: ['createTasks'],
    outputMode: 'review_before_apply',
    createdAt: updatedAt,
    updatedAt
  }
}

async function createFixtureVault(profile: ProfileDefinition): Promise<FixtureInfo> {
  const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-performance-vault-'))
  const now = new Date().toISOString()
  const directories = [
    '.xingularity',
    'notebooks',
    'attachments',
    'projects',
    'tasks',
    'calendar',
    'weekly-plan',
    'subscriptions',
    'schedules',
    'agent',
    'excalidraw',
    'resources'
  ]
  await Promise.all(
    directories.map((directory) => fs.mkdir(path.join(rootPath, directory), { recursive: true }))
  )

  await writeJson(
    path.join(rootPath, '.xingularity', 'manifest.json'),
    createVaultManifest({ vaultId: `perf-audit-${Date.now()}` })
  )
  await writeJson(path.join(rootPath, 'settings.json'), {
    stickyNoteBoard: createStickyNoteBoard(profile.stickyNoteCount),
    featureFlags: {}
  })
  await writeJson(path.join(rootPath, 'vault.json'), { version: 1, createdAt: now })
  await writeJson(path.join(rootPath, 'filemap.json'), {})
  await writeJson(path.join(rootPath, 'migrations.json'), { version: 2 })
  await writeJson(
    path.join(rootPath, 'schedules', 'jobs.json'),
    Array.from({ length: profile.scheduleCount }, (_, index) => createSchedule(index, now))
  )
  await writeJson(path.join(rootPath, 'resources', 'resources.json'), [])

  const projects = Array.from({ length: profile.projectCount }, (_, index) =>
    createProject(index, now)
  )
  await writeJsonBatch(
    projects.map((project) => [
      path.join(rootPath, 'projects', `${encodeURIComponent(project.id)}.json`),
      project
    ])
  )

  const tasks = Array.from({ length: profile.taskCount }, (_, index) =>
    createTask(index, profile.projectCount, now)
  )
  await writeJsonBatch(
    tasks.map((task) => [path.join(rootPath, 'tasks', `${encodeURIComponent(task.id)}.json`), task])
  )

  const noteEntries = Array.from({ length: profile.noteCount }, (_, index) => {
    const notePath = `performance-note-${pad(index, 4)}.md`
    const relatedPath = `performance-note-${pad((index + 1) % profile.noteCount, 4)}.md`
    const markdown = createStoredNoteDocumentFromText(
      `# Performance note ${index + 1}\n\nThis synthetic note exercises note-tree, search, indexing, and editor rendering paths.\n\n- Benchmark item ${index + 1}\n- Related note: [${relatedPath}](${relatedPath})\n- Stable body text for representative list and preview work.\n\n${'Representative paragraph content used to keep note sizes non-trivial. '.repeat(8)}\n`,
      ['performance', index % 4 === 0 ? 'priority' : 'benchmark']
    )
    return [path.join(rootPath, 'notebooks', notePath), serializeStoredNoteDocument(markdown)] as [
      string,
      string
    ]
  })
  for (let start = 0; start < noteEntries.length; start += 200) {
    const batch = noteEntries.slice(start, start + 200)
    await Promise.all(batch.map(([filePath, content]) => fs.writeFile(filePath, content, 'utf8')))
  }

  const drawingPath = 'performance-diagram.excalidraw'
  await writeJson(path.join(rootPath, 'notebooks', drawingPath), {
    version: 1,
    scene: {
      type: 'excalidraw',
      version: 2,
      source: 'https://excalidraw.com',
      elements: [],
      appState: { viewBackgroundColor: 'transparent' },
      files: {}
    }
  })

  return {
    rootPath,
    owned: true,
    firstNotePath: 'performance-note-0000.md',
    drawingPath,
    counts: {
      notes: profile.noteCount,
      projects: profile.projectCount,
      tasks: profile.taskCount,
      stickyNotes: profile.stickyNoteCount,
      schedules: profile.scheduleCount
    }
  }
}

async function resolveFixture(options: AuditOptions): Promise<FixtureInfo> {
  if (options.fixtureRoot) {
    await fs.access(path.resolve(options.fixtureRoot))
    return {
      rootPath: path.resolve(options.fixtureRoot),
      owned: false,
      firstNotePath: null,
      drawingPath: null,
      counts: {
        notes: null,
        projects: null,
        tasks: null,
        stickyNotes: null,
        schedules: null
      }
    }
  }

  return createFixtureVault(PROFILES[options.profile])
}

async function collectMainSnapshot(
  electronApp: ElectronApplication,
  includeGpuInfo = false
): Promise<MainSnapshot> {
  return electronApp.evaluate(async ({ app, BrowserWindow }, shouldReadGpuInfo) => {
    const metrics = app.getAppMetrics().map((metric) => ({
      type: String(metric.type),
      name: metric.name ?? metric.type,
      pid: metric.pid,
      cpu: {
        percentCPUUsage: metric.cpu.percentCPUUsage,
        idleWakeupsPerSecond: metric.cpu.idleWakeupsPerSecond
      },
      memory: {
        workingSetSize: metric.memory.workingSetSize,
        peakWorkingSetSize: metric.memory.peakWorkingSetSize,
        privateBytes: metric.memory.privateBytes ?? 0,
        sharedBytes: 0
      }
    }))
    let completeInfo: unknown
    if (shouldReadGpuInfo) {
      try {
        completeInfo = await app.getGPUInfo('complete')
      } catch {
        completeInfo = undefined
      }
    }

    return {
      timestampMs: Date.now(),
      metrics,
      rendererPids: BrowserWindow.getAllWindows().map((window) =>
        window.webContents.getOSProcessId()
      ),
      gpu: {
        hardwareAcceleration: app.isHardwareAccelerationEnabled(),
        featureStatus: app.getGPUFeatureStatus() as unknown as Record<string, unknown>,
        ...(completeInfo === undefined ? {} : { completeInfo })
      }
    }
  }, includeGpuInfo)
}

function sumMetrics(
  metrics: ProcessMetricSnapshot[],
  selector: (metric: ProcessMetricSnapshot) => boolean
): {
  cpu: number
  memoryMb: number
} {
  return metrics.filter(selector).reduce(
    (total, metric) => ({
      cpu: total.cpu + metric.cpu.percentCPUUsage,
      memoryMb: total.memoryMb + metric.memory.workingSetSize / 1024
    }),
    { cpu: 0, memoryMb: 0 }
  )
}

function summarizeProcesses(snapshot: MainSnapshot): ProcessSummary {
  const rendererPids = new Set(snapshot.rendererPids)
  const renderer = sumMetrics(
    snapshot.metrics,
    (metric) => rendererPids.has(metric.pid) || /tab|renderer/i.test(metric.type)
  )
  const gpu = sumMetrics(snapshot.metrics, (metric) => /^gpu$/i.test(metric.type))
  const browser = sumMetrics(snapshot.metrics, (metric) => /^browser$/i.test(metric.type))
  const total = sumMetrics(snapshot.metrics, () => true)

  return {
    totalCpuPercent: total.cpu,
    browserCpuPercent: browser.cpu,
    rendererCpuPercent: renderer.cpu,
    gpuProcessCpuPercent: gpu.cpu,
    totalWorkingSetMb: total.memoryMb,
    rendererWorkingSetMb: renderer.memoryMb,
    gpuWorkingSetMb: gpu.memoryMb,
    processCount: snapshot.metrics.length
  }
}

async function installRendererProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    type ProbeState = {
      startedAt: number
      lastFrameAt: number | null
      frameCount: number
      maxFrameGapMs: number
      longTaskCount: number
      longTaskTotalMs: number
      maxLongTaskMs: number
      mutationCount: number
      rafId: number
      longTaskObserver?: PerformanceObserver
      mutationObserver?: MutationObserver
    }
    type Probe = {
      start: () => void
      stop: () => RendererProbeResult
    }
    type ProbeWindow = Window & { __xingularityPerformanceProbe?: Probe }
    const target = window as ProbeWindow
    if (target.__xingularityPerformanceProbe) {
      return
    }

    let state: ProbeState = {
      startedAt: globalThis.performance.now(),
      lastFrameAt: null,
      frameCount: 0,
      maxFrameGapMs: 0,
      longTaskCount: 0,
      longTaskTotalMs: 0,
      maxLongTaskMs: 0,
      mutationCount: 0,
      rafId: 0
    }

    const reset = (): void => {
      state = {
        startedAt: globalThis.performance.now(),
        lastFrameAt: null,
        frameCount: 0,
        maxFrameGapMs: 0,
        longTaskCount: 0,
        longTaskTotalMs: 0,
        maxLongTaskMs: 0,
        mutationCount: 0,
        rafId: 0
      }
    }

    const frame = (timestamp: number): void => {
      if (state.lastFrameAt !== null) {
        state.maxFrameGapMs = Math.max(state.maxFrameGapMs, timestamp - state.lastFrameAt)
      }
      state.lastFrameAt = timestamp
      state.frameCount += 1
      state.rafId = requestAnimationFrame(frame)
    }

    const startObservers = (): void => {
      state.longTaskObserver?.disconnect()
      state.mutationObserver?.disconnect()
      const observerConstructor = (
        globalThis as typeof globalThis & {
          PerformanceObserver?: typeof PerformanceObserver
        }
      ).PerformanceObserver
      if (observerConstructor) {
        state.longTaskObserver = new observerConstructor((list) => {
          for (const entry of list.getEntries()) {
            if (entry.startTime < state.startedAt) {
              continue
            }
            state.longTaskCount += 1
            state.longTaskTotalMs += entry.duration
            state.maxLongTaskMs = Math.max(state.maxLongTaskMs, entry.duration)
          }
        })
        try {
          state.longTaskObserver.observe({ entryTypes: ['longtask'] })
        } catch {
          state.longTaskObserver = undefined
        }
      }

      if (document.body) {
        state.mutationObserver = new MutationObserver((records) => {
          state.mutationCount += records.length
        })
        state.mutationObserver.observe(document.body, {
          subtree: true,
          childList: true,
          attributes: true,
          characterData: true
        })
      }
    }

    target.__xingularityPerformanceProbe = {
      start: (): void => {
        cancelAnimationFrame(state.rafId)
        reset()
        startObservers()
        state.rafId = requestAnimationFrame(frame)
      },
      stop: (): RendererProbeResult => {
        const stoppedAt = globalThis.performance.now()
        cancelAnimationFrame(state.rafId)
        state.longTaskObserver?.disconnect()
        state.mutationObserver?.disconnect()
        return {
          durationMs: Math.max(0, stoppedAt - state.startedAt),
          frameCount: state.frameCount,
          maxFrameGapMs: state.maxFrameGapMs,
          estimatedDroppedFrames: Math.max(0, Math.round(state.maxFrameGapMs / 16.67) - 1),
          longTaskCount: state.longTaskCount,
          longTaskTotalMs: state.longTaskTotalMs,
          maxLongTaskMs: state.maxLongTaskMs,
          mutationCount: state.mutationCount,
          domNodeCount: document.getElementsByTagName('*').length
        }
      }
    }
  })
}

async function startRendererProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    type Probe = { start: () => void }
    const probe = (window as Window & { __xingularityPerformanceProbe?: Probe })
      .__xingularityPerformanceProbe
    if (!probe) {
      throw new Error('Renderer performance probe was not installed')
    }
    probe.start()
  })
}

async function stopRendererProbe(page: Page): Promise<RendererProbeResult> {
  return page.evaluate(() => {
    type Probe = { stop: () => RendererProbeResult }
    const probe = (window as Window & { __xingularityPerformanceProbe?: Probe })
      .__xingularityPerformanceProbe
    if (!probe) {
      throw new Error('Renderer performance probe was not installed')
    }
    return probe.stop()
  })
}

async function startTrace(electronApp: ElectronApplication): Promise<boolean> {
  try {
    await electronApp.evaluate(async ({ contentTracing }) => {
      await contentTracing.startRecording({ included_categories: ['*'] })
    })
    return true
  } catch (error) {
    console.warn(
      `Unable to start Chromium trace: ${error instanceof Error ? error.message : String(error)}`
    )
    return false
  }
}

async function stopTrace(
  electronApp: ElectronApplication,
  tracePath: string,
  started: boolean
): Promise<TraceSummary> {
  if (!started) {
    return { captured: false }
  }

  try {
    await electronApp.evaluate(async ({ contentTracing }, destination) => {
      await contentTracing.stopRecording(destination)
    }, tracePath)
    const summary = await summarizeTrace(tracePath)
    return { captured: true, path: tracePath, ...summary }
  } catch (error) {
    console.warn(
      `Unable to stop Chromium trace: ${error instanceof Error ? error.message : String(error)}`
    )
    return { captured: false }
  }
}

async function summarizeTrace(tracePath: string): Promise<Omit<TraceSummary, 'captured' | 'path'>> {
  const parsed = JSON.parse(await fs.readFile(tracePath, 'utf8')) as {
    traceEvents?: Array<{ cat?: string; name?: string; dur?: number; ph?: string }>
  }
  const events = parsed.traceEvents ?? []
  const gpuEvents = events.filter(
    (event) =>
      /gpu|viz|raster|\bcc\b/i.test(event.cat ?? '') || /gpu|viz|raster/i.test(event.name ?? '')
  )
  const rasterEvents = events.filter((event) =>
    /raster/i.test(`${event.cat ?? ''} ${event.name ?? ''}`)
  )
  const frameEvents = events.filter((event) =>
    /drawframe|framepresent|composit/i.test(event.name ?? '')
  )
  const gpuRelatedDurationMs = gpuEvents.reduce(
    (total, event) => total + (typeof event.dur === 'number' ? event.dur / 1_000 : 0),
    0
  )

  return {
    eventCount: events.length,
    gpuRelatedEventCount: gpuEvents.length,
    gpuRelatedDurationMs,
    frameEventCount: frameEvents.length,
    rasterEventCount: rasterEvents.length
  }
}

async function waitForTestId(page: Page, testId: string, timeout = 30_000): Promise<void> {
  await page.locator(cssTestId(testId)).first().waitFor({ state: 'visible', timeout })
}

async function waitForAny(page: Page, selectors: string, timeout = 30_000): Promise<void> {
  await page.locator(selectors).first().waitFor({ state: 'visible', timeout })
}

async function clickTestId(page: Page, testId: string): Promise<void> {
  const locator = page.locator(cssTestId(testId)).first()
  await locator.waitFor({ state: 'visible', timeout: 30_000 })
  await locator.click()
}

async function openNotes(page: Page): Promise<void> {
  await clickTestId(page, 'sidebar-page:notes')
  await waitForTestId(page, 'note-file-tree-panel')
}

async function openProjects(page: Page): Promise<void> {
  await clickTestId(page, 'sidebar-page:projects')
  await waitForTestId(page, 'all-projects-page')
}

async function openCalendar(page: Page): Promise<void> {
  await clickTestId(page, 'sidebar-page:calendar')
  await waitForAny(page, '[data-testid="calendar-month-view"], [data-testid="calendar-week-view"]')
}

async function openSchedules(page: Page): Promise<void> {
  await clickTestId(page, 'sidebar-page:schedules')
  await waitForTestId(page, 'scheduling-page')
}

async function openSettings(page: Page): Promise<void> {
  await clickTestId(page, 'sidebar-page:settings')
  await waitForTestId(page, 'settings-tabs')
}

async function openKnowledge(page: Page): Promise<void> {
  await clickTestId(page, 'sidebar-page:knowledge')
  await waitForTestId(page, 'knowledge-page')
}

async function openStickyNotes(page: Page): Promise<void> {
  await clickTestId(page, 'sidebar-page:stickyNote')
  await waitForTestId(page, 'sticky-note-page')
}

async function openFirstNote(page: Page, fixture: FixtureInfo): Promise<void> {
  await openNotes(page)
  const selector = fixture.firstNotePath
    ? cssTestId(`note-tree-row:${fixture.firstNotePath}`)
    : '[data-testid^="note-tree-row:"]'
  const noteRow = page.locator(selector).first()
  await noteRow.waitFor({ state: 'visible', timeout: 30_000 })
  await noteRow.click()
  await page
    .locator('[data-testid="note-block-editor"]')
    .waitFor({ state: 'visible', timeout: 30_000 })
}

async function launchWithFixture(
  fixture: FixtureInfo,
  options: AuditOptions
): Promise<LaunchResult> {
  const userDataPath = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-performance-user-'))
  const startupTimeoutMs = options.profile === 'baseline' ? 180_000 : 60_000
  // Seed the path before Electron starts so the renderer's built-in restore
  // effect owns activation and the audit does not race it with a second call.
  await writeJson(path.join(userDataPath, 'settings.json'), { lastVaultPath: fixture.rootPath })
  const launchStartedAt = performance.now()
  const args = ['.', `--user-data-dir=${userDataPath}`]
  if (options.gpuMode === 'disabled') {
    args.push('--disable-gpu')
  }
  let electronApp: ElectronApplication | null = null
  try {
    electronApp = await electron.launch({
      args,
      cwd: repoRoot,
      env: { ...process.env, CI: '1' },
      timeout: startupTimeoutMs
    })
    return await withTimeout(
      (async () => {
        const initialSnapshot = await collectMainSnapshot(electronApp!)
        const page = await electronApp!.firstWindow()
        await page.waitForLoadState('domcontentloaded')

        const actualUserDataPath = await electronApp!.evaluate(({ app }) => app.getPath('userData'))
        if (actualUserDataPath !== userDataPath) {
          await waitForTestId(page, 'vault-required-page', 30_000)
          await writeJson(path.join(actualUserDataPath, 'settings.json'), {
            lastVaultPath: fixture.rootPath
          })
          await page.waitForFunction(
            () => typeof window.vaultApi?.vault?.restoreLast === 'function',
            undefined,
            {
              timeout: 30_000
            }
          )
          await page.evaluate(async () => {
            await window.vaultApi?.vault.restoreLast()
          })
        }
        await page.waitForFunction(
          () => {
            const button = document.querySelector<HTMLButtonElement>(
              '[data-testid="sidebar-page:notes"]'
            )
            return Boolean(button && !button.disabled)
          },
          undefined,
          { timeout: startupTimeoutMs }
        )
        await waitForTestId(page, 'sidebar-page:notes', startupTimeoutMs)

        const readySnapshot = await collectMainSnapshot(electronApp!)
        const gpuSnapshot = await collectMainSnapshot(electronApp!, true)
        const electronVersion = await electronApp!.evaluate(
          () => process.versions.electron ?? 'unknown'
        )
        return {
          electronApp: electronApp!,
          page,
          startup: {
            readyWallMs: performance.now() - launchStartedAt,
            process: {
              sampleIntervalMs: Math.max(
                0,
                readySnapshot.timestampMs - initialSnapshot.timestampMs
              ),
              summary: summarizeProcesses({
                ...readySnapshot,
                rendererPids: Array.from(
                  new Set([...initialSnapshot.rendererPids, ...readySnapshot.rendererPids])
                )
              })
            }
          },
          gpu: gpuSnapshot.gpu,
          electronVersion
        }
      })(),
      startupTimeoutMs,
      'Electron vault activation'
    )
  } catch (error) {
    await closeElectronApp(electronApp)
    throw error
  }
}

async function runScenario(
  electronApp: ElectronApplication,
  page: Page,
  definition: ScenarioDefinition
): Promise<ScenarioResult> {
  const result: ScenarioResult = {
    id: definition.id,
    category: definition.category,
    label: definition.label,
    status: 'ok'
  }
  if (definition.enabled === false) {
    result.status = 'skipped'
    return result
  }

  if (
    definition.availabilitySelector &&
    (await page.locator(definition.availabilitySelector).count()) === 0
  ) {
    result.status = 'skipped'
    return result
  }

  let traceStarted = false
  try {
    await definition.before?.()
    await delay(250)
    await installRendererProbe(page)
    if (definition.tracePath) {
      traceStarted = await startTrace(electronApp)
    }
    const before = await collectMainSnapshot(electronApp)
    await startRendererProbe(page)
    const startedAt = performance.now()
    await definition.action()
    result.wallMs = performance.now() - startedAt
    if ((definition.settleMs ?? 300) > 0) {
      await delay(definition.settleMs ?? 300)
    }
    const after = await collectMainSnapshot(electronApp)
    result.renderer = await stopRendererProbe(page)
    result.process = {
      sampleIntervalMs: Math.max(0, after.timestampMs - before.timestampMs),
      summary: summarizeProcesses(after)
    }
  } catch (error) {
    result.status = 'error'
    result.error = error instanceof Error ? error.message : String(error)
    try {
      result.renderer = await stopRendererProbe(page)
    } catch {
      // The page may have failed before the renderer probe could be stopped.
    }
  } finally {
    if (definition.tracePath) {
      result.trace = await stopTrace(electronApp, definition.tracePath, traceStarted)
    }
  }
  return result
}

function createScenarioDefinitions(
  page: Page,
  fixture: FixtureInfo,
  options: AuditOptions,
  artifactDirectory: string
): ScenarioDefinition[] {
  const sidebar = (pageId: string): string => cssTestId(`sidebar-page:${pageId}`)
  const noteAvailable = fixture.owned || fixture.firstNotePath === null
  const drawingAvailable = fixture.drawingPath !== null
  const definitions: ScenarioDefinition[] = [
    {
      id: 'navigation.notes',
      category: 'navigation',
      label: 'Navigate to Notes',
      availabilitySelector: sidebar('notes'),
      action: () => openNotes(page)
    },
    {
      id: 'navigation.projects',
      category: 'navigation',
      label: 'Navigate to Projects',
      availabilitySelector: sidebar('projects'),
      action: () => openProjects(page)
    },
    {
      id: 'navigation.calendar',
      category: 'navigation',
      label: 'Navigate to Calendar',
      availabilitySelector: sidebar('calendar'),
      action: () => openCalendar(page)
    },
    {
      id: 'navigation.schedules',
      category: 'navigation',
      label: 'Navigate to Schedules',
      availabilitySelector: sidebar('schedules'),
      action: () => openSchedules(page)
    },
    {
      id: 'navigation.settings',
      category: 'navigation',
      label: 'Navigate to Settings',
      availabilitySelector: sidebar('settings'),
      action: () => openSettings(page)
    },
    {
      id: 'idle.notes',
      category: 'idle',
      label: `Idle on Notes for ${options.idleMs} ms`,
      availabilitySelector: sidebar('notes'),
      before: () => openNotes(page),
      action: () => delay(options.idleMs),
      settleMs: 0
    },
    {
      id: 'idle.projects',
      category: 'idle',
      label: `Idle on Projects for ${options.idleMs} ms`,
      availabilitySelector: sidebar('projects'),
      before: () => openProjects(page),
      action: () => delay(options.idleMs),
      settleMs: 0
    },
    {
      id: 'idle.calendar',
      category: 'idle',
      label: `Idle on Calendar for ${options.idleMs} ms`,
      availabilitySelector: sidebar('calendar'),
      before: () => openCalendar(page),
      action: () => delay(options.idleMs),
      settleMs: 0
    },
    {
      id: 'idle.schedules',
      category: 'idle',
      label: `Idle on Schedules for ${options.idleMs} ms`,
      availabilitySelector: sidebar('schedules'),
      before: () => openSchedules(page),
      action: () => delay(options.idleMs),
      settleMs: 0
    },
    {
      id: 'calendar.next-period',
      category: 'calendar',
      label: 'Calendar next period',
      availabilitySelector: sidebar('calendar'),
      before: () => openCalendar(page),
      action: async () => {
        await clickTestId(page, 'calendar-period-next')
        await delay(250)
      }
    },
    {
      id: 'calendar.previous-period',
      category: 'calendar',
      label: 'Calendar previous period',
      availabilitySelector: sidebar('calendar'),
      before: () => openCalendar(page),
      action: async () => {
        await clickTestId(page, 'calendar-period-previous')
        await delay(250)
      }
    },
    {
      id: 'command-palette.search',
      category: 'search',
      label: 'Open command palette and search the synthetic vault',
      availabilitySelector: sidebar('notes'),
      before: () => openNotes(page),
      action: async () => {
        await page.getByRole('button', { name: 'Open command palette' }).click()
        const input = page.locator('input[placeholder*="Search names"]')
        await input.waitFor({ state: 'visible', timeout: 30_000 })
        await input.fill('@performance')
        await delay(250)
        await page.keyboard.press('Escape')
      }
    },
    {
      id: 'editor.long-note-input',
      category: 'editor',
      label: 'Append text to a long note',
      enabled: noteAvailable,
      availabilitySelector: sidebar('notes'),
      before: () => openFirstNote(page, fixture),
      action: async () => {
        const editor = page
          .locator('[data-testid="note-block-editor"] [contenteditable="true"]')
          .first()
        await editor.waitFor({ state: 'visible', timeout: 30_000 })
        await editor.click()
        await page.keyboard.press('End')
        await page.keyboard.insertText(' Performance audit input')
      }
    },
    {
      id: 'idle.editor',
      category: 'idle',
      label: `Idle in the editor for ${options.idleMs} ms`,
      enabled: noteAvailable,
      availabilitySelector: sidebar('notes'),
      before: () => openFirstNote(page, fixture),
      action: () => delay(options.idleMs),
      settleMs: 0
    },
    {
      id: 'render.knowledge-graph',
      category: 'graphics',
      label: 'Render the Knowledge graph',
      availabilitySelector: sidebar('knowledge'),
      action: async () => {
        await openKnowledge(page)
        await waitForAny(
          page,
          '[data-testid="knowledge-canvas"], svg[aria-label="Knowledge graph"]'
        )
      },
      settleMs: 1_000,
      tracePath: path.join(artifactDirectory, 'knowledge-graph.trace.json')
    },
    {
      id: 'render.sticky-notes',
      category: 'graphics',
      label: 'Render the Sticky Notes board',
      availabilitySelector: sidebar('stickyNote'),
      action: async () => {
        await openStickyNotes(page)
        await waitForAny(page, '[data-testid="sticky-note-page"] .react-flow__node')
      },
      settleMs: 1_000
    },
    {
      id: 'render.excalidraw',
      category: 'graphics',
      label: 'Open an Excalidraw canvas',
      enabled: drawingAvailable,
      availabilitySelector: sidebar('notes'),
      before: () => openNotes(page),
      action: async () => {
        const row = page.locator(cssTestId(`note-tree-row:${fixture.drawingPath}`))
        await row.waitFor({ state: 'visible', timeout: 30_000 })
        await row.click()
        await page.locator('.excalidraw').waitFor({ state: 'visible', timeout: 30_000 })
      },
      settleMs: 1_000
    },
    {
      id: 'external.file-change-storm',
      category: 'vault-sync',
      label: `Write ${PROFILES[options.profile].externalUpdateCount} external note updates`,
      enabled: fixture.owned,
      availabilitySelector: sidebar('notes'),
      before: () => openNotes(page),
      action: async () => {
        const stormPath = path.join(fixture.rootPath, 'notebooks', 'performance-external-storm.md')
        for (let index = 0; index < PROFILES[options.profile].externalUpdateCount; index += 1) {
          await fs.writeFile(
            stormPath,
            serializeStoredNoteDocument(
              createStoredNoteDocumentFromText(
                `# External update ${index + 1}\n\nThis file exercises the watcher and index reconciliation path.\n${'External edit content '.repeat(20)}\n`,
                ['performance', 'external']
              )
            ),
            'utf8'
          )
        }
        await delay(750)
      },
      settleMs: 0
    }
  ]

  if (!options.trace) {
    for (const definition of definitions) {
      delete definition.tracePath
    }
  }
  return definitions
}

function sanitizeError(error: string | undefined): string | undefined {
  if (!error) {
    return undefined
  }
  return error.replaceAll(repoRoot, '<repo>').replaceAll(os.tmpdir(), '<tmp>')
}

function formatMetric(value: number | undefined, digits = 1): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '—'
}

function emptyProcessSummary(): ProcessSummary {
  return {
    totalCpuPercent: 0,
    browserCpuPercent: 0,
    rendererCpuPercent: 0,
    gpuProcessCpuPercent: 0,
    totalWorkingSetMb: 0,
    rendererWorkingSetMb: 0,
    gpuWorkingSetMb: 0,
    processCount: 0
  }
}

function createFailureReport(
  runId: string,
  runStartedAt: Date,
  options: AuditOptions,
  fixture: FixtureInfo | null,
  error: unknown,
  artifactDirectory: string
): AuditReport {
  const failureMessage = error instanceof Error ? error.message : String(error)
  const fixtureCounts = fixture?.counts ?? {
    notes: null,
    projects: null,
    tasks: null,
    stickyNotes: null,
    schedules: null
  }
  const elapsedMs = Math.max(0, Date.now() - runStartedAt.getTime())
  return {
    runId,
    startedAt: runStartedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    platform: process.platform,
    arch: process.arch,
    electronVersion: 'unknown',
    options,
    fixture: {
      source: fixture ? (fixture.owned ? 'generated' : 'provided') : 'generated',
      ...fixtureCounts
    },
    startup: {
      readyWallMs: elapsedMs,
      process: {
        sampleIntervalMs: 0,
        summary: emptyProcessSummary()
      }
    },
    gpu: {
      hardwareAcceleration: null,
      featureStatus: {}
    },
    scenarios: [
      {
        id: 'startup.vault-activation',
        category: 'startup',
        label: 'Cold Electron startup and vault activation',
        status: 'error',
        wallMs: elapsedMs,
        error: sanitizeError(failureMessage)
      }
    ],
    artifacts: {
      directory: artifactDirectory,
      reportPath: path.join(artifactDirectory, 'performance-audit.json')
    }
  }
}

async function appendAuditLog(report: AuditReport): Promise<void> {
  const logPath = path.join(repoRoot, 'docs', 'performance-audit-log.md')
  let existing = ''
  try {
    existing = await fs.readFile(logPath, 'utf8')
  } catch {
    existing =
      '# Performance Audit Log\n\nThis append-only log is generated by `npm run perf:audit`.\n'
  }

  const errors = report.scenarios.filter((scenario) => scenario.status === 'error')
  const acceleration =
    report.gpu.hardwareAcceleration === null
      ? 'unknown'
      : report.gpu.hardwareAcceleration
        ? 'enabled'
        : 'disabled'
  const errorDetails = errors.length
    ? errors.map((scenario) => `- ${scenario.id}: ${scenario.error ?? 'unknown error'}`).join('\n')
    : '- none'
  const rows = report.scenarios
    .map((scenario) => {
      const cpu = scenario.process?.summary
      const renderer = scenario.renderer
      return `| ${scenario.id} | ${scenario.status} | ${formatMetric(scenario.wallMs)} | ${formatMetric(cpu?.totalCpuPercent)} | ${formatMetric(cpu?.rendererCpuPercent)} | ${formatMetric(cpu?.gpuProcessCpuPercent)} | ${formatMetric(renderer?.maxFrameGapMs)} | ${renderer?.longTaskCount ?? '—'} |`
    })
    .join('\n')
  const entry = `## ${report.runId}\n\n- Date: ${report.startedAt}\n- Platform: ${report.platform} ${report.arch}\n- Electron: ${report.electronVersion}\n- Profile: ${report.options.profile} (${report.fixture.notes ?? 'provided'} notes, ${report.fixture.projects ?? 'provided'} projects, ${report.fixture.tasks ?? 'provided'} tasks)\n- GPU mode: ${report.options.gpuMode}; hardware acceleration reported as **${acceleration}**\n- Startup/vault activation: ${formatMetric(report.startup.readyWallMs)} ms\n- Chromium trace: ${report.scenarios.some((scenario) => scenario.trace?.captured) ? 'captured for the Knowledge graph scenario' : 'not captured'}\n- Scenario errors: ${errors.length}\n\nErrors:\n${errorDetails}\n\nGPU process CPU is reported as process CPU, not GPU engine utilization. Feature status and trace counters are supporting evidence; they must not be interpreted as a percentage of GPU capacity.\n\n| Scenario | Status | Wall ms | Total CPU % | Renderer CPU % | GPU process CPU % | Max frame gap ms | Long tasks |\n|---|---:|---:|---:|---:|---:|---:|---:|\n${rows}\n`
  await fs.writeFile(logPath, `${existing.trimEnd()}\n\n${entry}`, 'utf8')
}

function printSummary(report: AuditReport): void {
  const completed = report.scenarios.filter((scenario) => scenario.status === 'ok').length
  const skipped = report.scenarios.filter((scenario) => scenario.status === 'skipped').length
  const errors = report.scenarios.filter((scenario) => scenario.status === 'error').length
  console.log(
    `Performance audit ${report.runId} completed: ${completed} ok, ${skipped} skipped, ${errors} errors`
  )
  console.log(`Profile: ${report.options.profile}; GPU mode: ${report.options.gpuMode}`)
  console.log(`Startup/vault activation: ${formatMetric(report.startup.readyWallMs)} ms`)
  const acceleration =
    report.gpu.hardwareAcceleration === null
      ? 'unknown'
      : report.gpu.hardwareAcceleration
        ? 'enabled'
        : 'disabled'
  console.log(
    `GPU acceleration: ${acceleration}; GPU process CPU is sampled separately from GPU engine utilization`
  )
  console.log(`Raw report: ${report.artifacts.reportPath}`)
  if (!report.options.noDocs) {
    console.log('Audit log: docs/performance-audit-log.md')
  }
  for (const scenario of report.scenarios.filter((item) => item.status === 'ok')) {
    console.log(
      `${scenario.id}: wall=${formatMetric(scenario.wallMs)}ms cpu=${formatMetric(scenario.process?.summary.totalCpuPercent)}% renderer=${formatMetric(scenario.process?.summary.rendererCpuPercent)}% gpu-process=${formatMetric(scenario.process?.summary.gpuProcessCpuPercent)}% frame-gap=${formatMetric(scenario.renderer?.maxFrameGapMs)}ms`
    )
  }
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2))
  const runStartedAt = new Date()
  const runId = createRunId(runStartedAt)
  const artifactDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'xingularity-performance-run-'))
  let fixture: FixtureInfo | null = null
  let electronApp: ElectronApplication | null = null
  let report: AuditReport | null = null

  try {
    fixture = await resolveFixture(options)
    const launch = await launchWithFixture(fixture, options)
    electronApp = launch.electronApp
    const definitions = createScenarioDefinitions(launch.page, fixture, options, artifactDirectory)
    const scenarios: ScenarioResult[] = [
      {
        id: 'startup.vault-activation',
        category: 'startup',
        label: 'Cold Electron startup and vault activation',
        status: 'ok',
        wallMs: launch.startup.readyWallMs,
        process: launch.startup.process
      }
    ]

    for (let repeat = 0; repeat < options.repeats; repeat += 1) {
      for (const definition of definitions) {
        const repeatDefinition =
          options.repeats === 1
            ? definition
            : { ...definition, id: `${definition.id}.repeat-${repeat + 1}` }
        scenarios.push(await runScenario(electronApp, launch.page, repeatDefinition))
      }
    }

    report = {
      runId,
      startedAt: runStartedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      platform: process.platform,
      arch: process.arch,
      electronVersion: launch.electronVersion,
      options,
      fixture: {
        source: fixture.owned ? 'generated' : 'provided',
        ...fixture.counts
      },
      startup: launch.startup,
      gpu: launch.gpu,
      scenarios: scenarios.map((scenario) => ({
        ...scenario,
        error: sanitizeError(scenario.error)
      })),
      artifacts: {
        directory: artifactDirectory,
        reportPath: path.join(artifactDirectory, 'performance-audit.json')
      }
    }
    await writeJson(report.artifacts.reportPath, report)
    if (!options.noDocs) {
      await appendAuditLog(report)
    }
    printSummary(report)
    if (report.scenarios.some((scenario) => scenario.status === 'error')) {
      process.exitCode = 1
    }
  } catch (error) {
    if (!report) {
      report = createFailureReport(runId, runStartedAt, options, fixture, error, artifactDirectory)
      await writeJson(report.artifacts.reportPath, report)
      if (!options.noDocs) {
        await appendAuditLog(report)
      }
      printSummary(report)
    }
    throw error
  } finally {
    if (electronApp) {
      await closeElectronApp(electronApp)
    }
    if (fixture?.owned) {
      await fs.rm(fixture.rootPath, { recursive: true, force: true })
    }
  }
}

main().catch((error) => {
  console.error(
    `Performance audit failed: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`
  )
  process.exitCode = 1
})
