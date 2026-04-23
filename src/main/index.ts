import { app, BrowserWindow, protocol } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { registerIpcHandlers } from './ipc'
import { registerScheduleIpcHandlers } from './scheduleIpc'
import { VaultRuntime } from './runtime'
import { ScheduleService } from './scheduleService'
import { registerWeeklyPlanIpcHandlers } from './planning/weeklyPlanIpc'
import { WeeklyPlanService } from './planning/weeklyPlanService'
import { registerSubscriptionsIpcHandlers } from './subscriptionsIpc'
import { SubscriptionsService } from './subscriptionsService'
import { registerAgentToolIpcHandlers } from './agentToolsIpc'
import { AgentToolsService } from './agentToolsService'
import { createMainWindow } from './window'
import { IPC_CHANNELS } from '../shared/ipc'
import { HistoryService } from './historyService'
import * as fs from 'fs/promises'
import * as path from 'path'

const historyService = new HistoryService()
const runtime = new VaultRuntime(historyService)
const scheduleService = new ScheduleService(runtime)
const weeklyPlanService = new WeeklyPlanService(historyService)
const subscriptionsService = new SubscriptionsService()
const agentToolsService = new AgentToolsService(runtime, weeklyPlanService)
runtime.setAgentToolInvoker((name, input) => agentToolsService.invoke(name as never, input))
runtime.onVaultChange((paths) => {
  void scheduleService.handleVaultChange(paths ? paths.rootPath : null)
  weeklyPlanService.handleVaultChange(paths ? paths.rootPath : null)
  subscriptionsService.handleVaultChange(paths ? paths.rootPath : null)
})
runtime.onAgentChatEvent((event) => {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(IPC_CHANNELS.agentChatEvent, event)
    }
  }
})

// Register custom protocol to serve vault files
app.whenReady().then(() => {
  // Register vault-file:// protocol to serve images from vault
  protocol.handle('vault-file', async (request) => {
    try {
      const parsedUrl = new URL(request.url)
      const rawPath = parsedUrl.host
        ? `/${parsedUrl.host}${parsedUrl.pathname}`
        : parsedUrl.pathname
      const decodedPath = decodeURIComponent(rawPath)

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
  registerSubscriptionsIpcHandlers(subscriptionsService)
  registerAgentToolIpcHandlers(agentToolsService)
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
