import { ReactElement, useCallback, useEffect, useId, useRef, useState } from 'react'
import {
  CheckCircle2,
  Circle,
  Clock,
  Loader2,
  Play,
  Plus,
  Save,
  Trash2,
  XCircle,
  AlertCircle,
  Eye
} from 'lucide-react'
import type { RendererVaultApi } from '../../../shared/types'
import type {
  ScheduleJob,
  ScheduleJobInput,
  ScheduleRunRecord,
  RunStatus,
  SchedulePermission,
  TriggerType,
  ScriptAction
} from '../../../shared/scheduleTypes'
import { ALL_PERMISSIONS } from '../../../shared/scheduleTypes'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle
} from '../components/ui/drawer'
import {
  DocumentWorkspace,
  DocumentWorkspaceMain,
  DocumentWorkspaceMainContent,
  DocumentWorkspaceMainHeader,
  DocumentWorkspacePanel,
  DocumentWorkspacePanelContent,
  DocumentWorkspacePanelHeader
} from '../components/ui/document-workspace'

interface SchedulesPageProps {
  vaultApi: RendererVaultApi | undefined
  pushToast: (kind: 'info' | 'error' | 'success', message: string) => void
}

const PERMISSION_LABELS: Record<SchedulePermission, string> = {
  network: 'Network access',
  readNotes: 'Read notes',
  createNotes: 'Create notes',
  updateNotes: 'Update notes',
  createTasks: 'Create tasks',
  updateTasks: 'Update tasks',
  createCalendarItems: 'Create calendar items',
  updateProjects: 'Update projects',
  useSecrets: 'Use secrets'
}

const TRIGGER_LABELS: Record<TriggerType, string> = {
  manual: 'Manual only',
  daily: 'Daily at time',
  every: 'Every N minutes',
  cron: 'Cron expression',
  on_app_start: 'On app start'
}

const RUNTIME_TEMPLATES: Record<string, string> = {
  javascript: `// Xingularity Schedule Script (JavaScript)
// Call beacon.emit([]) with an array of actions to produce output.
// Available APIs: beacon, console, JSON, Math, Date, fetch (if network permission granted)
//
// Example: create a task
beacon.emit([
  {
    type: 'task.create',
    title: 'Daily check-in',
    date: new Date().toISOString().slice(0, 10),
    priority: 'medium',
    automationSource: 'my-daily-job',
    automationSourceKey: new Date().toISOString().slice(0, 10) + ':daily-checkin'
  }
])
`,
  python: `# Xingularity Schedule Script (Python)
# Print JSON to stdout with an "actions" key to produce output.
# Network access requires the 'network' permission.
#
# Example: create a task
import json
from datetime import date

today = date.today().isoformat()
actions = [
    {
        "type": "task.create",
        "title": "Daily check-in",
        "date": today,
        "priority": "medium",
        "automationSource": "my-daily-job",
        "automationSourceKey": f"{today}:daily-checkin"
    }
]
print(json.dumps({"actions": actions}))
`
}

function emptyJob(): Omit<ScheduleJob, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    name: 'New Schedule',
    enabled: false,
    trigger: { type: 'manual' },
    runtime: 'javascript',
    code: RUNTIME_TEMPLATES['javascript'],
    permissions: [],
    outputMode: 'review_before_apply',
    lastStatus: undefined,
    lastRunAt: undefined,
    nextRunAt: undefined
  }
}

function statusIcon(status: RunStatus | undefined): ReactElement {
  switch (status) {
    case 'running':
      return <Loader2 size={13} className="animate-spin text-blue-500" />
    case 'success':
      return <CheckCircle2 size={13} className="text-green-500" />
    case 'error':
      return <XCircle size={13} className="text-red-500" />
    case 'review':
      return <Eye size={13} className="text-amber-500" />
    case 'cancelled':
      return <AlertCircle size={13} className="text-[var(--muted)]" />
    default:
      return <Circle size={13} className="text-[var(--muted)]" />
  }
}

function statusLabel(status: RunStatus | undefined): string {
  switch (status) {
    case 'running':
      return 'Running'
    case 'success':
      return 'Success'
    case 'error':
      return 'Error'
    case 'review':
      return 'Pending review'
    case 'cancelled':
      return 'Cancelled'
    default:
      return 'Never run'
  }
}

function formatRelativeTime(iso: string | undefined): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const secs = Math.floor(diff / 1000)
  if (secs < 60) return 'just now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function formatNextRun(iso: string | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const now = new Date()
  const diffMs = d.getTime() - now.getTime()
  if (diffMs < 0) return 'overdue'
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'in <1 min'
  if (mins < 60) return `in ${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `in ${hours}h`
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function describeAction(action: ScriptAction): string {
  switch (action.type) {
    case 'task.create':
      return `Create task: "${action.title}"${action.date ? ` on ${action.date}` : ''}`
    case 'task.update':
      return `Update task: ${action.automationSourceKey}`
    case 'note.create':
      return `Create note: "${action.name}"`
    case 'note.append':
      return `Append to note: "${action.name}"`
    case 'calendar.event.create':
      return `Create event: "${action.title}" on ${action.date}`
    default:
      return `Unknown action`
  }
}

export function SchedulesPage({ vaultApi, pushToast }: SchedulesPageProps): ReactElement {
  const [jobs, setJobs] = useState<ScheduleJob[]>([])
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Partial<ScheduleJob> & { id?: string }>(emptyJob())
  const [isDraftDirty, setIsDraftDirty] = useState(false)
  const [runs, setRuns] = useState<ScheduleRunRecord[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [isNewDrawerOpen, setIsNewDrawerOpen] = useState(false)
  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false)
  const [newDraft, setNewDraft] = useState<Partial<ScheduleJob> & { id?: string }>(emptyJob())
  const [isCreatingNew, setIsCreatingNew] = useState(false)
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const schedules = vaultApi?.schedules

  const loadJobs = useCallback(async () => {
    if (!schedules) return
    try {
      const list = await schedules.listJobs()
      setJobs(list)
    } catch (err) {
      pushToast('error', String(err))
    }
  }, [schedules, pushToast])

  const loadRuns = useCallback(
    async (jobId: string) => {
      if (!schedules) return
      try {
        const list = await schedules.listRuns(jobId)
        setRuns(list)
        if (list.length > 0 && !selectedRunId) {
          setSelectedRunId(list[0].id)
        }
      } catch (err) {
        pushToast('error', String(err))
      }
    },
    [schedules, pushToast, selectedRunId]
  )

  // Initial load
  useEffect(() => {
    void loadJobs()
  }, [loadJobs])

  useEffect(() => {
    if (!selectedJobId && jobs.length > 0) {
      setSelectedJobId(jobs[0].id)
    }
  }, [jobs, selectedJobId])

  // Poll for updates while page is mounted
  useEffect(() => {
    refreshTimerRef.current = setInterval(() => {
      void loadJobs()
      if (selectedJobId) void loadRuns(selectedJobId)
    }, 5000)
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current)
    }
  }, [loadJobs, loadRuns, selectedJobId])

  // When selected job changes, update draft and load runs
  useEffect(() => {
    if (!selectedJobId) return
    const job = jobs.find((j) => j.id === selectedJobId)
    if (job) {
      setDraft({ ...job })
      setIsDraftDirty(false)
      setSelectedRunId(null)
      setRuns([])
      void loadRuns(selectedJobId)
    }
  }, [selectedJobId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleNewJob = (): void => {
    setNewDraft(emptyJob())
    setIsNewDrawerOpen(true)
  }

  const handleOpenEditDrawer = (id: string): void => {
    setSelectedJobId(id)
    setIsEditDrawerOpen(true)
  }

  const handleSave = async (): Promise<void> => {
    if (!schedules) {
      pushToast('error', 'Schedules API unavailable')
      return
    }
    setIsSaving(true)
    try {
      const input: ScheduleJobInput = {
        id: draft.id,
        name: (draft.name ?? '').trim() || 'Untitled Job',
        enabled: draft.enabled ?? false,
        trigger: draft.trigger ?? { type: 'manual' },
        runtime: draft.runtime ?? 'javascript',
        code: draft.code ?? '',
        permissions: draft.permissions ?? [],
        outputMode: draft.outputMode ?? 'review_before_apply'
      }
      const saved = await schedules.saveJob(input)
      setDraft({ ...saved })
      setSelectedJobId(saved.id)
      setIsDraftDirty(false)
      await loadJobs()
      pushToast('success', 'Schedule saved')
    } catch (err) {
      pushToast('error', String(err))
    } finally {
      setIsSaving(false)
    }
  }

  const handleRunNow = async (): Promise<void> => {
    if (!schedules || !selectedJobId) return
    // Save first if dirty
    if (isDraftDirty) {
      await handleSave()
    }
    setIsRunning(true)
    try {
      const run = await schedules.runNow(selectedJobId)
      setRuns((prev) => [run, ...prev.filter((r) => r.id !== run.id)])
      setSelectedRunId(run.id)
      await loadJobs()
      if (run.status === 'error') {
        pushToast('error', `Run failed: ${run.errorMessage ?? 'unknown error'}`)
      } else if (run.status === 'review') {
        pushToast('info', `${run.proposedActions.length} action(s) awaiting review`)
      } else {
        pushToast('success', `Run complete — ${run.appliedActions.length} action(s) applied`)
      }
    } catch (err) {
      pushToast('error', String(err))
    } finally {
      setIsRunning(false)
    }
  }

  const handleDelete = async (): Promise<void> => {
    if (!schedules || !selectedJobId) return
    const job = jobs.find((j) => j.id === selectedJobId)
    const confirmed = window.confirm(
      `Delete schedule "${job?.name ?? selectedJobId}"? This cannot be undone.`
    )
    if (!confirmed) return
    try {
      await schedules.deleteJob(selectedJobId)
      setSelectedJobId(null)
      setIsEditDrawerOpen(false)
      setDraft(emptyJob())
      setRuns([])
      await loadJobs()
      pushToast('success', 'Schedule deleted')
    } catch (err) {
      pushToast('error', String(err))
    }
  }

  const handleApplyActions = async (runId: string): Promise<void> => {
    if (!schedules) return
    try {
      await schedules.applyActions(runId)
      await loadRuns(selectedJobId!)
      await loadJobs()
      pushToast('success', 'Actions applied')
    } catch (err) {
      pushToast('error', String(err))
    }
  }

  const handleDismissRun = async (runId: string): Promise<void> => {
    if (!schedules) return
    try {
      await schedules.dismissRun(runId)
      await loadRuns(selectedJobId!)
      await loadJobs()
      pushToast('info', 'Run dismissed')
    } catch (err) {
      pushToast('error', String(err))
    }
  }

  const updateDraft = <K extends keyof ScheduleJob>(key: K, value: ScheduleJob[K]): void => {
    setDraft((prev) => ({ ...prev, [key]: value }))
    setIsDraftDirty(true)
  }

  const togglePermission = (perm: SchedulePermission): void => {
    const current = draft.permissions ?? []
    const next = current.includes(perm) ? current.filter((p) => p !== perm) : [...current, perm]
    updateDraft('permissions', next)
  }

  const handleCurrentRuntimeChange = (runtime: 'javascript' | 'python'): void => {
    setDraft((prev) => ({
      ...prev,
      runtime,
      code:
        prev.code && prev.code !== RUNTIME_TEMPLATES[prev.runtime ?? 'javascript']
          ? prev.code
          : RUNTIME_TEMPLATES[runtime]
    }))
    setIsDraftDirty(true)
  }

  const updateNewDraft = <K extends keyof ScheduleJob>(key: K, value: ScheduleJob[K]): void => {
    setNewDraft((prev) => ({ ...prev, [key]: value }))
  }

  const toggleNewPermission = (perm: SchedulePermission): void => {
    setNewDraft((prev) => {
      const current = prev.permissions ?? []
      const next = current.includes(perm) ? current.filter((p) => p !== perm) : [...current, perm]
      return { ...prev, permissions: next }
    })
  }

  const handleNewRuntimeChange = (runtime: 'javascript' | 'python'): void => {
    setNewDraft((prev) => ({
      ...prev,
      runtime,
      code:
        prev.code && prev.code !== RUNTIME_TEMPLATES[prev.runtime ?? 'javascript']
          ? prev.code
          : RUNTIME_TEMPLATES[runtime]
    }))
  }

  const handleNewDrawerOpenChange = (open: boolean): void => {
    setIsNewDrawerOpen(open)
    if (!open) {
      setNewDraft(emptyJob())
    }
  }

  const handleEditDrawerOpenChange = (open: boolean): void => {
    setIsEditDrawerOpen(open)
  }

  const handleCreateNewSchedule = async (): Promise<void> => {
    if (!schedules) {
      pushToast('error', 'Schedules API unavailable')
      return
    }
    setIsCreatingNew(true)
    try {
      const input: ScheduleJobInput = {
        id: undefined,
        name: (newDraft.name ?? '').trim() || 'Untitled Job',
        enabled: newDraft.enabled ?? false,
        trigger: newDraft.trigger ?? { type: 'manual' },
        runtime: newDraft.runtime ?? 'javascript',
        code: newDraft.code ?? '',
        permissions: newDraft.permissions ?? [],
        outputMode: newDraft.outputMode ?? 'review_before_apply'
      }
      const saved = await schedules.saveJob(input)
      setDraft({ ...saved })
      setIsDraftDirty(false)
      setSelectedJobId(saved.id)
      setIsNewDrawerOpen(false)
      await loadJobs()
      pushToast('success', 'Schedule created')
    } catch (err) {
      pushToast('error', String(err))
    } finally {
      setIsCreatingNew(false)
    }
  }

  const selectedJob = jobs.find((j) => j.id === selectedJobId) ?? null
  const selectedRun = runs.find((r) => r.id === selectedRunId) ?? runs[0] ?? null

  const canRunNow = Boolean(selectedJobId && !isRunning)
  const canDelete = Boolean(selectedJobId)

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <DocumentWorkspace>
        {/* ── Left: Run history & selection ───────────────────────────── */}
        <DocumentWorkspaceMain>
          <DocumentWorkspaceMainHeader
            breadcrumb={
              <span className="text-sm font-semibold text-[var(--muted)]">Run History</span>
            }
            actions={
              selectedJob ? (
                <div className="flex items-center gap-1 text-xs text-[var(--muted)]">
                  <Clock size={12} />
                  {selectedJob.nextRunAt ? formatNextRun(selectedJob.nextRunAt) : '—'}
                </div>
              ) : null
            }
          />
          {/* <div className="border-b border-[var(--line)] px-3 py-3">
            {jobs.length === 0 ? (
              <div className="flex flex-col gap-3 text-sm text-[var(--muted)]">
                <p>No schedules yet. Create one to get started.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                  <span>Schedule</span>
                  <button
                    type="button"
                    onClick={handleNewJob}
                    className="inline-flex items-center gap-1 rounded border border-[var(--line)] bg-[var(--panel-2)] px-2 py-1 text-[10px] font-medium hover:border-[var(--accent)]"
                  >
                    <Plus size={12} />
                    New
                  </button>
                </div>
                <select
                  className="rounded border border-[var(--line)] bg-[var(--panel-2)] px-2 py-1 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
                  value={selectedJobId ?? jobs[0]?.id ?? ''}
                  onChange={(e) => setSelectedJobId(e.target.value)}
                >
                  {jobs.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.name}
                    </option>
                  ))}
                </select>
                {selectedJob && (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
                    <div className="flex items-center gap-1">
                      {statusIcon(selectedJob.lastStatus)}
                      <span>{statusLabel(selectedJob.lastStatus)}</span>
                    </div>
                    {selectedJob.lastRunAt && (
                      <span className="text-[var(--muted)]">
                        • Last run {formatRelativeTime(selectedJob.lastRunAt)}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleOpenEditDrawer(selectedJob.id)}
                      className="ml-auto inline-flex items-center rounded border border-[var(--line)] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                    >
                      Edit
                    </button>
                  </div>
                )}
              </div>
            )}
          </div> */}
          <DocumentWorkspaceMainContent className="overflow-y-auto">
            {!selectedJobId ? (
              <div className="p-4 text-sm text-[var(--muted)]">
                Select or create a schedule to view run history.
              </div>
            ) : runs.length === 0 ? (
              <div className="p-4 text-sm text-[var(--muted)]">
                No runs yet. Click &ldquo;Run Now&rdquo; to test this schedule.
              </div>
            ) : (
              <div className="flex flex-col">
                <div className="border-b border-[var(--line)] px-3 py-2">
                  <select
                    className="w-full rounded border border-[var(--line)] bg-[var(--panel-2)] px-2 py-1 text-xs text-[var(--text)] outline-none"
                    value={selectedRunId ?? runs[0]?.id ?? ''}
                    onChange={(e) => setSelectedRunId(e.target.value)}
                  >
                    {runs.map((run) => (
                      <option key={run.id} value={run.id}>
                        {new Date(run.startedAt).toLocaleString()} — {statusLabel(run.status)}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedRun && (
                  <div className="flex flex-col gap-0">
                    <div className="flex items-center gap-2 border-b border-[var(--line)] px-3 py-2.5">
                      {statusIcon(selectedRun.status)}
                      <span className="text-xs font-medium text-[var(--text)]">
                        {statusLabel(selectedRun.status)}
                      </span>
                      <span className="ml-auto text-xs text-[var(--muted)]">
                        {formatRelativeTime(selectedRun.startedAt)}
                      </span>
                    </div>

                    {selectedRun.errorMessage && (
                      <div className="border-b border-[var(--line)] bg-red-50 px-3 py-2.5 dark:bg-red-950/30">
                        <p className="text-xs font-semibold text-red-600 dark:text-red-400">
                          Error
                        </p>
                        <p className="mt-0.5 break-words text-xs text-red-600 dark:text-red-400">
                          {selectedRun.errorMessage}
                        </p>
                      </div>
                    )}

                    {selectedRun.status === 'review' && selectedRun.proposedActions.length > 0 && (
                      <div className="border-b border-[var(--line)] px-3 py-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                          Pending Review
                        </p>
                        <ul className="mt-1.5 space-y-1">
                          {selectedRun.proposedActions.map((action, i) => (
                            <li key={i} className="text-xs text-[var(--text)]">
                              <span className="mr-1 rounded bg-[var(--panel-3)] px-1 py-0.5 font-mono text-[10px] text-[var(--muted)]">
                                {action.type}
                              </span>
                              {describeAction(action)}
                            </li>
                          ))}
                        </ul>
                        <div className="mt-2.5 flex gap-2">
                          <button
                            type="button"
                            onClick={() => void handleApplyActions(selectedRun.id)}
                            className="flex items-center gap-1 rounded border border-green-500 bg-green-50 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-100 dark:bg-green-950/40 dark:text-green-400"
                          >
                            <CheckCircle2 size={11} />
                            Apply all
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDismissRun(selectedRun.id)}
                            className="flex items-center gap-1 rounded border border-[var(--line)] bg-[var(--panel-2)] px-2 py-1 text-xs text-[var(--muted)] hover:border-[var(--accent)]"
                          >
                            <XCircle size={11} />
                            Dismiss
                          </button>
                        </div>
                      </div>
                    )}

                    {selectedRun.appliedActions.length > 0 && (
                      <div className="border-b border-[var(--line)] px-3 py-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                          Actions Applied
                        </p>
                        <ul className="mt-1.5 space-y-1">
                          {selectedRun.appliedActions.map((action, i) => (
                            <li
                              key={i}
                              className="flex items-start gap-1 text-xs text-[var(--text)]"
                            >
                              <CheckCircle2 size={11} className="mt-0.5 shrink-0 text-green-500" />
                              {describeAction(action)}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {selectedRun.stdout && (
                      <div className="border-b border-[var(--line)] px-3 py-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                          Output
                        </p>
                        <pre className="mt-1.5 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded bg-[var(--panel-2)] p-2 font-mono text-[10px] leading-relaxed text-[var(--text)]">
                          {selectedRun.stdout}
                        </pre>
                      </div>
                    )}

                    {selectedRun.stderr && (
                      <div className="px-3 py-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                          Stderr
                        </p>
                        <pre className="mt-1.5 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded bg-[var(--panel-2)] p-2 font-mono text-[10px] leading-relaxed text-red-500">
                          {selectedRun.stderr}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </DocumentWorkspaceMainContent>
        </DocumentWorkspaceMain>

        {/* ── Right: Schedule cards ───────────────────────────────────── */}
        <DocumentWorkspacePanel className="border-l border-[var(--line)]">
          <DocumentWorkspacePanelHeader
            actions={
              <>
                <span className="text-sm font-semibold text-[var(--text)]">Schedules</span>
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--panel-2)] hover:border-[var(--accent)]"
                  onClick={handleNewJob}
                  title="New schedule"
                >
                  <Plus size={16} />
                </button>
              </>
            }
          />
          <DocumentWorkspacePanelContent>
            {jobs.length === 0 ? (
              <div className="p-4 text-sm text-[var(--muted)]">
                No schedules yet. Click + to create one.
              </div>
            ) : (
              <div className="flex flex-col gap-3 p-3">
                {jobs.map((job) => {
                  const isActive = selectedJobId === job.id
                  return (
                    <button
                      key={job.id}
                      type="button"
                      onClick={() => handleOpenEditDrawer(job.id)}
                      className={`flex flex-col gap-2 rounded-xl border px-3 py-3 text-left shadow-sm transition-colors ${
                        isActive
                          ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                          : 'border-[var(--line)] bg-[var(--panel-2)] hover:border-[var(--accent)]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[var(--text)]">
                            {job.name}
                          </p>
                          <p className="text-xs text-[var(--muted)]">
                            {TRIGGER_LABELS[job.trigger?.type ?? 'manual'] ?? 'Manual only'}
                          </p>
                        </div>
                        <span
                          className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                            job.enabled ? 'bg-green-500' : 'bg-[var(--muted)]'
                          }`}
                          title={job.enabled ? 'Enabled' : 'Disabled'}
                        />
                      </div>
                      <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                        {statusIcon(job.lastStatus)}
                        <span>{statusLabel(job.lastStatus)}</span>
                      </div>
                      {job.nextRunAt && (
                        <div className="text-xs text-[var(--muted)]">
                          Next run {formatNextRun(job.nextRunAt)}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </DocumentWorkspacePanelContent>
        </DocumentWorkspacePanel>
      </DocumentWorkspace>

      <Drawer open={isNewDrawerOpen} onOpenChange={handleNewDrawerOpenChange}>
        <DrawerContent>
          <DrawerHeader className="border-b border-[var(--line)] pb-4">
            <DrawerTitle>New Schedule</DrawerTitle>
            <DrawerDescription>Configure the job before saving.</DrawerDescription>
          </DrawerHeader>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ScheduleForm
              draft={newDraft}
              updateDraft={updateNewDraft}
              togglePermission={toggleNewPermission}
              handleRuntimeChange={handleNewRuntimeChange}
            />
          </div>
          <DrawerFooter className="flex items-center justify-between gap-2 border-t border-[var(--line)] pt-4">
            <DrawerClose asChild>
              <button
                type="button"
                className="rounded border border-[var(--line)] bg-[var(--panel-2)] px-3 py-1.5 text-sm text-[var(--text)] hover:border-[var(--accent)]"
              >
                Cancel
              </button>
            </DrawerClose>
            <button
              type="button"
              onClick={() => void handleCreateNewSchedule()}
              disabled={isCreatingNew}
              className="flex items-center gap-1.5 rounded border border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-1.5 text-sm text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white disabled:opacity-40"
            >
              {isCreatingNew ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Create schedule
            </button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <Drawer
        open={isEditDrawerOpen && Boolean(selectedJobId)}
        onOpenChange={handleEditDrawerOpenChange}
      >
        <DrawerContent>
          <DrawerHeader className="border-b border-[var(--line)] pb-4">
            <DrawerTitle>{draft.name ?? 'Schedule details'}</DrawerTitle>
            <DrawerDescription>Review and update this schedule.</DrawerDescription>
            {isDraftDirty && selectedJobId && (
              <span className="text-[11px] uppercase tracking-wide text-[var(--accent)]">
                Unsaved changes
              </span>
            )}
          </DrawerHeader>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {selectedJobId ? (
              <ScheduleForm
                draft={draft}
                updateDraft={updateDraft}
                togglePermission={togglePermission}
                handleRuntimeChange={handleCurrentRuntimeChange}
              />
            ) : (
              <div className="p-6 text-sm text-[var(--muted)]">Select a schedule to edit.</div>
            )}
          </div>
          <DrawerFooter className="flex items-center justify-between gap-2 border-t border-[var(--line)] pt-4">
            <DrawerClose asChild>
              <button
                type="button"
                className="rounded border border-[var(--line)] bg-[var(--panel-2)] px-3 py-1.5 text-sm text-[var(--text)] hover:border-[var(--accent)]"
              >
                Close
              </button>
            </DrawerClose>
            <div className="flex items-center gap-2">
              {canDelete && (
                <button
                  type="button"
                  onClick={() => void handleDelete()}
                  className="flex items-center justify-center rounded border border-[var(--line)] bg-[var(--panel-2)] px-2 py-1 text-sm hover:border-[var(--danger)] hover:text-[var(--danger)]"
                  title="Delete schedule"
                >
                  <Trash2 size={16} />
                </button>
              )}
              {canRunNow && (
                <button
                  type="button"
                  onClick={() => void handleRunNow()}
                  disabled={isRunning}
                  className="flex items-center gap-1.5 rounded border border-[var(--line)] bg-[var(--panel-2)] px-3 py-1.5 text-sm hover:border-[var(--accent)] disabled:opacity-50"
                >
                  {isRunning ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                  Run
                </button>
              )}
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={isSaving || !isDraftDirty || !selectedJobId}
                className="flex items-center gap-1.5 rounded border border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-1.5 text-sm text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white disabled:opacity-40"
              >
                {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Save changes
              </button>
            </div>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  )
}

interface ScheduleFormProps {
  draft: Partial<ScheduleJob> & { id?: string }
  updateDraft: <K extends keyof ScheduleJob>(key: K, value: ScheduleJob[K]) => void
  togglePermission: (perm: SchedulePermission) => void
  handleRuntimeChange: (runtime: 'javascript' | 'python') => void
}

function ScheduleForm({
  draft,
  updateDraft,
  togglePermission,
  handleRuntimeChange
}: ScheduleFormProps): ReactElement {
  const outputModeName = useId()
  const permissions = draft.permissions ?? []
  const triggerType = draft.trigger?.type ?? 'manual'
  const outputMode = draft.outputMode ?? 'review_before_apply'

  return (
    <div className="flex flex-col gap-0">
      <section className="border-b border-[var(--line)] px-5 py-4">
        <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          Name
        </label>
        <input
          type="text"
          maxLength={200}
          value={draft.name ?? ''}
          onChange={(e) => updateDraft('name', e.target.value)}
          placeholder="My Schedule"
          className="mt-1.5 w-full rounded-lg border border-[var(--line)] bg-[var(--panel-2)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
        />
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            role="switch"
            aria-checked={draft.enabled}
            onClick={() => updateDraft('enabled', !draft.enabled)}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors ${
              draft.enabled ? 'bg-green-500' : 'bg-[var(--line-strong)]'
            }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                draft.enabled ? 'translate-x-4' : 'translate-x-0.5'
              }`}
            />
          </button>
          <span className="text-xs text-[var(--muted)]">
            {draft.enabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>
      </section>

      <section className="border-b border-[var(--line)] px-5 py-4">
        <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          Trigger
        </label>
        <select
          className="mt-1.5 rounded-lg border border-[var(--line)] bg-[var(--panel-2)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
          value={triggerType}
          onChange={(e) =>
            updateDraft('trigger', {
              ...draft.trigger,
              type: e.target.value as TriggerType
            })
          }
        >
          {(Object.keys(TRIGGER_LABELS) as TriggerType[]).map((type) => (
            <option key={type} value={type}>
              {TRIGGER_LABELS[type]}
            </option>
          ))}
        </select>

        {triggerType === 'daily' && (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="text-xs text-[var(--muted)]">Time</label>
            <input
              type="time"
              value={draft.trigger?.time ?? '09:00'}
              onChange={(e) => updateDraft('trigger', { ...draft.trigger!, time: e.target.value })}
              className="rounded-lg border border-[var(--line)] bg-[var(--panel-2)] px-2 py-1 text-sm outline-none focus:border-[var(--accent)]"
            />
            <label className="text-xs text-[var(--muted)]">Timezone</label>
            <input
              type="text"
              placeholder="e.g. America/New_York"
              maxLength={60}
              value={draft.trigger?.timezone ?? ''}
              onChange={(e) =>
                updateDraft('trigger', {
                  ...draft.trigger!,
                  timezone: e.target.value || undefined
                })
              }
              className="w-48 rounded-lg border border-[var(--line)] bg-[var(--panel-2)] px-2 py-1 text-sm outline-none focus:border-[var(--accent)]"
            />
          </div>
        )}

        {triggerType === 'every' && (
          <div className="mt-3 flex items-center gap-3">
            <label className="text-xs text-[var(--muted)]">Every</label>
            <input
              type="number"
              min={1}
              max={10080}
              value={draft.trigger?.intervalMinutes ?? 60}
              onChange={(e) =>
                updateDraft('trigger', {
                  ...draft.trigger!,
                  intervalMinutes: parseInt(e.target.value, 10)
                })
              }
              className="w-24 rounded-lg border border-[var(--line)] bg-[var(--panel-2)] px-2 py-1 text-sm outline-none focus:border-[var(--accent)]"
            />
            <span className="text-xs text-[var(--muted)]">minutes</span>
          </div>
        )}

        {triggerType === 'cron' && (
          <div className="mt-3 flex items-center gap-3">
            <label className="text-xs text-[var(--muted)]">Expression</label>
            <input
              type="text"
              placeholder="0 9 * * 1-5"
              maxLength={100}
              value={draft.trigger?.expression ?? ''}
              onChange={(e) =>
                updateDraft('trigger', {
                  ...draft.trigger!,
                  expression: e.target.value || undefined
                })
              }
              className="flex-1 rounded-lg border border-[var(--line)] bg-[var(--panel-2)] px-2 py-1 text-sm outline-none focus:border-[var(--accent)]"
            />
          </div>
        )}
      </section>

      <section className="border-b border-[var(--line)] px-5 py-4">
        <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          Permissions
        </label>
        <p className="mt-1 text-xs text-[var(--muted)]">Grant the schedule access it needs.</p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {ALL_PERMISSIONS.map((perm) => {
            const active = permissions.includes(perm)
            return (
              <button
                type="button"
                key={perm}
                onClick={() => togglePermission(perm)}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                  active
                    ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                    : 'border-[var(--line)] bg-[var(--panel-2)] text-[var(--text)] hover:border-[var(--accent)]'
                }`}
              >
                {active ? (
                  <CheckCircle2 size={14} />
                ) : (
                  <Circle size={14} className="text-[var(--muted)]" />
                )}
                <span className="truncate">{PERMISSION_LABELS[perm]}</span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="border-b border-[var(--line)] px-5 py-4">
        <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          Output handling
        </label>
        <div className="mt-3 flex flex-col gap-2">
          {(['review_before_apply', 'auto_apply'] as const).map((mode) => (
            <label
              key={mode}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                outputMode === mode
                  ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                  : 'border-[var(--line)] bg-[var(--panel-2)] text-[var(--text)] hover:border-[var(--accent)]'
              }`}
            >
              <input
                type="radio"
                className="hidden"
                name={outputModeName}
                value={mode}
                checked={outputMode === mode}
                onChange={() => updateDraft('outputMode', mode)}
              />
              <span className="font-medium">
                {mode === 'auto_apply' ? 'Apply actions automatically' : 'Review before applying'}
              </span>
              <span className="ml-1 text-xs text-[var(--muted)]">
                {mode === 'auto_apply'
                  ? '— actions are applied immediately'
                  : '— actions wait for your approval'}
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="border-b border-[var(--line)] px-5 py-4">
        <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          Runtime
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          {(['javascript', 'python'] as const).map((rt) => (
            <button
              key={rt}
              type="button"
              onClick={() => handleRuntimeChange(rt)}
              className={`flex flex-1 min-w-[120px] flex-col rounded-lg border px-3 py-2 text-left transition-colors ${
                (draft.runtime ?? 'javascript') === rt
                  ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                  : 'border-[var(--line)] bg-[var(--panel-2)] text-[var(--text)] hover:border-[var(--accent)]'
              }`}
            >
              <span className="text-sm font-semibold capitalize">{rt}</span>
              <span className="text-xs text-[var(--muted)]">
                {rt === 'javascript'
                  ? '— run JavaScript inside Xingularity'
                  : '— run Python via runtime'}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="px-5 py-4">
        <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          Code
        </label>
        <textarea
          value={draft.code ?? ''}
          onChange={(e) => updateDraft('code', e.target.value)}
          spellCheck={false}
          rows={18}
          className="mt-2 w-full resize-y rounded-lg border border-[var(--line)] bg-[var(--panel-2)] p-3 font-mono text-xs leading-relaxed text-[var(--text)] outline-none focus:border-[var(--accent)]"
          placeholder="Write your script here…"
        />
      </section>
    </div>
  )
}
