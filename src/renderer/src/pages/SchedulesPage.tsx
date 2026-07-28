import { ReactElement, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Circle,
  Loader2,
  Play,
  Plus,
  Save,
  Trash2,
  XCircle,
  AlertCircle,
  Eye,
  SlidersHorizontal
} from '../components/ui/icons'
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
  DocumentWorkspacePanelHeader,
  WorkspaceIconButton,
  WorkspaceHeaderActions,
  WorkspaceHeaderActionGroup
} from '../components/ui/document-workspace'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from '../components/ui/breadcrumb'
import {
  WorkspacePanelSection,
  WorkspacePanelSectionHeader
} from '../components/ui/workspace-panel-section'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../components/ui/select'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Switch } from '../components/ui/switch'
import { Textarea } from '../components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '../components/ui/toggle-group'
import { useStaggeredScrollReveal } from '../hooks/useStaggeredScrollReveal'

interface SchedulesPageProps {
  vaultApi: RendererVaultApi | undefined
  pushToast: (kind: 'info' | 'error' | 'success', message: string) => void
  isRightPanelCollapsed?: boolean
  onToggleRightPanel: () => void
  onOpenDocumentation: () => void
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
      return <Loader2 size={13} className="animate-spin text-primary" />
    case 'success':
      return <CheckCircle2 size={13} className="text-primary" />
    case 'error':
      return <XCircle size={13} className="text-destructive" />
    case 'review':
      return <Eye size={13} className="text-muted-foreground" />
    case 'cancelled':
      return <AlertCircle size={13} className="text-muted-foreground" />
    default:
      return <Circle size={13} className="text-muted-foreground" />
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

export function SchedulesPage({
  vaultApi,
  pushToast,
  isRightPanelCollapsed = false,
  onToggleRightPanel,
  onOpenDocumentation
}: SchedulesPageProps): ReactElement {
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
  const revealItemIds = useMemo(
    () => ['schedule-panel-section', ...jobs.map((job) => `schedule:${job.id}`)],
    [jobs]
  )
  const { containerRef: panelRevealRef, getRevealItemProps } = useStaggeredScrollReveal(
    revealItemIds,
    {
      resetKey: revealItemIds.join('|')
    }
  )

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
      <DocumentWorkspace panelCollapsed={isRightPanelCollapsed} onTogglePanel={onToggleRightPanel}>
        {/* ── Left: Run history & selection ───────────────────────────── */}
        <DocumentWorkspaceMain>
          <DocumentWorkspaceMainHeader
            breadcrumb={
              <Breadcrumb>
                <BreadcrumbList className="text-muted-foreground">
                  <BreadcrumbItem>
                    <BreadcrumbPage className="text-sm text-muted-foreground">
                      Schedules
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="text-muted-foreground" />
                  <BreadcrumbItem>
                    <BreadcrumbPage className="max-w-[320px] truncate text-sm font-semibold text-foreground">
                      {selectedJob?.name ?? 'Run History'}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            }
            actions={
              <WorkspaceHeaderActions>
                <WorkspaceHeaderActionGroup>
                  <WorkspaceIconButton
                    onClick={onOpenDocumentation}
                    title="Schedule guide"
                    aria-label="Schedule guide"
                    icon={<BookOpen size={18} />}
                  />
                  <WorkspaceIconButton
                    onClick={() => {
                      if (selectedJobId) {
                        handleOpenEditDrawer(selectedJobId)
                      }
                    }}
                    disabled={!selectedJobId}
                    active={isEditDrawerOpen}
                    title="Open schedule drawer"
                    aria-label="Open schedule drawer"
                    icon={<SlidersHorizontal size={18} />}
                  />
                  <WorkspaceIconButton
                    onClick={() => void handleRunNow()}
                    disabled={!canRunNow}
                    title="Run now"
                    aria-label="Run now"
                    icon={
                      isRunning ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <Play size={18} />
                      )
                    }
                  />
                </WorkspaceHeaderActionGroup>
              </WorkspaceHeaderActions>
            }
          />
          <DocumentWorkspaceMainContent className="overflow-y-auto">
            {!selectedJobId ? (
              <div className="p-4 text-sm text-muted-foreground">
                Select or create a schedule to view run history.
              </div>
            ) : runs.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">
                No runs yet. Click &ldquo;Run Now&rdquo; to test this schedule.
              </div>
            ) : (
              <div className="flex flex-col">
                <div className="border-b border-border px-3 py-2">
                  <Select
                    value={selectedRunId ?? runs[0]?.id ?? ''}
                    onValueChange={setSelectedRunId}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select run" />
                    </SelectTrigger>
                    <SelectContent>
                      {runs.map((run) => (
                        <SelectItem key={run.id} value={run.id}>
                          {new Date(run.startedAt).toLocaleString()} — {statusLabel(run.status)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedRun && (
                  <div className="flex flex-col gap-0">
                    <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
                      {statusIcon(selectedRun.status)}
                      <span className="text-xs font-medium text-foreground">
                        {statusLabel(selectedRun.status)}
                      </span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {formatRelativeTime(selectedRun.startedAt)}
                      </span>
                    </div>

                    {selectedRun.errorMessage && (
                      <div className="border-b border-border bg-destructive/10 px-3 py-2.5">
                        <p className="text-xs font-semibold text-destructive dark:text-destructive">
                          Error
                        </p>
                        <p className="mt-0.5 break-words text-xs text-destructive dark:text-destructive">
                          {selectedRun.errorMessage}
                        </p>
                      </div>
                    )}

                    {selectedRun.status === 'review' && selectedRun.proposedActions.length > 0 && (
                      <div className="border-b border-border px-3 py-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground dark:text-muted-foreground">
                          Pending Review
                        </p>
                        <ul className="mt-1.5 space-y-1">
                          {selectedRun.proposedActions.map((action, i) => (
                            <li key={i} className="text-xs text-foreground">
                              <span className="mr-1 rounded bg-muted px-1 py-0.5 font-mono text-xs text-muted-foreground">
                                {action.type}
                              </span>
                              {describeAction(action)}
                            </li>
                          ))}
                        </ul>
                        <div className="mt-2.5 flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => void handleApplyActions(selectedRun.id)}
                            className="gap-1"
                          >
                            <CheckCircle2 size={11} />
                            Apply all
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void handleDismissRun(selectedRun.id)}
                            className="gap-1"
                          >
                            <XCircle size={11} />
                            Dismiss
                          </Button>
                        </div>
                      </div>
                    )}

                    {selectedRun.appliedActions.length > 0 && (
                      <div className="border-b border-border px-3 py-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Actions Applied
                        </p>
                        <ul className="mt-1.5 space-y-1">
                          {selectedRun.appliedActions.map((action, i) => (
                            <li key={i} className="flex items-start gap-1 text-xs text-foreground">
                              <CheckCircle2 size={11} className="mt-0.5 shrink-0 text-primary" />
                              {describeAction(action)}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {selectedRun.stdout && (
                      <div className="border-b border-border px-3 py-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Output
                        </p>
                        <pre className="mt-1.5 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded bg-muted p-3 font-mono text-xs leading-relaxed text-foreground">
                          {selectedRun.stdout}
                        </pre>
                      </div>
                    )}

                    {selectedRun.stderr && (
                      <div className="px-3 py-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Stderr
                        </p>
                        <pre className="mt-1.5 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded bg-muted p-3 font-mono text-xs leading-relaxed text-destructive">
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
        <DocumentWorkspacePanel className={isRightPanelCollapsed ? 'hidden' : 'flex'}>
          <DocumentWorkspacePanelHeader
            actions={
              <WorkspaceHeaderActions>
                <WorkspaceHeaderActionGroup>
                  <WorkspaceIconButton
                    onClick={handleNewJob}
                    title="New schedule"
                    aria-label="New schedule"
                    icon={<Plus size={16} />}
                  />
                </WorkspaceHeaderActionGroup>
              </WorkspaceHeaderActions>
            }
          />
          <DocumentWorkspacePanelContent ref={panelRevealRef} className="p-3">
            {(() => {
              const revealProps = getRevealItemProps('schedule-panel-section')
              return (
                <WorkspacePanelSection
                  ref={revealProps.ref}
                  style={revealProps.style}
                  className={revealProps.className}
                >
                  <WorkspacePanelSectionHeader
                    icon={<CalendarClock size={16} aria-hidden="true" />}
                    iconContainerClassName="bg-accent text-primary"
                    heading="Schedules"
                    description={`${jobs.length} jobs configured${selectedJobId ? ' · select one to edit' : ''}`}
                  />
                  {jobs.length === 0 ? (
                    <div className="p-1 text-sm text-muted-foreground">
                      No schedules yet. Click + to create one.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {jobs.map((job) => {
                        const isActive = selectedJobId === job.id
                        const itemRevealProps = getRevealItemProps(`schedule:${job.id}`)
                        return (
                          <Button
                            key={job.id}
                            ref={itemRevealProps.ref}
                            style={itemRevealProps.style}
                            type="button"
                            variant={isActive ? 'secondary' : 'ghost'}
                            onClick={() => setSelectedJobId(job.id)}
                            data-active={isActive}
                            className={`${itemRevealProps.className} rounded-lg border bg-card text-card-foreground h-auto flex-col items-stretch gap-2 px-3 py-3 text-left`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-foreground">
                                  {job.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {TRIGGER_LABELS[job.trigger?.type ?? 'manual'] ?? 'Manual only'}
                                </p>
                              </div>
                              <span
                                className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                                  job.enabled ? 'bg-primary' : 'bg-muted-foreground'
                                }`}
                                title={job.enabled ? 'Enabled' : 'Disabled'}
                              />
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              {statusIcon(job.lastStatus)}
                              <span>{statusLabel(job.lastStatus)}</span>
                            </div>
                            {job.nextRunAt && (
                              <div className="text-xs text-muted-foreground">
                                Next run {formatNextRun(job.nextRunAt)}
                              </div>
                            )}
                          </Button>
                        )
                      })}
                    </div>
                  )}
                </WorkspacePanelSection>
              )
            })()}
          </DocumentWorkspacePanelContent>
        </DocumentWorkspacePanel>
      </DocumentWorkspace>

      <Drawer open={isNewDrawerOpen} onOpenChange={handleNewDrawerOpenChange}>
        <DrawerContent>
          <DrawerHeader className="border-b border-border pb-4">
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
          <DrawerFooter className="flex items-center justify-between gap-2 border-t border-border pt-4">
            <DrawerClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DrawerClose>
            <Button
              type="button"
              onClick={() => void handleCreateNewSchedule()}
              disabled={isCreatingNew}
              className="gap-1.5"
            >
              {isCreatingNew ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Create schedule
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <Drawer
        open={isEditDrawerOpen && Boolean(selectedJobId)}
        onOpenChange={handleEditDrawerOpenChange}
      >
        <DrawerContent>
          <DrawerHeader className="border-b border-border pb-4">
            <DrawerTitle>{draft.name ?? 'Schedule details'}</DrawerTitle>
            <DrawerDescription>Review and update this schedule.</DrawerDescription>
            {isDraftDirty && selectedJobId && (
              <span className="text-xs uppercase tracking-wide text-primary">Unsaved changes</span>
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
              <div className="p-6 text-sm text-muted-foreground">Select a schedule to edit.</div>
            )}
          </div>
          <DrawerFooter className="flex items-center justify-between gap-2 border-t border-border pt-4">
            <DrawerClose asChild>
              <Button type="button" variant="outline">
                Close
              </Button>
            </DrawerClose>
            <div className="flex items-center gap-2">
              {canDelete && (
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  onClick={() => void handleDelete()}
                  title="Delete schedule"
                  aria-label="Delete schedule"
                >
                  <Trash2 size={16} />
                </Button>
              )}
              {canRunNow && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleRunNow()}
                  disabled={isRunning}
                  className="gap-1.5"
                >
                  {isRunning ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                  Run
                </Button>
              )}
              <Button
                type="button"
                onClick={() => void handleSave()}
                disabled={isSaving || !isDraftDirty || !selectedJobId}
                className="gap-1.5"
              >
                {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Save changes
              </Button>
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
  const permissions = draft.permissions ?? []
  const triggerType = draft.trigger?.type ?? 'manual'
  const outputMode = draft.outputMode ?? 'review_before_apply'

  return (
    <div className="flex flex-col gap-0">
      <section className="border-b border-border px-5 py-4">
        <label
          htmlFor="schedule-name"
          className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          Name
        </label>
        <Input
          id="schedule-name"
          type="text"
          maxLength={200}
          value={draft.name ?? ''}
          onChange={(e) => updateDraft('name', e.target.value)}
          placeholder="My Schedule"
          className="mt-1.5"
        />
        <div className="mt-2 flex items-center gap-2">
          <Switch
            checked={draft.enabled}
            onCheckedChange={(checked) => updateDraft('enabled', checked)}
            aria-label="Enable schedule"
          />
          <span className="text-xs text-muted-foreground">
            {draft.enabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>
      </section>

      <section className="border-b border-border px-5 py-4">
        <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Trigger
        </label>
        <Select
          value={triggerType}
          onValueChange={(value) =>
            updateDraft('trigger', {
              ...draft.trigger,
              type: value as TriggerType
            })
          }
        >
          <SelectTrigger className="mt-1.5 w-full">
            <SelectValue placeholder="Select trigger" />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(TRIGGER_LABELS) as TriggerType[]).map((type) => (
              <SelectItem key={type} value={type}>
                {TRIGGER_LABELS[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {triggerType === 'daily' && (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label htmlFor="schedule-trigger-time" className="text-xs text-muted-foreground">
              Time
            </label>
            <Input
              id="schedule-trigger-time"
              type="time"
              value={draft.trigger?.time ?? '09:00'}
              onChange={(e) => updateDraft('trigger', { ...draft.trigger!, time: e.target.value })}
              className="w-auto"
            />
            <label htmlFor="schedule-trigger-timezone" className="text-xs text-muted-foreground">
              Timezone
            </label>
            <Input
              id="schedule-trigger-timezone"
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
              className="w-48"
            />
          </div>
        )}

        {triggerType === 'every' && (
          <div className="mt-3 flex items-center gap-3">
            <label htmlFor="schedule-trigger-interval" className="text-xs text-muted-foreground">
              Every
            </label>
            <Input
              id="schedule-trigger-interval"
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
              className="w-24"
            />
            <span className="text-xs text-muted-foreground">minutes</span>
          </div>
        )}

        {triggerType === 'cron' && (
          <div className="mt-3 flex items-center gap-3">
            <label htmlFor="schedule-trigger-expression" className="text-xs text-muted-foreground">
              Expression
            </label>
            <Input
              id="schedule-trigger-expression"
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
              className="flex-1"
            />
          </div>
        )}
      </section>

      <section className="border-b border-border px-5 py-4">
        <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Permissions
        </label>
        <p className="mt-1 text-xs text-muted-foreground">Grant the schedule access it needs.</p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {ALL_PERMISSIONS.map((perm) => {
            const active = permissions.includes(perm)
            return (
              <Button
                type="button"
                key={perm}
                variant={active ? 'secondary' : 'outline'}
                onClick={() => togglePermission(perm)}
                aria-pressed={active}
                className="h-auto justify-start gap-2 px-3 py-2 text-left whitespace-normal"
              >
                {active ? (
                  <CheckCircle2 size={14} />
                ) : (
                  <Circle size={14} className="text-muted-foreground" />
                )}
                <span className="truncate">{PERMISSION_LABELS[perm]}</span>
              </Button>
            )
          })}
        </div>
      </section>

      <section className="border-b border-border px-5 py-4">
        <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Output handling
        </label>
        <ToggleGroup
          type="single"
          value={outputMode}
          onValueChange={(value) => {
            if (value) {
              updateDraft('outputMode', value as ScheduleJob['outputMode'])
            }
          }}
          className="mt-3 flex flex-col items-stretch gap-2"
          aria-label="Output handling"
        >
          {(['review_before_apply', 'auto_apply'] as const).map((mode) => (
            <ToggleGroupItem
              key={mode}
              value={mode}
              variant="outline"
              className="h-auto justify-start gap-2 rounded-lg px-3 py-2 text-left whitespace-normal"
            >
              <span className="font-medium">
                {mode === 'auto_apply' ? 'Apply actions automatically' : 'Review before applying'}
              </span>
              <span className="ml-1 text-xs text-muted-foreground">
                {mode === 'auto_apply'
                  ? '— actions are applied immediately'
                  : '— actions wait for your approval'}
              </span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </section>

      <section className="border-b border-border px-5 py-4">
        <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Runtime
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          {(['javascript', 'python'] as const).map((rt) => (
            <Button
              key={rt}
              type="button"
              variant={(draft.runtime ?? 'javascript') === rt ? 'secondary' : 'outline'}
              onClick={() => handleRuntimeChange(rt)}
              aria-pressed={(draft.runtime ?? 'javascript') === rt}
              className="h-auto min-w-[120px] flex-1 flex-col items-start px-3 py-2 text-left whitespace-normal"
            >
              <span className="text-sm font-semibold capitalize">{rt}</span>
              <span className="text-xs text-muted-foreground">
                {rt === 'javascript'
                  ? '— run JavaScript inside Xingularity'
                  : '— run Python via runtime'}
              </span>
            </Button>
          ))}
        </div>
      </section>

      <section className="px-5 py-4">
        <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Code
        </label>
        <Textarea
          value={draft.code ?? ''}
          onChange={(e) => updateDraft('code', e.target.value)}
          spellCheck={false}
          rows={18}
          className="mt-2 min-h-80 resize-y font-mono text-xs leading-relaxed"
          placeholder="Write your script here…"
        />
      </section>
    </div>
  )
}
