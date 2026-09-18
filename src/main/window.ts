import { app, BrowserWindow, ipcMain, shell, type IpcMainEvent } from 'electron'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { is } from '@electron-toolkit/utils'
import { createAppErrorEvent } from '../shared/appErrors'
import { IPC_CHANNELS } from '../shared/ipc'
import type { AppPrepareToCloseRequest, AppPrepareToCloseResponse } from '../shared/types'
import icon from '../../assets/logo.png?asset'
import { createWindowErrorPageHtml } from './windowErrorPage'

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
): Promise<void> {
  if (window.isDestroyed()) {
    return
  }

  const markup = createWindowErrorPageHtml(error)
  await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(markup)}`)
}

function isAppPrepareToCloseResponse(value: unknown): value is AppPrepareToCloseResponse {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.requestId === 'string' &&
    candidate.requestId.length > 0 &&
    typeof candidate.ok === 'boolean' &&
    (candidate.error === undefined || typeof candidate.error === 'string')
  )
}

function requestRendererPrepareToClose(window: BrowserWindow): Promise<AppPrepareToCloseResponse> {
  const request: AppPrepareToCloseRequest = { requestId: randomUUID() }

  return new Promise((resolve, reject) => {
    const cleanup = (): void => {
      ipcMain.removeListener(IPC_CHANNELS.appPrepareToCloseResponse, handleResponse)
      window.webContents.removeListener('destroyed', handleDestroyed)
    }

    const handleResponse = (event: IpcMainEvent, payload: unknown): void => {
      if (
        event.sender !== window.webContents ||
        !isAppPrepareToCloseResponse(payload) ||
        payload.requestId !== request.requestId
      ) {
        return
      }

      cleanup()
      resolve(payload)
    }

    const handleDestroyed = (): void => {
      cleanup()
      reject(new Error('The renderer closed before it could save pending changes'))
    }

    ipcMain.on(IPC_CHANNELS.appPrepareToCloseResponse, handleResponse)
    window.webContents.once('destroyed', handleDestroyed)

    try {
      window.webContents.send(IPC_CHANNELS.appPrepareToClose, request)
    } catch (error) {
      cleanup()
      reject(error)
    }
  })
}

export function createMainWindow(): BrowserWindow {
  const isMac = process.platform === 'darwin'

  const mainWindow = new BrowserWindow({
    width: 1320,
    height: 840,
    minWidth: 980,
    minHeight: 640,
    show: true,
    autoHideMenuBar: true,
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    ...(isMac ? { trafficLightPosition: { x: 16, y: 14 } } : {}),
    backgroundColor: '#f6f7f9',
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

  let rendererReady = false
  let closeAllowed = false
  let pendingClose: Promise<void> | null = null

  const handleRendererReady = (event: IpcMainEvent): void => {
    if (event.sender === mainWindow.webContents) {
      rendererReady = true
    }
  }
  ipcMain.on(IPC_CHANNELS.appRendererReady, handleRendererReady)

  mainWindow.webContents.on('did-start-loading', () => {
    rendererReady = false
  })

  mainWindow.on('close', (event) => {
    if (closeAllowed || !rendererReady || mainWindow.webContents.isDestroyed()) {
      return
    }

    event.preventDefault()
    if (pendingClose) {
      return
    }

    pendingClose = requestRendererPrepareToClose(mainWindow)
      .then((response) => {
        if (!response.ok) {
          console.error(
            '[window] renderer rejected close request',
            response.error ?? 'unknown error'
          )
          return
        }

        closeAllowed = true
        mainWindow.close()
        app.quit()
      })
      .catch((error) => {
        console.error('[window] renderer close handshake failed', error)
      })
      .finally(() => {
        pendingClose = null
      })
  })

  mainWindow.on('closed', () => {
    ipcMain.removeListener(IPC_CHANNELS.appRendererReady, handleRendererReady)
    rendererReady = false
  })

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
    rendererReady = false
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
