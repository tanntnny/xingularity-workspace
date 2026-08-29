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
import { Search } from '../components/ui/icons'
import { WorkspaceHeaderSecondaryActions } from '../components/ui/document-workspace'
import { Input } from '../components/ui/input'

export interface ResourceSearchInputProps {
  value: string
  onChange: (value: string) => void
}

export function ResourceSearchInput({ value, onChange }: ResourceSearchInputProps): ReactElement {
  return (
    <div className="relative w-64 max-w-[calc(100vw-1.5rem)] shrink-0 transition-[width] duration-[var(--motion-duration-content)] ease-[var(--motion-ease-standard)] focus-within:w-80">
      <Search
        size={14}
        aria-hidden="true"
        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search resources"
        aria-label="Search resources"
        data-testid="resource-search-input"
        radius="control"
        focusRadius="pill"
        className="h-[var(--compact-control-height)] border-input bg-panel pl-8 pr-3 text-xs shadow-none focus-visible:bg-panel-hover focus-visible:ring-2 focus-visible:ring-ring"
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
  onPreviewResource
}: ResourcesPageProps): ReactElement {
  const [resourceFilters, setResourceFilters] = useState<ResourceFilterState>({})
  const resourceRows = useMemo(
    () => getResourcePageRows(resources, projects, relations),
    [projects, relations, resources]
  )
  const resourceFilterOptions = useMemo(
    () => getResourceFilterOptions(resourceRows, projects),
    [projects, resourceRows]
  )

  return (
    <>
      <WorkspaceHeaderSecondaryActions>
        <ResourceSearchInput
          value={resourceFilters.searchQuery ?? ''}
          onChange={(searchQuery) => setResourceFilters((current) => ({ ...current, searchQuery }))}
        />
        <ResourceFiltersPopover
          options={resourceFilterOptions}
          value={resourceFilters}
          onChange={setResourceFilters}
        />
      </WorkspaceHeaderSecondaryActions>
      <ProjectResourcesTable
        scope="global"
        projects={projects}
        noteTree={noteTree}
        resources={resources}
        relations={relations}
        resourceFilters={resourceFilters}
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
