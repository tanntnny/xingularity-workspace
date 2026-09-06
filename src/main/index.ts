import { app, BrowserWindow, protocol, systemPreferences } from 'electron'
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
import { registerCalendarIpcHandlers } from './calendarIpc'
import { CalendarService, type CalendarGoogleAdapter } from './calendarService'
import { CalendarStore } from './calendarStore'
import { GoogleCalendarAdapter } from './googleCalendarAdapter'
import { CredentialStore } from './credentialStore'
import { createMainWindow } from './window'
import { createVaultFileProtocolHandler } from './vaultFileProtocol'
import { IPC_CHANNELS } from '../shared/ipc'
import { HistoryService } from './historyService'
import { broadcastMainProcessError } from './errorReporting'

const historyService = new HistoryService()
const runtime = new VaultRuntime(historyService)
const scheduleService = new ScheduleService(runtime)
const weeklyPlanService = new WeeklyPlanService(historyService)
const subscriptionsService = new SubscriptionsService()
const agentToolsService = new AgentToolsService(runtime, weeklyPlanService)
const credentialStore = new CredentialStore()
let calendarService: CalendarService | null = null
runtime.setAgentToolInvoker((name, input) => agentToolsService.invoke(name as never, input))
runtime.onVaultChange((paths) => {
  void scheduleService.handleVaultChange(paths ? paths.rootPath : null)
  weeklyPlanService.handleVaultChange(paths ? paths.rootPath : null)
  subscriptionsService.handleVaultChange(paths ? paths.rootPath : null)
  calendarService = paths ? createCalendarService(paths.rootPath) : null
})
runtime.onTreeChange(() => {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(IPC_CHANNELS.filesTreeChanged)
    }
  }
})
runtime.onVaultEvent((event) => {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(IPC_CHANNELS.vaultChanged, event)
    }
  }
})
runtime.onReminderClick((target) => {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(IPC_CHANNELS.reminderClicked, target)
    }
  }
})
runtime.onAgentChatEvent((event) => {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(IPC_CHANNELS.agentChatEvent, event)
    }
  }
})

process.on('uncaughtException', (error) => {
  console.error('[main] uncaughtException', error)
  broadcastMainProcessError(error)
})

process.on('unhandledRejection', (reason) => {
  console.error('[main] unhandledRejection', reason)
  broadcastMainProcessError(reason)
})

// Register custom protocol to serve vault files
app.whenReady().then(() => {
  if (process.platform === 'darwin') {
    systemPreferences.setUserDefault('ApplePressAndHoldEnabled', 'boolean', false)
  }

  // Register vault-file:// protocol to serve images from vault
  protocol.handle(
    'vault-file',
    createVaultFileProtocolHandler(() => runtime.getVaultFileProtocolScope())
  )

  electronApp.setAppUserModelId('com.beacon.vault')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerIpcHandlers(runtime)
  registerScheduleIpcHandlers(scheduleService)
  registerWeeklyPlanIpcHandlers(weeklyPlanService)
  registerSubscriptionsIpcHandlers(subscriptionsService)
  registerAgentToolIpcHandlers(agentToolsService)
  registerCalendarIpcHandlers(() => calendarService)
  void scheduleService.init()
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

function createCalendarService(vaultRoot: string): CalendarService {
  const clientId = process.env.XINGULARITY_GOOGLE_CLIENT_ID?.trim()
  const redirectUri = process.env.XINGULARITY_GOOGLE_REDIRECT_URI?.trim()
  const googleAdapter: CalendarGoogleAdapter =
    clientId && redirectUri
      ? new GoogleCalendarAdapter({
          clientId,
          redirectUri,
          vaultRoot,
          credentialStore
        })
      : new UnavailableGoogleCalendarAdapter()
  return new CalendarService(new CalendarStore(vaultRoot), googleAdapter, {
    defaultTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  })
}

class UnavailableGoogleCalendarAdapter implements CalendarGoogleAdapter {
  createAuthorizationRequest(): never {
    throw new Error(
      'Google Calendar is not configured. Set XINGULARITY_GOOGLE_CLIENT_ID and XINGULARITY_GOOGLE_REDIRECT_URI before connecting.'
    )
  }

  completeAuthorization(): Promise<never> {
    return Promise.reject(this.configurationError())
  }

  listCalendars(): Promise<never> {
    return Promise.reject(this.configurationError())
  }

  syncEvents(): Promise<never> {
    return Promise.reject(this.configurationError())
  }

  disconnect(): Promise<never> {
    return Promise.reject(this.configurationError())
  }

  revoke(): Promise<never> {
    return Promise.reject(this.configurationError())
  }

  private configurationError(): Error {
    return new Error(
      'Google Calendar is not configured. Set XINGULARITY_GOOGLE_CLIENT_ID and XINGULARITY_GOOGLE_REDIRECT_URI before connecting.'
    )
  }
}

app.on('window-all-closed', () => {
  scheduleService.destroy()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
