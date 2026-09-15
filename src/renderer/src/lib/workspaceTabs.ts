import type { SearchResult } from '../../../shared/types'
import type { NoteEditorSessionSnapshot } from './noteEditorSession'
import type { NoteTreeSelection } from './noteTreeSelection'

export type WorkspaceTabNoteScrollPositions = Record<string, Record<string, number>>

export interface NotebookNoteBaseline {
  fingerprint: string | null
  revision: string | null
}

export interface NotebookWorkspaceSession {
  currentNotePath: string | null
  currentExcalidrawPath: string | null
  browseFolderPath: string | null
  currentNoteContent: string
  currentNoteTags: string[]
  currentNoteEditorDraft: string | null
  searchQuery: string
  searchResults: SearchResult[]
  selectedNoteTreeEntries: NoteTreeSelection
  noteEditorSessions: Record<string, NoteEditorSessionSnapshot>
  noteEditorBaselines: Record<string, NotebookNoteBaseline>
}

export function createEmptyNotebookWorkspaceSession(): NotebookWorkspaceSession {
  return {
    currentNotePath: null,
    currentExcalidrawPath: null,
    browseFolderPath: null,
    currentNoteContent: '',
    currentNoteTags: [],
    currentNoteEditorDraft: null,
    searchQuery: '',
    searchResults: [],
    selectedNoteTreeEntries: [],
    noteEditorSessions: {},
    noteEditorBaselines: {}
  }
}

function remapPath(path: string | null, sourcePath: string, targetPath: string): string | null {
  if (!path) {
    return path
  }

  if (path === sourcePath) {
    return targetPath
  }

  if (path.startsWith(`${sourcePath}/`)) {
    return `${targetPath}${path.slice(sourcePath.length)}`
  }

  return path
}

function isPathAffected(path: string, removedPath: string): boolean {
  return path === removedPath || path.startsWith(`${removedPath}/`)
}

export function remapNotebookWorkspaceSessionPaths(
  session: NotebookWorkspaceSession,
  sourcePath: string,
  targetPath: string
): void {
  session.currentNotePath = remapPath(session.currentNotePath, sourcePath, targetPath)
  session.currentExcalidrawPath = remapPath(session.currentExcalidrawPath, sourcePath, targetPath)
  session.browseFolderPath = remapPath(session.browseFolderPath, sourcePath, targetPath)
  session.selectedNoteTreeEntries = session.selectedNoteTreeEntries.map((entry) => ({
    ...entry,
    relPath: remapPath(entry.relPath, sourcePath, targetPath) ?? entry.relPath
  }))
  session.searchResults = session.searchResults.map((result) => ({
    ...result,
    relPath: remapPath(result.relPath, sourcePath, targetPath) ?? result.relPath
  }))

  const remappedEditorSessions: Record<string, NoteEditorSessionSnapshot> = {}
  Object.entries(session.noteEditorSessions).forEach(([path, editorSession]) => {
    const nextPath = remapPath(path, sourcePath, targetPath) ?? path
    remappedEditorSessions[nextPath] = editorSession
  })
  session.noteEditorSessions = remappedEditorSessions

  const remappedBaselines: Record<string, NotebookNoteBaseline> = {}
  Object.entries(session.noteEditorBaselines).forEach(([path, baseline]) => {
    const nextPath = remapPath(path, sourcePath, targetPath) ?? path
    remappedBaselines[nextPath] = baseline
  })
  session.noteEditorBaselines = remappedBaselines
}

export function removeNotebookWorkspaceSessionPaths(
  session: NotebookWorkspaceSession,
  removedPaths: readonly string[]
): void {
  const isRemoved = (path: string | null): boolean =>
    Boolean(path && removedPaths.some((removedPath) => isPathAffected(path, removedPath)))

  if (isRemoved(session.currentNotePath)) {
    session.currentNotePath = null
    session.currentNoteContent = ''
    session.currentNoteTags = []
    session.currentNoteEditorDraft = null
  }
  if (isRemoved(session.currentExcalidrawPath)) {
    session.currentExcalidrawPath = null
  }
  if (isRemoved(session.browseFolderPath)) {
    session.browseFolderPath = null
  }

  session.selectedNoteTreeEntries = session.selectedNoteTreeEntries.filter(
    (entry) => !isRemoved(entry.relPath)
  )
  session.searchResults = session.searchResults.filter((result) => !isRemoved(result.relPath))
  session.noteEditorSessions = Object.fromEntries(
    Object.entries(session.noteEditorSessions).filter(([path]) => !isRemoved(path))
  )
  session.noteEditorBaselines = Object.fromEntries(
    Object.entries(session.noteEditorBaselines).filter(([path]) => !isRemoved(path))
  )
}

export function remapWorkspaceTabNoteScrollPositions(
  positions: WorkspaceTabNoteScrollPositions,
  sourcePath: string,
  targetPath: string
): void {
  Object.entries(positions).forEach(([tabId, tabPositions]) => {
    const remappedPositions: Record<string, number> = {}
    Object.entries(tabPositions).forEach(([path, scrollTop]) => {
      const nextPath = remapPath(path, sourcePath, targetPath) ?? path
      remappedPositions[nextPath] = scrollTop
    })
    positions[tabId] = remappedPositions
  })
}

export function removeWorkspaceTabNoteScrollPositions(
  positions: WorkspaceTabNoteScrollPositions,
  removedPaths: readonly string[]
): void {
  Object.entries(positions).forEach(([tabId, tabPositions]) => {
    const remainingPositions = Object.fromEntries(
      Object.entries(tabPositions).filter(
        ([path]) => !removedPaths.some((removedPath) => isPathAffected(path, removedPath))
      )
    )

    if (Object.keys(remainingPositions).length === 0) {
      delete positions[tabId]
      return
    }

    positions[tabId] = remainingPositions
  })
}

export function getNextActiveWorkspaceTabId(
  tabIds: readonly string[],
  closingTabId: string
): string | null {
  const closingIndex = tabIds.indexOf(closingTabId)
  if (closingIndex < 0) {
    return null
  }

  return tabIds[closingIndex + 1] ?? tabIds[closingIndex - 1] ?? null
}
