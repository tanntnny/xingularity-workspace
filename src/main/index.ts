import { app, BrowserWindow, protocol } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { registerIpcHandlers } from './ipc'
import { registerScheduleIpcHandlers } from './scheduleIpc'
import { VaultRuntime } from './runtime'
import { ScheduleService } from './scheduleService'
import { registerWeeklyPlanIpcHandlers } from './planning/weeklyPlanIpc'
import { WeeklyPlanService } from './planning/weeklyPlanService'
import { createMainWindow } from './window'
import * as fs from 'fs/promises'
import * as path from 'path'

const runtime = new VaultRuntime()
const scheduleService = new ScheduleService(runtime)
const weeklyPlanService = new WeeklyPlanService()
runtime.onVaultChange((paths) => {
  void scheduleService.handleVaultChange(paths ? paths.rootPath : null)
  weeklyPlanService.handleVaultChange(paths ? paths.rootPath : null)
})

// Register custom protocol to serve vault files
app.whenReady().then(() => {
  // Register vault-file:// protocol to serve images from vault
  protocol.handle('vault-file', async (request) => {
    const url = request.url.replace('vault-file://', '')
    const decodedPath = decodeURIComponent(url)

    try {
      // Security: only allow access to files within vault directories
      const absolutePath = path.normalize(decodedPath)

      // Read the file
      const data = await fs.readFile(absolutePath)

      // Determine MIME type based on file extension
      const ext = path.extname(absolutePath).toLowerCase()
      const mimeTypes: Record<string, string> = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml',
        '.bmp': 'image/bmp'
      }
      const mimeType = mimeTypes[ext] || 'application/octet-stream'

      return new Response(data, {
        headers: { 'Content-Type': mimeType }
      })
    } catch (error) {
      console.error('Failed to load vault file:', error)
      return new Response('File not found', { status: 404 })
    }
  })

  electronApp.setAppUserModelId('com.beacon.vault')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerIpcHandlers(runtime)
  registerScheduleIpcHandlers(scheduleService)
  registerWeeklyPlanIpcHandlers(weeklyPlanService)
  void scheduleService.init()
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  scheduleService.destroy()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
