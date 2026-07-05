import { BrowserWindow, ipcMain, IpcMainInvokeEvent } from 'electron'
import { IPC_CHANNELS } from '../shared/ipc'
import type { AppErrorEvent } from '../shared/types'
import { createAppErrorEvent } from '../shared/appErrors'

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

export function broadcastMainProcessError(error: unknown): void {
  broadcastAppError(createAppErrorEvent('main', error))
}
