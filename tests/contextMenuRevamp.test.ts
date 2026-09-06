import { describe, expect, it } from 'vitest'
import { getNoteMenuGroups, buildNoteNativeMenuItems } from '../src/renderer/src/lib/noteMenu'
import { getProjectMenuGroups } from '../src/renderer/src/lib/projectMenu'
import type { Project } from '../src/shared/types'

const project: Project = {
  id: 'project-1',
  name: 'Alpha Project',
  description: '',
  summary: '',
  state: 'active',
  updatedAt: '2026-08-20T00:00:00.000Z',
  icon: { variant: 'filled', color: '#2563eb' },
  milestones: []
}

describe('context menu definitions', () => {
  it('keeps project actions grouped with deletion last', () => {
    const groups = getProjectMenuGroups(project, {
      isFavorite: false,
      isExporting: true,
      onOpen: () => undefined,
      onToggleFavorite: () => undefined,
      onToggleArchive: () => undefined,
      onExport: () => undefined,
      onDelete: () => undefined
    })

    expect(groups.map((group) => group.id)).toEqual(['primary', 'state', 'destructive'])
    expect(groups[0]?.items[0]?.label).toBe('Open project')
    expect(groups[1]?.items.map((item) => item.label)).toEqual([
      'Add favorite',
      'Archive project',
      'Exporting project context…'
    ])
    expect(groups[1]?.items[2]?.disabled).toBe(true)
    expect(groups[2]?.items[0]?.label).toBe('Delete project')
    expect(groups[2]?.items[0]?.destructive).toBe(true)

    const favoriteGroups = getProjectMenuGroups(project, {
      isFavorite: true,
      onOpen: () => undefined,
      onToggleFavorite: () => undefined,
      onToggleArchive: () => undefined,
      onExport: () => undefined,
      onDelete: () => undefined
    })

    expect(favoriteGroups[1]?.items[0]?.label).toBe('Remove favorite')
  })

  it('uses the same note action groups for custom and native menus', () => {
    const groups = getNoteMenuGroups(
      {
        onDelete: () => undefined,
        onRename: () => undefined,
        onDuplicate: () => undefined,
        onMoveTo: () => undefined,
        onCopyLink: () => undefined
      },
      ['Projects', 'Archive']
    )
    const nativeItems = buildNoteNativeMenuItems({
      canRename: true,
      canDuplicate: true,
      canCopyLink: true,
      moveFolders: ['Projects', 'Archive']
    })

    expect(groups.map((group) => group.id)).toEqual(['editing', 'organization', 'destructive'])
    expect(groups[1]?.items[0]?.label).toBe('Move to…')
    expect(nativeItems[0]).toMatchObject({ id: 'rename', label: 'Rename' })
    expect(nativeItems.filter((item) => item.type === 'separator')).toHaveLength(2)
    expect(nativeItems.at(-1)).toMatchObject({ id: 'delete', label: 'Delete' })
  })
})
