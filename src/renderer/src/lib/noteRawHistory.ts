export const NOTE_RAW_HISTORY_LIMIT = 100
export const NOTE_RAW_HISTORY_MAX_BYTES = 8 * 1024 * 1024

export function getNoteRawHistoryEntryBytes(value: string): number {
  return value.length * 2
}

export function trimNoteRawHistory(
  history: string[],
  historyBytes: number,
  maxEntries = NOTE_RAW_HISTORY_LIMIT,
  maxBytes = NOTE_RAW_HISTORY_MAX_BYTES
): number {
  let nextHistoryBytes = historyBytes

  while (history.length > maxEntries || nextHistoryBytes > maxBytes) {
    const removedValue = history.shift()
    if (removedValue === undefined) {
      break
    }

    nextHistoryBytes -= getNoteRawHistoryEntryBytes(removedValue)
  }

  return Math.max(0, nextHistoryBytes)
}
