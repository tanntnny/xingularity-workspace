import { describe, expect, it } from 'vitest'
import { getNextActiveWorkspaceTabId } from '../src/renderer/src/lib/workspaceTabs'

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
