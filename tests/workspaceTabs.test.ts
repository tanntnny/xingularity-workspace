import { describe, expect, it } from 'vitest'
import {
  createEmptyNotebookWorkspaceSession,
  getNextActiveWorkspaceTabId,
  remapWorkspaceTabNoteScrollPositions,
  remapNotebookWorkspaceSessionPaths,
  removeNotebookWorkspaceSessionPaths,
  removeWorkspaceTabNoteScrollPositions,
  type WorkspaceTabNoteScrollPositions
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
      noteEditorSessions: {},
      noteEditorBaselines: {}
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
    session.noteEditorBaselines['archive/alpha.md'] = {
      fingerprint: 'alpha-baseline',
      revision: 'revision-1'
    }

    remapNotebookWorkspaceSessionPaths(session, 'archive', 'work')

    expect(session.currentNotePath).toBe('work/alpha.md')
    expect(session.currentExcalidrawPath).toBe('work/diagram.excalidraw')
    expect(session.browseFolderPath).toBe('work')
    expect(session.selectedNoteTreeEntries).toEqual([{ kind: 'folder', relPath: 'work' }])
    expect(session.searchResults[0]?.relPath).toBe('work/alpha.md')
    expect(session.noteEditorSessions['work/alpha.md']).toEqual({ content: 'Alpha', tags: [] })
    expect(session.noteEditorBaselines['work/alpha.md']).toEqual({
      fingerprint: 'alpha-baseline',
      revision: 'revision-1'
    })
  })

  it('removes deleted paths without affecting unrelated notebook state', () => {
    const session = createEmptyNotebookWorkspaceSession()
    session.currentNotePath = 'archive/alpha.md'
    session.browseFolderPath = 'archive'
    session.currentNoteContent = 'draft'
    session.noteEditorSessions['archive/alpha.md'] = { content: 'draft', tags: [] }
    session.noteEditorSessions['beta.md'] = { content: 'beta', tags: [] }
    session.noteEditorBaselines['archive/alpha.md'] = {
      fingerprint: 'draft-baseline',
      revision: 'revision-1'
    }
    session.noteEditorBaselines['beta.md'] = {
      fingerprint: 'beta-baseline',
      revision: 'revision-2'
    }
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
    expect(session.noteEditorBaselines).toEqual({
      'beta.md': { fingerprint: 'beta-baseline', revision: 'revision-2' }
    })
    expect(session.selectedNoteTreeEntries).toEqual([{ kind: 'note', relPath: 'beta.md' }])
  })
})

describe('WorkspaceTabNoteScrollPositions', () => {
  it('remaps note paths independently in every workspace tab', () => {
    const positions: WorkspaceTabNoteScrollPositions = {
      'workspace-tab-1': {
        'archive/alpha.md': 120,
        'beta.md': 40
      },
      'workspace-tab-2': {
        'archive/alpha.md': 360
      }
    }

    remapWorkspaceTabNoteScrollPositions(positions, 'archive', 'work')

    expect(positions).toEqual({
      'workspace-tab-1': {
        'work/alpha.md': 120,
        'beta.md': 40
      },
      'workspace-tab-2': {
        'work/alpha.md': 360
      }
    })
  })

  it('removes deleted note paths without affecting other tab positions', () => {
    const positions: WorkspaceTabNoteScrollPositions = {
      'workspace-tab-1': {
        'archive/alpha.md': 120,
        'beta.md': 40
      },
      'workspace-tab-2': {
        'archive/nested/gamma.md': 360
      }
    }

    removeWorkspaceTabNoteScrollPositions(positions, ['archive'])

    expect(positions).toEqual({
      'workspace-tab-1': {
        'beta.md': 40
      }
    })
  })
})
