import type { ReactElement } from 'react'

import type {
  CalendarTask,
  Project,
  ProjectIconStyle,
  WorkspaceView,
  WorkspaceViewResourceConfig,
  WorkspaceViewTaskConfig
} from '../../../shared/types'
import {
  buildResourceWorkspaceViewConfig,
  buildTaskWorkspaceViewConfig,
  getResourceWorkspaceViewState,
  getTaskWorkspaceViewState,
  type ResourceWorkspaceViewState,
  type TaskWorkspaceViewState
} from '../lib/workspaceViewState'
import { ResourcesPage, type ResourcesPageProps } from './ResourcesPage'
import { TasksPage } from './TasksPage'

export type WorkspaceViewUpdate = {
  name?: string
  icon?: ProjectIconStyle
  config?: WorkspaceViewTaskConfig | WorkspaceViewResourceConfig
}

export interface WorkspaceViewPageProps {
  view: WorkspaceView
  projects: Project[]
  tasks: CalendarTask[]
  onOpenTask: (taskId: string) => void
  onDuplicateTask?: (taskId: string) => void | Promise<void>
  onUpdateView: (update: WorkspaceViewUpdate) => void
  resourcePageProps: Omit<ResourcesPageProps, 'viewState' | 'onViewStateChange'>
}

export function WorkspaceViewPage({
  view,
  projects,
  tasks,
  onOpenTask,
  onDuplicateTask,
  onUpdateView,
  resourcePageProps
}: WorkspaceViewPageProps): ReactElement {
  const taskViewState: TaskWorkspaceViewState | null =
    view.source === 'tasks' ? getTaskWorkspaceViewState(view) : null
  const resourceViewState: ResourceWorkspaceViewState | null =
    view.source === 'resources' ? getResourceWorkspaceViewState(view) : null

  return (
    <div className="flex min-h-full min-w-0 flex-col gap-6" data-testid="workspace-view-page">
      {view.source === 'tasks' && taskViewState ? (
        <TasksPage
          projects={projects}
          tasks={tasks}
          onOpenTask={onOpenTask}
          onDuplicateTask={onDuplicateTask}
          viewState={taskViewState}
          onViewStateChange={(state) =>
            onUpdateView({ config: buildTaskWorkspaceViewConfig(state) })
          }
        />
      ) : resourceViewState ? (
        <ResourcesPage
          {...resourcePageProps}
          viewState={resourceViewState}
          onViewStateChange={(state) =>
            onUpdateView({ config: buildResourceWorkspaceViewConfig(state) })
          }
        />
      ) : null}
    </div>
  )
}
