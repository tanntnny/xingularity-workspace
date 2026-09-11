import { describe, expect, it } from 'vitest'
import {
  createEmptyNotebookWorkspaceSession,
  createEmptyWorkspaceTabSession,
  getNextActiveWorkspaceTabId,
  remapNotebookWorkspaceSessionPaths,
  remapWorkspaceTabSessionPaths,
  removeNotebookWorkspaceSessionPaths
} from '../src/renderer/src/lib/workspaceTabs'

describe('getNextActiveWorkspaceTabId', () => {
  it('selects the tab to the right when closing a non-final tab', () => {
    expect(getNextActiveWorkspaceTabId(['notes', 'projects', 'calendar'], 'projects')).toBe(
      'calendar'
    )
  })

  it('selects the tab to the left when closing the final tab', () => {
    expect(getNextActiveWorkspaceTabId(['notes', 'projects'], 'projects')).toBe('notes')
  })

  it('returns null when closing the only tab', () => {
    expect(getNextActiveWorkspaceTabId(['notes'], 'notes')).toBeNull()
  })
})

describe('NotebookWorkspaceSession', () => {
  it('starts as an empty notebook chooser session', () => {
    expect(createEmptyNotebookWorkspaceSession()).toEqual({
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
    })
  })

  it('remaps all notebook state when a file or folder moves', () => {
    const session = createEmptyNotebookWorkspaceSession()
    session.currentNotePath = 'archive/alpha.md'
    session.currentExcalidrawPath = 'archive/diagram.excalidraw'
    session.browseFolderPath = 'archive'
    session.selectedNoteTreeEntries = [{ kind: 'folder', relPath: 'archive' }]
    session.searchResults = [
      {
        id: 'alpha',
        relPath: 'archive/alpha.md',
        title: 'Alpha',
        tags: [],
        updated: '',
        snippet: '',
        entityType: 'note',
        target: { kind: 'note', id: 'alpha', relPath: 'archive/alpha.md' }
      }
    ]
    session.noteEditorSessions['archive/alpha.md'] = { content: 'Alpha', tags: [] }

    remapNotebookWorkspaceSessionPaths(session, 'archive', 'work')

    expect(session.currentNotePath).toBe('work/alpha.md')
    expect(session.currentExcalidrawPath).toBe('work/diagram.excalidraw')
    expect(session.browseFolderPath).toBe('work')
    expect(session.selectedNoteTreeEntries).toEqual([{ kind: 'folder', relPath: 'work' }])
    expect(session.searchResults[0]?.relPath).toBe('work/alpha.md')
    expect(session.noteEditorSessions['work/alpha.md']).toEqual({ content: 'Alpha', tags: [] })
  })

  it('removes deleted paths without affecting unrelated notebook state', () => {
    const session = createEmptyNotebookWorkspaceSession()
    session.currentNotePath = 'archive/alpha.md'
    session.browseFolderPath = 'archive'
    session.currentNoteContent = 'draft'
    session.noteEditorSessions['archive/alpha.md'] = { content: 'draft', tags: [] }
    session.noteEditorSessions['beta.md'] = { content: 'beta', tags: [] }
    session.selectedNoteTreeEntries = [
      { kind: 'note', relPath: 'archive/alpha.md' },
      { kind: 'note', relPath: 'beta.md' }
    ]

    removeNotebookWorkspaceSessionPaths(session, ['archive'])

    expect(session.currentNotePath).toBeNull()
    expect(session.browseFolderPath).toBeNull()
    expect(session.currentNoteContent).toBe('')
    expect(session.noteEditorSessions).toEqual({
      'beta.md': { content: 'beta', tags: [] }
    })
    expect(session.selectedNoteTreeEntries).toEqual([{ kind: 'note', relPath: 'beta.md' }])
  })
})

describe('WorkspaceTabSession', () => {
  it('starts with isolated defaults for page work state', () => {
    const first = createEmptyWorkspaceTabSession()
    const second = createEmptyWorkspaceTabSession()

    first.captureDraft = 'first draft'
    first.taskViewState.filters = { searchQuery: 'first' }
    first.calendarTaskTagSettings.push('first-tag')
    first.subscriptions.draft.tags.push('first-tag')

    expect(second.captureDraft).toBe('')
    expect(second.taskViewState.filters).toEqual({})
    expect(second.calendarTaskTagSettings).toEqual([])
    expect(second.subscriptions.draft.tags).toEqual([])
    expect(first.calendarHeaderNewTask).toBe('')
    expect(first.calendarViewMode).toBe('month')
    expect(first.schedulingView).toBe('list')
  })

  it('accepts session-specific defaults without sharing mutable values', () => {
    const session = createEmptyWorkspaceTabSession({
      calendarDate: '2025-05-12',
      calendarViewMode: 'week',
      calendarContentFilter: 'projectTasks',
      calendarTaskTagSettings: ['important']
    })

    session.calendarTaskTagSettings.push('later')

    expect(session.calendarDate).toBe('2025-05-12')
    expect(session.calendarViewMode).toBe('week')
    expect(session.calendarContentFilter).toBe('projectTasks')
    expect(session.calendarTaskTagSettings).toEqual(['important', 'later'])
  })

  it('remaps drawing scene state alongside notebook paths', () => {
    const session = createEmptyWorkspaceTabSession()
    session.excalidrawScenes['archive/diagram.excalidraw'] = {
      type: 'excalidraw',
      version: 2,
      source: 'test',
      elements: [],
      appState: {},
      files: {}
    }

    remapWorkspaceTabSessionPaths(session, 'archive', 'work')

    expect(session.excalidrawScenes['work/diagram.excalidraw']).toBeDefined()
    expect(session.excalidrawScenes['archive/diagram.excalidraw']).toBeUndefined()
  })
})
