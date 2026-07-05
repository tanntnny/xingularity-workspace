import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppErrorEvent } from '../src/shared/types'

const windowSend = vi.fn()
const destroyedWindowSend = vi.fn()
let registeredHandler:
  | ((event: { sender: unknown }, ...args: unknown[]) => unknown | Promise<unknown>)
  | undefined

vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: () => [
      {
        isDestroyed: () => false,
        webContents: { send: windowSend }
      },
      {
        isDestroyed: () => true,
        webContents: { send: destroyedWindowSend }
      }
    ]
  },
  ipcMain: {
    handle: vi.fn((_channel: string, handler: typeof registeredHandler) => {
      registeredHandler = handler
    })
  }
}))

import { IPC_CHANNELS } from '../src/shared/ipc'
import { broadcastAppError, handleIpc } from '../src/main/errorReporting'

describe('errorReporting', () => {
  beforeEach(() => {
    windowSend.mockReset()
    destroyedWindowSend.mockReset()
    registeredHandler = undefined
  })

  it('broadcasts app errors only to live windows', () => {
    const event: AppErrorEvent = {
      source: 'main',
      message: 'Renderer crashed',
      stack: 'stack trace'
    }

    broadcastAppError(event)

    expect(windowSend).toHaveBeenCalledWith(IPC_CHANNELS.appErrorEvent, event)
    expect(destroyedWindowSend).not.toHaveBeenCalled()
  })

  it('wraps IPC handlers, broadcasts failures, and rethrows', async () => {
    handleIpc('settings:update', async () => {
      throw new Error('No vault selected')
    })

    expect(registeredHandler).toBeTypeOf('function')

    await expect(registeredHandler?.({ sender: {} })).rejects.toThrow('No vault selected')
    expect(windowSend).toHaveBeenCalledWith(
      IPC_CHANNELS.appErrorEvent,
      expect.objectContaining({
        source: 'ipc',
        channel: 'settings:update',
        message: 'No vault selected'
      })
    )
  })
})
