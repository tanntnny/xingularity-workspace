import type { Project } from '../../../shared/types'
import type { ActionMenuGroup } from '../components/ui/action-menu'
import { Archive, Download, FolderOpen, Star, StarOutline, Trash2 } from '../components/ui/icons'

export interface ProjectMenuActionHandlers {
  isFavorite: boolean
  isExporting?: boolean
  onOpen: (project: Project) => void
  onToggleFavorite: (project: Project) => void
  onToggleArchive: (project: Project) => void
  onExport: (project: Project) => void
  onDelete: (project: Project) => void
}

export function getProjectMenuGroups(
  project: Project,
  handlers: ProjectMenuActionHandlers,
  { includeOpen = true }: { includeOpen?: boolean } = {}
): ActionMenuGroup[] {
  return [
    {
      id: 'primary',
      items: includeOpen
        ? [
            {
              id: 'open',
              label: 'Open project',
              icon: <FolderOpen aria-hidden="true" />,
              onSelect: () => handlers.onOpen(project)
            }
          ]
        : []
    },
    {
      id: 'state',
      items: [
        {
          id: 'favorite',
          label: handlers.isFavorite ? 'Remove favorite' : 'Add favorite',
          icon: handlers.isFavorite ? (
            <Star aria-hidden="true" />
          ) : (
            <StarOutline aria-hidden="true" />
          ),
          onSelect: () => handlers.onToggleFavorite(project)
        },
        {
          id: 'archive',
          label: project.state === 'archived' ? 'Unarchive project' : 'Archive project',
          icon: <Archive aria-hidden="true" />,
          onSelect: () => handlers.onToggleArchive(project)
        },
        {
          id: 'export',
          label: handlers.isExporting ? 'Exporting project context…' : 'Export project context',
          icon: <Download aria-hidden="true" />,
          disabled: handlers.isExporting,
          onSelect: () => handlers.onExport(project)
        }
      ]
    },
    {
      id: 'destructive',
      items: [
        {
          id: 'delete',
          label: 'Delete project',
          icon: <Trash2 aria-hidden="true" />,
          destructive: true,
          onSelect: () => handlers.onDelete(project)
        }
      ]
    }
  ]
}
