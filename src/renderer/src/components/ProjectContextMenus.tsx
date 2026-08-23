import type { ReactElement } from 'react'
import type { ProjectMilestone } from '../../../shared/types'
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from './ui/icons'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from './ui/context-menu'

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
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent data-testid={`project-milestone-context-menu:${milestone.id}`}>
        <ContextMenuItem disabled={isCreatingTask} onSelect={onCreateTask}>
          <Plus />
          Add task to milestone
        </ContextMenuItem>
        <ContextMenuItem onSelect={onEdit}>
          <Pencil />
          Edit milestone
        </ContextMenuItem>
        <ContextMenuItem onSelect={onToggle}>
          {expanded ? <ChevronDown /> : <ChevronRight />}
          {expanded ? 'Collapse milestone' : 'Expand milestone'}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={onDelete}>
          <Trash2 />
          Delete milestone
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
