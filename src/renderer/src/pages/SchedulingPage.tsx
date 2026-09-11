import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode
} from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  BookOpen,
  Card,
  CardContent,
  Play,
  Plus,
  Save,
  ActionMenuItems,
  WorkspaceIconButton,
  WorkspacePanelStack,
  Trash2,
  type ActionMenuGroup
} from '../components/ui'
import type { RendererVaultApi } from '../../../shared/types'
import type {
  ScheduleJob,
  ScheduleJobInput,
  SchedulePermission,
  ScheduleRunRecord,
  TriggerConfig
} from '../../../shared/scheduleTypes'
import { createPythonTemplate } from '../lib/schedulingTemplates'
import { APP_PAGE_ICONS } from '../lib/pageIcons'
import { ScheduleEditor } from '../components/scheduling/ScheduleEditor'
import { ScheduleJobList } from '../components/scheduling/ScheduleJobList'
import { SchedulePropertiesPanel } from '../components/scheduling/SchedulePropertiesPanel'
import {
  ScheduleRunHistory,
  ScheduleRunHistoryList
} from '../components/scheduling/ScheduleRunHistory'
import { SchedulingBreadcrumb as SchedulingBreadcrumbView } from '../components/scheduling/SchedulingBreadcrumb'
import type { ScheduleDraft, SchedulingView } from '../components/scheduling/types'
import { WorkspacePage } from '../components/workspace'

type ToastKind = 'info' | 'error' | 'success' | 'warning'

export interface SchedulingWorkspaceProviderProps {
  workspaceTabId?: string
  enabled: boolean
  vaultApi: RendererVaultApi | null | undefined
  vaultRoot?: string | null
  pushToast: (kind: ToastKind, message: string) => void
  onWorkspaceDataChanged?: () => Promise<void>
  children?: ReactNode
}

interface SchedulingWorkspaceSessionSnapshot {
  selectedJobId: string | null
  draft: ScheduleDraft
  isNewDraft: boolean
  isDirty: boolean
  runs: ScheduleRunRecord[]
  selectedRunId: string | null
}

interface SchedulingWorkspaceValue {
  vaultApi: RendererVaultApi | null | undefined
  jobs: ScheduleJob[]
  selectedJobId: string | null
  draft: ScheduleDraft
  isNewDraft: boolean
  isDirty: boolean
  runs: ScheduleRunRecord[]
  selectedRunId: string | null
  setSelectedRunId: (runId: string | null) => void
  isLoading: boolean
  isSaving: boolean
  isRunning: boolean
  secretNames: string[]
  actionBusyRunId: string | null
  trustDialogOpen: boolean
  deleteDialogOpen: boolean
  setTrustDialogOpen: (open: boolean) => void
  setDeleteDialogOpen: (open: boolean) => void
  updateDraft: (patch: Partial<ScheduleJobInput>) => void
  updateTrigger: (trigger: TriggerConfig) => void
  togglePermission: (permission: SchedulePermission, enabled: boolean) => void
  handleSave: () => void
  handleRun: () => void
  handleRunJob: (jobId: string) => void
  handleSelectJob: (jobId: string) => void
  handleCreate: () => void
  requestDeleteJob: (jobId: string) => void
  handleDelete: () => Promise<void>
  handleRunAction: (runId: string, action: 'apply' | 'dismiss') => Promise<void>
  handleTrustConfirm: () => void
  handleEnabledChange: (enabled: boolean) => void
  saveSecret: (name: string, value: string) => Promise<void>
  deleteSecret: (name: string) => Promise<void>
}

const SchedulingWorkspaceContext = createContext<SchedulingWorkspaceValue | null>(null)

const TRUST_STORAGE_PREFIX = 'xingularity:scheduling-python-trust:'

function createNewDraft(): ScheduleDraft {
  return {
    name: 'New automation',
    enabled: false,
    trigger: { type: 'manual' },
    runtime: 'python',
    code: createPythonTemplate('task', 'new-automation'),
    permissions: ['createTasks'],
    secretRefs: [],
    outputMode: 'review_before_apply'
  }
}

function toDraft(job: ScheduleJob): ScheduleDraft {
  return {
    id: job.id,
    name: job.name,
    enabled: job.enabled,
    trigger: { ...job.trigger },
    runtime: job.runtime,
    code: job.code,
    permissions: [...job.permissions],
    secretRefs: [...(job.secretRefs ?? [])],
    outputMode: job.outputMode
  }
}

function getTrustStorageKey(vaultRoot: string | null | undefined): string {
  return `${TRUST_STORAGE_PREFIX}${vaultRoot ?? 'default'}`
}

function readTrustAcknowledgement(vaultRoot: string | null | undefined): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  try {
    return window.localStorage.getItem(getTrustStorageKey(vaultRoot)) === 'true'
  } catch {
    return false
  }
}

function rememberTrustAcknowledgement(vaultRoot: string | null | undefined): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(getTrustStorageKey(vaultRoot), 'true')
  } catch {
    // Local storage can be unavailable in locked-down renderer environments.
  }
}

export function SchedulingWorkspaceProvider({
  workspaceTabId = 'default',
  ...props
}: SchedulingWorkspaceProviderProps): ReactElement {
  const [sessions, setSessions] = useState<Record<string, SchedulingWorkspaceSessionSnapshot>>({})
  const sessionKey = `${props.vaultRoot ?? 'default'}:${workspaceTabId}`
  const session = sessions[sessionKey] ?? {
    selectedJobId: null,
    draft: createNewDraft(),
    isNewDraft: true,
    isDirty: false,
    runs: [],
    selectedRunId: null
  }
  const handleSessionChange = useCallback(
    (nextSession: SchedulingWorkspaceSessionSnapshot): void => {
      setSessions((current) => ({ ...current, [sessionKey]: nextSession }))
    },
    [sessionKey]
  )

  return (
    <SchedulingWorkspaceSessionProvider
      key={sessionKey}
      {...props}
      initialSession={session}
      onSessionChange={handleSessionChange}
    />
  )
}

interface SchedulingWorkspaceSessionProviderProps extends Omit<
  SchedulingWorkspaceProviderProps,
  'workspaceTabId'
> {
  initialSession: SchedulingWorkspaceSessionSnapshot
  onSessionChange: (session: SchedulingWorkspaceSessionSnapshot) => void
}

function SchedulingWorkspaceSessionProvider({
  enabled,
  vaultApi,
  vaultRoot = null,
  pushToast,
  onWorkspaceDataChanged,
  children,
  initialSession,
  onSessionChange
}: SchedulingWorkspaceSessionProviderProps): ReactElement {
  const [jobs, setJobs] = useState<ScheduleJob[]>([])
  const [selectedJobId, setSelectedJobId] = useState<string | null>(initialSession.selectedJobId)
  const [draft, setDraft] = useState<ScheduleDraft>(() => ({ ...initialSession.draft }))
  const [isNewDraft, setIsNewDraft] = useState(initialSession.isNewDraft)
  const [isDirty, setIsDirty] = useState(initialSession.isDirty)
  const [runs, setRuns] = useState<ScheduleRunRecord[]>(() => [...initialSession.runs])
  const [selectedRunId, setSelectedRunId] = useState<string | null>(initialSession.selectedRunId)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [secretNames, setSecretNames] = useState<string[]>([])
  const [actionBusyRunId, setActionBusyRunId] = useState<string | null>(null)
  const [trustAcknowledged, setTrustAcknowledged] = useState(false)
  const [trustDialogOpen, setTrustDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [pendingDeleteJobId, setPendingDeleteJobId] = useState<string | null>(null)
  const trustActionRef = useRef<(() => Promise<void>) | null>(null)
  const isNewDraftRef = useRef(initialSession.isNewDraft)
  const preserveInitialDraftRef = useRef(initialSession.isDirty)
  const jobsRef = useRef(jobs)
  const vaultRootRef = useRef<string | null | undefined>(vaultRoot)
  const jobsLoadRequestRef = useRef(0)
  const runsLoadRequestRef = useRef(0)

  jobsRef.current = jobs
  vaultRootRef.current = vaultRoot

  useEffect(() => {
    onSessionChange({
      selectedJobId,
      draft: { ...draft },
      isNewDraft,
      isDirty,
      runs: [...runs],
      selectedRunId
    })
  }, [draft, isDirty, isNewDraft, onSessionChange, runs, selectedJobId, selectedRunId])

  useEffect(() => {
    if (!enabled) {
      return
    }

    setTrustAcknowledged(readTrustAcknowledgement(vaultRoot))
  }, [enabled, vaultRoot])

  const loadJobs = useCallback(async (): Promise<void> => {
    const requestId = ++jobsLoadRequestRef.current
    const requestedVaultRoot = vaultRoot

    if (!vaultApi || !vaultRoot) {
      setJobs([])
      setSelectedJobId(null)
      setIsLoading(false)
      return
    }

    const nextJobs = await vaultApi.schedules.listJobs()
    if (requestId !== jobsLoadRequestRef.current || vaultRootRef.current !== requestedVaultRoot) {
      return
    }

    setJobs(nextJobs)
    setSelectedJobId((current) => {
      if (isNewDraftRef.current) {
        return current
      }

      if (current && nextJobs.some((job) => job.id === current)) {
        return current
      }

      return nextJobs[0]?.id ?? null
    })
    setIsLoading(false)
  }, [vaultApi, vaultRoot])

  const loadRuns = useCallback(
    async (jobId: string): Promise<void> => {
      const requestId = ++runsLoadRequestRef.current
      const requestedVaultRoot = vaultRoot

      if (!vaultApi || !vaultRoot) {
        setRuns([])
        setSelectedRunId(null)
        return
      }

      const nextRuns = await vaultApi.schedules.listRuns(jobId)
      if (requestId !== runsLoadRequestRef.current || vaultRootRef.current !== requestedVaultRoot) {
        return
      }

      setRuns(nextRuns)
      setSelectedRunId((current) => {
        if (current && nextRuns.some((run) => run.id === current)) {
          return current
        }

        return nextRuns[0]?.id ?? null
      })
    },
    [vaultApi, vaultRoot]
  )

  const loadSecrets = useCallback(async (): Promise<void> => {
    if (!vaultApi) {
      setSecretNames([])
      return
    }

    try {
      setSecretNames(await vaultApi.schedules.listSecrets())
    } catch (error) {
      setSecretNames([])
      pushToast('error', `Could not load schedule secrets: ${String(error)}`)
    }
  }, [pushToast, vaultApi])

  useEffect(() => {
    if (!enabled) {
      return
    }

    let cancelled = false
    setIsLoading(true)

    const refresh = async (): Promise<void> => {
      try {
        await loadJobs()
      } catch (error) {
        if (!cancelled) {
          setIsLoading(false)
          pushToast('error', `Could not load automations: ${String(error)}`)
        }
      }
    }

    void refresh()
    const interval = window.setInterval(() => {
      void refresh()
    }, 5000)

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [enabled, loadJobs, pushToast])

  useEffect(() => {
    if (enabled) {
      void loadSecrets()
    }
  }, [enabled, loadSecrets])

  useEffect(() => {
    if (!enabled || !selectedJobId) {
      setRuns([])
      setSelectedRunId(null)
      return
    }

    const selectedJob = jobsRef.current.find((job) => job.id === selectedJobId)
    if (!selectedJob) {
      return
    }

    if (preserveInitialDraftRef.current) {
      preserveInitialDraftRef.current = false
    } else if (!isDirty) {
      setDraft(toDraft(selectedJob))
      setIsNewDraft(false)
    }
    void loadRuns(selectedJob.id).catch((error: unknown) => {
      pushToast('error', `Could not load run history: ${String(error)}`)
    })
  }, [enabled, isDirty, loadRuns, pushToast, selectedJobId])

  useEffect(() => {
    if (!enabled || !selectedJobId || !vaultApi) {
      return
    }

    const interval = window.setInterval(() => {
      void loadRuns(selectedJobId).catch((error: unknown) => {
        pushToast('error', `Could not refresh run history: ${String(error)}`)
      })
    }, 5000)

    return () => window.clearInterval(interval)
  }, [enabled, loadRuns, pushToast, selectedJobId, vaultApi])

  const updateDraft = useCallback((patch: Partial<ScheduleJobInput>): void => {
    setDraft((current) => ({ ...current, ...patch }))
    setIsDirty(true)
  }, [])

  const updateTrigger = useCallback((trigger: TriggerConfig): void => {
    setDraft((current) => ({ ...current, trigger: { ...trigger } }))
    setIsDirty(true)
  }, [])

  const togglePermission = useCallback((permission: SchedulePermission, enabled: boolean): void => {
    setDraft((current) => {
      const permissions = enabled
        ? Array.from(new Set([...current.permissions, permission]))
        : current.permissions.filter((item) => item !== permission)
      return { ...current, permissions }
    })
    setIsDirty(true)
  }, [])

  const saveSecret = useCallback(
    async (name: string, value: string): Promise<void> => {
      if (!vaultApi) {
        throw new Error('Open a vault before saving a schedule secret')
      }

      try {
        await vaultApi.schedules.saveSecret({ name, value })
        await loadSecrets()
        pushToast('success', `Secret ${name} saved.`)
      } catch (error) {
        pushToast('error', `Could not save secret ${name}: ${String(error)}`)
        throw error
      }
    },
    [loadSecrets, pushToast, vaultApi]
  )

  const deleteSecret = useCallback(
    async (name: string): Promise<void> => {
      if (!vaultApi) {
        return
      }

      try {
        await vaultApi.schedules.deleteSecret(name)
        await loadSecrets()
        setDraft((current) => ({
          ...current,
          secretRefs: (current.secretRefs ?? []).filter((item) => item !== name)
        }))
        setIsDirty(true)
        pushToast('success', `Secret ${name} deleted.`)
      } catch (error) {
        pushToast('error', `Could not delete secret ${name}: ${String(error)}`)
        throw error
      }
    },
    [loadSecrets, pushToast, vaultApi]
  )

  const saveDraft = useCallback(async (): Promise<ScheduleJob | null> => {
    if (!vaultApi) {
      pushToast('error', 'Open a vault before saving an automation.')
      return null
    }

    if (!draft.name.trim()) {
      pushToast('error', 'Give the automation a name before saving.')
      return null
    }

    if (!draft.code.trim()) {
      pushToast('error', 'Add code before saving the automation.')
      return null
    }

    if (draft.permissions.includes('useSecrets') && (draft.secretRefs?.length ?? 0) === 0) {
      pushToast('error', 'Attach at least one configured secret before saving the automation.')
      return null
    }

    setIsSaving(true)
    try {
      const savedJob = await vaultApi.schedules.saveJob({
        ...draft,
        name: draft.name.trim(),
        id: draft.id
      })
      isNewDraftRef.current = false
      setIsNewDraft(false)
      setDraft(toDraft(savedJob))
      setIsDirty(false)
      setSelectedJobId(savedJob.id)
      await loadJobs()
      pushToast('success', 'Automation saved.')
      return savedJob
    } catch (error) {
      pushToast('error', `Could not save automation: ${String(error)}`)
      return null
    } finally {
      setIsSaving(false)
    }
  }, [draft, loadJobs, pushToast, vaultApi])

  const runSavedJob = useCallback(
    async (jobId: string): Promise<void> => {
      if (!vaultApi) {
        return
      }

      setIsRunning(true)
      try {
        const run = await vaultApi.schedules.runNow(jobId)
        await Promise.all([loadJobs(), loadRuns(jobId)])
        setSelectedJobId(jobId)
        setSelectedRunId(run.id)
        await onWorkspaceDataChanged?.()
        if (run.status === 'error') {
          pushToast('error', run.errorMessage ?? 'Automation failed.')
        } else if (run.status === 'review') {
          pushToast('warning', 'Automation finished with actions ready for review.')
        } else {
          pushToast('success', 'Automation finished.')
        }
      } catch (error) {
        pushToast('error', `Could not run automation: ${String(error)}`)
      } finally {
        setIsRunning(false)
      }
    },
    [loadJobs, loadRuns, onWorkspaceDataChanged, pushToast, vaultApi]
  )

  const runWithTrustCheck = useCallback(
    (action: () => Promise<void>, runtime = draft.runtime): void => {
      if (runtime !== 'python' || trustAcknowledged) {
        void action()
        return
      }

      trustActionRef.current = action
      setTrustDialogOpen(true)
    },
    [draft.runtime, trustAcknowledged]
  )

  const handleSave = useCallback((): void => {
    const action = async (): Promise<void> => {
      await saveDraft()
    }

    if (draft.runtime === 'python' && draft.enabled && !trustAcknowledged) {
      runWithTrustCheck(action)
      return
    }

    void action()
  }, [draft.enabled, draft.runtime, runWithTrustCheck, saveDraft, trustAcknowledged])

  const handleEnabledChange = useCallback(
    (enabled: boolean): void => {
      if (enabled && draft.runtime === 'python' && !trustAcknowledged) {
        runWithTrustCheck(async () => {
          updateDraft({ enabled: true })
        })
        return
      }

      updateDraft({ enabled })
    },
    [draft.runtime, runWithTrustCheck, trustAcknowledged, updateDraft]
  )

  const handleRun = useCallback((): void => {
    const action = async (): Promise<void> => {
      let jobId = draft.id
      if (!jobId || isDirty) {
        const savedJob = await saveDraft()
        jobId = savedJob?.id
      }

      if (jobId) {
        await runSavedJob(jobId)
      }
    }

    runWithTrustCheck(action)
  }, [draft.id, isDirty, runSavedJob, runWithTrustCheck, saveDraft])

  const handleRunJob = useCallback(
    (jobId: string): void => {
      const job = jobsRef.current.find((candidate) => candidate.id === jobId)
      if (!job) {
        return
      }

      runWithTrustCheck(() => runSavedJob(jobId), job.runtime)
    },
    [runSavedJob, runWithTrustCheck]
  )

  const handleSelectJob = useCallback((jobId: string): void => {
    isNewDraftRef.current = false
    preserveInitialDraftRef.current = false
    setIsDirty(false)
    setSelectedJobId(jobId)
  }, [])

  const handleCreate = useCallback((): void => {
    isNewDraftRef.current = true
    setSelectedJobId(null)
    setDraft(createNewDraft())
    setIsNewDraft(true)
    setIsDirty(false)
    setRuns([])
    setSelectedRunId(null)
  }, [])

  const requestDeleteJob = useCallback((jobId: string): void => {
    setPendingDeleteJobId(jobId)
    setDeleteDialogOpen(true)
  }, [])

  const handleDelete = useCallback(async (): Promise<void> => {
    const jobId = pendingDeleteJobId ?? draft.id
    if (!vaultApi || !jobId) {
      return
    }

    try {
      await vaultApi.schedules.deleteJob(jobId)
      if (jobId === selectedJobId) {
        isNewDraftRef.current = true
        setSelectedJobId(null)
        setDraft(createNewDraft())
        setIsNewDraft(true)
        setIsDirty(false)
        setRuns([])
        setSelectedRunId(null)
      }
      setPendingDeleteJobId(null)
      setDeleteDialogOpen(false)
      await loadJobs()
      pushToast('success', 'Automation deleted.')
    } catch (error) {
      pushToast('error', `Could not delete automation: ${String(error)}`)
    }
  }, [draft.id, loadJobs, pendingDeleteJobId, pushToast, selectedJobId, vaultApi])

  const handleRunAction = useCallback(
    async (runId: string, action: 'apply' | 'dismiss'): Promise<void> => {
      if (!vaultApi) {
        return
      }

      setActionBusyRunId(runId)
      try {
        if (action === 'apply') {
          await vaultApi.schedules.applyActions(runId)
          await onWorkspaceDataChanged?.()
          pushToast('success', 'Automation actions applied.')
        } else {
          await vaultApi.schedules.dismissRun(runId)
          pushToast('info', 'Automation actions dismissed.')
        }

        if (selectedJobId) {
          await Promise.all([loadJobs(), loadRuns(selectedJobId)])
        }
      } catch (error) {
        pushToast('error', `Could not update run: ${String(error)}`)
      } finally {
        setActionBusyRunId(null)
      }
    },
    [loadJobs, loadRuns, onWorkspaceDataChanged, pushToast, selectedJobId, vaultApi]
  )

  const handleTrustConfirm = useCallback((): void => {
    rememberTrustAcknowledgement(vaultRoot)
    setTrustAcknowledged(true)
    setTrustDialogOpen(false)
    const action = trustActionRef.current
    trustActionRef.current = null
    if (action) {
      void action()
    }
  }, [vaultRoot])

  const value: SchedulingWorkspaceValue = {
    vaultApi,
    jobs,
    selectedJobId,
    draft,
    isNewDraft,
    isDirty,
    runs,
    selectedRunId,
    setSelectedRunId,
    isLoading,
    isSaving,
    isRunning,
    secretNames,
    actionBusyRunId,
    trustDialogOpen,
    deleteDialogOpen,
    setTrustDialogOpen,
    setDeleteDialogOpen,
    updateDraft,
    updateTrigger,
    togglePermission,
    handleSave,
    handleRun,
    handleRunJob,
    handleSelectJob,
    handleCreate,
    requestDeleteJob,
    handleDelete,
    handleRunAction,
    handleTrustConfirm,
    handleEnabledChange,
    saveSecret,
    deleteSecret
  }

  return (
    <SchedulingWorkspaceContext.Provider value={value}>
      {children}
    </SchedulingWorkspaceContext.Provider>
  )
}

function useSchedulingWorkspace(): SchedulingWorkspaceValue {
  const value = useContext(SchedulingWorkspaceContext)
  if (!value) {
    throw new Error('useSchedulingWorkspace must be used inside SchedulingWorkspaceProvider')
  }

  return value
}

export function SchedulingWorkspaceBreadcrumb({
  value,
  onNavigate
}: {
  value: SchedulingView
  onNavigate: (view: SchedulingView) => void
}): ReactElement {
  const { draft } = useSchedulingWorkspace()

  return (
    <SchedulingBreadcrumbView value={value} automationName={draft.name} onNavigate={onNavigate} />
  )
}

export interface SchedulingPageProps {
  activeView: SchedulingView
  onViewChange?: (view: SchedulingView) => void
}

export function SchedulingPage({ activeView, onViewChange }: SchedulingPageProps): ReactElement {
  const {
    vaultApi,
    jobs,
    selectedJobId,
    draft,
    runs,
    selectedRunId,
    actionBusyRunId,
    trustDialogOpen,
    deleteDialogOpen,
    setTrustDialogOpen,
    setDeleteDialogOpen,
    updateDraft,
    updateTrigger,
    isLoading,
    handleSelectJob,
    handleCreate,
    handleRunJob,
    requestDeleteJob,
    isRunning,
    handleRunAction,
    handleTrustConfirm,
    handleDelete
  } = useSchedulingWorkspace()
  const SchedulingIcon = APP_PAGE_ICONS.schedules

  if (!vaultApi) {
    return (
      <section
        className="flex min-h-full items-center justify-center"
        data-testid="scheduling-page"
      >
        <Card>
          <CardContent>
            <div className="flex flex-col items-center gap-3 p-8 text-center">
              <SchedulingIcon className="text-muted-foreground" aria-hidden="true" />
              <h1 className="text-lg font-semibold">Scheduling needs an open vault</h1>
              <p className="max-w-md text-sm text-muted-foreground">
                Open a vault to create and run local automations.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>
    )
  }

  const openAutomation = (jobId: string): void => {
    handleSelectJob(jobId)
    onViewChange?.('automation')
  }

  const createAutomation = (): void => {
    handleCreate()
    onViewChange?.('automation')
  }

  const schedulingTabPanelProps =
    activeView === 'list'
      ? {}
      : {
          id: 'scheduling-view-panel',
          role: 'tabpanel' as const,
          'aria-labelledby': `scheduling-view-tab-${activeView}`
        }

  return (
    <>
      <WorkspacePage
        className="h-full min-h-0 w-full min-w-0 gap-0 overflow-hidden"
        data-testid="scheduling-page"
        aria-label="Scheduling"
      >
        <div
          className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
          {...schedulingTabPanelProps}
        >
          {activeView === 'list' ? (
            <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
              <ScheduleJobList
                jobs={jobs}
                selectedJobId={selectedJobId}
                loading={isLoading}
                className="h-full"
                onSelect={openAutomation}
                onCreate={createAutomation}
                onRunJob={handleRunJob}
                onRequestDeleteJob={requestDeleteJob}
                isRunning={isRunning}
              />
            </div>
          ) : activeView === 'automation' ? (
            <ScheduleEditor draft={draft} onChange={updateDraft} onTriggerChange={updateTrigger} />
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto">
              <ScheduleRunHistory
                runs={runs}
                selectedRunId={selectedRunId}
                actionBusyRunId={actionBusyRunId}
                onApply={(runId) => void handleRunAction(runId, 'apply')}
                onDismiss={(runId) => void handleRunAction(runId, 'dismiss')}
              />
            </div>
          )}
        </div>
      </WorkspacePage>

      <AlertDialog open={trustDialogOpen} onOpenChange={setTrustDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Trust this local Python automation?</AlertDialogTitle>
            <AlertDialogDescription>
              Xingularity will run this Python code on your computer. It is not a security sandbox;
              the code may access local files, processes, and the network according to your OS user.
              Continue only if you trust the source.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleTrustConfirm}>
              I understand, continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this automation?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the saved job and its run history from the current vault.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDelete()}>
              Delete automation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export interface SchedulingContextMenuItemsProps {
  onOpenApiGuide: () => void
  activeView?: SchedulingView
}

export function SchedulingContextMenuItems({
  onOpenApiGuide,
  activeView = 'automation'
}: SchedulingContextMenuItemsProps): ReactElement {
  const {
    draft,
    isNewDraft,
    isDirty,
    isSaving,
    isRunning,
    handleSave,
    handleRun,
    requestDeleteJob
  } = useSchedulingWorkspace()
  const isDetailView = activeView !== 'list'
  const groups: ActionMenuGroup[] = [
    {
      id: 'primary',
      items: [
        {
          id: 'api-guide',
          label: 'API guide',
          icon: <BookOpen aria-hidden="true" />,
          testId: 'scheduling-context-menu-item:api-guide',
          onSelect: onOpenApiGuide
        }
      ]
    },
    {
      id: 'workflow',
      items: isDetailView
        ? [
            {
              id: 'run',
              label: isRunning ? 'Running…' : 'Run now',
              icon: <Play aria-hidden="true" />,
              testId: 'scheduling-context-menu-item:run',
              disabled: isRunning || isSaving,
              onSelect: handleRun
            },
            {
              id: 'save',
              label: isSaving ? 'Saving…' : 'Save changes',
              icon: <Save aria-hidden="true" />,
              testId: 'scheduling-context-menu-item:save',
              disabled: !isDirty || isSaving,
              onSelect: handleSave
            }
          ]
        : []
    },
    {
      id: 'destructive',
      items:
        isDetailView && !isNewDraft
          ? [
              {
                id: 'delete',
                label: 'Delete automation',
                icon: <Trash2 aria-hidden="true" />,
                testId: 'scheduling-context-menu-item:delete',
                destructive: true,
                onSelect: () => {
                  if (draft.id) requestDeleteJob(draft.id)
                }
              }
            ]
          : []
    }
  ]

  return <ActionMenuItems variant="dropdown" groups={groups} />
}

export interface SchedulingTopbarActionsProps {
  activeView?: SchedulingView
}

export function SchedulingTopbarActions({
  activeView = 'automation'
}: SchedulingTopbarActionsProps): ReactElement | null {
  const { isDirty, isSaving, isRunning, handleSave, handleRun } = useSchedulingWorkspace()

  if (activeView === 'list') {
    return null
  }

  return (
    <>
      <WorkspaceIconButton
        type="button"
        data-testid="scheduling-topbar-save"
        aria-label="Save changes"
        title="Save changes"
        icon={<Save aria-hidden="true" />}
        label={isSaving ? 'Saving…' : 'Save changes'}
        variant="muted"
        borderless
        disabled={!isDirty || isSaving}
        onClick={handleSave}
      />
      <WorkspaceIconButton
        type="button"
        data-testid="scheduling-topbar-run"
        aria-label="Run now"
        title="Run now"
        icon={<Play aria-hidden="true" />}
        label={isRunning ? 'Running…' : 'Run now'}
        variant="accent"
        borderless
        disabled={isRunning || isSaving}
        onClick={handleRun}
      />
    </>
  )
}

export interface SchedulingAddAutomationButtonProps {
  onCreate?: () => void
}

export function SchedulingAddAutomationButton({
  onCreate
}: SchedulingAddAutomationButtonProps = {}): ReactElement {
  const { handleCreate } = useSchedulingWorkspace()

  return (
    <WorkspaceIconButton
      type="button"
      onClick={() => {
        handleCreate()
        onCreate?.()
      }}
      data-testid="scheduling-add-automation"
      aria-label="Add automation"
      title="Add automation"
      icon={<Plus size={16} />}
      label="Add automation"
      variant="accent"
      borderless
    />
  )
}

export interface SchedulingRightPanelProps {
  activeView?: SchedulingView
}

export function SchedulingRightPanel({
  activeView = 'automation'
}: SchedulingRightPanelProps): ReactElement {
  const {
    draft,
    updateDraft,
    updateTrigger,
    togglePermission,
    secretNames,
    saveSecret,
    deleteSecret,
    handleEnabledChange,
    runs,
    selectedRunId,
    setSelectedRunId
  } = useSchedulingWorkspace()

  if (activeView === 'list') {
    return <></>
  }

  return (
    <WorkspacePanelStack data-testid="scheduling-panel-stack">
      {activeView === 'history' ? (
        <ScheduleRunHistoryList
          runs={runs}
          selectedRunId={selectedRunId}
          onSelect={setSelectedRunId}
        />
      ) : (
        <SchedulePropertiesPanel
          draft={draft}
          secretNames={secretNames}
          onChange={updateDraft}
          onEnabledChange={handleEnabledChange}
          onTriggerChange={updateTrigger}
          onTogglePermission={togglePermission}
          onSaveSecret={saveSecret}
          onDeleteSecret={deleteSecret}
        />
      )}
    </WorkspacePanelStack>
  )
}
