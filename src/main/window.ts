import { BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { is } from '@electron-toolkit/utils'
import { createAppErrorEvent } from '../shared/appErrors'
import icon from '../../assets/workspace_letter.png?asset'
import { createWindowErrorPageHtml } from './windowErrorPage'

interface MainWindowOptions {
  performanceModeEnabled?: boolean
}

export function applyMainWindowPerformanceMode(
  window: BrowserWindow,
  performanceModeEnabled: boolean
): void {
  window.setBackgroundColor(
    performanceModeEnabled || process.platform !== 'darwin' ? '#f6f7f9' : '#00000000'
  )

  if (process.platform !== 'darwin') {
    return
  }

  const macWindow = window as BrowserWindow & {
    setVibrancy?: (type: 'sidebar' | null) => void
    setVisualEffectState?: (state: 'active' | 'inactive' | 'followWindow') => void
  }

  macWindow.setVibrancy?.(performanceModeEnabled ? null : 'sidebar')
  macWindow.setVisualEffectState?.(performanceModeEnabled ? 'inactive' : 'active')
}

export async function loadMainWindowApp(window: BrowserWindow): Promise<void> {
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    await window.loadURL(process.env['ELECTRON_RENDERER_URL'])
    return
  }

  await window.loadFile(join(__dirname, '../renderer/index.html'))
}

async function showWindowErrorPage(
  window: BrowserWindow,
  error: ReturnType<typeof createAppErrorEvent>
) {
  if (window.isDestroyed()) {
    return
  }

  const markup = createWindowErrorPageHtml(error)
  await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(markup)}`)
}

export function createMainWindow(options: MainWindowOptions = {}): BrowserWindow {
  const isMac = process.platform === 'darwin'
  const performanceModeEnabled = options.performanceModeEnabled ?? false

  const mainWindow = new BrowserWindow({
    width: 1320,
    height: 840,
    minWidth: 980,
    minHeight: 640,
    show: true,
    autoHideMenuBar: true,
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    ...(isMac ? { trafficLightPosition: { x: 16, y: 14 } } : {}),
    backgroundColor: performanceModeEnabled || !isMac ? '#f6f7f9' : '#00000000',
    ...(isMac
      ? performanceModeEnabled
        ? {}
        : {
            transparent: true,
            vibrancy: 'sidebar',
            visualEffectState: 'active'
          }
      : {}),
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  })

  applyMainWindowPerformanceMode(mainWindow, performanceModeEnabled)

  mainWindow.on('ready-to-show', () => {
    mainWindow.center()
    if (!mainWindow.isVisible()) {
      mainWindow.show()
    }
    mainWindow.focus()
  })

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.center()
    if (!mainWindow.isVisible()) {
      mainWindow.show()
    }
    mainWindow.focus()
  })

  mainWindow.webContents.on(
    'did-fail-load',
    (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (!isMainFrame) {
        return
      }

      console.error('Renderer failed to load', {
        errorCode,
        errorDescription,
        validatedURL
      })
      void showWindowErrorPage(
        mainWindow,
        createAppErrorEvent(
          'main',
          new Error(`Renderer failed to load: ${errorDescription} (${errorCode})`)
        )
      )
      mainWindow.center()
      if (!mainWindow.isVisible()) {
        mainWindow.show()
      }
      mainWindow.focus()
    }
  )

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[window] render-process-gone', details)
    void showWindowErrorPage(
      mainWindow,
      createAppErrorEvent(
        'main',
        new Error(
          `Renderer process exited: ${details.reason}${details.exitCode !== undefined ? ` (${details.exitCode})` : ''}`
        )
      )
    )
  })

  setTimeout(() => {
    if (!mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      mainWindow.center()
      mainWindow.show()
      mainWindow.focus()
    }
  }, 2000)

  mainWindow.webContents.on('before-input-event', (event, input) => {
    const isReloadKey = input.type === 'keyDown' && input.key.toLowerCase() === 'r'
    const isReloadShortcut = isReloadKey && (input.meta || input.control)
    const isF5 = input.type === 'keyDown' && input.key === 'F5'
    if (isReloadShortcut || isF5) {
      event.preventDefault()
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url)
    return { action: 'deny' }
  })

  void loadMainWindowApp(mainWindow)

  return mainWindow
}
