import type { AppErrorEvent } from './types'

const APP_ERROR_SOURCE_LABELS: Record<AppErrorEvent['source'], string> = {
  ipc: 'IPC',
  main: 'Main Process',
  renderer: 'Renderer'
}

export function normalizeAppError(error: unknown): { message: string; stack?: string } {
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
  extras: Partial<Pick<AppErrorEvent, 'channel' | 'stack'>> = {}
): AppErrorEvent {
  const normalized = normalizeAppError(error)
  return {
    source,
    message: normalized.message,
    stack: extras.stack ?? normalized.stack,
    channel: extras.channel
  }
}

export function formatAppErrorSource(source: AppErrorEvent['source']): string {
  return APP_ERROR_SOURCE_LABELS[source]
}

export function mergeAppErrorStacks(primary?: string, secondary?: string): string | undefined {
  const parts = [primary?.trim(), secondary?.trim()].filter(Boolean)
  if (parts.length === 0) {
    return undefined
  }

  return parts.join('\n\n')
}

export function formatAppErrorDetails(event: AppErrorEvent): string {
  const lines = [
    `Source: ${formatAppErrorSource(event.source)}`,
    event.channel ? `Channel: ${event.channel}` : null,
    `Message: ${event.message}`
  ].filter(Boolean)

  if (event.stack?.trim()) {
    lines.push('', event.stack.trim())
  }

  return lines.join('\n')
}
