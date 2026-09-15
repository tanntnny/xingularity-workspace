import { describe, expect, it } from 'vitest'
import {
  getWorkspaceOpenOptions,
  isMiddleWorkspaceOpen,
  isModifiedWorkspaceOpen
} from '../src/renderer/src/lib/workspaceOpen'

describe('workspace opening interactions', () => {
  it('recognizes either platform modifier as a new-tab request', () => {
    expect(isModifiedWorkspaceOpen({ metaKey: true, ctrlKey: false })).toBe(true)
    expect(isModifiedWorkspaceOpen({ metaKey: false, ctrlKey: true })).toBe(true)
    expect(isModifiedWorkspaceOpen({ metaKey: false, ctrlKey: false })).toBe(false)
  })

  it('recognizes the middle mouse button', () => {
    expect(isMiddleWorkspaceOpen({ button: 1 })).toBe(true)
    expect(isMiddleWorkspaceOpen({ button: 0 })).toBe(false)
  })

  it('normalizes modified and middle activations to the same option', () => {
    expect(getWorkspaceOpenOptions({ metaKey: true, ctrlKey: false })).toEqual({
      openInNewTab: true
    })
    expect(getWorkspaceOpenOptions({ button: 1 })).toEqual({ openInNewTab: true })
    expect(getWorkspaceOpenOptions({ metaKey: false, ctrlKey: false })).toEqual({
      openInNewTab: false
    })
  })
})
