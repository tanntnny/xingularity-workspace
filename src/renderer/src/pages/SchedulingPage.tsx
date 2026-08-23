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
  DropdownMenuItem,
  DropdownMenuSeparator,
  WorkspaceIconButton,
  WorkspacePanelStack,
  Trash2
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

type ToastKind = 'info' | 'error' | 'success'

export interface SchedulingWorkspaceProviderProps {
  enabled: boolean
  vaultApi: RendererVaultApi | null | undefined
  vaultRoot?: string | null
  pushToast: (kind: ToastKind, message: string) => void
  onWorkspaceDataChanged?: () => Promise<void>
  children?: ReactNode
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
  handleSelectJob: (jobId: string) => void
  handleCreate: () => void
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
  enabled,
  vaultApi,
  vaultRoot = null,
  pushToast,
  onWorkspaceDataChanged,
  children
}: SchedulingWorkspaceProviderProps): ReactElement {
  const [jobs, setJobs] = useState<ScheduleJob[]>([])
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [draft, setDraft] = useState<ScheduleDraft>(() => createNewDraft())
  const [isNewDraft, setIsNewDraft] = useState(true)
  const [isDirty, setIsDirty] = useState(false)
  const [runs, setRuns] = useState<ScheduleRunRecord[]>([])
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [secretNames, setSecretNames] = useState<string[]>([])
  const [actionBusyRunId, setActionBusyRunId] = useState<string | null>(null)
  const [trustAcknowledged, setTrustAcknowledged] = useState(false)
  const [trustDialogOpen, setTrustDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const trustActionRef = useRef<(() => Promise<void>) | null>(null)
  const isNewDraftRef = useRef(false)
  const jobsRef = useRef(jobs)

  jobsRef.current = jobs

  useEffect(() => {
    if (!enabled) {
      return
    }

    setTrustAcknowledged(readTrustAcknowledgement(vaultRoot))
  }, [enabled, vaultRoot])

  const loadJobs = useCallback(async (): Promise<void> => {
    if (!vaultApi) {
      setJobs([])
      setSelectedJobId(null)
      setIsLoading(false)
      return
    }

    const nextJobs = await vaultApi.schedules.listJobs()
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
  }, [vaultApi])

  const loadRuns = useCallback(
    async (jobId: string): Promise<void> => {
      if (!vaultApi) {
        setRuns([])
        setSelectedRunId(null)
        return
      }

      const nextRuns = await vaultApi.schedules.listRuns(jobId)
      setRuns(nextRuns)
      setSelectedRunId((current) => {
        if (current && nextRuns.some((run) => run.id === current)) {
          return current
        }

        return nextRuns[0]?.id ?? null
      })
    },
    [vaultApi]
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

    setDraft(toDraft(selectedJob))
    setIsNewDraft(false)
    setIsDirty(false)
    void loadRuns(selectedJob.id).catch((error: unknown) => {
      pushToast('error', `Could not load run history: ${String(error)}`)
    })
  }, [enabled, loadRuns, pushToast, selectedJobId])

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
          pushToast('info', 'Automation finished with actions ready for review.')
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
    (action: () => Promise<void>): void => {
      if (draft.runtime !== 'python' || trustAcknowledged) {
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

  const handleSelectJob = useCallback((jobId: string): void => {
    isNewDraftRef.current = false
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

  const handleDelete = useCallback(async (): Promise<void> => {
    if (!vaultApi || !draft.id) {
      return
    }

    try {
      await vaultApi.schedules.deleteJob(draft.id)
      isNewDraftRef.current = true
      setSelectedJobId(null)
      setDraft(createNewDraft())
      setIsNewDraft(true)
      setIsDirty(false)
      setRuns([])
      setSelectedRunId(null)
      setDeleteDialogOpen(false)
      await loadJobs()
      pushToast('success', 'Automation deleted.')
    } catch (error) {
      pushToast('error', `Could not delete automation: ${String(error)}`)
    }
  }, [draft.id, loadJobs, pushToast, vaultApi])

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
    handleSelectJob,
    handleCreate,
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
  const { isNewDraft, isDirty, isSaving, isRunning, handleSave, handleRun, setDeleteDialogOpen } =
    useSchedulingWorkspace()
  const isDetailView = activeView !== 'list'

  return (
    <>
      <DropdownMenuItem
        data-testid="scheduling-context-menu-item:api-guide"
        onSelect={onOpenApiGuide}
      >
        <BookOpen aria-hidden="true" />
        API guide
      </DropdownMenuItem>
      {isDetailView ? <DropdownMenuSeparator /> : null}
      {isDetailView ? (
        <DropdownMenuItem
          data-testid="scheduling-context-menu-item:run"
          disabled={isRunning || isSaving}
          onSelect={handleRun}
        >
          <Play aria-hidden="true" />
          {isRunning ? 'Running…' : 'Run now'}
        </DropdownMenuItem>
      ) : null}
      {isDetailView && !isNewDraft ? (
        <DropdownMenuItem
          data-testid="scheduling-context-menu-item:delete"
          onSelect={() => setDeleteDialogOpen(true)}
        >
          <Trash2 aria-hidden="true" />
          Delete automation
        </DropdownMenuItem>
      ) : null}
      {isDetailView ? (
        <DropdownMenuItem
          data-testid="scheduling-context-menu-item:save"
          disabled={!isDirty || isSaving}
          onSelect={handleSave}
        >
          <Save aria-hidden="true" />
          {isSaving ? 'Saving…' : 'Save changes'}
        </DropdownMenuItem>
      ) : null}
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
      bordered
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
    <WorkspacePanelStack>
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
