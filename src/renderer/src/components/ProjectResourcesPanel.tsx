import {
  Fragment,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactElement,
  type ReactNode
} from 'react'
import { siGoogledocs, siGoogledrive, siGooglesheets, siGoogleslides } from 'simple-icons'
import type { SimpleIcon } from 'simple-icons'
import type {
  GoogleDriveFileCandidate,
  NoteTreeNode,
  Project,
  ResourceLabel,
  ResourceInput,
  ResourceUpdateInput,
  ResourcePreview,
  ResourceRef,
  ResourceRelation,
  ExternalProduct
} from '../../../shared/types'
import type { FolderColorMap } from '../../../shared/folderColors'
import {
  normalizeResourceLabelKey,
  normalizeResourceLabels,
  notebookPathFromResource,
  RESOURCE_LABEL_VALUE_MAX_LENGTH
} from '../../../shared/resourceDomain'
import { flattenNotebookFolders } from '../lib/projectNotebook'
import {
  filterResourceRows,
  getResourcePageRows,
  getResourceProjectIds,
  type ResourceFilterState
} from '../lib/resourceRows'
import { createResourceLabelDrafts, type ResourceLabelDraft } from '../lib/resourceLabels'
import { ResourceLabelsEditor } from './ResourceLabelsEditor'
import { ResourceLabelChip } from './ResourceLabelChip'
import { ResourceProjectsEditor } from './ResourceProjectsEditor'
import { NoteShapeIcon } from './NoteShapeIcon'
import {
  getProjectResourceRows,
  isExternalHttpUrl,
  resourceLocationLabel,
  resourceProductLabel,
  type ProjectResourceRow
} from '../lib/projectResources'
import { RESOURCE_STATE_CHIP_ITEMS } from '../lib/statusChipMeta'
import { cn } from '../lib/utils'
import { Button } from './ui/button'
import { Checkbox } from './ui/checkbox'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from './ui/alert-dialog'
import {
  Dialog,
  DialogActionButton,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogShell,
  DialogShellFooter,
  DialogShellHeader
} from './ui/dialog'
import { COMMAND_ENTER_ARIA_KEYSHORTCUT, handleCommandEnterSubmit } from '../lib/formShortcuts'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from './ui/dropdown-menu'
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from './ui/context-menu'
import {
  ActionMenuItems,
  type ActionMenuGroup,
  type ActionMenuItemDefinition
} from './ui/action-menu'
import { EmptyState } from './ui/empty-state'
import { Input } from './ui/input'
import { Badge } from './ui/badge'
import { WorkspaceIconButton } from './ui/document-workspace'
import { ColumnFolderPicker, type ColumnFolderPickerNode } from './ui/column-folder-picker'
import { NotebookFolderIcon } from './ui/notebook-folder-icon'
import { StatusChip } from './ui/status-chip'
import { StatusChipToggleGroup, StatusChipToggleItem } from './ui/status-chip-toggle'
import { TableRowList, type TableRowListColumn } from './ui/table-row-list'
import { WorkspaceTextFade } from './ui/workspace-text-fade'
import { usePersistentTableSort } from '../hooks/usePersistentTableSort'
import type { TableSortState } from '../lib/tableSort'
import { getWorkspaceOpenOptions, type WorkspaceOpenOptions } from '../lib/workspaceOpen'
import {
  CalendarCheck,
  Check,
  ChevronDown,
  Eye,
  FileText,
  FolderInput,
  FolderOpen,
  Globe,
  HardDrive,
  HexagonFilled,
  Link,
  Loader2,
  MoreHorizontal,
  Trash2,
  RefreshCw,
  Unlink,
  X
} from './ui/icons'

const externalProductIcons: Partial<Record<ExternalProduct, SimpleIcon>> = {
  'google-docs': siGoogledocs,
  'google-sheets': siGooglesheets,
  'google-slides': siGoogleslides,
  'google-drive': siGoogledrive
}

const GOOGLE_DOC_MIME_TYPE = 'application/vnd.google-apps.document'

const GLOBAL_RESOURCE_SORTABLE_COLUMNS = [
  'resource',
  'projects',
  'source',
  'labels',
  'health',
  'location',
  'last-checked'
] as const

const PROJECT_RESOURCE_SORTABLE_COLUMNS = [
  'resource',
  'source',
  'labels',
  'health',
  'location',
  'last-checked'
] as const

export interface ProjectResourcesTableProps {
  project?: Project
  scope?: 'project' | 'global'
  projects?: Project[]
  noteTree: NoteTreeNode[]
  folderColors?: FolderColorMap
  resources: ResourceRef[]
  relations: ResourceRelation[]
  resourceFilters?: ResourceFilterState
  sortState?: TableSortState | null
  onSortChange?: (sortState: TableSortState) => void
  onAddResource: (projectId: string, input: ResourceInput) => Promise<void>
  onCreateResource?: (input: ResourceInput) => Promise<void>
  addResourceRequestProjectId?: string | null
  addResourceRequest?: boolean
  onAddResourceRequestHandled?: () => void
  onSetProjectNotebook?: (projectId: string, notebookPath: string) => Promise<void>
  onUpdateResource: (input: ResourceUpdateInput) => Promise<void>
  onSetResourceProjectLinks?: (input: { resourceId: string; projectIds: string[] }) => Promise<void>
  onDetachResource: (projectId: string, resourceId: string) => Promise<void>
  onRemoveResource?: (resourceId: string) => Promise<void>
  onOpenResource: (resourceId: string) => Promise<void>
  onOpenNotebookResource: (resourceId: string, options?: WorkspaceOpenOptions) => void
  onLocateResource?: (resourceId: string) => Promise<void>
  onRevealResource?: (resourceId: string) => Promise<void>
  onRefreshResource?: (resourceId: string) => Promise<void>
  onPreviewResource?: (resourceId: string) => Promise<ResourcePreview>
  googleDriveEnabled?: boolean
  googleDriveConnected?: boolean
  onListGoogleDriveFiles?: () => Promise<GoogleDriveFileCandidate[]>
  onAttachGoogleDriveResources?: (projectId: string, fileIds: string[]) => Promise<void>
}

interface ProjectResourceActionHandlers {
  onOpen: () => void
  onEdit: () => void
  onAttachGoogleDocs?: () => void
  onDetach?: () => void
  onLocate?: () => void
  onReveal?: () => void
  onRefresh?: () => void
  onPreview?: () => void
  onRemove?: () => void
}

function getProjectResourceMenuItems(
  resource: ProjectResourceRow['resource'],
  handlers: ProjectResourceActionHandlers
): ActionMenuGroup[] {
  const primaryItems: ActionMenuItemDefinition[] = [
    {
      id: 'open',
      label: 'Open',
      icon:
        resource.type === 'notebook' ? (
          <FolderOpen aria-hidden="true" />
        ) : (
          <Link aria-hidden="true" />
        ),
      onSelect: handlers.onOpen
    },
    {
      id: 'edit',
      label: 'Edit resource',
      icon: <FileText aria-hidden="true" />,
      onSelect: handlers.onEdit
    }
  ]
  const integrationItems: ActionMenuItemDefinition[] = []
  const inspectionItems: ActionMenuItemDefinition[] = []
  const organizationItems: ActionMenuItemDefinition[] = []
  const destructiveItems: ActionMenuItemDefinition[] = []

  if (handlers.onAttachGoogleDocs) {
    integrationItems.push({
      id: 'attach-google-docs',
      label: 'Attach Google Docs',
      icon: <FileText aria-hidden="true" />,
      onSelect: handlers.onAttachGoogleDocs,
      testId: `project-resource-attach-google-docs:${resource.id}`
    })
  }

  if (handlers.onPreview) {
    inspectionItems.push({
      id: 'preview',
      label: 'Preview',
      icon: <Eye aria-hidden="true" />,
      onSelect: handlers.onPreview
    })
  }

  if (handlers.onRefresh) {
    inspectionItems.push({
      id: 'refresh',
      label: 'Refresh status',
      icon: <RefreshCw aria-hidden="true" />,
      onSelect: handlers.onRefresh
    })
  }

  if (handlers.onLocate) {
    inspectionItems.push({
      id: 'locate',
      label: 'Locate',
      icon: <FolderInput aria-hidden="true" />,
      onSelect: handlers.onLocate
    })
  }

  if (handlers.onReveal) {
    inspectionItems.push({
      id: 'reveal',
      label: 'Reveal in Finder',
      icon: <HardDrive aria-hidden="true" />,
      onSelect: handlers.onReveal
    })
  }

  if (handlers.onDetach) {
    organizationItems.push({
      id: 'detach',
      label: 'Remove from project',
      icon: <Unlink aria-hidden="true" />,
      onSelect: handlers.onDetach
    })
  }

  if (handlers.onRemove) {
    destructiveItems.push({
      id: 'remove',
      label: 'Delete resource',
      icon: <Trash2 aria-hidden="true" />,
      onSelect: handlers.onRemove,
      destructive: true
    })
  }

  return [
    { id: 'primary', items: primaryItems },
    { id: 'integration', items: integrationItems },
    { id: 'inspection', items: inspectionItems },
    { id: 'organization', items: organizationItems },
    { id: 'destructive', items: destructiveItems }
  ]
}

export function ProjectResourcesTable({
  project,
  scope = 'project',
  projects = [],
  noteTree,
  folderColors = {},
  resources,
  relations,
  resourceFilters = {},
  sortState: controlledSortState,
  onSortChange,
  onAddResource,
  onCreateResource,
  addResourceRequestProjectId,
  addResourceRequest = false,
  onAddResourceRequestHandled,
  onUpdateResource,
  onSetResourceProjectLinks,
  onDetachResource,
  onRemoveResource,
  onOpenResource,
  onOpenNotebookResource,
  onLocateResource,
  onRevealResource,
  onRefreshResource,
  onPreviewResource,
  googleDriveEnabled = false,
  googleDriveConnected = false,
  onListGoogleDriveFiles,
  onAttachGoogleDriveResources
}: ProjectResourcesTableProps): ReactElement {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogType, setDialogType] = useState<'notebook' | 'external'>('external')
  const [editingResource, setEditingResource] = useState<ResourceRef | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ resource: ResourceRef; result: ResourcePreview } | null>(
    null
  )
  const [googleDriveDialogOpen, setGoogleDriveDialogOpen] = useState(false)
  const [googleDriveFiles, setGoogleDriveFiles] = useState<GoogleDriveFileCandidate[]>([])
  const [selectedGoogleDriveFileIds, setSelectedGoogleDriveFileIds] = useState<Set<string>>(
    () => new Set()
  )
  const [googleDriveLoading, setGoogleDriveLoading] = useState(false)
  const [googleDriveSaving, setGoogleDriveSaving] = useState(false)
  const [googleDriveError, setGoogleDriveError] = useState<string | null>(null)
  const [resourceToDelete, setResourceToDelete] = useState<ResourceRef | null>(null)
  const [localSortState, setLocalSortState] = usePersistentTableSort(
    `xingularity:table-sort:resources:${scope}`,
    null,
    scope === 'global' ? GLOBAL_RESOURCE_SORTABLE_COLUMNS : PROJECT_RESOURCE_SORTABLE_COLUMNS
  )
  const sortState = controlledSortState !== undefined ? controlledSortState : localSortState
  const setSortState = (nextSortState: TableSortState): void => {
    if (onSortChange) {
      onSortChange(nextSortState)
      return
    }
    setLocalSortState(nextSortState)
  }
  const allResourceRows = useMemo(
    () =>
      scope === 'global'
        ? getResourcePageRows(resources, projects, relations).map(({ resource }) => ({ resource }))
        : project
          ? getProjectResourceRows(project, resources, relations)
          : [],
    [project, projects, relations, resources, scope]
  )
  const globalResourceRows = useMemo(
    () => getResourcePageRows(resources, projects, relations),
    [projects, relations, resources]
  )
  const filteredGlobalResourceRows = useMemo(
    () =>
      filterResourceRows(globalResourceRows, {
        ...resourceFilters
      }),
    [globalResourceRows, resourceFilters]
  )
  const rows = useMemo(() => {
    if (scope !== 'global') return allResourceRows
    return filteredGlobalResourceRows.map(({ resource }) => ({ resource }))
  }, [allResourceRows, filteredGlobalResourceRows, scope])
  useEffect(() => {
    const shouldOpenProjectDialog =
      scope === 'project' && project && addResourceRequestProjectId === project.id
    const shouldOpenGlobalDialog = scope === 'global' && addResourceRequest
    if (!shouldOpenProjectDialog && !shouldOpenGlobalDialog) return

    setDialogType('external')
    setEditingResource(null)
    setDialogOpen(true)
    onAddResourceRequestHandled?.()
  }, [addResourceRequest, addResourceRequestProjectId, onAddResourceRequestHandled, project, scope])

  const run = async (resourceId: string, action: () => Promise<void>): Promise<void> => {
    setBusyId(resourceId)
    try {
      await action()
    } catch {
      // Parent callbacks surface persistence errors to the workspace toast.
    } finally {
      setBusyId(null)
    }
  }

  const openEditDialog = (resource: ResourceRef): void => {
    setDialogType(resource.type)
    setEditingResource(
      scope === 'global'
        ? { ...resource, projectIds: getResourceProjectIds(resource, projects, relations) }
        : resource
    )
    setDialogOpen(true)
  }

  const resetGoogleDriveDialog = (): void => {
    setGoogleDriveFiles([])
    setSelectedGoogleDriveFileIds(new Set())
    setGoogleDriveLoading(false)
    setGoogleDriveSaving(false)
    setGoogleDriveError(null)
  }

  const handleGoogleDriveDialogOpenChange = (open: boolean): void => {
    setGoogleDriveDialogOpen(open)
    if (!open) {
      resetGoogleDriveDialog()
    }
  }

  const openGoogleDriveDialog = async (): Promise<void> => {
    setGoogleDriveDialogOpen(true)
    setGoogleDriveLoading(true)
    setGoogleDriveError(null)
    setGoogleDriveFiles([])
    setSelectedGoogleDriveFileIds(new Set())

    if (!googleDriveConnected) {
      setGoogleDriveLoading(false)
      setGoogleDriveError('Connect Google Drive in Settings before attaching a document.')
      return
    }
    if (!onListGoogleDriveFiles) {
      setGoogleDriveLoading(false)
      setGoogleDriveError('Google Drive is unavailable in this workspace.')
      return
    }

    try {
      const candidates = await onListGoogleDriveFiles()
      setGoogleDriveFiles(
        candidates
          .filter((candidate) => candidate.mimeType === GOOGLE_DOC_MIME_TYPE)
          .sort((left, right) => left.name.localeCompare(right.name))
      )
    } catch (error) {
      setGoogleDriveError(error instanceof Error ? error.message : String(error))
    } finally {
      setGoogleDriveLoading(false)
    }
  }

  const toggleGoogleDriveFile = (fileId: string, checked: boolean | 'indeterminate'): void => {
    setSelectedGoogleDriveFileIds((current) => {
      const next = new Set(current)
      if (checked === true) {
        next.add(fileId)
      } else {
        next.delete(fileId)
      }
      return next
    })
  }

  const attachSelectedGoogleDriveFiles = async (): Promise<void> => {
    if (!project || !onAttachGoogleDriveResources || selectedGoogleDriveFileIds.size === 0) return

    setGoogleDriveSaving(true)
    setGoogleDriveError(null)
    try {
      await onAttachGoogleDriveResources(project.id, [...selectedGoogleDriveFileIds])
      handleGoogleDriveDialogOpenChange(false)
    } catch (error) {
      setGoogleDriveError(error instanceof Error ? error.message : String(error))
    } finally {
      setGoogleDriveSaving(false)
    }
  }

  const openResource = (row: ProjectResourceRow, options: WorkspaceOpenOptions = {}): void => {
    if (row.resource.type === 'notebook') {
      onOpenNotebookResource(row.resource.id, options)
      return
    }

    void run(row.resource.id, () => onOpenResource(row.resource.id))
  }

  const getResourceActions = (row: ProjectResourceRow): ProjectResourceActionHandlers => ({
    onOpen: () => openResource(row),
    onEdit: () => openEditDialog(row.resource),
    onAttachGoogleDocs:
      scope === 'project' &&
      project &&
      googleDriveEnabled &&
      row.resource.provider === 'google-drive'
        ? () => void openGoogleDriveDialog()
        : undefined,
    onDetach:
      scope === 'project' && project
        ? () => void run(row.resource.id, () => onDetachResource(project.id, row.resource.id))
        : undefined,
    onRemove:
      scope === 'global' && onRemoveResource ? () => setResourceToDelete(row.resource) : undefined,
    onLocate:
      onLocateResource && row.resource.provider === 'filesystem'
        ? () => void run(row.resource.id, () => onLocateResource(row.resource.id))
        : undefined,
    onReveal:
      onRevealResource && row.resource.provider === 'filesystem'
        ? () => void run(row.resource.id, () => onRevealResource(row.resource.id))
        : undefined,
    onRefresh: onRefreshResource
      ? () => void run(row.resource.id, () => onRefreshResource(row.resource.id))
      : undefined,
    onPreview:
      onPreviewResource && row.resource.type === 'external'
        ? () =>
            void run(row.resource.id, async () => {
              const result = await onPreviewResource(row.resource.id)
              setPreview({ resource: row.resource, result })
            })
        : undefined
  })

  const getLinkedProjects = (resource: ResourceRef): Project[] => {
    const projectIds = new Set(getResourceProjectIds(resource, projects, relations))

    return projects
      .filter((candidate) => projectIds.has(candidate.id))
      .sort((left, right) => left.name.localeCompare(right.name))
  }

  const columns: readonly TableRowListColumn<ProjectResourceRow>[] = [
    {
      id: 'resource',
      header: 'Name',
      cellClassName: 'min-w-64',
      sortValue: ({ resource }) => resource.title,
      renderCell: (row) => (
        <Button
          type="button"
          variant="ghost"
          onClick={(event) => {
            event.stopPropagation()
            openResource(row, getWorkspaceOpenOptions(event))
          }}
          onAuxClick={(event) => {
            if (event.button !== 1) {
              return
            }
            event.preventDefault()
            event.stopPropagation()
            openResource(row, { openInNewTab: true })
          }}
          className="h-auto max-w-full justify-start rounded-none px-0 text-left font-semibold text-foreground hover:bg-transparent hover:text-foreground"
          aria-label={`Open ${row.resource.title}`}
          title={resourceLocationLabel(row.resource)}
        >
          <span className="flex min-w-0 items-center gap-2.5">
            <ResourceBrandIcon resource={row.resource} />
            <WorkspaceTextFade className="min-w-0 flex-1">{row.resource.title}</WorkspaceTextFade>
          </span>
        </Button>
      )
    },
    ...(scope === 'global'
      ? [
          {
            id: 'projects',
            header: 'Projects',
            cellClassName: 'min-w-40 max-w-[20rem]',
            sortValue: ({ resource }: ProjectResourceRow) => {
              const projectNames = getLinkedProjects(resource).map((project) => project.name)
              return projectNames.length > 0 ? projectNames.join(', ') : null
            },
            renderCell: ({ resource }: ProjectResourceRow) => {
              const linkedProjects = getLinkedProjects(resource)
              if (linkedProjects.length === 0) {
                return <span className="text-sm text-muted-foreground">—</span>
              }

              const projectNames = linkedProjects.map((project) => project.name).join(', ')

              return (
                <WorkspaceTextFade
                  className="max-w-full text-sm text-muted-foreground"
                  title={projectNames}
                >
                  {linkedProjects.map((linkedProject, index) => (
                    <Fragment key={linkedProject.id}>
                      {index > 0 ? ', ' : null}
                      <span className="inline-flex shrink-0 items-center gap-1.5">
                        <NoteShapeIcon icon={linkedProject.icon} size={16} />
                        <span>{linkedProject.name}</span>
                      </span>
                    </Fragment>
                  ))}
                </WorkspaceTextFade>
              )
            }
          } satisfies TableRowListColumn<ProjectResourceRow>
        ]
      : []),
    {
      id: 'source',
      header: 'Source',
      cellClassName: 'whitespace-nowrap',
      sortValue: ({ resource }) => resourceProductLabel(resource),
      renderCell: ({ resource }) => (
        <WorkspaceTextFade
          className="max-w-full text-sm text-muted-foreground"
          title={resourceProductLabel(resource)}
        >
          {resourceProductLabel(resource)}
        </WorkspaceTextFade>
      )
    },
    {
      id: 'labels',
      header: 'Labels',
      cellClassName: 'min-w-48 max-w-[24rem]',
      sortValue: ({ resource }) => {
        const labels = (resource.labels ?? [])
          .map(formatResourceLabel)
          .sort((left, right) => left.localeCompare(right))
        return labels.length > 0 ? labels.join(' · ') : null
      },
      renderCell: ({ resource }) => <ResourceLabelsCell resource={resource} />
    },
    {
      id: 'health',
      header: 'Health',
      sortValue: ({ resource }) => resource.state,
      renderCell: ({ resource }) => {
        const healthChip = RESOURCE_STATE_CHIP_ITEMS[resource.state]

        return (
          <StatusChip
            item={healthChip}
            surface="hover-pill"
            mutedLabel
            className="text-xs"
            data-testid={`project-resource-health:${resource.id}`}
            aria-label={`Health: ${healthChip.label}`}
            title={`Health: ${healthChip.label}`}
          />
        )
      }
    },
    {
      id: 'location',
      header: 'Location',
      cellClassName: 'min-w-56 max-w-[28rem]',
      sortValue: ({ resource }) => resourceLocationLabel(resource),
      renderCell: ({ resource }) => (
        <WorkspaceTextFade
          className="text-sm text-muted-foreground"
          title={resourceLocationLabel(resource)}
        >
          {resourceLocationLabel(resource)}
        </WorkspaceTextFade>
      )
    },
    {
      id: 'last-checked',
      header: 'Last checked',
      cellClassName: 'whitespace-nowrap text-muted-foreground',
      sortValue: ({ resource }) => resource.lastSeenAt ?? resource.updatedAt,
      sortDefaultDirection: 'desc',
      renderCell: (row) => {
        const { resource } = row
        const checkedAt = resource.lastSeenAt ?? resource.updatedAt
        const checkedDateLabel = formatResourceDate(checkedAt)
        return (
          <div className="flex items-center justify-between gap-2">
            <StatusChip
              item={{
                label: <time dateTime={checkedAt}>{checkedDateLabel}</time>,
                icon: <CalendarCheck aria-hidden="true" />,
                iconColorToken: 'var(--muted-foreground)'
              }}
              surface="hover-pill"
              mutedLabel
              className="text-xs"
              data-testid={`project-resource-date-chip:last-checked:${resource.id}`}
              aria-label={`Last checked ${checkedDateLabel}`}
              title={`Last checked ${checkedDateLabel}`}
            />
            <ProjectResourceActions
              row={row}
              busy={busyId === resource.id}
              {...getResourceActions(row)}
              className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
            />
          </div>
        )
      }
    }
  ]

  return (
    <>
      <section
        className="flex min-h-full min-w-0 flex-col gap-6"
        data-testid={scope === 'global' ? 'resources-page' : 'project-resources-page'}
        aria-labelledby={scope === 'global' ? 'resources-heading' : 'project-resources-heading'}
      >
        <h1
          id={scope === 'global' ? 'resources-heading' : 'project-resources-heading'}
          className="sr-only"
        >
          Resources
        </h1>
        {rows.length === 0 ? (
          <EmptyState
            icon={Link}
            title={
              scope === 'global' && globalResourceRows.length > 0
                ? 'No matching resources'
                : 'No resources found'
            }
            description={
              scope === 'global' && globalResourceRows.length > 0
                ? 'Try a different search term.'
                : 'Use Add resource in the top bar to link one or more notebook folders or external links.'
            }
          />
        ) : (
          <TableRowList
            aria-label="Resources"
            data-testid={scope === 'global' ? 'resources-table' : 'project-resources-table'}
            columns={columns}
            items={rows}
            sortState={sortState}
            onSortChange={setSortState}
            getRowKey={({ resource }) => resource.id}
            getRowProps={(row) => ({
              'data-testid': `${scope === 'global' ? 'resource' : 'project-resource'}-row:${row.resource.id}`,
              className: cn('group', busyId === row.resource.id && 'opacity-60'),
              onClick: (event) => openResource(row, getWorkspaceOpenOptions(event)),
              onAuxClick: (event) => {
                if (event.button !== 1) {
                  return
                }
                event.preventDefault()
                event.stopPropagation()
                openResource(row, { openInNewTab: true })
              }
            })}
            rowWrapper={(row, tableRow) => (
              <ProjectResourceContextMenu
                key={row.resource.id}
                row={row}
                {...getResourceActions(row)}
              >
                {tableRow}
              </ProjectResourceContextMenu>
            )}
          />
        )}
        {preview ? (
          <div className="border-t border-border/60 bg-muted/20 px-4 py-3" aria-live="polite">
            <div className="mb-1 flex items-center justify-between gap-2">
              <p className="min-w-0" title={preview.resource.title}>
                <WorkspaceTextFade className="text-xs font-semibold">
                  Preview · {preview.resource.title}
                </WorkspaceTextFade>
              </p>
              <WorkspaceIconButton
                label="Close preview"
                aria-label="Close preview"
                title="Close preview"
                icon={<X size={14} aria-hidden="true" />}
                className="h-6 w-6"
                onClick={() => setPreview(null)}
              />
            </div>
            {preview.result.error ? (
              <p className="text-xs text-destructive">{preview.result.error}</p>
            ) : preview.result.text ? (
              <pre className="max-h-32 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">
                {preview.result.text}
              </pre>
            ) : (
              <p className="text-xs text-muted-foreground">
                Metadata is available; content preview is unsupported for this resource.
              </p>
            )}
          </div>
        ) : null}
      </section>
      <ResourceEditorDialog
        key={`${editingResource?.id ?? 'new'}:${dialogType}`}
        open={dialogOpen}
        type={dialogType}
        project={project ?? null}
        projects={projects}
        existingResources={
          scope === 'global' ? resources : allResourceRows.map(({ resource }) => resource)
        }
        context={scope === 'global' ? 'Resources' : 'Project Resources'}
        noteTree={noteTree}
        folderColors={folderColors}
        resource={editingResource}
        onOpenChange={setDialogOpen}
        onAddResource={onAddResource}
        onCreateResource={onCreateResource}
        onUpdateResource={onUpdateResource}
        onSetResourceProjectLinks={onSetResourceProjectLinks}
      />
      <Dialog open={googleDriveDialogOpen} onOpenChange={handleGoogleDriveDialogOpenChange}>
        <DialogContent className="max-w-lg" showCloseButton={false}>
          <DialogShell>
            <DialogShellHeader
              context="Project Resources"
              title="Attach Google Docs"
              closeLabel="Close Google Docs dialog"
              onClose={() => handleGoogleDriveDialogOpenChange(false)}
            />
            <DialogBody className="space-y-3">
              <DialogDescription className="mb-3">
                Choose Google Docs from your connected Drive. Attached documents can be included in
                project context and Markdown exports when content indexing is enabled.
              </DialogDescription>
              {googleDriveLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                  Loading Google Docs…
                </div>
              ) : googleDriveError ? (
                <p className="text-sm text-destructive">{googleDriveError}</p>
              ) : googleDriveFiles.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No Google Docs were found in the connected Drive.
                </p>
              ) : (
                <div
                  className="max-h-72 space-y-1 overflow-y-auto rounded-[var(--radius-button)] border border-border/70 p-2"
                  data-testid="google-drive-document-picker"
                >
                  {googleDriveFiles.map((file) => (
                    <label
                      key={file.id}
                      htmlFor={`google-drive-document-${file.id}`}
                      className="flex cursor-pointer items-center gap-3 rounded-[var(--radius-control)] px-2 py-2 hover:bg-muted/50"
                      data-testid={`google-drive-document:${file.id}`}
                    >
                      <Checkbox
                        id={`google-drive-document-${file.id}`}
                        checked={selectedGoogleDriveFileIds.has(file.id)}
                        onCheckedChange={(checked) => toggleGoogleDriveFile(file.id, checked)}
                      />
                      <WorkspaceTextFade
                        className="min-w-0 flex-1 text-sm font-medium"
                        title={file.name}
                      >
                        {file.name}
                      </WorkspaceTextFade>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {file.modifiedTime ? formatResourceDate(file.modifiedTime) : 'Unknown'}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </DialogBody>
            <DialogShellFooter>
              <DialogActionButton
                type="button"
                icon={<FileText size={15} aria-hidden="true" />}
                label={
                  googleDriveSaving
                    ? 'Attaching…'
                    : selectedGoogleDriveFileIds.size > 0
                      ? `Attach ${selectedGoogleDriveFileIds.size} Docs`
                      : 'Attach Docs'
                }
                tone="accent"
                disabled={
                  googleDriveLoading ||
                  googleDriveSaving ||
                  selectedGoogleDriveFileIds.size === 0 ||
                  !onAttachGoogleDriveResources
                }
                onClick={() => void attachSelectedGoogleDriveFiles()}
              />
            </DialogShellFooter>
          </DialogShell>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={Boolean(resourceToDelete)}
        onOpenChange={(open) => {
          if (!open) setResourceToDelete(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete resource?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes {resourceToDelete?.title ?? 'this resource'} and its links
              from every project. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!resourceToDelete || !onRemoveResource) return
                void run(resourceToDelete.id, async () => {
                  await onRemoveResource(resourceToDelete.id)
                  setResourceToDelete(null)
                })
              }}
            >
              Delete resource
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function ProjectResourceDropdownItems({
  groups
}: {
  groups: readonly ActionMenuGroup[]
}): ReactElement {
  return <ActionMenuItems variant="dropdown" groups={groups} />
}

function ProjectResourceContextMenuItems({
  groups
}: {
  groups: readonly ActionMenuGroup[]
}): ReactElement {
  return <ActionMenuItems variant="context" groups={groups} />
}

function ProjectResourceActions({
  row,
  busy,
  className,
  ...handlers
}: {
  row: ProjectResourceRow
  busy: boolean
  className?: string
} & ProjectResourceActionHandlers): ReactElement {
  const { resource } = row
  const groups = getProjectResourceMenuItems(resource, handlers)

  return (
    <div
      className={cn('flex shrink-0 items-center gap-1', className)}
      data-testid={`project-resource-actions-container:${resource.id}`}
      onClick={(event) => event.stopPropagation()}
    >
      {busy ? (
        <Loader2 size={14} className="animate-spin text-muted-foreground" aria-hidden="true" />
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <WorkspaceIconButton
            variant="rowAction"
            borderless
            data-testid={`project-resource-actions:${resource.id}`}
            aria-label={`Manage ${resource.title}`}
            title={`Manage ${resource.title}`}
            icon={<MoreHorizontal size={15} aria-hidden="true" />}
            className="h-7 w-7 shrink-0 bg-transparent hover:bg-card-hover focus-visible:bg-card-hover"
            disabled={busy}
            onClick={(event) => event.stopPropagation()}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <ProjectResourceDropdownItems groups={groups} />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function ProjectResourceContextMenu({
  row,
  children,
  ...handlers
}: {
  row: ProjectResourceRow
  children: ReactElement
} & ProjectResourceActionHandlers): ReactElement {
  const groups = getProjectResourceMenuItems(row.resource, handlers)

  return (
    <ContextMenu modal>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent data-testid={`project-resource-context-menu:${row.resource.id}`}>
        <ProjectResourceContextMenuItems groups={groups} />
      </ContextMenuContent>
    </ContextMenu>
  )
}

function formatResourceDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown'
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function ResourceBrandIcon({ resource }: { resource: ResourceRef }): ReactElement {
  if (resource.type === 'notebook') {
    return (
      <ResourceIconFrame iconColor="var(--status-chip-resource-reference-icon)">
        <FolderOpen size={14} aria-hidden="true" />
      </ResourceIconFrame>
    )
  }

  if (resource.externalProduct === 'canva') {
    return (
      <ResourceIconFrame iconColor="var(--accent)" label="Canva">
        <span className="flex size-3.5 items-center justify-center rounded-[4px] bg-[linear-gradient(135deg,#00c4cc,#7d2ae8_55%,#ff5a5f)] text-[10px] font-bold text-white">
          C
        </span>
      </ResourceIconFrame>
    )
  }

  const icon = resource.externalProduct ? externalProductIcons[resource.externalProduct] : undefined
  if (icon) {
    return (
      <ResourceIconFrame iconColor={`#${icon.hex}`} label={resourceProductLabel(resource)}>
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-3.5" fill="currentColor">
          <path d={icon.path} />
        </svg>
      </ResourceIconFrame>
    )
  }

  if (resource.provider === 'filesystem') {
    return (
      <ResourceIconFrame iconColor="var(--muted-foreground)">
        <HardDrive size={14} aria-hidden="true" />
      </ResourceIconFrame>
    )
  }
  return (
    <ResourceIconFrame iconColor="var(--status-chip-resource-reference-icon)">
      <Globe size={14} aria-hidden="true" />
    </ResourceIconFrame>
  )
}

function ResourceIconFrame({
  iconColor,
  label,
  children
}: {
  iconColor: string
  label?: string
  children: ReactNode
}): ReactElement {
  return (
    <span
      className="relative inline-flex size-7 shrink-0 items-center justify-center"
      style={{ color: iconColor }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <HexagonFilled
        aria-hidden="true"
        className="absolute inset-0 !h-7 !w-7"
        size={28}
        style={{
          color: `color-mix(in srgb, ${iconColor} var(--project-icon-surface-strength), var(--card))`
        }}
      />
      <span className="relative inline-flex size-3.5 items-center justify-center">{children}</span>
    </span>
  )
}

function ResourceLabelsCell({ resource }: { resource: ResourceRef }): ReactElement {
  const labels = resource.labels ?? []
  if (labels.length === 0) {
    return <span className="text-sm text-muted-foreground">—</span>
  }

  const visibleLabel = labels[0]
  const remainingCount = labels.length - 1

  return (
    <div
      className="flex min-w-0 max-w-full items-center gap-1 overflow-hidden"
      title={labels.map(formatResourceLabel).join(', ')}
    >
      <ResourceLabelChip label={visibleLabel} className="max-w-full text-xs" />
      {remainingCount > 0 ? (
        <Badge
          variant="neutral"
          className="h-6 shrink-0 px-1.5 text-[11px]"
          aria-label={`${remainingCount} more resource label${remainingCount === 1 ? '' : 's'}`}
        >
          +{remainingCount}
        </Badge>
      ) : null}
    </div>
  )
}

function formatResourceLabel(label: ResourceLabel): string {
  return `${label.key}=${label.value}`
}

function ResourceEditorDialog({
  open,
  type,
  context,
  project,
  projects,
  existingResources,
  noteTree,
  folderColors,
  resource,
  onOpenChange,
  onAddResource,
  onCreateResource,
  onUpdateResource,
  onSetResourceProjectLinks
}: {
  open: boolean
  type: 'notebook' | 'external'
  context: string
  project: Project | null
  projects: readonly Project[]
  existingResources: readonly ResourceRef[]
  noteTree: NoteTreeNode[]
  folderColors: FolderColorMap
  resource: ResourceRef | null
  onOpenChange: (open: boolean) => void
  onAddResource: (projectId: string, input: ResourceInput) => Promise<void>
  onCreateResource?: (input: ResourceInput) => Promise<void>
  onUpdateResource: (input: ResourceUpdateInput) => Promise<void>
  onSetResourceProjectLinks?: (input: { resourceId: string; projectIds: string[] }) => Promise<void>
}): ReactElement {
  const folders = useMemo(() => flattenNotebookFolders(noteTree), [noteTree])
  const initialNotebookPath = resource ? notebookPathFromResource(resource) : null
  const folderOptions = useMemo(() => {
    if (!initialNotebookPath || folders.some((folder) => folder.path === initialNotebookPath)) {
      return folders
    }

    return [
      {
        path: initialNotebookPath,
        name: `Current · ${initialNotebookPath.split('/').pop() ?? initialNotebookPath}`,
        depth: Math.max(0, initialNotebookPath.split('/').filter(Boolean).length - 1)
      },
      ...folders
    ]
  }, [folders, initialNotebookPath])
  const linkedNotebookPaths = useMemo(() => {
    const paths = new Set<string>()

    for (const linkedResource of existingResources) {
      if (linkedResource.id === resource?.id) continue
      const path = notebookPathFromResource(linkedResource)
      if (path) paths.add(path)
    }

    return paths
  }, [existingResources, resource?.id])
  const duplicateFolderNames = useMemo(() => {
    const counts = new Map<string, number>()

    for (const folder of folderOptions) {
      counts.set(folder.name, (counts.get(folder.name) ?? 0) + 1)
    }

    return new Set(
      Array.from(counts.entries())
        .filter(([, count]) => count > 1)
        .map(([name]) => name)
    )
  }, [folderOptions])
  const notebookPickerNodes = useMemo<readonly ColumnFolderPickerNode[]>(() => {
    const buildNodes = (nodes: readonly NoteTreeNode[]): ColumnFolderPickerNode[] =>
      nodes.flatMap((node) => {
        if (node.kind !== 'folder') return []

        const isCurrentResource = node.relPath === initialNotebookPath
        const isDisabled = linkedNotebookPaths.has(node.relPath) && !isCurrentResource

        return [
          {
            value: node.relPath,
            label: node.name,
            pathLabel: node.relPath,
            searchText: `${node.name} ${node.relPath}`,
            disabled: isDisabled,
            color: folderColors[node.relPath],
            children: buildNodes(node.children)
          }
        ]
      })

    const mappedNodes = buildNodes(noteTree)
    if (!initialNotebookPath || folders.some((folder) => folder.path === initialNotebookPath)) {
      return mappedNodes
    }

    return [
      {
        value: initialNotebookPath,
        label: `Current · ${initialNotebookPath.split('/').pop() ?? initialNotebookPath}`,
        pathLabel: initialNotebookPath,
        searchText: initialNotebookPath,
        color: folderColors[initialNotebookPath]
      },
      ...mappedNodes
    ]
  }, [folderColors, folders, initialNotebookPath, linkedNotebookPaths, noteTree])
  const [selectedType, setSelectedType] = useState(type)
  const [notebookPath, setNotebookPath] = useState(initialNotebookPath ?? '')
  const [externalUrl, setExternalUrl] = useState(resource?.canonicalUri ?? '')
  const [title, setTitle] = useState(resource?.title ?? '')
  const [labelDrafts, setLabelDrafts] = useState<ResourceLabelDraft[]>(() =>
    createResourceLabelDrafts(resource?.labels ?? [])
  )
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>(
    () => resource?.projectIds ?? (project ? [project.id] : [])
  )
  const [error, setError] = useState<string | null>(null)
  const [labelError, setLabelError] = useState<string | null>(null)
  const isEditing = Boolean(resource)
  const canChooseProjects = !project && projects.length > 0
  const selectedFolder = folderOptions.find((folder) => folder.path === notebookPath)
  const selectedFolderHasDuplicateName = selectedFolder
    ? duplicateFolderNames.has(selectedFolder.name)
    : false

  useEffect(() => {
    if (!open) return
    setSelectedType(type)
    setNotebookPath(initialNotebookPath ?? '')
    setExternalUrl(resource?.canonicalUri ?? '')
    setTitle(resource?.title ?? '')
    setLabelDrafts(createResourceLabelDrafts(resource?.labels ?? []))
    setSelectedProjectIds(resource?.projectIds ?? (project ? [project.id] : []))
    setError(null)
    setLabelError(null)
  }, [initialNotebookPath, open, project, resource, type])

  const getLabels = (): ResourceLabel[] => {
    const hasIncompleteLabel = labelDrafts.some(
      (draft) => Boolean(draft.key.trim()) !== Boolean(draft.value.trim())
    )
    if (hasIncompleteLabel) {
      throw new Error('Complete both the key and value for each label, or remove the empty row.')
    }

    for (const draft of labelDrafts) {
      if (!normalizeResourceLabelKey(draft.key)) {
        throw new Error('Label keys may use letters, numbers, dots, dashes, or underscores.')
      }
      if (draft.value.trim().length > RESOURCE_LABEL_VALUE_MAX_LENGTH) {
        throw new Error(
          `Label values must be ${RESOURCE_LABEL_VALUE_MAX_LENGTH} characters or fewer.`
        )
      }
    }

    const labels = normalizeResourceLabels(labelDrafts)
    const completeDrafts = labelDrafts.filter(
      (draft) => draft.key.trim().length > 0 && draft.value.trim().length > 0
    )
    if (labels.length !== completeDrafts.length) {
      throw new Error('Label keys may use letters, numbers, dots, dashes, or underscores.')
    }
    return labels
  }

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    setError(null)
    setLabelError(null)
    try {
      const labels = getLabels()
      const projectIds = project ? [project.id] : selectedProjectIds
      if (selectedType === 'notebook') {
        if (!notebookPath) throw new Error('Choose a notebook folder')
        if (resource) {
          await onUpdateResource({ resourceId: resource.id, canonicalUri: notebookPath, labels })
          if (onSetResourceProjectLinks) {
            await onSetResourceProjectLinks({ resourceId: resource.id, projectIds })
          }
        } else {
          const input: ResourceInput = {
            type: 'notebook',
            canonicalUri: notebookPath,
            labels,
            ...(projectIds.length ? { projectIds } : {})
          }
          if (project) await onAddResource(project.id, input)
          else if (onCreateResource) await onCreateResource(input)
          else throw new Error('Resource creation is unavailable in this workspace.')
        }
      } else {
        const normalizedUrl = externalUrl.trim()
        if (!isExternalHttpUrl(normalizedUrl)) {
          throw new Error('Enter a valid HTTP or HTTPS URL')
        }
        if (resource) {
          await onUpdateResource({
            resourceId: resource.id,
            canonicalUri: normalizedUrl,
            title: title.trim() || undefined,
            labels
          })
          if (onSetResourceProjectLinks) {
            await onSetResourceProjectLinks({ resourceId: resource.id, projectIds })
          }
        } else {
          const input: ResourceInput = {
            type: 'external',
            canonicalUri: normalizedUrl,
            title: title.trim() || undefined,
            labels,
            ...(projectIds.length ? { projectIds } : {})
          }
          if (project) await onAddResource(project.id, input)
          else if (onCreateResource) await onCreateResource(input)
          else throw new Error('Resource creation is unavailable in this workspace.')
        }
      }
      onOpenChange(false)
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : String(submitError)
      if (message.startsWith('Label') || message.startsWith('Complete both')) setLabelError(message)
      else setError(message)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl"
        data-testid={context === 'Resources' ? 'resource-dialog' : 'project-resource-dialog'}
        showCloseButton={false}
      >
        <DialogShell>
          <DialogShellHeader
            context={context}
            title={isEditing ? 'Edit resource' : 'Add resource'}
            closeLabel="Close resource editor"
            onClose={() => onOpenChange(false)}
          />
          <form
            className="space-y-4"
            onSubmit={(event) => void submit(event)}
            onKeyDownCapture={handleCommandEnterSubmit}
          >
            <DialogBody className="max-h-[70vh] space-y-4 overflow-y-auto">
              {!isEditing ? (
                <StatusChipToggleGroup
                  value={selectedType}
                  onValueChange={(value) => setSelectedType(value as 'notebook' | 'external')}
                  aria-label="Resource type"
                  data-testid="project-resource-type-toggle"
                >
                  <StatusChipToggleItem
                    value="notebook"
                    data-testid="project-resource-type:notebook"
                  >
                    Notebook
                  </StatusChipToggleItem>
                  <StatusChipToggleItem
                    value="external"
                    data-testid="project-resource-type:external"
                  >
                    External URL
                  </StatusChipToggleItem>
                </StatusChipToggleGroup>
              ) : null}

              {selectedType === 'notebook' ? (
                <div className="space-y-2">
                  <label htmlFor="project-resource-notebook" className="text-sm font-medium">
                    Notebook folder
                  </label>
                  <ColumnFolderPicker
                    nodes={notebookPickerNodes}
                    value={notebookPath}
                    onValueChange={setNotebookPath}
                    label="Notebook folder"
                    placeholder="Select a notebook folder"
                    searchPlaceholder="Search notebook folders"
                    testId="project-resource-notebook-options"
                  >
                    <Button
                      id="project-resource-notebook"
                      type="button"
                      variant="outline"
                      data-testid="project-resource-notebook-picker"
                      aria-label="Notebook folder"
                      aria-describedby="project-resource-notebook-description"
                      disabled={folderOptions.length === 0}
                      className="h-10 w-full justify-between px-3 text-left"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <NotebookFolderIcon
                          variant="open"
                          color={selectedFolder ? folderColors[selectedFolder.path] : undefined}
                          size={15}
                        />
                        <span className="min-w-0">
                          <WorkspaceTextFade
                            className={selectedFolder ? undefined : 'text-muted-foreground'}
                          >
                            {selectedFolder?.name ?? 'Select a notebook folder'}
                          </WorkspaceTextFade>
                          {selectedFolder && selectedFolderHasDuplicateName ? (
                            <WorkspaceTextFade className="text-xs font-normal text-muted-foreground">
                              {selectedFolder.path}
                            </WorkspaceTextFade>
                          ) : null}
                        </span>
                      </span>
                      <ChevronDown className="shrink-0 opacity-60" aria-hidden="true" />
                    </Button>
                  </ColumnFolderPicker>
                  {folderOptions.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No notebook folders are available in this vault.
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <label htmlFor="project-resource-url" className="text-sm font-medium">
                      URL
                    </label>
                    <Input
                      id="project-resource-url"
                      type="url"
                      value={externalUrl}
                      onChange={(event) => setExternalUrl(event.target.value)}
                      placeholder="https://docs.google.com/..."
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="project-resource-title" className="text-sm font-medium">
                      Display name{' '}
                      <span className="font-normal text-muted-foreground">(optional)</span>
                    </label>
                    <Input
                      id="project-resource-title"
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      placeholder="Uses the product or URL title automatically"
                    />
                  </div>
                </div>
              )}

              <div
                role="group"
                aria-label="Resource labels and projects"
                data-testid="resource-dialog-properties"
                className="flex min-w-0 flex-wrap items-center gap-2"
              >
                <ResourceLabelsEditor
                  drafts={labelDrafts}
                  onChange={setLabelDrafts}
                  error={labelError}
                  className="min-w-0 max-w-full"
                  surface="pill"
                />
                {canChooseProjects ? (
                  <ResourceProjectsEditor
                    value={selectedProjectIds}
                    projects={projects}
                    onChange={setSelectedProjectIds}
                    className="min-w-0 max-w-full"
                    surface="pill"
                  />
                ) : null}
              </div>

              {error ? <p className="text-sm text-destructive">{error}</p> : null}
            </DialogBody>
            <DialogShellFooter>
              <DialogActionButton
                type="submit"
                icon={<Check />}
                label={isEditing ? 'Save resource' : 'Add resource'}
                shortcutKeys={['cmd', 'return']}
                aria-keyshortcuts={COMMAND_ENTER_ARIA_KEYSHORTCUT}
                tone="accent"
                disabled={
                  selectedType === 'notebook' && (folderOptions.length === 0 || !notebookPath)
                }
              />
            </DialogShellFooter>
          </form>
        </DialogShell>
      </DialogContent>
    </Dialog>
  )
}
