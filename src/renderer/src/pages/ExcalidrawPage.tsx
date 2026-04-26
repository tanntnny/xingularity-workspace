import {
  ComponentProps,
  createContext,
  Fragment,
  ReactElement,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { PenTool, Plus, Trash2 } from 'lucide-react'
import { Excalidraw, serializeAsJSON, THEME } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'
import type {
  ExcalidrawSession,
  ExcalidrawSessionScene,
  RendererVaultApi
} from '../../../shared/types'
import {
  DocumentWorkspacePanelContent,
  DocumentWorkspacePanelHeader,
  WorkspaceActionButton,
  WorkspaceHeaderActions,
  WorkspaceHeaderActionDivider,
  WorkspaceHeaderActionGroup
} from '../components/ui/document-workspace'
import { isDeleteShortcut } from '../components/ui/context-menu'
import {
  WorkspacePanelSection,
  WorkspacePanelSectionHeader
} from '../components/ui/workspace-panel-section'

type ExcalidrawTheme = typeof THEME.LIGHT | typeof THEME.DARK
type ExcalidrawApi = Parameters<NonNullable<ComponentProps<typeof Excalidraw>['excalidrawAPI']>>[0]
type ExcalidrawOnChange = NonNullable<ComponentProps<typeof Excalidraw>['onChange']>
type ExcalidrawInitialData = NonNullable<ComponentProps<typeof Excalidraw>['initialData']>
type ToastKind = 'info' | 'error' | 'success'
type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error'

interface ExcalidrawPageProps {
  vaultApi: RendererVaultApi | undefined
  pushToast: (kind: ToastKind, message: string) => void
}

interface ExcalidrawWorkspaceProviderProps extends ExcalidrawPageProps {
  children: ReactNode
}

interface ExcalidrawWorkspaceContextValue {
  activeToolType: string
  editingSessionId: string | null
  handleCancelRenameSession: () => void
  handleCommitRenameSession: (sessionId: string) => Promise<void>
  handleCreateSession: () => Promise<void>
  handleDeleteSession: (sessionId: string) => Promise<void>
  handleSceneChange: ExcalidrawOnChange
  handleSelectSession: (sessionId: string) => Promise<void>
  handleStartRenameSession: (sessionId: string) => void
  initialData: ExcalidrawInitialData | null
  isLoading: boolean
  renameDraft: string
  renameInputRef: React.MutableRefObject<HTMLInputElement | null>
  selectedSessionId: string | null
  sessions: ExcalidrawSession[]
  setApi: (api: ExcalidrawApi | null) => void
  setRenameDraft: (value: string) => void
  theme: ExcalidrawTheme
}

const SAVE_DEBOUNCE_MS = 800

const excalidrawUiOptions = {
  canvasActions: {
    toggleTheme: false
  }
}

const ExcalidrawWorkspaceContext = createContext<ExcalidrawWorkspaceContextValue | null>(null)

function getSystemExcalidrawTheme(): ExcalidrawTheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? THEME.DARK : THEME.LIGHT
}

function createEmptyScene(): ExcalidrawSessionScene {
  return {
    type: 'excalidraw',
    version: 2,
    source: 'https://excalidraw.com',
    elements: [],
    appState: {
      viewBackgroundColor: 'transparent'
    },
    files: {}
  }
}

function createSession(title = 'Untitled drawing'): ExcalidrawSession {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    title,
    createdAt: now,
    updatedAt: now,
    scene: createEmptyScene()
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function serializeScene(
  elements: Parameters<ExcalidrawOnChange>[0],
  appState: Parameters<ExcalidrawOnChange>[1],
  files: Parameters<ExcalidrawOnChange>[2]
): ExcalidrawSessionScene {
  const raw = JSON.parse(serializeAsJSON(elements, appState, files, 'local')) as Record<
    string,
    unknown
  >

  return {
    type: typeof raw.type === 'string' ? raw.type : 'excalidraw',
    version: typeof raw.version === 'number' ? raw.version : 2,
    source: typeof raw.source === 'string' ? raw.source : 'https://excalidraw.com',
    elements: Array.isArray(raw.elements) ? raw.elements : [],
    appState: isRecord(raw.appState) ? raw.appState : {},
    files: isRecord(raw.files) ? raw.files : {}
  }
}

function formatUpdatedAt(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'Unknown update time'
  }
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function useExcalidrawWorkspace(): ExcalidrawWorkspaceContextValue {
  const value = useContext(ExcalidrawWorkspaceContext)
  if (!value) {
    throw new Error('Excalidraw workspace context is unavailable')
  }
  return value
}

export function ExcalidrawWorkspaceProvider({
  vaultApi,
  pushToast,
  children
}: ExcalidrawWorkspaceProviderProps): ReactElement {
  const [theme, setTheme] = useState<ExcalidrawTheme>(getSystemExcalidrawTheme)
  const [sessions, setSessions] = useState<ExcalidrawSession[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [activeToolType, setActiveToolType] = useState('selection')
  const [isLoading, setIsLoading] = useState(true)
  const [, setSaveStatus] = useState<SaveStatus>('idle')
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const apiRef = useRef<ExcalidrawApi | null>(null)
  const sessionsRef = useRef<ExcalidrawSession[]>([])
  const selectedSessionIdRef = useRef<string | null>(null)
  const pendingSceneRef = useRef<ExcalidrawSessionScene | null>(null)
  const saveTimerRef = useRef<number | null>(null)
  const renameInputRef = useRef<HTMLInputElement | null>(null)

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId) ?? null,
    [selectedSessionId, sessions]
  )

  const initialData = useMemo<ExcalidrawInitialData | null>(() => {
    if (!selectedSession) {
      return null
    }

    return {
      ...selectedSession.scene,
      appState: {
        ...selectedSession.scene.appState,
        viewBackgroundColor: 'transparent'
      },
      scrollToContent: true
    } as ExcalidrawInitialData
  }, [selectedSession])

  useEffect(() => {
    sessionsRef.current = sessions
  }, [sessions])

  useEffect(() => {
    selectedSessionIdRef.current = selectedSessionId
  }, [selectedSessionId])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const syncTheme = (): void => setTheme(getSystemExcalidrawTheme())

    syncTheme()
    mediaQuery.addEventListener('change', syncTheme)

    return () => {
      mediaQuery.removeEventListener('change', syncTheme)
    }
  }, [])

  useEffect(() => {
    if (!editingSessionId) {
      return
    }

    window.requestAnimationFrame(() => {
      renameInputRef.current?.focus()
      renameInputRef.current?.select()
    })
  }, [editingSessionId])

  const persistSession = useCallback(
    async (session: ExcalidrawSession): Promise<ExcalidrawSession | null> => {
      if (!vaultApi) {
        return null
      }

      setSaveStatus('saving')
      try {
        const saved = await vaultApi.excalidraw.saveSession(session)
        const nextSessions = [
          saved,
          ...sessionsRef.current.filter((item) => item.id !== saved.id)
        ].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        sessionsRef.current = nextSessions
        setSessions(nextSessions)
        setSaveStatus('saved')
        return saved
      } catch (error) {
        setSaveStatus('error')
        pushToast('error', error instanceof Error ? error.message : 'Failed to save drawing')
        return null
      }
    },
    [pushToast, vaultApi]
  )

  const flushPendingSave = useCallback(async (): Promise<void> => {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }

    const sessionId = selectedSessionIdRef.current
    const scene = pendingSceneRef.current
    if (!sessionId || !scene) {
      return
    }

    const session = sessionsRef.current.find((item) => item.id === sessionId)
    if (!session) {
      return
    }

    pendingSceneRef.current = null
    await persistSession({
      ...session,
      updatedAt: new Date().toISOString(),
      scene
    })
  }, [persistSession])

  const captureCurrentScene = useCallback((): ExcalidrawSessionScene | null => {
    const api = apiRef.current
    if (!api) {
      return pendingSceneRef.current
    }

    return serializeScene(api.getSceneElementsIncludingDeleted(), api.getAppState(), api.getFiles())
  }, [])

  const loadSessions = useCallback(async (): Promise<void> => {
    if (!vaultApi) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      const storedSessions = await vaultApi.excalidraw.listSessions()
      if (storedSessions.length > 0) {
        setSessions(storedSessions)
        setSelectedSessionId(storedSessions[0]!.id)
        setSaveStatus('saved')
        return
      }

      const saved = await vaultApi.excalidraw.saveSession(createSession())
      setSessions([saved])
      setSelectedSessionId(saved.id)
      setSaveStatus('saved')
    } catch (error) {
      setSaveStatus('error')
      pushToast('error', error instanceof Error ? error.message : 'Failed to load drawings')
    } finally {
      setIsLoading(false)
    }
  }, [pushToast, vaultApi])

  useEffect(() => {
    void loadSessions()
  }, [loadSessions])

  useEffect(() => {
    return () => {
      void flushPendingSave()
    }
  }, [flushPendingSave])

  const handleSceneChange = useCallback<ExcalidrawOnChange>(
    (elements, appState, files) => {
      setActiveToolType(appState.activeTool.type)

      if (!selectedSessionIdRef.current) {
        return
      }

      pendingSceneRef.current = serializeScene(elements, appState, files)
      setSaveStatus('pending')

      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current)
      }
      saveTimerRef.current = window.setTimeout(() => {
        void flushPendingSave()
      }, SAVE_DEBOUNCE_MS)
    },
    [flushPendingSave]
  )

  const handleCreateSession = useCallback(async (): Promise<void> => {
    await flushPendingSave()
    const saved = await persistSession(createSession())
    if (saved) {
      setSelectedSessionId(saved.id)
      setEditingSessionId(saved.id)
      setRenameDraft(saved.title)
    }
  }, [flushPendingSave, persistSession])

  const handleSelectSession = useCallback(
    async (sessionId: string): Promise<void> => {
      if (sessionId === selectedSessionIdRef.current) {
        return
      }

      await flushPendingSave()
      setSelectedSessionId(sessionId)
      setEditingSessionId(null)
      setRenameDraft('')
    },
    [flushPendingSave]
  )

  const handleDeleteSession = useCallback(
    async (sessionId: string): Promise<void> => {
      if (!vaultApi) {
        return
      }

      await flushPendingSave()
      try {
        await vaultApi.excalidraw.deleteSession(sessionId)
        const nextSessions = sessionsRef.current.filter((session) => session.id !== sessionId)

        setEditingSessionId(null)
        setRenameDraft('')

        if (nextSessions.length === 0) {
          const saved = await persistSession(createSession())
          if (saved) {
            setSessions([saved])
            setSelectedSessionId(saved.id)
          }
          return
        }

        setSessions(nextSessions)
        if (selectedSessionIdRef.current === sessionId) {
          setSelectedSessionId(nextSessions[0]!.id)
        }
        setSaveStatus('saved')
      } catch (error) {
        setSaveStatus('error')
        pushToast('error', error instanceof Error ? error.message : 'Failed to delete drawing')
      }
    },
    [flushPendingSave, persistSession, pushToast, vaultApi]
  )

  const handleStartRenameSession = useCallback((sessionId: string): void => {
    const session = sessionsRef.current.find((item) => item.id === sessionId)
    if (!session) {
      return
    }

    setEditingSessionId(sessionId)
    setRenameDraft(session.title)
  }, [])

  const handleCancelRenameSession = useCallback((): void => {
    setEditingSessionId(null)
    setRenameDraft('')
  }, [])

  const handleCommitRenameSession = useCallback(
    async (sessionId: string): Promise<void> => {
      const latestSession = sessionsRef.current.find((item) => item.id === sessionId)
      const nextTitle = renameDraft.trim()

      if (!latestSession) {
        handleCancelRenameSession()
        return
      }

      if (!nextTitle || nextTitle === latestSession.title) {
        handleCancelRenameSession()
        return
      }

      const isSelected = selectedSessionIdRef.current === sessionId
      if (isSelected) {
        await flushPendingSave()
      }

      const refreshedSession = sessionsRef.current.find((item) => item.id === sessionId)
      if (!refreshedSession) {
        handleCancelRenameSession()
        return
      }

      const scene = isSelected
        ? (captureCurrentScene() ?? refreshedSession.scene)
        : refreshedSession.scene

      await persistSession({
        ...refreshedSession,
        title: nextTitle,
        updatedAt: new Date().toISOString(),
        scene
      })

      handleCancelRenameSession()
    },
    [captureCurrentScene, flushPendingSave, handleCancelRenameSession, persistSession, renameDraft]
  )

  const value = useMemo<ExcalidrawWorkspaceContextValue>(
    () => ({
      activeToolType,
      editingSessionId,
      handleCancelRenameSession,
      handleCommitRenameSession,
      handleCreateSession,
      handleDeleteSession,
      handleSceneChange,
      handleSelectSession,
      handleStartRenameSession,
      initialData,
      isLoading,
      renameDraft,
      renameInputRef,
      selectedSessionId,
      sessions,
      setApi: (api) => {
        apiRef.current = api
        setActiveToolType(api?.getAppState().activeTool.type ?? 'selection')
      },
      setRenameDraft,
      theme
    }),
    [
      activeToolType,
      editingSessionId,
      handleCancelRenameSession,
      handleCommitRenameSession,
      handleCreateSession,
      handleDeleteSession,
      handleSceneChange,
      handleSelectSession,
      handleStartRenameSession,
      initialData,
      isLoading,
      renameDraft,
      selectedSessionId,
      sessions,
      theme
    ]
  )

  return (
    <ExcalidrawWorkspaceContext.Provider value={value}>
      {children}
    </ExcalidrawWorkspaceContext.Provider>
  )
}

export function ExcalidrawPage(): ReactElement {
  const {
    activeToolType,
    handleSceneChange,
    initialData,
    isLoading,
    selectedSessionId,
    setApi,
    theme
  } = useExcalidrawWorkspace()

  return (
    <div
      className={`excalidraw-app-shell workspace-clear-surface h-full min-w-0 ${
        activeToolType === 'eraser' ? 'excalidraw-tool-eraser' : ''
      }`.trim()}
    >
      <div className="h-full min-h-0">
        {isLoading || !initialData ? (
          <div className="flex h-full items-center justify-center text-sm text-[var(--muted)]">
            Loading drawing...
          </div>
        ) : (
          <Excalidraw
            key={selectedSessionId}
            initialData={initialData}
            theme={theme}
            UIOptions={excalidrawUiOptions}
            excalidrawAPI={setApi}
            onChange={handleSceneChange}
          />
        )}
      </div>
    </div>
  )
}

export function ExcalidrawSidebar(): ReactElement {
  const {
    editingSessionId,
    handleCancelRenameSession,
    handleCommitRenameSession,
    handleCreateSession,
    handleDeleteSession,
    handleSelectSession,
    handleStartRenameSession,
    renameDraft,
    renameInputRef,
    selectedSessionId,
    sessions,
    setRenameDraft
  } = useExcalidrawWorkspace()
  return (
    <Fragment>
      <DocumentWorkspacePanelHeader
        actions={
          <WorkspaceHeaderActions>
            <WorkspaceHeaderActionGroup>
              <WorkspaceActionButton
                onClick={() => {
                  void handleCreateSession()
                }}
                aria-label="Create session"
                title="Create session"
                icon={<Plus size={18} />}
              />
            </WorkspaceHeaderActionGroup>
            <WorkspaceHeaderActionDivider />
            <WorkspaceHeaderActionGroup>
              <WorkspaceActionButton
                onClick={() => {
                  if (!selectedSessionId) {
                    return
                  }
                  void handleDeleteSession(selectedSessionId)
                }}
                disabled={!selectedSessionId}
                aria-label="Delete selected session"
                title="Delete selected session"
                icon={<Trash2 size={18} />}
              />
            </WorkspaceHeaderActionGroup>
          </WorkspaceHeaderActions>
        }
      />
      <DocumentWorkspacePanelContent className="p-3">
        <div
          className="right-panel-stagger-item"
          style={{ ['--right-panel-stagger-delay' as string]: '0ms' }}
        >
          <WorkspacePanelSection>
            <WorkspacePanelSectionHeader
              icon={<PenTool size={16} aria-hidden="true" />}
              heading="Saved drawings"
              description={`${sessions.length} saved drawings in this vault`}
            />
            <div className="space-y-2">
              {sessions.map((session, index) => {
                const isActive = session.id === selectedSessionId
                const isEditing = session.id === editingSessionId

                return (
                  <div
                    key={session.id}
                    style={{
                      ['--right-panel-stagger-delay' as string]: `${(index + 1) * 32}ms`
                    }}
                    data-active={isActive}
                    className="right-panel-stagger-item sidebar-menu-card right-panel-menu-card flex-col px-3 py-2.5"
                  >
                    {isEditing ? (
                      <div className="min-w-0">
                        <input
                          ref={renameInputRef}
                          value={renameDraft}
                          onChange={(event) => setRenameDraft(event.currentTarget.value)}
                          onBlur={() => {
                            void handleCommitRenameSession(session.id)
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault()
                              void handleCommitRenameSession(session.id)
                              return
                            }
                            if (event.key === 'Escape') {
                              event.preventDefault()
                              handleCancelRenameSession()
                            }
                          }}
                          className="workspace-subtle-control w-full rounded-md border border-[var(--accent)] px-2.5 py-1.5 text-sm font-semibold text-[var(--text)] outline-none"
                        />
                        <div className="mt-1 text-xs text-[var(--muted)]">
                          Updated {formatUpdatedAt(session.updatedAt)}
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          void handleSelectSession(session.id)
                        }}
                        onDoubleClick={() => {
                          handleStartRenameSession(session.id)
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' && event.metaKey) {
                            event.preventDefault()
                            handleStartRenameSession(session.id)
                            return
                          }
                          if (!isDeleteShortcut(event)) {
                            return
                          }
                          event.preventDefault()
                          void handleDeleteSession(session.id)
                        }}
                        className="w-full text-left"
                      >
                        <div className="truncate text-sm font-semibold text-[var(--text)]">
                          {session.title}
                        </div>
                        <div className="mt-1 text-xs text-[var(--muted)]">
                          Updated {formatUpdatedAt(session.updatedAt)}
                        </div>
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </WorkspacePanelSection>
        </div>
      </DocumentWorkspacePanelContent>
    </Fragment>
  )
}
