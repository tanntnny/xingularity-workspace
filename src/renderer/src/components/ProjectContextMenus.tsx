import type { ReactElement } from 'react'
import type { Project, ProjectMilestone } from '../../../shared/types'
import { ActionMenuItems, type ActionMenuGroup, type ActionMenuVariant } from './ui/action-menu'
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from './ui/icons'
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from './ui/context-menu'
import { getProjectMenuGroups, type ProjectMenuActionHandlers } from '../lib/projectMenu'

export function ProjectMenuItems({
  project,
  handlers,
  variant,
  includeOpen = true
}: {
  project: Project
  handlers: ProjectMenuActionHandlers
  variant: ActionMenuVariant
  includeOpen?: boolean
}): ReactElement {
  return (
    <ActionMenuItems
      variant={variant}
      groups={getProjectMenuGroups(project, handlers, { includeOpen })}
    />
  )
}

export function ProjectContextMenu({
  project,
  handlers,
  children
}: {
  project: Project
  handlers: ProjectMenuActionHandlers
  children: ReactElement
}): ReactElement {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent data-testid={`project-context-menu:${project.id}`}>
        <ProjectMenuItems project={project} handlers={handlers} variant="context" />
      </ContextMenuContent>
    </ContextMenu>
  )
}

interface ProjectMilestoneContextMenuProps {
  milestone: ProjectMilestone
  expanded: boolean
  isCreatingTask: boolean
  onCreateTask: () => void
  onEdit: () => void
  onToggle: () => void
  onDelete: () => void
  children: ReactElement
}

export function ProjectMilestoneContextMenu({
  milestone,
  expanded,
  isCreatingTask,
  onCreateTask,
  onEdit,
  onToggle,
  onDelete,
  children
}: ProjectMilestoneContextMenuProps): ReactElement {
  const groups: ActionMenuGroup[] = [
    {
      id: 'primary',
      items: [
        {
          id: 'add-task',
          label: 'Add task to milestone',
          icon: <Plus aria-hidden="true" />,
          disabled: isCreatingTask,
          onSelect: onCreateTask
        },
        {
          id: 'open',
          label: 'Open milestone',
          icon: <Pencil aria-hidden="true" />,
          onSelect: onEdit
        },
        {
          id: 'toggle',
          label: expanded ? 'Collapse milestone' : 'Expand milestone',
          icon: expanded ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />,
          onSelect: onToggle
        }
      ]
    },
    {
      id: 'destructive',
      items: [
        {
          id: 'delete',
          label: 'Delete milestone',
          icon: <Trash2 aria-hidden="true" />,
          destructive: true,
          onSelect: onDelete
        }
      ]
    }
  ]

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent data-testid={`project-milestone-context-menu:${milestone.id}`}>
        <ActionMenuItems variant="context" groups={groups} />
      </ContextMenuContent>
    </ContextMenu>
  )
}
