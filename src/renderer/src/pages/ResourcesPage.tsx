import { useMemo, useState, type ReactElement } from 'react'
import type {
  NoteTreeNode,
  Project,
  ResourceInput,
  ResourcePreview,
  ResourceRef,
  ResourceRelation,
  ResourceUpdateInput
} from '../../../shared/types'
import { ProjectResourcesTable } from '../components/ProjectResourcesPanel'
import { ResourceFiltersPopover } from '../components/ResourceFiltersPopover'
import {
  getResourceFilterOptions,
  getResourcePageRows,
  type ResourceFilterState
} from '../lib/resourceRows'
import type { ResourceWorkspaceViewState } from '../lib/workspaceViewState'
import type { TableSortState } from '../lib/tableSort'
import { Search } from '../components/ui/icons'
import { WorkspaceHeaderSecondaryActions } from '../components/ui/document-workspace'
import { Input } from '../components/ui/input'

export interface ResourceSearchInputProps {
  value: string
  onChange: (value: string) => void
}

export function ResourceSearchInput({ value, onChange }: ResourceSearchInputProps): ReactElement {
  return (
    <div className="relative w-64 max-w-[calc(100vw-1.5rem)] shrink-0 rounded-[var(--radius-button-pill)] border border-input bg-panel transition-[width] duration-[var(--motion-duration-content)] ease-[var(--motion-ease-standard)] focus-within:w-80">
      <Search
        size={14}
        aria-hidden="true"
        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        variant="plain"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search resources"
        aria-label="Search resources"
        data-testid="resource-search-input"
        radius="pill"
        className="h-[var(--compact-control-height)] pl-8 pr-3 text-xs focus-visible:bg-transparent focus-visible:outline-none focus-visible:ring-0"
      />
    </div>
  )
}

export interface ResourcesPageProps {
  projects: Project[]
  noteTree: NoteTreeNode[]
  resources: ResourceRef[]
  relations: ResourceRelation[]
  addResourceRequest?: boolean
  onAddResourceRequestHandled?: () => void
  onCreateResource: (input: ResourceInput) => Promise<void>
  onUpdateResource: (input: ResourceUpdateInput) => Promise<void>
  onSetResourceProjectLinks: (input: { resourceId: string; projectIds: string[] }) => Promise<void>
  onRemoveResource: (resourceId: string) => Promise<void>
  onOpenResource: (resourceId: string) => Promise<void>
  onOpenNotebookResource: (resourceId: string) => void
  onLocateResource?: (resourceId: string) => Promise<void>
  onRevealResource?: (resourceId: string) => Promise<void>
  onRefreshResource?: (resourceId: string) => Promise<void>
  onPreviewResource?: (resourceId: string) => Promise<ResourcePreview>
  viewState?: ResourceWorkspaceViewState
  onViewStateChange?: (state: ResourceWorkspaceViewState) => void
}

export function ResourcesPage({
  projects,
  noteTree,
  resources,
  relations,
  addResourceRequest = false,
  onAddResourceRequestHandled,
  onCreateResource,
  onUpdateResource,
  onSetResourceProjectLinks,
  onRemoveResource,
  onOpenResource,
  onOpenNotebookResource,
  onLocateResource,
  onRevealResource,
  onRefreshResource,
  onPreviewResource,
  viewState,
  onViewStateChange
}: ResourcesPageProps): ReactElement {
  const [localResourceFilters, setLocalResourceFilters] = useState<ResourceFilterState>({})
  const resourceFilters = viewState?.filters ?? localResourceFilters
  const resourceRows = useMemo(
    () => getResourcePageRows(resources, projects, relations),
    [projects, relations, resources]
  )
  const resourceFilterOptions = useMemo(
    () => getResourceFilterOptions(resourceRows, projects),
    [projects, resourceRows]
  )
  const updateResourceFilters = (nextFilters: ResourceFilterState): void => {
    if (viewState && onViewStateChange) {
      onViewStateChange({ ...viewState, filters: nextFilters })
      return
    }
    setLocalResourceFilters(nextFilters)
  }
  const updateResourceSort = (sortState: TableSortState): void => {
    if (viewState && onViewStateChange) {
      onViewStateChange({ ...viewState, sortState })
    }
  }

  return (
    <>
      <WorkspaceHeaderSecondaryActions>
        <ResourceSearchInput
          value={resourceFilters.searchQuery ?? ''}
          onChange={(searchQuery) => updateResourceFilters({ ...resourceFilters, searchQuery })}
        />
        <ResourceFiltersPopover
          options={resourceFilterOptions}
          value={resourceFilters}
          onChange={updateResourceFilters}
        />
      </WorkspaceHeaderSecondaryActions>
      <ProjectResourcesTable
        scope="global"
        projects={projects}
        noteTree={noteTree}
        resources={resources}
        relations={relations}
        resourceFilters={resourceFilters}
        sortState={viewState ? viewState.sortState : undefined}
        onSortChange={viewState && onViewStateChange ? updateResourceSort : undefined}
        onAddResource={async () => undefined}
        onCreateResource={onCreateResource}
        addResourceRequest={addResourceRequest}
        onAddResourceRequestHandled={onAddResourceRequestHandled}
        onUpdateResource={onUpdateResource}
        onSetResourceProjectLinks={onSetResourceProjectLinks}
        onDetachResource={async () => undefined}
        onRemoveResource={onRemoveResource}
        onOpenResource={onOpenResource}
        onOpenNotebookResource={onOpenNotebookResource}
        onLocateResource={onLocateResource}
        onRevealResource={onRevealResource}
        onRefreshResource={onRefreshResource}
        onPreviewResource={onPreviewResource}
      />
    </>
  )
}
