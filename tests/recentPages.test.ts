import { describe, expect, it } from 'vitest'
import {
  normalizeRecentPageTargets,
  rememberRecentPageTarget,
  remapRecentPageTargets,
  removeRecentPageTargets,
  type RecentPageTarget
} from '../src/shared/recentPages'

describe('recent pages', () => {
  it('normalizes mixed target history to five unique eligible targets', () => {
    expect(
      normalizeRecentPageTargets([
        { kind: 'project', projectId: ' project-1 ' },
        { kind: 'page', pageId: 'calendar' },
        { kind: 'note', path: 'notes/alpha.md' },
        { kind: 'project', projectId: 'project-1' },
        { kind: 'drawing', path: 'drawings/board.excalidraw' },
        { kind: 'view', viewId: 'view-tasks' },
        { kind: 'note', path: 'notes/beta.md' },
        { kind: 'view', viewId: 'view-resources' },
        null
      ])
    ).toEqual([
      { kind: 'project', projectId: 'project-1' },
      { kind: 'note', path: 'notes/alpha.md' },
      { kind: 'drawing', path: 'drawings/board.excalidraw' },
      { kind: 'view', viewId: 'view-tasks' },
      { kind: 'note', path: 'notes/beta.md' }
    ])
  })

  it('promotes a target to the front without duplicates', () => {
    const targets: RecentPageTarget[] = [
      { kind: 'project', projectId: 'project-1' },
      { kind: 'view', viewId: 'view-tasks' }
    ]

    expect(rememberRecentPageTarget(targets, { kind: 'view', viewId: 'view-tasks' })).toEqual([
      { kind: 'view', viewId: 'view-tasks' },
      { kind: 'project', projectId: 'project-1' }
    ])
  })

  it('remaps and removes note or drawing paths without affecting other targets', () => {
    const targets: RecentPageTarget[] = [
      { kind: 'note', path: 'notes/archive/alpha.md' },
      { kind: 'drawing', path: 'notes/archive/board.excalidraw' },
      { kind: 'project', projectId: 'project-1' }
    ]

    const remapped = remapRecentPageTargets(targets, 'notes/archive', 'notes/renamed')
    expect(remapped).toEqual([
      { kind: 'note', path: 'notes/renamed/alpha.md' },
      { kind: 'drawing', path: 'notes/renamed/board.excalidraw' },
      { kind: 'project', projectId: 'project-1' }
    ])
    expect(removeRecentPageTargets(remapped, ['notes/renamed'])).toEqual([
      { kind: 'project', projectId: 'project-1' }
    ])
  })
})
