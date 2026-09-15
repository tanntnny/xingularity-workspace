export interface NoteEditorSnapshotScheduler {
  schedule: (content: string) => void
  flush: () => string | null
  cancel: () => void
  dispose: () => void
}

export interface NoteEditorSnapshotSchedulerOptions {
  debounceMs: number
  maxWaitMs: number
  onFlush: (content: string) => void
}

export function createNoteEditorSnapshotScheduler({
  debounceMs,
  maxWaitMs,
  onFlush
}: NoteEditorSnapshotSchedulerOptions): NoteEditorSnapshotScheduler {
  let pendingContent: string | null = null
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let maxWaitTimer: ReturnType<typeof setTimeout> | null = null
  let disposed = false

  const clearDebounceTimer = (): void => {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
  }

  const clearMaxWaitTimer = (): void => {
    if (maxWaitTimer !== null) {
      clearTimeout(maxWaitTimer)
      maxWaitTimer = null
    }
  }

  const clearTimers = (): void => {
    clearDebounceTimer()
    clearMaxWaitTimer()
  }

  const flush = (): string | null => {
    if (disposed || pendingContent === null) {
      return null
    }

    const content = pendingContent
    pendingContent = null
    clearTimers()
    onFlush(content)
    return content
  }

  const schedule = (content: string): void => {
    if (disposed) {
      return
    }

    pendingContent = content
    clearDebounceTimer()
    debounceTimer = setTimeout(() => {
      debounceTimer = null
      flush()
    }, debounceMs)

    if (maxWaitTimer === null) {
      maxWaitTimer = setTimeout(() => {
        maxWaitTimer = null
        flush()
      }, maxWaitMs)
    }
  }

  const cancel = (): void => {
    pendingContent = null
    clearTimers()
  }

  const dispose = (): void => {
    cancel()
    disposed = true
  }

  return { schedule, flush, cancel, dispose }
}
