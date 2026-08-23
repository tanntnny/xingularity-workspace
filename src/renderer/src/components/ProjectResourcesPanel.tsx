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
  ResourceInput,
  ResourcePreview,
  ResourceRef,
  ResourceRelation,
  ExternalProduct
} from '../../../shared/types'
import { notebookPathFromResource } from '../../../shared/resourceDomain'
import { flattenNotebookFolders } from '../lib/projectNotebook'
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
  Dialog,
  DialogActionButton,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogShell,
  DialogShellFooter,
  DialogShellHeader
} from './ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from './ui/dropdown-menu'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from './ui/context-menu'
import { EmptyState } from './ui/empty-state'
import { Input } from './ui/input'
import { WorkspaceIconButton } from './ui/document-workspace'
import { ColumnFolderPicker, type ColumnFolderPickerNode } from './ui/column-folder-picker'
import { StatusChip } from './ui/status-chip'
import { StatusChipToggleGroup, StatusChipToggleItem } from './ui/status-chip-toggle'
import { TableRowList, type TableRowListColumn } from './ui/table-row-list'
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

export interface ProjectResourcesTableProps {
  project: Project
  noteTree: NoteTreeNode[]
  resources: ResourceRef[]
  relations: ResourceRelation[]
  onAddResource: (projectId: string, input: ResourceInput) => Promise<void>
  addResourceRequestProjectId?: string | null
  onAddResourceRequestHandled?: () => void
  onSetProjectNotebook: (projectId: string, notebookPath: string) => Promise<void>
  onUpdateResource: (input: {
    resourceId: string
    canonicalUri?: string
    title?: string
  }) => Promise<void>
  onDetachResource: (projectId: string, resourceId: string) => Promise<void>
  onOpenResource: (resourceId: string) => Promise<void>
  onOpenNotebookResource: (resourceId: string) => void
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
}

interface ProjectResourceMenuItem {
  id: string
  label: string
  icon: ReactElement
  onSelect: () => void
  separatorBefore?: boolean
  testId?: string
}

function getProjectResourceMenuItems(
  resource: ProjectResourceRow['resource'],
  handlers: ProjectResourceActionHandlers
): ProjectResourceMenuItem[] {
  const items: ProjectResourceMenuItem[] = [
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

  if (handlers.onAttachGoogleDocs) {
    items.push({
      id: 'attach-google-docs',
      label: 'Attach Google Docs',
      icon: <FileText aria-hidden="true" />,
      onSelect: handlers.onAttachGoogleDocs,
      testId: `project-resource-attach-google-docs:${resource.id}`
    })
  }

  if (handlers.onPreview) {
    items.push({
      id: 'preview',
      label: 'Preview',
      icon: <Eye aria-hidden="true" />,
      onSelect: handlers.onPreview
    })
  }

  if (handlers.onRefresh) {
    items.push({
      id: 'refresh',
      label: 'Refresh status',
      icon: <RefreshCw aria-hidden="true" />,
      onSelect: handlers.onRefresh
    })
  }

  if (handlers.onLocate) {
    items.push({
      id: 'locate',
      label: 'Locate',
      icon: <FolderInput aria-hidden="true" />,
      onSelect: handlers.onLocate
    })
  }

  if (handlers.onReveal) {
    items.push({
      id: 'reveal',
      label: 'Reveal in Finder',
      icon: <HardDrive aria-hidden="true" />,
      onSelect: handlers.onReveal
    })
  }

  if (handlers.onDetach) {
    items.push({
      id: 'detach',
      label: 'Remove from project',
      icon: <Unlink aria-hidden="true" />,
      onSelect: handlers.onDetach,
      separatorBefore: true
    })
  }

  return items
}

export function ProjectResourcesTable({
  project,
  noteTree,
  resources,
  relations,
  onAddResource,
  addResourceRequestProjectId,
  onAddResourceRequestHandled,
  onSetProjectNotebook,
  onUpdateResource,
  onDetachResource,
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
  const rows = useMemo(
    () => getProjectResourceRows(project, resources, relations),
    [project, relations, resources]
  )

  useEffect(() => {
    if (addResourceRequestProjectId !== project.id) return
    setDialogType('external')
    setEditingResource(null)
    setDialogOpen(true)
    onAddResourceRequestHandled?.()
  }, [addResourceRequestProjectId, onAddResourceRequestHandled, project.id])

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
    setEditingResource(resource)
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
    if (!onAttachGoogleDriveResources || selectedGoogleDriveFileIds.size === 0) return

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

  const openResource = (row: ProjectResourceRow): void => {
    if (row.resource.type === 'notebook') {
      onOpenNotebookResource(row.resource.id)
      return
    }

    void run(row.resource.id, () => onOpenResource(row.resource.id))
  }

  const getResourceActions = (row: ProjectResourceRow): ProjectResourceActionHandlers => ({
    onOpen: () => openResource(row),
    onEdit: () => openEditDialog(row.resource),
    onAttachGoogleDocs:
      googleDriveEnabled && row.resource.provider === 'google-drive'
        ? () => void openGoogleDriveDialog()
        : undefined,
    onDetach: () => void run(row.resource.id, () => onDetachResource(project.id, row.resource.id)),
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

  const columns: readonly TableRowListColumn<ProjectResourceRow>[] = [
    {
      id: 'resource',
      header: 'Name',
      cellClassName: 'min-w-64',
      renderCell: (row) => (
        <Button
          type="button"
          variant="ghost"
          onClick={(event) => {
            event.stopPropagation()
            openResource(row)
          }}
          className="h-auto max-w-full justify-start truncate rounded-none px-0 text-left font-semibold text-foreground hover:bg-transparent hover:text-foreground"
          aria-label={`Open ${row.resource.title}`}
          title={resourceLocationLabel(row.resource)}
        >
          <span className="flex min-w-0 items-center gap-2.5">
            <ResourceBrandIcon resource={row.resource} />
            <span className="min-w-0 truncate">{row.resource.title}</span>
          </span>
        </Button>
      )
    },
    {
      id: 'source',
      header: 'Source',
      cellClassName: 'whitespace-nowrap',
      renderCell: ({ resource }) => (
        <span className="text-sm text-muted-foreground">{resourceProductLabel(resource)}</span>
      )
    },
    {
      id: 'health',
      header: 'Health',
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
      renderCell: ({ resource }) => (
        <span
          className="block truncate text-sm text-muted-foreground"
          title={resourceLocationLabel(resource)}
        >
          {resourceLocationLabel(resource)}
        </span>
      )
    },
    {
      id: 'last-checked',
      header: 'Last checked',
      cellClassName: 'whitespace-nowrap text-muted-foreground',
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
        data-testid="project-resources-page"
        aria-labelledby="project-resources-heading"
      >
        <h1 id="project-resources-heading" className="sr-only">
          Resources
        </h1>
        {rows.length === 0 ? (
          <EmptyState
            icon={Link}
            title="No resources found"
            description="Use Add resource in the top bar to link one or more notebook folders or external links."
          />
        ) : (
          <TableRowList
            aria-label="Resources"
            data-testid="project-resources-table"
            columns={columns}
            items={rows}
            getRowKey={({ resource }) => resource.id}
            getRowProps={(row) => ({
              'data-testid': `project-resource-row:${row.resource.id}`,
              className: cn('group', busyId === row.resource.id && 'opacity-60'),
              onClick: () => openResource(row)
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
              <p className="text-xs font-semibold">Preview · {preview.resource.title}</p>
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
        project={project}
        noteTree={noteTree}
        resource={editingResource}
        onOpenChange={setDialogOpen}
        onAddResource={onAddResource}
        onSetProjectNotebook={onSetProjectNotebook}
        onUpdateResource={onUpdateResource}
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
                      <span
                        className="min-w-0 flex-1 truncate text-sm font-medium"
                        title={file.name}
                      >
                        {file.name}
                      </span>
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
    </>
  )
}

function ProjectResourceDropdownItems({
  items
}: {
  items: readonly ProjectResourceMenuItem[]
}): ReactElement {
  return (
    <>
      {items.map((item) => (
        <Fragment key={item.id}>
          {item.separatorBefore ? <DropdownMenuSeparator /> : null}
          <DropdownMenuItem data-testid={item.testId} onSelect={item.onSelect}>
            {item.icon}
            {item.label}
          </DropdownMenuItem>
        </Fragment>
      ))}
    </>
  )
}

function ProjectResourceContextMenuItems({
  items
}: {
  items: readonly ProjectResourceMenuItem[]
}): ReactElement {
  return (
    <>
      {items.map((item) => (
        <Fragment key={item.id}>
          {item.separatorBefore ? <ContextMenuSeparator /> : null}
          <ContextMenuItem data-testid={item.testId} onSelect={item.onSelect}>
            {item.icon}
            {item.label}
          </ContextMenuItem>
        </Fragment>
      ))}
    </>
  )
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
  const items = getProjectResourceMenuItems(resource, handlers)

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
          <ProjectResourceDropdownItems items={items} />
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
  const items = getProjectResourceMenuItems(row.resource, handlers)

  return (
    <ContextMenu modal>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent data-testid={`project-resource-context-menu:${row.resource.id}`}>
        <ProjectResourceContextMenuItems items={items} />
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

function ResourceEditorDialog({
  open,
  type,
  project,
  noteTree,
  resource,
  onOpenChange,
  onAddResource,
  onSetProjectNotebook,
  onUpdateResource
}: {
  open: boolean
  type: 'notebook' | 'external'
  project: Project
  noteTree: NoteTreeNode[]
  resource: ResourceRef | null
  onOpenChange: (open: boolean) => void
  onAddResource: (projectId: string, input: ResourceInput) => Promise<void>
  onSetProjectNotebook: (projectId: string, notebookPath: string) => Promise<void>
  onUpdateResource: (input: {
    resourceId: string
    canonicalUri?: string
    title?: string
  }) => Promise<void>
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

    for (const linkedResource of project.resourceRefs ?? []) {
      const path = notebookPathFromResource(linkedResource)
      if (path) paths.add(path)
    }

    return paths
  }, [project.resourceRefs])
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
        searchText: initialNotebookPath
      },
      ...mappedNodes
    ]
  }, [folders, initialNotebookPath, linkedNotebookPaths, noteTree])
  const [selectedType, setSelectedType] = useState(type)
  const [notebookPath, setNotebookPath] = useState(initialNotebookPath ?? '')
  const [externalUrl, setExternalUrl] = useState(resource?.canonicalUri ?? '')
  const [title, setTitle] = useState(resource?.title ?? '')
  const [error, setError] = useState<string | null>(null)
  const isEditing = Boolean(resource)
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
    setError(null)
  }, [initialNotebookPath, open, resource, type])

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    setError(null)
    try {
      if (selectedType === 'notebook') {
        if (!notebookPath) throw new Error('Choose a notebook folder')
        if (resource) {
          await onUpdateResource({ resourceId: resource.id, canonicalUri: notebookPath })
        } else {
          await onSetProjectNotebook(project.id, notebookPath)
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
            title: title.trim() || undefined
          })
        } else {
          await onAddResource(project.id, {
            type: 'external',
            canonicalUri: normalizedUrl,
            title: title.trim() || undefined
          })
        }
      }
      onOpenChange(false)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : String(submitError))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg"
        data-testid="project-resource-dialog"
        showCloseButton={false}
      >
        <DialogShell>
          <DialogShellHeader
            context="Project Resources"
            title={isEditing ? 'Edit resource' : 'Add resource'}
            closeLabel="Close resource editor"
            onClose={() => onOpenChange(false)}
          />
          <form onSubmit={(event) => void submit(event)}>
            <DialogBody className="space-y-4">
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
                        <FolderOpen size={15} aria-hidden="true" />
                        <span className="min-w-0">
                          <span
                            className={
                              selectedFolder ? 'block truncate' : 'block text-muted-foreground'
                            }
                          >
                            {selectedFolder?.name ?? 'Select a notebook folder'}
                          </span>
                          {selectedFolder && selectedFolderHasDuplicateName ? (
                            <span className="block truncate text-xs font-normal text-muted-foreground">
                              {selectedFolder.path}
                            </span>
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
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
            </DialogBody>
            <DialogShellFooter>
              <DialogActionButton
                type="submit"
                icon={<Check />}
                label={isEditing ? 'Save resource' : 'Add resource'}
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
