import { BrowserWindow, ipcMain, IpcMainInvokeEvent } from 'electron'
import { IPC_CHANNELS } from '../shared/ipc'
import type { AppErrorEvent } from '../shared/types'

function normalizeError(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) {
    return {
      message: error.message || error.name,
      stack: error.stack
    }
  }

  if (typeof error === 'string') {
    return { message: error }
  }

  try {
    return { message: JSON.stringify(error) }
  } catch {
    return { message: String(error) }
  }
}

export function createAppErrorEvent(
  source: AppErrorEvent['source'],
  error: unknown,
  extras: Partial<Pick<AppErrorEvent, 'channel'>> = {}
): AppErrorEvent {
  const normalized = normalizeError(error)
  return {
    source,
    message: normalized.message,
    stack: normalized.stack,
    channel: extras.channel
  }
}

export function broadcastAppError(event: AppErrorEvent): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(IPC_CHANNELS.appErrorEvent, event)
    }
  }
}

export function handleIpc(
  channel: string,
  handler: (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown | Promise<unknown>
): void {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      return await handler(event, ...args)
    } catch (error) {
      broadcastAppError(createAppErrorEvent('ipc', error, { channel }))
      throw error
    }
  })
}
