import type {
  WorkspaceView,
  WorkspaceViewResourceConfig,
  WorkspaceViewTaskConfig
} from '../../../shared/types'
import type { ResourceFilterState } from './resourceRows'
import type { TableSortState } from './tableSort'
import type { TaskFilterState, TaskGroupBy } from './taskRows'

export interface TaskWorkspaceViewState {
  filters: TaskFilterState
  groupBy: TaskGroupBy
  sortState: TableSortState | null
}

export interface ResourceWorkspaceViewState {
  filters: ResourceFilterState
  sortState: TableSortState | null
}

export function getTaskWorkspaceViewState(
  view: Extract<WorkspaceView, { source: 'tasks' }>
): TaskWorkspaceViewState {
  return {
    filters: {
      searchQuery: view.config.searchQuery,
      statuses: [...view.config.statuses],
      taskTypes: [...view.config.taskTypes],
      priorities: [...view.config.priorities],
      projectIds: [...view.config.projectIds],
      milestoneIds: [...view.config.milestoneIds],
      scheduleStates: [...view.config.scheduleStates],
      tags: [...view.config.tags]
    },
    groupBy: view.config.groupBy,
    sortState: view.config.sortState ? { ...view.config.sortState } : null
  }
}

export function buildTaskWorkspaceViewConfig(
  state: TaskWorkspaceViewState
): WorkspaceViewTaskConfig {
  return {
    searchQuery: state.filters.searchQuery ?? '',
    statuses: [...(state.filters.statuses ?? [])],
    taskTypes: [...(state.filters.taskTypes ?? [])],
    priorities: [...(state.filters.priorities ?? [])],
    projectIds: [...(state.filters.projectIds ?? [])],
    milestoneIds: [...(state.filters.milestoneIds ?? [])],
    scheduleStates: [...(state.filters.scheduleStates ?? [])],
    tags: [...(state.filters.tags ?? [])],
    groupBy: state.groupBy,
    sortState: state.sortState ? { ...state.sortState } : null
  }
}

export function getResourceWorkspaceViewState(
  view: Extract<WorkspaceView, { source: 'resources' }>
): ResourceWorkspaceViewState {
  return {
    filters: {
      searchQuery: view.config.searchQuery,
      types: [...view.config.types],
      providers: [...view.config.providers],
      states: [...view.config.states],
      labelFilters: Object.fromEntries(
        Object.entries(view.config.labelFilters).map(([key, values]) => [key, [...values]])
      ),
      projectIds: [...view.config.projectIds]
    },
    sortState: view.config.sortState ? { ...view.config.sortState } : null
  }
}

export function buildResourceWorkspaceViewConfig(
  state: ResourceWorkspaceViewState
): WorkspaceViewResourceConfig {
  return {
    searchQuery: state.filters.searchQuery ?? '',
    types: [...(state.filters.types ?? [])],
    providers: [...(state.filters.providers ?? [])],
    states: [...(state.filters.states ?? [])],
    labelFilters: Object.fromEntries(
      Object.entries(state.filters.labelFilters ?? {}).map(([key, values]) => [key, [...values]])
    ),
    projectIds: [...(state.filters.projectIds ?? [])],
    sortState: state.sortState ? { ...state.sortState } : null
  }
}
