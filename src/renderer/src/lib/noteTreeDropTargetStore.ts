type NoteTreeDropTargetListener = () => void

const listenersByFolderId = new Map<string, Set<NoteTreeDropTargetListener>>()
let activeFolderId: string | null = null

function notify(folderId: string | null): void {
  if (!folderId) {
    return
  }

  const listeners = listenersByFolderId.get(folderId)
  if (!listeners) {
    return
  }

  for (const listener of [...listeners]) {
    listener()
  }
}

export function subscribeNoteTreeDropTarget(
  folderId: string,
  listener: NoteTreeDropTargetListener
): () => void {
  const listeners = listenersByFolderId.get(folderId) ?? new Set<NoteTreeDropTargetListener>()
  listeners.add(listener)
  listenersByFolderId.set(folderId, listeners)

  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      listenersByFolderId.delete(folderId)
    }
  }
}

export function isNoteTreeDropTarget(folderId: string): boolean {
  return activeFolderId === folderId
}

export function setNoteTreeDropTarget(folderId: string | null): void {
  if (activeFolderId === folderId) {
    return
  }

  const previousFolderId = activeFolderId
  activeFolderId = folderId
  notify(previousFolderId)
  notify(folderId)
}

export function clearNoteTreeDropTarget(): void {
  setNoteTreeDropTarget(null)
}
