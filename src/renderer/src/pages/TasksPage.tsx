import { useMemo, useState, type ReactElement } from 'react'

import type { CalendarTask, Project } from '../../../shared/types'
import { TaskFiltersPopover } from '../components/TaskFiltersPopover'
import { TaskGroupByPopover } from '../components/TaskGroupByPopover'
import { TaskTable, TASK_TABLE_SORTABLE_COLUMNS } from '../components/TaskTable'
import { EmptyState } from '../components/ui/empty-state'
import { Input } from '../components/ui/input'
import { Search, ListTodo } from '../components/ui/icons'
import { WorkspaceHeaderSecondaryActions } from '../components/ui/document-workspace'
import { usePersistentTableSort } from '../hooks/usePersistentTableSort'
import {
  filterTaskRows,
  getTaskFilterOptions,
  getTaskPageRows,
  type TaskFilterState,
  type TaskGroupBy
} from '../lib/taskRows'
import type { TableSortState } from '../lib/tableSort'
import type { TaskWorkspaceViewState } from '../lib/workspaceViewState'
import type { TaskOpenOptions } from '../lib/taskOpenOptions'

export interface TaskSearchInputProps {
  value: string
  onChange: (value: string) => void
}

export function TaskSearchInput({ value, onChange }: TaskSearchInputProps): ReactElement {
  return (
    <div className="relative w-64 max-w-[calc(100vw-1.5rem)] shrink-0 rounded-[var(--radius-button-pill)] border border-input bg-panel transition-[width] duration-[var(--motion-duration-content)] ease-[var(--motion-ease-standard)] focus-within:w-80">
      <Search
        size={14}
        aria-hidden="true"
        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        variant="plain"
        radius="pill"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search tasks"
        aria-label="Search tasks"
        data-testid="task-search-input"
        className="h-[var(--compact-control-height)] pl-8 pr-3 text-xs focus-visible:bg-transparent focus-visible:outline-none focus-visible:ring-0"
      />
    </div>
  )
}

export interface TasksPageProps {
  projects: Project[]
  tasks: CalendarTask[]
  onOpenTask: (taskId: string, options?: TaskOpenOptions) => void
  onDuplicateTask?: (taskId: string) => void | Promise<void>
  viewState?: TaskWorkspaceViewState
  onViewStateChange?: (state: TaskWorkspaceViewState) => void
}

export function TasksPage({
  projects,
  tasks,
  onOpenTask,
  onDuplicateTask,
  viewState,
  onViewStateChange
}: TasksPageProps): ReactElement {
  const [localTaskFilters, setLocalTaskFilters] = useState<TaskFilterState>({})
  const [localGroupBy, setLocalGroupBy] = useState<TaskGroupBy>('none')
  const isControlled = Boolean(viewState && onViewStateChange)
  const taskFilters = viewState?.filters ?? localTaskFilters
  const groupBy = viewState?.groupBy ?? localGroupBy
  const rows = useMemo(() => getTaskPageRows(tasks, projects), [projects, tasks])
  const filterOptions = useMemo(() => getTaskFilterOptions(rows, projects), [projects, rows])
  const filteredRows = useMemo(() => filterTaskRows(rows, taskFilters), [rows, taskFilters])
  const [sortState, setSortState] = usePersistentTableSort(
    'xingularity:table-sort:tasks',
    { columnId: 'start-date', direction: 'asc' },
    TASK_TABLE_SORTABLE_COLUMNS
  )
  const activeSortState = viewState ? viewState.sortState : sortState
  const updateViewState = (patch: Partial<TaskWorkspaceViewState>): void => {
    if (viewState && onViewStateChange) {
      onViewStateChange({ ...viewState, ...patch })
    }
  }
  const updateTaskFilters = (nextFilters: TaskFilterState): void => {
    if (isControlled) {
      updateViewState({ filters: nextFilters })
      return
    }
    setLocalTaskFilters(nextFilters)
  }
  const updateGroupBy = (nextGroupBy: TaskGroupBy): void => {
    if (isControlled) {
      updateViewState({ groupBy: nextGroupBy })
      return
    }
    setLocalGroupBy(nextGroupBy)
  }
  const updateSortState = (nextSortState: TableSortState): void => {
    if (isControlled) {
      updateViewState({ sortState: nextSortState })
      return
    }
    setSortState(nextSortState)
  }
  const updateSearchQuery = (searchQuery: string): void => {
    updateTaskFilters({ ...taskFilters, searchQuery })
  }

  return (
    <>
      <WorkspaceHeaderSecondaryActions>
        <TaskSearchInput value={taskFilters.searchQuery ?? ''} onChange={updateSearchQuery} />
        <TaskGroupByPopover value={groupBy} onChange={updateGroupBy} />
        <TaskFiltersPopover
          options={filterOptions}
          value={taskFilters}
          onChange={updateTaskFilters}
        />
      </WorkspaceHeaderSecondaryActions>
      <section
        className="flex min-h-full min-w-0 flex-col gap-6"
        data-testid="tasks-page"
        aria-labelledby="tasks-heading"
      >
        <h1 id="tasks-heading" className="sr-only">
          Tasks
        </h1>
        {filteredRows.length === 0 ? (
          <EmptyState
            icon={ListTodo}
            title={rows.length > 0 ? 'No matching tasks' : 'No tasks found'}
            description={
              rows.length > 0
                ? 'Try a different search term or filter.'
                : 'Use New task in the top bar to start organizing work.'
            }
          />
        ) : (
          <TaskTable
            rows={filteredRows}
            groupBy={groupBy}
            sortState={activeSortState}
            onSortChange={updateSortState}
            onOpenTask={onOpenTask}
            onDuplicateTask={onDuplicateTask}
          />
        )}
      </section>
    </>
  )
}
