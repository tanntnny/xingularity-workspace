import type { ExcalidrawSessionScene, SearchResult } from '../../../shared/types'
import type { CalendarContentFilter } from './calendarTasks'
import type { NoteEditorSessionSnapshot } from './noteEditorSession'
import type { NoteTreeSelection } from './noteTreeSelection'
import type { ProjectsWorkspaceFilterMode } from './projectTaskRows'
import type { ResourceWorkspaceViewState, TaskWorkspaceViewState } from './workspaceViewState'
import type { TaskDialogSession, TaskPageSession } from './taskDialogSession'
import {
  createEmptySubscriptionWorkspaceSession,
  type SubscriptionWorkspaceSession
} from './subscriptionSession'
import type { SchedulingView } from '../components/scheduling/types'

export type CalendarViewMode = 'month' | 'week' | 'day'

export interface WorkspaceScrollPosition {
  top: number
  left: number
}

export interface WorkspaceViewport {
  x: number
  y: number
  zoom: number
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
}

export interface WorkspaceTabSession extends NotebookWorkspaceSession {
  calendarDate: string
  calendarViewMode: CalendarViewMode
  calendarContentFilter: CalendarContentFilter
  calendarTaskTagSettings: string[]
  calendarHeaderNewTask: string
  taskViewState: TaskWorkspaceViewState
  resourceViewState: ResourceWorkspaceViewState
  projectFilterMode: ProjectsWorkspaceFilterMode
  captureDraft: string
  captureResourceDraft: string
  schedulingView: SchedulingView
  taskDialog: TaskDialogSession | null
  taskPage: TaskPageSession | null
  subscriptions: SubscriptionWorkspaceSession
  excalidrawScenes: Record<string, ExcalidrawSessionScene>
  knowledgeViewport: WorkspaceViewport | null
  scrollPositions: Record<string, WorkspaceScrollPosition>
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
    noteEditorSessions: {}
  }
}

export function createEmptyWorkspaceTabSession(
  defaults: Partial<
    Pick<
      WorkspaceTabSession,
      'calendarDate' | 'calendarViewMode' | 'calendarContentFilter' | 'calendarTaskTagSettings'
    >
  > = {}
): WorkspaceTabSession {
  return {
    ...createEmptyNotebookWorkspaceSession(),
    calendarDate: defaults.calendarDate ?? new Date().toISOString().slice(0, 10),
    calendarViewMode: defaults.calendarViewMode ?? 'month',
    calendarContentFilter: defaults.calendarContentFilter ?? 'all',
    calendarTaskTagSettings: [...(defaults.calendarTaskTagSettings ?? [])],
    calendarHeaderNewTask: '',
    taskViewState: {
      filters: {},
      groupBy: 'none',
      sortState: { columnId: 'start-date', direction: 'asc' }
    },
    resourceViewState: {
      filters: {},
      sortState: null
    },
    projectFilterMode: 'all',
    captureDraft: '',
    captureResourceDraft: '',
    schedulingView: 'list',
    taskDialog: null,
    taskPage: null,
    subscriptions: createEmptySubscriptionWorkspaceSession(),
    excalidrawScenes: {},
    knowledgeViewport: null,
    scrollPositions: {}
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
}

export function remapWorkspaceTabSessionPaths(
  session: WorkspaceTabSession,
  sourcePath: string,
  targetPath: string
): void {
  remapNotebookWorkspaceSessionPaths(session, sourcePath, targetPath)

  const remappedScenes: Record<string, ExcalidrawSessionScene> = {}
  Object.entries(session.excalidrawScenes).forEach(([path, scene]) => {
    remappedScenes[remapPath(path, sourcePath, targetPath) ?? path] = scene
  })
  session.excalidrawScenes = remappedScenes
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
}

export function removeWorkspaceTabSessionPaths(
  session: WorkspaceTabSession,
  removedPaths: readonly string[]
): void {
  removeNotebookWorkspaceSessionPaths(session, removedPaths)
  session.excalidrawScenes = Object.fromEntries(
    Object.entries(session.excalidrawScenes).filter(
      ([path]) => !removedPaths.some((removedPath) => isPathAffected(path, removedPath))
    )
  )
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
