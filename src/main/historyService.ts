import type { HistoryAffectedAreas, HistoryOperationResult, HistoryStatus } from '../shared/types'

export interface HistoryEntry {
  label: string
  affected: HistoryAffectedAreas
  undo: () => Promise<HistoryAffectedAreas | void>
  redo: () => Promise<HistoryAffectedAreas | void>
}

export class HistoryService {
  private undoStack: HistoryEntry[] = []
  private redoStack: HistoryEntry[] = []

  push(entry: HistoryEntry): void {
    this.undoStack.push(entry)
    this.redoStack = []
  }

  clear(): void {
    this.undoStack = []
    this.redoStack = []
  }

  status(): HistoryStatus {
    const undoEntry = this.undoStack[this.undoStack.length - 1] ?? null
    const redoEntry = this.redoStack[this.redoStack.length - 1] ?? null
    return {
      canUndo: Boolean(undoEntry),
      canRedo: Boolean(redoEntry),
      undoLabel: undoEntry?.label ?? null,
      redoLabel: redoEntry?.label ?? null
    }
  }

  async undo(): Promise<HistoryOperationResult> {
    const entry = this.undoStack.pop()
    if (!entry) {
      return {
        performed: false,
        action: 'undo',
        label: null,
        affected: {}
      }
    }

    const affected = (await entry.undo()) ?? entry.affected
    this.redoStack.push(entry)
    return {
      performed: true,
      action: 'undo',
      label: entry.label,
      affected
    }
  }

  async redo(): Promise<HistoryOperationResult> {
    const entry = this.redoStack.pop()
    if (!entry) {
      return {
        performed: false,
        action: 'redo',
        label: null,
        affected: {}
      }
    }

    const affected = (await entry.redo()) ?? entry.affected
    this.undoStack.push(entry)
    return {
      performed: true,
      action: 'redo',
      label: entry.label,
      affected
    }
  }
}
