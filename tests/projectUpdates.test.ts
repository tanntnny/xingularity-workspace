import { describe, expect, it } from 'vitest'

import type { ProjectUpdate } from '../src/shared/types'
import { getLatestProjectUpdate } from '../src/renderer/src/lib/projectUpdates'

describe('project update helpers', () => {
  it('returns the newest update without mutating the source array', () => {
    const updates: ProjectUpdate[] = [
      {
        id: 'older',
        projectId: 'project-1',
        markdown: 'Older update',
        status: 'on-track',
        createdAt: '2026-08-19T00:00:00.000Z',
        updatedAt: '2026-08-19T00:00:00.000Z'
      },
      {
        id: 'newer',
        projectId: 'project-1',
        markdown: 'Newer update',
        status: 'at-risk',
        createdAt: '2026-08-20T00:00:00.000Z',
        updatedAt: '2026-08-20T00:00:00.000Z'
      }
    ]

    expect(getLatestProjectUpdate(updates)?.id).toBe('newer')
    expect(updates.map((update) => update.id)).toEqual(['older', 'newer'])
  })

  it('returns null when no project updates exist', () => {
    expect(getLatestProjectUpdate(undefined)).toBeNull()
    expect(getLatestProjectUpdate([])).toBeNull()
  })
})
