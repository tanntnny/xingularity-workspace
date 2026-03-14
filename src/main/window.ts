import { BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

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
    backgroundColor: isMac ? '#00000000' : '#f6f7f9',
    ...(isMac
      ? {
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
    (_event, errorCode, errorDescription, validatedURL) => {
      console.error('Renderer failed to load', {
        errorCode,
        errorDescription,
        validatedURL
      })
      mainWindow.center()
      if (!mainWindow.isVisible()) {
        mainWindow.show()
      }
      mainWindow.focus()
    }
  )

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[window] render-process-gone', details)
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

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}
