import {
  type ComponentProps,
  type ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { Excalidraw, serializeAsJSON, THEME } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'
import type { ExcalidrawSessionScene, RendererVaultApi } from '../../../shared/types'
import { createEmptyExcalidrawFileDocument } from '../../../shared/excalidrawFile'

type ExcalidrawTheme = typeof THEME.LIGHT | typeof THEME.DARK
type ExcalidrawApi = Parameters<NonNullable<ComponentProps<typeof Excalidraw>['excalidrawAPI']>>[0]
type ExcalidrawOnChange = NonNullable<ComponentProps<typeof Excalidraw>['onChange']>
type ExcalidrawInitialData = NonNullable<ComponentProps<typeof Excalidraw>['initialData']>
type ToastKind = 'info' | 'error' | 'success'

interface ExcalidrawFileEditorProps {
  notePath: string
  vaultApi: RendererVaultApi | undefined
  pushToast: (kind: ToastKind, message: string) => void
}

const SAVE_DEBOUNCE_MS = 800

const excalidrawUiOptions = {
  canvasActions: {
    toggleTheme: false
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function getSystemExcalidrawTheme(): ExcalidrawTheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? THEME.DARK : THEME.LIGHT
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

export function ExcalidrawFileEditor({
  notePath,
  vaultApi,
  pushToast
}: ExcalidrawFileEditorProps): ReactElement {
  const [theme, setTheme] = useState<ExcalidrawTheme>(getSystemExcalidrawTheme)
  const [isLoading, setIsLoading] = useState(true)
  const [activeToolType, setActiveToolType] = useState('selection')
  const [scene, setScene] = useState<ExcalidrawSessionScene>(createEmptyExcalidrawFileDocument().scene)
  const apiRef = useRef<ExcalidrawApi | null>(null)
  const saveTimerRef = useRef<number | null>(null)
  const pendingSceneRef = useRef<ExcalidrawSessionScene | null>(null)
  const saveVersionRef = useRef(0)

  const initialData = useMemo<ExcalidrawInitialData>(
    () =>
      ({
        ...scene,
        appState: {
          ...scene.appState,
          viewBackgroundColor: 'transparent'
        },
        scrollToContent: true
      }) as ExcalidrawInitialData,
    [scene]
  )

  const flushPendingSave = useCallback(async (): Promise<void> => {
    if (!vaultApi) {
      return
    }

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }

    const pendingScene = pendingSceneRef.current
    if (!pendingScene) {
      return
    }

    pendingSceneRef.current = null
    const saveVersion = saveVersionRef.current + 1
    saveVersionRef.current = saveVersion

    try {
      await vaultApi.files.writeExcalidrawFileDocument(notePath, {
        version: 1,
        scene: pendingScene
      })
      if (saveVersion === saveVersionRef.current) {
        setScene(pendingScene)
      }
    } catch (error) {
      pushToast('error', error instanceof Error ? error.message : 'Failed to save drawing')
    }
  }, [notePath, pushToast, vaultApi])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const syncTheme = (): void => setTheme(getSystemExcalidrawTheme())

    syncTheme()
    mediaQuery.addEventListener('change', syncTheme)
    return () => mediaQuery.removeEventListener('change', syncTheme)
  }, [])

  useEffect(() => {
    let cancelled = false
    void flushPendingSave()

    const load = async (): Promise<void> => {
      if (!vaultApi) {
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      try {
        const document = await vaultApi.files.readExcalidrawFileDocument(notePath)
        if (cancelled) {
          return
        }
        pendingSceneRef.current = null
        setScene(document.scene)
      } catch (error) {
        if (!cancelled) {
          pushToast('error', error instanceof Error ? error.message : 'Failed to load drawing')
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [flushPendingSave, notePath, pushToast, vaultApi])

  useEffect(() => {
    return () => {
      void flushPendingSave()
    }
  }, [flushPendingSave])

  const handleSceneChange = useCallback<ExcalidrawOnChange>(
    (elements, appState, files) => {
      setActiveToolType(appState.activeTool.type)
      pendingSceneRef.current = serializeScene(elements, appState, files)

      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current)
      }

      saveTimerRef.current = window.setTimeout(() => {
        void flushPendingSave()
      }, SAVE_DEBOUNCE_MS)
    },
    [flushPendingSave]
  )

  return (
    <div
      className={`excalidraw-app-shell workspace-clear-surface h-full min-w-0 ${
        activeToolType === 'eraser' ? 'excalidraw-tool-eraser' : ''
      }`.trim()}
    >
      <div className="h-full min-h-0">
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-sm text-[var(--muted)]">
            Loading drawing...
          </div>
        ) : (
          <Excalidraw
            key={notePath}
            initialData={initialData}
            theme={theme}
            UIOptions={excalidrawUiOptions}
            excalidrawAPI={(api) => {
              apiRef.current = api
              setActiveToolType(api?.getAppState().activeTool.type ?? 'selection')
            }}
            onChange={handleSceneChange}
          />
        )}
      </div>
    </div>
  )
}
