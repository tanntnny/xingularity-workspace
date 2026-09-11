import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
  type ReactElement,
  type SyntheticEvent
} from 'react'
import type {
  CalendarTask,
  NoteListItem,
  NoteTreeNode,
  NoteVimKeyMapping,
  Project,
  ProjectIconStyle,
  ProjectMeetingOutcome,
  ProjectMeetingType,
  ProjectMilestone,
  UpdateProjectMilestoneInput,
  ProjectPropertiesPatch,
  ProjectUpdateStatus,
  TaskStatus,
  ResourceRef,
  ResourceRelation,
  ResourcePreview,
  ResourceInput,
  ResourceUpdateInput,
  GoogleDriveFileCandidate
} from '../../../shared/types'
import type { FolderColorMap } from '../../../shared/folderColors'
import { normalizeTag } from '../../../shared/noteTags'
import { NoteShapeIcon } from '../components/NoteShapeIcon'
import { ProjectIconPicker } from '../components/ProjectIconPicker'
import { ProjectLatestUpdate } from '../components/ProjectLatestUpdate'
import { MilestoneCompletenessIcon } from '../components/MilestoneCompletenessIcon'
import { TaskStatusIcon } from '../components/TaskStatusIcon'
import { TaskContextMenu } from '../components/TaskContextMenu'
import {
  ProjectContextMenu,
  ProjectMenuItems,
  ProjectMilestoneContextMenu
} from '../components/ProjectContextMenus'
import type { ProjectMenuActionHandlers } from '../lib/projectMenu'
import { InlineEditableText } from '../components/InlineEditableText'
import {
  ProjectDescriptionEditor,
  type ProjectDescriptionEditorHandle
} from '../components/ProjectDescriptionEditor'
import { TagEditor } from '../components/TagEditor'
import { ProjectPulsePage } from './ProjectPulsePage'
import { ProjectMeetingPage } from './ProjectMeetingPage'
import { getTaskStatus } from '../lib/taskStatus'
import {
  PROJECT_FAVORITE_CHIP_OPTIONS,
  PROJECT_STATE_CHIP_OPTIONS,
  TASK_STATUS_CHIP_OPTIONS,
  getProjectUpdateStatusChipItem
} from '../lib/statusChipMeta'
import { formatCalendarDateValue, formatCalendarTimeValue } from '../lib/calendarDateTimeInput'
import { getLatestProjectUpdate } from '../lib/projectUpdates'
import { formatProjectDate, formatProjectUpdatedDate } from '../lib/projectDateLabels'
import { cn } from '../lib/utils'
import { Button, rowActionButtonClassName } from '../components/ui/button'
import { CalendarDateEditPopover } from '../components/ui/calendar-date-edit-popover'
import { ChipGroup } from '../components/ui/chip-group'
import { Input } from '../components/ui/input'
import {
  WorkspaceHeaderActionDivider,
  WorkspaceHeaderSecondaryActions,
  WorkspaceIconButton,
  WorkspacePanelStack
} from '../components/ui/document-workspace'
import { CollapsibleWorkspacePanelSection } from '../components/ui/workspace-panel-section'
import { WorkspacePropertyRow } from '../components/ui/workspace-property-row'
import { EmptyState } from '../components/ui/empty-state'
import { DragSource } from '../components/ui/drag-source'
import { DropZone } from '../components/ui/drop-zone'
import { TabToggleGroup, TabToggleGroupItem } from '../components/ui/tab-toggle-group'
import {
  Breadcrumb,
  BreadcrumbButton,
  BreadcrumbIconLabel,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from '../components/ui/breadcrumb'
import { StatusChip } from '../components/ui/status-chip'
import { StatusChipSelect } from '../components/ui/status-chip-select'
import { ProgressRing } from '../components/ui/progress-ring'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger
} from '../components/ui/dropdown-menu'
import { TableRowList, type TableRowListColumn } from '../components/ui/table-row-list'
import { WorkspaceTextFade } from '../components/ui/workspace-text-fade'
import {
  filterProjectsForWorkspace,
  PROJECTS_WORKSPACE_FILTER_OPTIONS,
  type ProjectsWorkspaceFilterMode
} from '../lib/projectTaskRows'
import {
  CalendarCheck,
  ChevronRight,
  ClockCheck,
  GripVertical,
  MoreHorizontal,
  Plus,
  Star,
  Trash2,
  X
} from '../components/ui/icons'
import { APP_PAGE_ICONS } from '../lib/pageIcons'
import {
  getProjectDirectTasks,
  getCurrentProjectMilestone,
  getMostUrgentProjectTask,
  getProjectMilestoneProgress,
  getProjectMilestoneTasks,
  getProjectMilestoneStatus,
  moveProjectMilestone
} from '../lib/projectMilestones'
import type { ProjectMilestoneStatus } from '../lib/projectMilestones'
import { calculateProjectHealth } from '../../../shared/projectPlanning'
import { isTaskStatusDone } from '../../../shared/taskStatus'
import { ProjectActivityPanel } from '../components/ProjectActivityPanel'
import { ProjectMilestonesPanel } from '../components/ProjectMilestonesPanel'
import { ProjectResourcesTable } from '../components/ProjectResourcesPanel'
import { WorkspaceReadingWidth } from '../components/workspace'
import type { TaskOpenOptions } from '../lib/taskOpenOptions'
import { useReorderMotion } from '../hooks/useReorderMotion'
import { usePersistentTableSort } from '../hooks/usePersistentTableSort'

export type { ProjectsWorkspaceFilterMode } from '../lib/projectTaskRows'

export type ProjectsWorkspaceView = 'list' | 'home' | 'pulse' | 'meetings' | 'resources'

type MilestoneDropBoundary = 'top' | 'bottom'

function getProjectMilestoneIds(items: readonly ProjectMilestone[]): string[] {
  return items.map((milestone) => milestone.id)
}

function hasSameProjectMilestoneOrder(
  left: readonly ProjectMilestone[],
  right: readonly ProjectMilestone[]
): boolean {
  const leftIds = getProjectMilestoneIds(left)
  const rightIds = getProjectMilestoneIds(right)
  return leftIds.length === rightIds.length && leftIds.every((id, index) => id === rightIds[index])
}

interface ProjectsWorkspacePageProps {
  projects: Project[]
  tasks: CalendarTask[]
  favoriteProjectIds: string[]
  selectedProjectId: string | null
  view: ProjectsWorkspaceView
  filterMode: ProjectsWorkspaceFilterMode
  onFilterModeChange: (mode: ProjectsWorkspaceFilterMode) => void
  onUpdateProjectProperties: (projectId: string, patch: ProjectPropertiesPatch) => void
  onOpenProject: (projectId: string) => void
  onToggleProjectFavorite: (projectId: string) => void
  onToggleProjectArchive: (projectId: string) => void
  onExportProjectContext: (project: Project) => void
  onDeleteProject: (projectId: string) => void
  isProjectContextExporting?: boolean
  onOpenProjectUpdates: (projectId: string) => void
  onCreateProjectUpdate: (
    projectId: string,
    input: { markdown: string; status: ProjectUpdateStatus }
  ) => Promise<void>
  onUpdateProjectUpdate: (
    projectId: string,
    updateId: string,
    input: { markdown: string; status: ProjectUpdateStatus }
  ) => Promise<void>
  onDeleteProjectUpdate: (projectId: string, updateId: string) => Promise<void>
  onCreateProjectMeeting: (
    projectId: string,
    input: { markdown: string; type: ProjectMeetingType; outcome: ProjectMeetingOutcome }
  ) => Promise<void>
  onUpdateProjectMeeting: (
    projectId: string,
    meetingId: string,
    input: { markdown: string; type: ProjectMeetingType; outcome: ProjectMeetingOutcome }
  ) => Promise<void>
  onDeleteProjectMeeting: (projectId: string, meetingId: string) => Promise<void>
  noteTree: NoteTreeNode[]
  folderColors?: FolderColorMap
  resources: ResourceRef[]
  relations: ResourceRelation[]
  onAddResource: (projectId: string, input: ResourceInput) => Promise<void>
  addResourceRequestProjectId?: string | null
  onAddResourceRequestHandled?: () => void
  onSetProjectNotebook: (projectId: string, notebookPath: string) => Promise<void>
  onUpdateResource: (input: ResourceUpdateInput) => Promise<void>
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
  notes: NoteListItem[]
  vimModeEnabled: boolean
  vimKeyMappings: NoteVimKeyMapping[]
  onOpenNoteLink: (target: string) => void
  onCreateTask: (
    projectId: string | undefined,
    title: string,
    milestoneId?: string
  ) => Promise<CalendarTask>
  onCreateMilestone: (projectId: string, title: string) => Promise<ProjectMilestone>
  onUpdateMilestone: (
    projectId: string,
    milestoneId: string,
    patch: Pick<UpdateProjectMilestoneInput, 'title' | 'endDate'>
  ) => void | Promise<void>
  onDeleteMilestone: (projectId: string, milestoneId: string) => Promise<void>
  onReorderMilestones: (projectId: string, milestoneIds: string[]) => Promise<boolean>
  onOpenMilestoneDialog: (projectId: string, milestoneId: string) => void
  onUpdateProject: (
    projectId: string,
    draft: { name: string; description: string; icon: ProjectIconStyle }
  ) => void
  onUpdateTask: (taskId: string, patch: Partial<CalendarTask>) => void
  onDeleteTask: (taskId: string) => void
  onDuplicateTask?: (taskId: string) => void | Promise<void>
  onOpenTask: (taskId: string, options?: TaskOpenOptions) => void
}

export function ProjectsWorkspacePage({
  projects,
  tasks,
  favoriteProjectIds,
  selectedProjectId,
  view,
  filterMode,
  onFilterModeChange,
  onUpdateProjectProperties,
  onOpenProject,
  onToggleProjectFavorite,
  onToggleProjectArchive,
  onExportProjectContext,
  onDeleteProject,
  isProjectContextExporting = false,
  onOpenProjectUpdates,
  onCreateProjectUpdate,
  onUpdateProjectUpdate,
  onDeleteProjectUpdate,
  onCreateProjectMeeting,
  onUpdateProjectMeeting,
  onDeleteProjectMeeting,
  noteTree,
  folderColors = {},
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
  googleDriveEnabled,
  googleDriveConnected,
  onListGoogleDriveFiles,
  onAttachGoogleDriveResources,
  notes,
  vimModeEnabled,
  vimKeyMappings,
  onOpenNoteLink,
  onCreateTask,
  onCreateMilestone,
  onUpdateMilestone,
  onDeleteMilestone,
  onReorderMilestones,
  onOpenMilestoneDialog,
  onUpdateProject,
  onUpdateTask,
  onDeleteTask,
  onDuplicateTask,
  onOpenTask
}: ProjectsWorkspacePageProps): ReactElement {
  const [editingMilestoneId, setEditingMilestoneId] = useState<string | null>(null)
  const [milestoneEditToken, setMilestoneEditToken] = useState(0)
  const [isCreatingTask, setIsCreatingTask] = useState(false)
  const [isCreatingMilestone, setIsCreatingMilestone] = useState(false)
  const [expandedMilestoneIds, setExpandedMilestoneIds] = useState<Set<string>>(() => new Set())

  const visibleProjects = useMemo(
    () => filterProjectsForWorkspace(projects, favoriteProjectIds, filterMode),
    [favoriteProjectIds, filterMode, projects]
  )
  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null

  const projectTasks = selectedProject ? getProjectDirectTasks(tasks, selectedProject.id) : []
  const projectMilestones = selectedProject?.milestones ?? []
  useEffect(() => {
    setExpandedMilestoneIds(new Set())
    setEditingMilestoneId(null)
  }, [selectedProject?.id])

  const handleCreateTask = async (): Promise<void> => {
    if (!selectedProject || isCreatingTask) return

    setIsCreatingTask(true)
    try {
      const task = await onCreateTask(selectedProject.id, 'New Task')
      onOpenTask(task.id, { isNewTask: true })
    } catch {
      // The parent reports persistence errors.
    } finally {
      setIsCreatingTask(false)
    }
  }

  const handleCreateMilestone = async (): Promise<void> => {
    if (!selectedProject || isCreatingMilestone) return

    setIsCreatingMilestone(true)
    try {
      const milestone = await onCreateMilestone(selectedProject.id, 'New Milestone')
      setExpandedMilestoneIds((current) => new Set(current).add(milestone.id))
      requestMilestoneEdit(milestone.id)
    } catch {
      // The parent reports persistence errors.
    } finally {
      setIsCreatingMilestone(false)
    }
  }

  const requestMilestoneEdit = (milestoneId: string): void => {
    setEditingMilestoneId(milestoneId)
    setMilestoneEditToken((current) => current + 1)
  }

  const updateMilestone = (milestoneId: string, title: string): void => {
    if (selectedProject) {
      onUpdateMilestone(selectedProject.id, milestoneId, { title })
    }
    setEditingMilestoneId((current) => (current === milestoneId ? null : current))
  }

  const handleCreateMilestoneTask = async (milestoneId: string): Promise<void> => {
    if (!selectedProject || isCreatingTask) return

    setIsCreatingTask(true)
    try {
      const task = await onCreateTask(selectedProject.id, 'New Task', milestoneId)
      setExpandedMilestoneIds((current) => new Set(current).add(milestoneId))
      onOpenTask(task.id, { isNewTask: true })
    } catch {
      // The parent reports persistence errors.
    } finally {
      setIsCreatingTask(false)
    }
  }

  const toggleMilestone = (milestoneId: string): void => {
    setExpandedMilestoneIds((current) => {
      const next = new Set(current)
      if (next.has(milestoneId)) next.delete(milestoneId)
      else next.add(milestoneId)
      return next
    })
  }

  const requestDeleteMilestone = (milestoneId: string): boolean => {
    if (!selectedProject) {
      return false
    }

    const milestone = projectMilestones.find((item) => item.id === milestoneId)
    const childTaskCount = milestone
      ? getProjectMilestoneTasks(tasks, selectedProject.id, milestone.id).length
      : 0
    if (
      childTaskCount > 0 &&
      !window.confirm(
        `Delete milestone "${milestone?.title ?? 'this milestone'}" and move its ${childTaskCount} ${childTaskCount === 1 ? 'task' : 'tasks'} to the project?`
      )
    ) {
      return false
    }

    void onDeleteMilestone(selectedProject.id, milestoneId)
    setEditingMilestoneId((current) => (current === milestoneId ? null : current))
    return true
  }

  const toolbar =
    view === 'list' ? (
      <div className="flex min-w-max items-center gap-2">
        <TabToggleGroup
          value={filterMode}
          onValueChange={(value) => {
            if (value) onFilterModeChange(value as ProjectsWorkspaceFilterMode)
          }}
          aria-label="Project filter"
          data-testid="project-filter"
          className="max-w-none"
        >
          {PROJECTS_WORKSPACE_FILTER_OPTIONS.map((option) => (
            <TabToggleGroupItem key={option.value} value={option.value}>
              {option.label}
            </TabToggleGroupItem>
          ))}
        </TabToggleGroup>
      </div>
    ) : null

  return (
    <div className={cn('flex min-h-full min-w-0 flex-col bg-transparent')}>
      {toolbar ? (
        <WorkspaceHeaderSecondaryActions>{toolbar}</WorkspaceHeaderSecondaryActions>
      ) : null}
      <div className="min-h-full w-full">
        {view === 'list' ? (
          <AllProjectsTable
            projects={visibleProjects}
            tasks={tasks}
            favoriteProjectIds={favoriteProjectIds}
            onUpdateProjectProperties={onUpdateProjectProperties}
            onOpenProject={onOpenProject}
            onToggleProjectFavorite={onToggleProjectFavorite}
            onToggleProjectArchive={onToggleProjectArchive}
            onExportProjectContext={onExportProjectContext}
            onDeleteProject={onDeleteProject}
            isProjectContextExporting={isProjectContextExporting}
          />
        ) : view === 'resources' && selectedProject ? (
          <div id="project-view-panel" role="tabpanel" aria-labelledby="project-view-tab-resources">
            <ProjectResourcesTable
              project={selectedProject}
              noteTree={noteTree}
              folderColors={folderColors}
              resources={resources}
              relations={relations}
              onAddResource={onAddResource}
              addResourceRequestProjectId={addResourceRequestProjectId}
              onAddResourceRequestHandled={onAddResourceRequestHandled}
              onSetProjectNotebook={onSetProjectNotebook}
              onUpdateResource={onUpdateResource}
              onDetachResource={onDetachResource}
              onOpenResource={onOpenResource}
              onOpenNotebookResource={onOpenNotebookResource}
              onLocateResource={onLocateResource}
              onRevealResource={onRevealResource}
              onRefreshResource={onRefreshResource}
              onPreviewResource={onPreviewResource}
              googleDriveEnabled={googleDriveEnabled}
              googleDriveConnected={googleDriveConnected}
              onListGoogleDriveFiles={onListGoogleDriveFiles}
              onAttachGoogleDriveResources={onAttachGoogleDriveResources}
            />
          </div>
        ) : view === 'pulse' && selectedProject ? (
          <div id="project-view-panel" role="tabpanel" aria-labelledby="project-view-tab-pulse">
            <ProjectPulsePage
              project={selectedProject}
              notes={notes}
              vimModeEnabled={vimModeEnabled}
              vimKeyMappings={vimKeyMappings}
              onOpenNoteLink={onOpenNoteLink}
              onCreateUpdate={(input) => onCreateProjectUpdate(selectedProject.id, input)}
              onUpdateUpdate={(updateId, input) =>
                onUpdateProjectUpdate(selectedProject.id, updateId, input)
              }
              onDeleteUpdate={(updateId) => onDeleteProjectUpdate(selectedProject.id, updateId)}
            />
          </div>
        ) : view === 'meetings' && selectedProject ? (
          <div id="project-view-panel" role="tabpanel" aria-labelledby="project-view-tab-meetings">
            <ProjectMeetingPage
              project={selectedProject}
              notes={notes}
              vimModeEnabled={vimModeEnabled}
              vimKeyMappings={vimKeyMappings}
              onOpenNoteLink={onOpenNoteLink}
              onCreateMeeting={(input) => onCreateProjectMeeting(selectedProject.id, input)}
              onUpdateMeeting={(meetingId, input) =>
                onUpdateProjectMeeting(selectedProject.id, meetingId, input)
              }
              onDeleteMeeting={(meetingId) => onDeleteProjectMeeting(selectedProject.id, meetingId)}
              onCreateFollowUpTask={async () => {
                const task = await onCreateTask(selectedProject.id, 'Follow up from meeting')
                onOpenTask(task.id, { isNewTask: true })
              }}
            />
          </div>
        ) : (
          <WorkspaceReadingWidth className="py-4">
            {selectedProject ? (
              <div
                id="project-view-panel"
                role="tabpanel"
                aria-labelledby="project-view-tab-home"
                className="w-full space-y-3"
              >
                <ProjectDetails
                  key={selectedProject.id}
                  project={selectedProject}
                  onUpdateProject={onUpdateProject}
                  vimModeEnabled={vimModeEnabled}
                  vimKeyMappings={vimKeyMappings}
                  dataTestId="project-main-detail-panel"
                  testIdPrefix="project-main-detail"
                />
                <ProjectLatestUpdate
                  project={selectedProject}
                  notes={notes}
                  vimModeEnabled={vimModeEnabled}
                  vimKeyMappings={vimKeyMappings}
                  onOpenNoteLink={onOpenNoteLink}
                  onOpenUpdates={() => onOpenProjectUpdates(selectedProject.id)}
                />
                <ProjectMilestones
                  key={selectedProject.id}
                  projectId={selectedProject.id}
                  milestones={projectMilestones}
                  tasks={tasks}
                  expandedMilestoneIds={expandedMilestoneIds}
                  isCreatingMilestone={isCreatingMilestone}
                  isCreatingTask={isCreatingTask}
                  editingMilestoneId={editingMilestoneId}
                  milestoneEditToken={milestoneEditToken}
                  onCreateMilestone={handleCreateMilestone}
                  onCreateTask={handleCreateMilestoneTask}
                  onToggleMilestone={toggleMilestone}
                  onUpdateMilestone={updateMilestone}
                  onOpenMilestoneDialog={(milestoneId) =>
                    onOpenMilestoneDialog(selectedProject.id, milestoneId)
                  }
                  onOpenTask={onOpenTask}
                  onDuplicateTask={onDuplicateTask}
                  onUpdateTask={onUpdateTask}
                  onDeleteTask={onDeleteTask}
                  onDeleteMilestone={requestDeleteMilestone}
                  onReorderMilestones={(milestoneIds) =>
                    onReorderMilestones(selectedProject.id, milestoneIds)
                  }
                />
                <ProjectTasks
                  tasks={projectTasks}
                  onCreateTask={handleCreateTask}
                  isCreatingTask={isCreatingTask}
                  onUpdateTask={onUpdateTask}
                  onDeleteTask={onDeleteTask}
                  onOpenTask={onOpenTask}
                />
              </div>
            ) : (
              <EmptyState
                icon={APP_PAGE_ICONS.projects}
                title="No project selected"
                description="Open a project from All Projects to start organizing tasks."
              />
            )}
          </WorkspaceReadingWidth>
        )}
      </div>
    </div>
  )
}

export function ProjectsWorkspaceRightPanel({
  projects,
  tasks = [],
  favoriteProjectIds,
  selectedProjectId,
  onToggleProjectFavorite,
  onToggleProjectArchive,
  onUpdateProjectProperties,
  onCreateMilestone,
  onOpenMilestone
}: {
  projects: Project[]
  tasks?: CalendarTask[]
  favoriteProjectIds: string[]
  selectedProjectId: string | null
  onToggleProjectFavorite: (projectId: string) => void
  onToggleProjectArchive: (projectId: string) => void
  onUpdateProjectProperties: (projectId: string, patch: ProjectPropertiesPatch) => void
  onCreateMilestone?: (projectId: string) => void | Promise<void>
  onOpenMilestone?: (projectId: string, milestoneId: string) => void
}): ReactElement {
  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null
  const projectTagOptions = useMemo(() => {
    const values = new Set<string>()
    for (const tag of projects.flatMap((project) => project.tags ?? [])) {
      const normalized = normalizeTag(tag)
      if (normalized) values.add(normalized)
    }

    return Array.from(values).sort((left, right) => left.localeCompare(right))
  }, [projects])

  return (
    <WorkspacePanelStack data-testid="projects-panel-stack">
      <ProjectPropertiesPanel
        key={selectedProject?.id ?? 'empty-project-properties'}
        project={selectedProject}
        favorite={selectedProject ? favoriteProjectIds.includes(selectedProject.id) : false}
        onToggleFavorite={() => {
          if (selectedProject) onToggleProjectFavorite(selectedProject.id)
        }}
        onToggleArchive={() => {
          if (selectedProject) onToggleProjectArchive(selectedProject.id)
        }}
        onUpdateProperties={(patch) => {
          if (selectedProject) onUpdateProjectProperties(selectedProject.id, patch)
        }}
        availableTags={projectTagOptions}
      />
      {selectedProject ? (
        <ProjectMilestonesPanel
          project={selectedProject}
          tasks={tasks}
          onCreateMilestone={() =>
            onCreateMilestone ? onCreateMilestone(selectedProject.id) : undefined
          }
          onOpenMilestone={(milestoneId) => onOpenMilestone?.(selectedProject.id, milestoneId)}
        />
      ) : null}
      {selectedProject ? <ProjectActivityPanel project={selectedProject} /> : null}
    </WorkspacePanelStack>
  )
}

export function ProjectsWorkspaceSecondaryActions({
  view,
  project,
  onViewChange
}: {
  view: ProjectsWorkspaceView
  project: Project | null
  onViewChange: (view: ProjectsWorkspaceView) => void
}): ReactElement | null {
  if (!project || view === 'list') {
    return null
  }

  return (
    <div className="flex min-w-max items-center gap-1.5">
      <TabToggleGroup
        value={view}
        onValueChange={(value) => {
          if (
            value === 'home' ||
            value === 'pulse' ||
            value === 'meetings' ||
            value === 'resources'
          ) {
            onViewChange(value)
          }
        }}
        aria-label="Project view"
        data-testid="project-view-tabs"
        className="max-w-none"
      >
        <TabToggleGroupItem
          value="home"
          id="project-view-tab-home"
          aria-controls="project-view-panel"
          data-testid="project-view-tab:home"
        >
          Overview
        </TabToggleGroupItem>
        <TabToggleGroupItem
          value="pulse"
          id="project-view-tab-pulse"
          aria-controls="project-view-panel"
          data-testid="project-view-tab:pulse"
        >
          Activity
        </TabToggleGroupItem>
        <TabToggleGroupItem
          value="meetings"
          id="project-view-tab-meetings"
          aria-controls="project-view-panel"
          data-testid="project-view-tab:meetings"
        >
          Meeting
        </TabToggleGroupItem>
        <TabToggleGroupItem
          value="resources"
          id="project-view-tab-resources"
          aria-controls="project-view-panel"
          data-testid="project-view-tab:resources"
        >
          Resources
        </TabToggleGroupItem>
      </TabToggleGroup>
    </div>
  )
}

export function ProjectsWorkspaceBreadcrumb({
  project,
  view,
  onOpenAllProjects,
  onOpenProjectHome
}: {
  project: Project | null
  view: ProjectsWorkspaceView
  onOpenAllProjects: () => void
  onOpenProjectHome: () => void
}): ReactElement {
  const viewLabel =
    view === 'pulse'
      ? 'Activity'
      : view === 'meetings'
        ? 'Meeting'
        : view === 'resources'
          ? 'Resources'
          : 'Overview'

  return (
    <Breadcrumb>
      <BreadcrumbList className="text-muted-foreground">
        <BreadcrumbItem>
          {view === 'list' ? (
            <BreadcrumbPage className="text-sm text-foreground">
              <BreadcrumbIconLabel
                icon={<APP_PAGE_ICONS.projects size={14} strokeWidth={1.8} aria-hidden="true" />}
              >
                All Projects
              </BreadcrumbIconLabel>
            </BreadcrumbPage>
          ) : (
            <BreadcrumbButton
              onClick={onOpenAllProjects}
              className="text-sm text-muted-foreground"
              data-testid="projects-breadcrumb:all"
            >
              <BreadcrumbIconLabel
                icon={<APP_PAGE_ICONS.projects size={14} strokeWidth={1.8} aria-hidden="true" />}
              >
                All Projects
              </BreadcrumbIconLabel>
            </BreadcrumbButton>
          )}
        </BreadcrumbItem>
        {project && view !== 'list' ? (
          <>
            <BreadcrumbSeparator className="text-muted-foreground" />
            <BreadcrumbItem>
              {view === 'home' ? (
                <BreadcrumbPage className="max-w-[220px] text-sm font-bold text-foreground">
                  <BreadcrumbIconLabel icon={<NoteShapeIcon icon={project.icon} size={16} />}>
                    {project.name}
                  </BreadcrumbIconLabel>
                </BreadcrumbPage>
              ) : (
                <BreadcrumbButton
                  onClick={onOpenProjectHome}
                  className="max-w-[180px] text-sm text-muted-foreground"
                  data-testid="projects-breadcrumb:project"
                >
                  <BreadcrumbIconLabel icon={<NoteShapeIcon icon={project.icon} size={16} />}>
                    {project.name}
                  </BreadcrumbIconLabel>
                </BreadcrumbButton>
              )}
            </BreadcrumbItem>
            {view !== 'home' ? (
              <>
                <BreadcrumbSeparator className="text-muted-foreground" />
                <BreadcrumbItem>
                  <BreadcrumbPage className="max-w-[180px] text-sm font-semibold text-foreground">
                    {viewLabel}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </>
            ) : null}
          </>
        ) : null}
      </BreadcrumbList>
    </Breadcrumb>
  )
}

function AllProjectsTable({
  projects,
  tasks,
  favoriteProjectIds,
  onUpdateProjectProperties,
  onOpenProject,
  onToggleProjectFavorite,
  onToggleProjectArchive,
  onExportProjectContext,
  onDeleteProject,
  isProjectContextExporting
}: {
  projects: Project[]
  tasks: CalendarTask[]
  favoriteProjectIds: string[]
  onUpdateProjectProperties: (projectId: string, patch: ProjectPropertiesPatch) => void
  onOpenProject: (projectId: string) => void
  onToggleProjectFavorite: (projectId: string) => void
  onToggleProjectArchive: (projectId: string) => void
  onExportProjectContext: (project: Project) => void
  onDeleteProject: (projectId: string) => void
  isProjectContextExporting: boolean
}): ReactElement {
  const [sortState, setSortState] = usePersistentTableSort(
    'xingularity:table-sort:projects',
    null,
    ['project', 'health', 'progress', 'end-date', 'updated'] as const
  )

  const getProjectMenuHandlers = (project: Project): ProjectMenuActionHandlers => ({
    isFavorite: favoriteProjectIds.includes(project.id),
    isExporting: isProjectContextExporting,
    onOpen: ({ id }) => onOpenProject(id),
    onToggleFavorite: ({ id }) => onToggleProjectFavorite(id),
    onToggleArchive: ({ id }) => onToggleProjectArchive(id),
    onExport: onExportProjectContext,
    onDelete: ({ id }) => onDeleteProject(id)
  })

  const projectRows = projects.map((project) => {
    const taskHealth = calculateProjectHealth(project, tasks)
    const projectMilestones = project.milestones ?? []
    const currentMilestone = getCurrentProjectMilestone(projectMilestones, tasks, project.id)
    const mostUrgentTask = getMostUrgentProjectTask(tasks, project.id)
    const latestUpdate = getLatestProjectUpdate(project.updates)

    return {
      project,
      taskHealth,
      projectMilestones,
      currentMilestone,
      mostUrgentTask,
      latestUpdate
    }
  })

  type ProjectTableRow = (typeof projectRows)[number]

  const columns: readonly TableRowListColumn<ProjectTableRow>[] = [
    {
      id: 'project',
      header: 'Project',
      cellClassName: 'w-[clamp(20rem,42vw,40rem)] min-w-[20rem] max-w-[40rem]',
      sortValue: ({ project }) => project.name,
      renderCell: ({ project, projectMilestones, currentMilestone, mostUrgentTask }) => {
        const summaryTitle = [
          project.name,
          projectMilestones.length > 0 ? (currentMilestone?.title ?? 'Complete') : undefined,
          mostUrgentTask?.title
        ]
          .filter(Boolean)
          .join(' · ')

        return (
          <Button
            type="button"
            variant="ghost"
            onClick={(event) => {
              event.stopPropagation()
              onOpenProject(project.id)
            }}
            className="h-auto w-full min-w-0 max-w-full justify-start rounded-none px-0 text-left font-semibold text-foreground hover:bg-transparent hover:text-foreground"
            aria-label={`Open project ${project.name}`}
            title={summaryTitle}
          >
            <span className="flex w-full min-w-0 items-center gap-2.5">
              <NoteShapeIcon icon={project.icon} size={20} aria-hidden="true" />
              <WorkspaceTextFade
                className="min-w-0 flex-1"
                data-testid={`all-project-summary:${project.id}`}
                title={summaryTitle}
              >
                <span className="inline-flex min-w-max items-center gap-2.5">
                  <span className="shrink-0" title={project.name}>
                    {project.name}
                  </span>
                  {projectMilestones.length > 0 ? (
                    <span
                      className="all-project-milestone-summary flex shrink-0 items-center gap-1.5 text-sm"
                      data-milestone-complete={!currentMilestone ? 'true' : 'false'}
                    >
                      <MilestoneCompletenessIcon
                        status={currentMilestone ? 'current' : 'complete'}
                        size={16}
                        dataTestId={`all-project-milestone-icon:${project.id}`}
                      />
                      <span title={currentMilestone?.title ?? 'Complete'}>
                        {currentMilestone?.title ?? 'Complete'}
                      </span>
                    </span>
                  ) : null}
                  {mostUrgentTask ? (
                    <>
                      <TaskStatusIcon
                        status={mostUrgentTask.status}
                        completed={mostUrgentTask.completed}
                        size={16}
                        className="all-project-urgent-task-status"
                      />
                      <span
                        className="shrink-0 text-sm font-normal text-muted-foreground"
                        data-testid={`all-project-urgent-task:${project.id}`}
                        title={`Most urgent task: ${mostUrgentTask.title}`}
                      >
                        {mostUrgentTask.title}
                      </span>
                    </>
                  ) : null}
                </span>
              </WorkspaceTextFade>
            </span>
          </Button>
        )
      }
    },
    {
      id: 'health',
      header: 'Health',
      cellClassName: 'whitespace-nowrap',
      sortValue: ({ latestUpdate }) => latestUpdate?.status,
      renderCell: ({ project, latestUpdate }) => (
        <StatusChip
          item={getProjectUpdateStatusChipItem(latestUpdate?.status)}
          surface="hover"
          mutedLabel={latestUpdate ? undefined : true}
          data-testid={`all-project-health:${project.id}`}
        />
      )
    },
    {
      id: 'progress',
      header: 'Progress',
      cellClassName: 'min-w-24',
      sortValue: ({ taskHealth }) => taskHealth.completionRatio,
      sortDefaultDirection: 'desc',
      renderCell: ({ project, taskHealth }) => {
        const completionPercent = Math.min(
          100,
          Math.max(0, Math.round(taskHealth.completionRatio * 100))
        )

        return (
          <div
            className="flex items-center gap-2"
            data-testid={`all-project-progress:${project.id}`}
          >
            <ProgressRing
              value={completionPercent}
              data-testid={`all-project-progress-ring:${project.id}`}
            />
            <span className="text-sm font-medium text-foreground">{completionPercent}%</span>
          </div>
        )
      }
    },
    {
      id: 'end-date',
      header: 'End date',
      cellClassName: 'whitespace-nowrap',
      sortValue: ({ project }) => project.endDate,
      renderCell: ({ project }) => {
        const endDateLabel = project.endDate ? formatProjectDate(project.endDate) : 'Set end date'

        return (
          <CalendarDateEditPopover
            value={project.endDate}
            label="Project end date"
            onValueChange={(value) => {
              onUpdateProjectProperties(project.id, { endDate: value ?? null })
            }}
            placeholder="Set end date"
            displayValue={
              project.endDate ? <time dateTime={project.endDate}>{endDateLabel}</time> : undefined
            }
            triggerStyle="status-chip"
            aria-label={`End date: ${endDateLabel}`}
            title={`End date: ${endDateLabel}`}
            data-testid={`all-project-date-chip:end-date:${project.id}`}
            onClick={(event) => event.stopPropagation()}
          />
        )
      }
    },
    {
      id: 'updated',
      header: 'Updated',
      cellClassName: 'whitespace-nowrap',
      sortValue: ({ project }) => project.updatedAt,
      sortDefaultDirection: 'desc',
      renderCell: ({ project }) => {
        const updatedDate = formatProjectUpdatedDate(project.updatedAt)

        return (
          <StatusChip
            item={{
              label: <time dateTime={project.updatedAt}>{updatedDate.label}</time>,
              icon: <CalendarCheck aria-hidden="true" />,
              iconColorToken: 'var(--muted-foreground)'
            }}
            surface="hover-pill"
            mutedLabel
            className="text-xs"
            data-testid={`all-project-date-chip:updated:${project.id}`}
            aria-label={`Updated ${updatedDate.label}; ${updatedDate.exactLabel}`}
            title={`Updated ${updatedDate.exactLabel}`}
          />
        )
      }
    },
    {
      id: 'favorite',
      header: <span className="sr-only">Favorite</span>,
      headerClassName: 'w-10',
      cellClassName: 'w-10 text-right',
      renderCell: ({ project }) =>
        favoriteProjectIds.includes(project.id) ? (
          <Star
            aria-hidden="true"
            className="ml-auto text-[var(--status-chip-project-favorite-favorite-icon)]"
            size={16}
          />
        ) : null
    },
    {
      id: 'actions',
      header: <span className="sr-only">Actions</span>,
      headerClassName: 'w-10',
      cellClassName: 'w-10 text-right',
      renderCell: ({ project }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="rowAction"
              size="icon"
              className="ml-auto"
              aria-label={`Open actions for project: ${project.name}`}
              title="Open project actions"
              data-testid={`all-project-menu:${project.id}`}
              onClick={(event) => event.stopPropagation()}
            >
              <MoreHorizontal size={16} aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <ProjectMenuItems
              project={project}
              handlers={getProjectMenuHandlers(project)}
              variant="dropdown"
            />
          </DropdownMenuContent>
        </DropdownMenu>
      )
    }
  ]

  return (
    <section
      className="flex min-h-full min-w-0 flex-col gap-6"
      data-testid="all-projects-page"
      aria-labelledby="all-projects-heading"
    >
      <h1 id="all-projects-heading" className="sr-only">
        All Projects
      </h1>
      {projects.length === 0 ? (
        <EmptyState
          icon={APP_PAGE_ICONS.projects}
          title="No projects found"
          description="Create a project to start organizing work across milestones, tasks, and updates."
          data-testid="all-projects-empty"
        />
      ) : (
        <TableRowList
          aria-label="Projects"
          data-testid="all-projects-table"
          columns={columns}
          items={projectRows}
          sortState={sortState}
          onSortChange={setSortState}
          getRowKey={({ project }) => project.id}
          getRowProps={({ project }) => ({
            'data-testid': `all-project-row:${project.id}`,
            onClick: () => onOpenProject(project.id)
          })}
          rowWrapper={({ project }, tableRow) => (
            <ProjectContextMenu
              project={project}
              handlers={getProjectMenuHandlers(project)}
              key={project.id}
            >
              {tableRow}
            </ProjectContextMenu>
          )}
        />
      )}
    </section>
  )
}

export function ProjectsWorkspaceHeaderActions({
  project,
  onDelete
}: {
  project: Project | null
  onDelete: () => void
}): ReactElement | null {
  if (!project) {
    return null
  }

  return (
    <>
      <WorkspaceHeaderActionDivider />
      <WorkspaceIconButton
        type="button"
        onClick={onDelete}
        data-testid="project-workspace-header-actions"
        aria-label="Delete project"
        title="Delete project"
        icon={<Trash2 size={18} />}
      />
    </>
  )
}

function ProjectDetails({
  project,
  onUpdateProject,
  dataTestId,
  testIdPrefix,
  vimModeEnabled,
  vimKeyMappings
}: {
  project: Project | null
  onUpdateProject: (
    projectId: string,
    draft: { name: string; description: string; icon: ProjectIconStyle }
  ) => void
  dataTestId: string
  testIdPrefix: string
  vimModeEnabled: boolean
  vimKeyMappings: NoteVimKeyMapping[]
}): ReactElement {
  const [name, setName] = useState(project?.name ?? '')
  const descriptionEditorRef = useRef<ProjectDescriptionEditorHandle | null>(null)

  if (!project) {
    return (
      <CollapsibleWorkspacePanelSection
        data-testid={dataTestId}
        heading="Project properties"
        description="Select a project to edit its details."
      >
        <EmptyState
          icon={APP_PAGE_ICONS.projects}
          title="No project selected"
          description="Create a project to see its properties."
        />
      </CollapsibleWorkspacePanelSection>
    )
  }

  const initialDescription = project.description ?? project.summary ?? ''
  const getProjectDraft = (): {
    name: string
    description: string
    icon: ProjectIconStyle
  } => ({
    name: name.trim() || project.name,
    description: (descriptionEditorRef.current?.getDraft() ?? initialDescription).trim(),
    icon: project.icon
  })
  return (
    <div data-testid={dataTestId}>
      <div className="space-y-3" data-testid={`${testIdPrefix}-header`}>
        <div className="flex items-center gap-3" data-testid={`${testIdPrefix}-icon-row`}>
          <ProjectIconPicker
            icon={project.icon}
            onChange={(icon) => onUpdateProject(project.id, { ...getProjectDraft(), icon })}
            testId={`${testIdPrefix}-icon-trigger`}
          />
        </div>
        <Input
          data-testid={`${testIdPrefix}-name-row`}
          id={`${testIdPrefix}-name`}
          value={name}
          onChange={(event) => setName(event.target.value)}
          onBlur={() => onUpdateProject(project.id, getProjectDraft())}
          className="h-auto border-0 bg-transparent px-0 text-3xl font-bold shadow-none focus-visible:ring-0"
          aria-label="Project name"
        />
        <div className="space-y-1.5" data-testid={`${testIdPrefix}-description-row`}>
          <p
            data-testid={`${testIdPrefix}-description-label`}
            className="text-sm font-medium text-muted-foreground"
          >
            Description
          </p>
          <ProjectDescriptionEditor
            ref={descriptionEditorRef}
            initialContent={initialDescription}
            onSave={(markdown) =>
              onUpdateProject(project.id, {
                ...getProjectDraft(),
                description: markdown
              })
            }
            testId={`${testIdPrefix}-description-editor`}
            vimModeEnabled={vimModeEnabled}
            vimKeyMappings={vimKeyMappings}
          />
        </div>
      </div>
    </div>
  )
}

function ProjectPropertiesPanel({
  project,
  availableTags,
  favorite,
  onToggleFavorite,
  onToggleArchive,
  onUpdateProperties
}: {
  project: Project | null
  availableTags: readonly string[]
  favorite: boolean
  onToggleFavorite: () => void
  onToggleArchive: () => void
  onUpdateProperties: (patch: ProjectPropertiesPatch) => void
}): ReactElement {
  if (!project) {
    return (
      <CollapsibleWorkspacePanelSection
        data-testid="project-properties-panel"
        heading="Project properties"
      />
    )
  }

  return (
    <CollapsibleWorkspacePanelSection
      data-testid="project-properties-panel"
      heading="Project properties"
    >
      <div data-testid="project-property-rows">
        <WorkspacePropertyRow label="Health" testId="project-property-health">
          <StatusChip
            item={getProjectUpdateStatusChipItem(getLatestProjectUpdate(project.updates)?.status)}
            surface="pill"
            className="text-xs"
            data-testid="project-property-health-status"
          />
        </WorkspacePropertyRow>
        <WorkspacePropertyRow label="Tags" testId="project-property-tags">
          <TagEditor
            value={project.tags ?? []}
            availableTags={availableTags}
            onChange={(tags) => onUpdateProperties({ tags })}
            label="Project tags"
            testId="project-tags-editor"
            className="min-w-0 flex-wrap"
          />
        </WorkspacePropertyRow>
        <WorkspacePropertyRow label="Favorite" testId="project-property-favorite">
          <StatusChipSelect
            label="Project favorite"
            value={favorite ? 'favorite' : 'not-favorite'}
            options={PROJECT_FAVORITE_CHIP_OPTIONS}
            surface="pill"
            data-testid="project-favorite-button"
            onValueChange={(value) => {
              if (value !== 'favorite' && value !== 'not-favorite') return
              if ((value === 'favorite') !== favorite) onToggleFavorite()
            }}
          />
        </WorkspacePropertyRow>
        <WorkspacePropertyRow label="Archive" testId="project-property-archive">
          <StatusChipSelect
            label="Project archive state"
            value={project.state}
            options={PROJECT_STATE_CHIP_OPTIONS}
            surface="pill"
            data-testid="project-archive-button"
            onValueChange={(value) => {
              if (value !== project.state) {
                onToggleArchive()
              }
            }}
          />
        </WorkspacePropertyRow>
        <WorkspacePropertyRow label="Start Date" testId="project-property-start-date">
          <ProjectDateValue
            value={project.startDate}
            placeholder="Set start date"
            ariaLabel="Project start date"
            testId="project-property-start-date-group"
            onChange={(value) => {
              if (value && project.endDate && value > project.endDate) return
              onUpdateProperties({ startDate: value || null })
            }}
            onClear={() => onUpdateProperties({ startDate: null })}
          />
        </WorkspacePropertyRow>
        <WorkspacePropertyRow label="End Date" testId="project-property-end-date">
          <ProjectDateValue
            value={project.endDate}
            placeholder="Set end date"
            ariaLabel="Project end date"
            testId="project-property-end-date-group"
            onChange={(value) => {
              if (value && project.startDate && value < project.startDate) return
              onUpdateProperties({ endDate: value || null })
            }}
            onClear={() => onUpdateProperties({ endDate: null })}
          />
        </WorkspacePropertyRow>
      </div>
    </CollapsibleWorkspacePanelSection>
  )
}

function ProjectDateValue({
  value,
  placeholder,
  ariaLabel,
  testId,
  onChange,
  onClear
}: {
  value?: string
  placeholder: string
  ariaLabel: string
  testId: string
  onChange: (value: string | undefined) => void
  onClear: () => void
}): ReactElement {
  return (
    <ChipGroup aria-label={ariaLabel} data-testid={testId}>
      <CalendarDateEditPopover
        value={value}
        label={ariaLabel}
        onValueChange={onChange}
        placeholder={placeholder}
        variant="ghost"
        aria-label={ariaLabel}
        className="h-7 w-fit rounded-none px-2"
      />
      {value ? (
        <WorkspaceIconButton
          data-testid={`${testId}-clear`}
          aria-label={`Clear ${ariaLabel.toLowerCase()}`}
          title={`Clear ${ariaLabel.toLowerCase()}`}
          icon={<X size={14} aria-hidden="true" />}
          className="h-7 w-7 rounded-none border-0 p-1.5"
          onClick={onClear}
        />
      ) : null}
    </ChipGroup>
  )
}

function ProjectMilestones({
  projectId,
  milestones,
  tasks,
  expandedMilestoneIds,
  isCreatingMilestone,
  isCreatingTask,
  editingMilestoneId,
  milestoneEditToken,
  onCreateMilestone,
  onCreateTask,
  onToggleMilestone,
  onUpdateMilestone,
  onOpenMilestoneDialog,
  onOpenTask,
  onDuplicateTask,
  onUpdateTask,
  onDeleteTask,
  onDeleteMilestone,
  onReorderMilestones
}: {
  projectId: string
  milestones: ProjectMilestone[]
  tasks: CalendarTask[]
  expandedMilestoneIds: Set<string>
  isCreatingMilestone: boolean
  isCreatingTask: boolean
  editingMilestoneId: string | null
  milestoneEditToken: number
  onCreateMilestone: () => void
  onCreateTask: (milestoneId: string) => void
  onToggleMilestone: (milestoneId: string) => void
  onUpdateMilestone: (milestoneId: string, title: string) => void
  onOpenMilestoneDialog: (milestoneId: string) => void
  onOpenTask: (taskId: string, options?: TaskOpenOptions) => void
  onDuplicateTask?: (taskId: string) => void | Promise<void>
  onUpdateTask: (taskId: string, patch: Partial<CalendarTask>) => void
  onDeleteTask: (taskId: string) => void
  onDeleteMilestone: (milestoneId: string) => boolean
  onReorderMilestones: (milestoneIds: string[]) => Promise<boolean>
}): ReactElement {
  const [pendingOrderIds, setPendingOrderIds] = useState<string[] | null>(null)
  const [draggedMilestoneId, setDraggedMilestoneId] = useState<string | null>(null)
  const [dragOverMilestoneId, setDragOverMilestoneId] = useState<string | null>(null)
  const [isPersistingOrder, setIsPersistingOrder] = useState(false)
  const [reorderAnnouncement, setReorderAnnouncement] = useState('')
  const initialOrderRef = useRef<ProjectMilestone[]>(milestones)
  const dropCommittedRef = useRef(false)
  const milestoneListRef = useRef<HTMLUListElement | null>(null)
  const orderedMilestones = useMemo(() => {
    if (!pendingOrderIds) {
      return milestones
    }

    const milestonesById = new Map(milestones.map((milestone) => [milestone.id, milestone]))
    const nextMilestones = pendingOrderIds.flatMap((milestoneId) => {
      const milestone = milestonesById.get(milestoneId)
      return milestone ? [milestone] : []
    })
    return nextMilestones.length === milestones.length ? nextMilestones : milestones
  }, [milestones, pendingOrderIds])

  const orderedMilestoneIds = useMemo(
    () => orderedMilestones.map((milestone) => milestone.id),
    [orderedMilestones]
  )
  const milestoneMotionRef = useReorderMotion(orderedMilestoneIds)

  const persistOrder = useCallback(
    async (nextMilestones: ProjectMilestone[]): Promise<void> => {
      if (hasSameProjectMilestoneOrder(nextMilestones, initialOrderRef.current)) {
        setPendingOrderIds(null)
        return
      }

      setIsPersistingOrder(true)
      const persisted = await onReorderMilestones(getProjectMilestoneIds(nextMilestones))
      setIsPersistingOrder(false)
      setPendingOrderIds(null)
      if (!persisted) {
        setReorderAnnouncement('Milestone order could not be saved.')
      }
    },
    [onReorderMilestones]
  )

  const applyPreviewOrder = useCallback(
    (nextMilestones: ProjectMilestone[]): void => {
      if (hasSameProjectMilestoneOrder(nextMilestones, orderedMilestones)) {
        return
      }

      setPendingOrderIds(getProjectMilestoneIds(nextMilestones))
      const movedMilestone = nextMilestones.find((item) => item.id === draggedMilestoneId)
      const nextIndex = nextMilestones.findIndex((item) => item.id === draggedMilestoneId)
      if (movedMilestone && nextIndex >= 0) {
        setReorderAnnouncement(
          `${movedMilestone.title} moved to position ${nextIndex + 1} of ${nextMilestones.length}.`
        )
      }
    },
    [draggedMilestoneId, orderedMilestones]
  )

  const completeDrop = useCallback(
    (nextMilestones: ProjectMilestone[]): void => {
      dropCommittedRef.current = true
      setPendingOrderIds(getProjectMilestoneIds(nextMilestones))
      setDraggedMilestoneId(null)
      setDragOverMilestoneId(null)
      void persistOrder(nextMilestones)
    },
    [persistOrder]
  )

  const getOutsideBoundary = useCallback(
    (clientX: number, clientY: number): MilestoneDropBoundary | null => {
      const bounds = milestoneListRef.current?.getBoundingClientRect()
      if (!bounds || bounds.width === 0 || bounds.height === 0) {
        return null
      }

      const horizontalPadding = 48
      if (clientX < bounds.left - horizontalPadding || clientX > bounds.right + horizontalPadding) {
        return null
      }
      if (clientY < bounds.top) {
        return 'top'
      }
      if (clientY > bounds.bottom) {
        return 'bottom'
      }
      return null
    },
    []
  )

  const getDropOrder = useCallback(
    (event: ReactDragEvent<HTMLElement>, targetMilestoneId: string): ProjectMilestone[] => {
      if (!draggedMilestoneId) {
        return orderedMilestones
      }

      const sourceIndex = orderedMilestones.findIndex(
        (milestone) => milestone.id === draggedMilestoneId
      )
      const targetIndex = orderedMilestones.findIndex(
        (milestone) => milestone.id === targetMilestoneId
      )
      if (sourceIndex < 0 || targetIndex < 0) {
        return orderedMilestones
      }

      const bounds = event.currentTarget.getBoundingClientRect()
      const isAfterTarget = event.clientY > bounds.top + bounds.height / 2
      let insertionIndex = targetIndex + (isAfterTarget ? 1 : 0)
      if (sourceIndex < insertionIndex) {
        insertionIndex -= 1
      }

      return moveProjectMilestone(orderedMilestones, draggedMilestoneId, insertionIndex)
    },
    [draggedMilestoneId, orderedMilestones]
  )

  const handleDragStart = (event: ReactDragEvent<HTMLElement>, milestoneId: string): void => {
    if (isPersistingOrder) {
      event.preventDefault()
      return
    }

    const milestone = orderedMilestones.find((item) => item.id === milestoneId)
    initialOrderRef.current = orderedMilestones
    dropCommittedRef.current = false
    setDraggedMilestoneId(milestoneId)
    setDragOverMilestoneId(milestoneId)
    setReorderAnnouncement(
      `${milestone?.title ?? 'Milestone'} grabbed. Move vertically to reorder.`
    )
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', milestoneId)
  }

  const handleDragOver = (event: ReactDragEvent<HTMLElement>, milestoneId: string): void => {
    if (!draggedMilestoneId) {
      return
    }

    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setDragOverMilestoneId(milestoneId)
    const nextMilestones = getDropOrder(event, milestoneId)
    applyPreviewOrder(nextMilestones)
  }

  useEffect(() => {
    if (!draggedMilestoneId) {
      return
    }

    const getBoundaryOrder = (boundary: MilestoneDropBoundary): ProjectMilestone[] =>
      moveProjectMilestone(
        orderedMilestones,
        draggedMilestoneId,
        boundary === 'top' ? 0 : orderedMilestones.length - 1
      )

    const handleBoundaryDragOver = (event: DragEvent): void => {
      const boundary = getOutsideBoundary(event.clientX, event.clientY)
      if (!boundary) {
        return
      }

      event.preventDefault()
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'move'
      }
      setDragOverMilestoneId(
        boundary === 'top'
          ? (orderedMilestones[0]?.id ?? null)
          : (orderedMilestones[orderedMilestones.length - 1]?.id ?? null)
      )
      applyPreviewOrder(getBoundaryOrder(boundary))
    }

    const handleBoundaryDrop = (event: DragEvent): void => {
      const boundary = getOutsideBoundary(event.clientX, event.clientY)
      if (!boundary) {
        return
      }

      event.preventDefault()
      completeDrop(getBoundaryOrder(boundary))
    }

    window.addEventListener('dragover', handleBoundaryDragOver, true)
    window.addEventListener('drop', handleBoundaryDrop, true)
    return () => {
      window.removeEventListener('dragover', handleBoundaryDragOver, true)
      window.removeEventListener('drop', handleBoundaryDrop, true)
    }
  }, [applyPreviewOrder, completeDrop, draggedMilestoneId, getOutsideBoundary, orderedMilestones])

  const handleDrop = (event: ReactDragEvent<HTMLElement>, milestoneId: string): void => {
    if (!draggedMilestoneId) {
      return
    }

    event.preventDefault()
    const nextMilestones = getDropOrder(event, milestoneId)
    completeDrop(nextMilestones)
  }

  const handleDragEnd = (): void => {
    if (!dropCommittedRef.current) {
      setPendingOrderIds(null)
      setReorderAnnouncement('Milestone reordering cancelled.')
    }
    dropCommittedRef.current = false
    setDraggedMilestoneId(null)
    setDragOverMilestoneId(null)
  }

  const handleKeyboardMove = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    milestoneId: string
  ): void => {
    if (isPersistingOrder || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    const currentIndex = orderedMilestones.findIndex((milestone) => milestone.id === milestoneId)
    const direction = event.key === 'ArrowUp' ? -1 : 1
    const targetIndex = currentIndex + direction
    const milestone = orderedMilestones[currentIndex]
    if (!milestone || targetIndex < 0 || targetIndex >= orderedMilestones.length) {
      setReorderAnnouncement(
        `${milestone?.title ?? 'Milestone'} is already ${direction < 0 ? 'first' : 'last'}.`
      )
      return
    }

    initialOrderRef.current = orderedMilestones
    const nextMilestones = moveProjectMilestone(orderedMilestones, milestoneId, targetIndex)
    setPendingOrderIds(getProjectMilestoneIds(nextMilestones))
    setReorderAnnouncement(
      `${milestone.title} moved to position ${targetIndex + 1} of ${nextMilestones.length}.`
    )
    void persistOrder(nextMilestones)
  }

  return (
    <section aria-labelledby="project-milestones-heading" className="space-y-3">
      <div className="flex items-center justify-between pt-4">
        <h2 id="project-milestones-heading" className="text-sm font-medium text-muted-foreground">
          Project Milestones
        </h2>
        <span className="text-xs text-muted-foreground">
          {milestones.length} {milestones.length === 1 ? 'milestone' : 'milestones'}
        </span>
      </div>
      {milestones.length > 0 ? (
        <ul
          ref={milestoneListRef}
          className="list-none"
          data-testid="project-milestones"
          data-drag-boundary-active={draggedMilestoneId ? 'true' : 'false'}
        >
          {orderedMilestones.map((milestone) => (
            <ProjectMilestoneRow
              key={milestone.id}
              motionRef={milestoneMotionRef(milestone.id)}
              projectId={projectId}
              milestone={milestone}
              status={getProjectMilestoneStatus(milestone, milestones, tasks, projectId)}
              tasks={tasks}
              expanded={expandedMilestoneIds.has(milestone.id)}
              editToken={editingMilestoneId === milestone.id ? milestoneEditToken : 0}
              isCreatingTask={isCreatingTask}
              onCreateTask={onCreateTask}
              onToggle={() => onToggleMilestone(milestone.id)}
              onEdit={() => onOpenMilestoneDialog(milestone.id)}
              onUpdateMilestone={onUpdateMilestone}
              onOpenTask={onOpenTask}
              onDuplicateTask={onDuplicateTask}
              onUpdateTask={onUpdateTask}
              onDeleteTask={onDeleteTask}
              onDeleteMilestone={() => onDeleteMilestone(milestone.id)}
              isDragging={draggedMilestoneId === milestone.id}
              isDragOver={dragOverMilestoneId === milestone.id}
              isReordering={isPersistingOrder}
              onDragStart={(event) => handleDragStart(event, milestone.id)}
              onDragOver={(event) => handleDragOver(event, milestone.id)}
              onDrop={(event) => handleDrop(event, milestone.id)}
              onDragEnd={handleDragEnd}
              onMoveKeyboard={(event) => handleKeyboardMove(event, milestone.id)}
            />
          ))}
        </ul>
      ) : null}
      <span className="sr-only" aria-live="polite">
        {reorderAnnouncement}
      </span>
      <div className="py-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full justify-start px-2 text-muted-foreground hover:bg-transparent hover:text-foreground"
          onClick={onCreateMilestone}
          disabled={isCreatingMilestone}
          aria-label="Add new milestone"
        >
          <Plus size={14} /> {isCreatingMilestone ? 'Adding…' : 'Add new milestone'}
        </Button>
      </div>
    </section>
  )
}

function ProjectMilestoneRow({
  motionRef,
  projectId,
  milestone,
  status,
  tasks,
  expanded,
  editToken,
  isCreatingTask,
  onCreateTask,
  onToggle,
  onEdit,
  onUpdateMilestone,
  onOpenTask,
  onDuplicateTask,
  onUpdateTask,
  onDeleteTask,
  onDeleteMilestone,
  isDragging,
  isDragOver,
  isReordering,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onMoveKeyboard
}: {
  motionRef: (node: HTMLElement | null) => void
  projectId: string
  milestone: ProjectMilestone
  status: ProjectMilestoneStatus
  tasks: CalendarTask[]
  expanded: boolean
  editToken: number
  isCreatingTask: boolean
  onCreateTask: (milestoneId: string) => void
  onToggle: () => void
  onEdit: () => void
  onUpdateMilestone: (milestoneId: string, title: string) => void
  onOpenTask: (taskId: string, options?: TaskOpenOptions) => void
  onDuplicateTask?: (taskId: string) => void | Promise<void>
  onUpdateTask: (taskId: string, patch: Partial<CalendarTask>) => void
  onDeleteTask: (taskId: string) => void
  onDeleteMilestone: () => void
  isDragging: boolean
  isDragOver: boolean
  isReordering: boolean
  onDragStart: (event: ReactDragEvent<HTMLElement>) => void
  onDragOver: (event: ReactDragEvent<HTMLElement>) => void
  onDrop: (event: ReactDragEvent<HTMLElement>) => void
  onDragEnd: () => void
  onMoveKeyboard: (event: ReactKeyboardEvent<HTMLButtonElement>) => void
}): ReactElement {
  const milestoneTasks = getProjectMilestoneTasks(tasks, projectId, milestone.id)
  const progress = getProjectMilestoneProgress(milestoneTasks)
  const completionPercent =
    progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0

  const stopRowInteraction = (event: SyntheticEvent): void => {
    event.stopPropagation()
  }
  const milestoneContainerRef = useRef<HTMLElement | null>(null)

  return (
    <li
      ref={motionRef}
      className={cn('relative', isDragging && 'opacity-0')}
      data-testid={`project-milestone-row:${milestone.id}`}
      data-dragging={isDragging ? 'true' : 'false'}
      data-drag-over={isDragOver ? 'true' : 'false'}
    >
      <DropZone
        ref={milestoneContainerRef}
        variant="row"
        active={isDragOver}
        disabled={!isDragging && isReordering}
        className="relative overflow-visible rounded-[var(--radius-button)] px-2 py-1 transition-colors motion-reduce:transition-none"
        data-expanded={expanded}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        <ProjectMilestoneContextMenu
          milestone={milestone}
          expanded={expanded}
          isCreatingTask={isCreatingTask}
          onCreateTask={() => onCreateTask(milestone.id)}
          onEdit={onEdit}
          onToggle={onToggle}
          onDelete={onDeleteMilestone}
        >
          <div
            className="group/milestone-header relative rounded-[var(--radius-button)] border border-transparent bg-transparent px-2 py-1 group-hover/milestone-header:bg-muted"
            data-testid={`project-milestone-open:${milestone.id}`}
          >
            <button
              type="button"
              className={cn(
                'absolute inset-0 z-0 rounded-[var(--radius-button)] border border-transparent bg-transparent text-left outline-none transition-colors',
                isDragOver ? 'bg-[var(--drop-zone-active-bg)]' : 'hover:bg-muted',
                'focus-visible:border-border focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring'
              )}
              onClick={onToggle}
              aria-label={`${expanded ? 'Collapse' : 'Expand'} milestone: ${milestone.title}`}
              aria-expanded={expanded}
              aria-controls={`project-milestone-content:${milestone.id}`}
              data-testid={`project-milestone-toggle:${milestone.id}`}
            >
              <span className="sr-only">{milestone.title}</span>
            </button>
            <DragSource
              as="button"
              type="button"
              draggable={!isReordering}
              disabled={isReordering}
              tabIndex={0}
              preview="floating"
              previewTargetRef={milestoneContainerRef}
              previewAxis="y"
              previewMotion="smooth"
              previewElevation="strong"
              hideFromPreview
              className={cn(
                rowActionButtonClassName,
                'pointer-events-auto absolute -left-6 top-1/2 z-20 flex size-7 -translate-y-1/2 items-center justify-center rounded-full border-0 p-0 opacity-0 transition-opacity group-hover/milestone-header:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[dragging=true]:opacity-100 motion-reduce:transition-none'
              )}
              onPointerDown={stopRowInteraction}
              onClick={stopRowInteraction}
              onKeyDown={onMoveKeyboard}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              aria-label={`Reorder milestone: ${milestone.title}`}
              aria-keyshortcuts="ArrowUp ArrowDown"
              title="Drag vertically to reorder, or use Arrow Up and Arrow Down"
              data-testid={`project-milestone-reorder-handle:${milestone.id}`}
            >
              <GripVertical size={16} aria-hidden="true" />
            </DragSource>
            <div className="pointer-events-none relative z-10 flex min-w-0 items-center gap-2">
              <div
                className="pointer-events-auto shrink-0 cursor-pointer px-1"
                onClick={(event) => {
                  stopRowInteraction(event)
                  onToggle()
                }}
              >
                <MilestoneCompletenessIcon
                  status={status}
                  size={18}
                  dataTestId={`project-milestone-icon:${milestone.id}`}
                />
              </div>
              <div className="flex min-w-0 flex-1 items-center gap-1 px-1 py-1 text-left">
                <div
                  className="pointer-events-auto min-w-0 w-fit max-w-full shrink"
                  onClick={stopRowInteraction}
                >
                  <InlineEditableText
                    value={milestone.title}
                    onCommit={(title) => onUpdateMilestone(milestone.id, title)}
                    displayClassName="block w-full min-w-0 text-base font-semibold text-foreground hover:text-primary"
                    inputClassName="inline-block h-8 w-auto max-w-full min-w-0 rounded-none border-0 bg-transparent px-0 text-base font-semibold text-foreground shadow-none outline-none focus-visible:border-0 focus-visible:bg-transparent focus-visible:outline-none focus-visible:ring-0"
                    title={`Edit milestone: ${milestone.title}`}
                    fitInputToContent
                    editToken={editToken}
                  />
                </div>
                <div className="flex shrink-0 items-center" aria-hidden="true">
                  <ChevronRight
                    className={cn('motion-state-chevron size-3.5', expanded && 'rotate-90')}
                  />
                </div>
              </div>
              <div className="ml-auto flex shrink-0 items-center gap-2">
                <div
                  className="pointer-events-none flex items-center gap-1.5 opacity-0 transition-opacity motion-reduce:transition-none group-hover/milestone-header:opacity-100"
                  data-testid={`project-milestone-progress:${milestone.id}`}
                  aria-label={`Milestone progress: ${completionPercent}%`}
                >
                  <ProgressRing
                    value={completionPercent}
                    data-testid={`project-milestone-progress-ring:${milestone.id}`}
                  />
                  <span className="whitespace-nowrap text-xs text-muted-foreground">
                    {completionPercent}%
                  </span>
                </div>
                <Button
                  type="button"
                  variant="rowAction"
                  size="icon"
                  shape="pill"
                  className="pointer-events-auto size-7 shrink-0 opacity-0 transition-opacity group-hover/milestone-header:opacity-100 motion-reduce:transition-none"
                  onPointerDown={stopRowInteraction}
                  onClick={(event) => {
                    stopRowInteraction(event)
                    onCreateTask(milestone.id)
                  }}
                  disabled={isCreatingTask}
                  aria-label={`Add task to milestone: ${milestone.title}`}
                  title="Add task to milestone"
                  data-testid={`project-milestone-add-task-icon:${milestone.id}`}
                >
                  <Plus size={14} aria-hidden="true" />
                </Button>
              </div>
            </div>
          </div>
        </ProjectMilestoneContextMenu>
        <div
          id={`project-milestone-content:${milestone.id}`}
          className="motion-milestone-content"
          data-state={expanded ? 'open' : 'closed'}
          data-testid={`project-milestone-children:${milestone.id}`}
          aria-hidden={!expanded}
          inert={!expanded}
        >
          <div className="ml-[21px] border-l border-border pl-3">
            {milestoneTasks.length > 0 ? (
              <ul className="list-none">
                {milestoneTasks.map((task) => (
                  <TaskDetailRow
                    key={task.id}
                    task={task}
                    isParentDropActive={isDragOver}
                    onUpdateTask={onUpdateTask}
                    onDeleteTask={onDeleteTask}
                    onDuplicateTask={onDuplicateTask}
                    onOpenTask={onOpenTask}
                  />
                ))}
              </ul>
            ) : (
              <p className="px-2 py-2 text-xs text-muted-foreground">No tasks in this milestone.</p>
            )}
          </div>
        </div>
      </DropZone>
    </li>
  )
}

function ProjectTasks({
  tasks,
  onCreateTask,
  isCreatingTask,
  onUpdateTask,
  onDeleteTask,
  onDuplicateTask,
  onOpenTask
}: {
  tasks: CalendarTask[]
  onCreateTask: () => void
  isCreatingTask: boolean
  onUpdateTask: (taskId: string, patch: Partial<CalendarTask>) => void
  onDeleteTask: (taskId: string) => void
  onDuplicateTask?: (taskId: string) => void | Promise<void>
  onOpenTask: (taskId: string, options?: TaskOpenOptions) => void
}): ReactElement {
  return (
    <section aria-labelledby="project-tasks-heading" className="space-y-3">
      <div className="border-t border-border pt-3">
        <h2 id="project-tasks-heading" className="text-sm font-medium text-muted-foreground">
          Project Tasks
        </h2>
      </div>
      <ul className="list-none">
        {tasks.map((task) => (
          <TaskDetailRow
            key={task.id}
            task={task}
            onUpdateTask={onUpdateTask}
            onDeleteTask={onDeleteTask}
            onDuplicateTask={onDuplicateTask}
            onOpenTask={onOpenTask}
          />
        ))}
      </ul>
      <div className="py-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full justify-start px-2 text-muted-foreground hover:bg-transparent hover:text-foreground"
          onClick={() => void onCreateTask()}
          disabled={isCreatingTask}
        >
          <Plus size={14} /> {isCreatingTask ? 'Adding…' : 'Add new task'}
        </Button>
      </div>
    </section>
  )
}

export function TaskDetailRow({
  task,
  onUpdateTask,
  onDeleteTask,
  onDuplicateTask,
  onOpenTask,
  isParentDropActive = false
}: {
  task: CalendarTask
  onUpdateTask: (taskId: string, patch: Partial<CalendarTask>) => void
  onDeleteTask: (taskId: string) => void
  onDuplicateTask?: (taskId: string) => void | Promise<void>
  onOpenTask: (taskId: string) => void
  isParentDropActive?: boolean
}): ReactElement {
  const status = getTaskStatus(task.status, task.completed)
  const hasStartSchedule = Boolean(task.date || task.time)
  const hasEndSchedule = Boolean(task.endDate || task.endTime)

  const stopRowInteraction = (event: SyntheticEvent): void => {
    event.stopPropagation()
  }

  const openContextMenu = (event: MouseEvent<HTMLButtonElement>): void => {
    stopRowInteraction(event)
    const bounds = event.currentTarget.getBoundingClientRect()
    event.currentTarget.dispatchEvent(
      new window.MouseEvent('contextmenu', {
        bubbles: true,
        button: 2,
        clientX: bounds.left,
        clientY: bounds.bottom
      })
    )
  }

  return (
    <TaskContextMenu
      task={task}
      onDuplicateTask={onDuplicateTask}
      onDelete={onDeleteTask}
      onUpdateStatus={(taskId, nextStatus) =>
        onUpdateTask(taskId, {
          status: nextStatus,
          completed: isTaskStatusDone(nextStatus)
        })
      }
      onUpdatePriority={(taskId, priority) => onUpdateTask(taskId, { priority })}
      onUpdateTaskType={(taskId, taskType) => onUpdateTask(taskId, { taskType })}
      onUpdateTime={(taskId, time) => onUpdateTask(taskId, { time })}
      onUpdateReminders={(taskId, reminders) => onUpdateTask(taskId, { reminders })}
      onUnscheduleTask={(taskId) => onUpdateTask(taskId, { date: undefined, endDate: undefined })}
    >
      <li
        className="group relative rounded-[var(--radius-button)] px-2 py-1 data-[parent-drop-active=true]:bg-[var(--drop-zone-active-bg)]"
        data-parent-drop-active={isParentDropActive ? 'true' : 'false'}
        data-testid={`project-task-row:${task.id}`}
      >
        <button
          type="button"
          className={cn(
            'absolute inset-0 z-0 rounded-[var(--radius-button)] border border-transparent bg-transparent text-left outline-none transition-colors',
            isParentDropActive ? 'bg-[var(--drop-zone-active-bg)]' : 'group-hover:bg-muted',
            'focus-visible:border-border focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring'
          )}
          onClick={() => onOpenTask(task.id)}
          aria-label={`Open task: ${task.title}`}
          data-testid={`project-task-open:${task.id}`}
        >
          <span className="sr-only">{task.title}</span>
        </button>
        <div className="pointer-events-none relative z-10 flex min-w-0 items-center gap-2">
          <StatusChipSelect
            className="pointer-events-auto shrink-0 w-32 p-0"
            label={`Status for ${task.title}`}
            value={status}
            options={TASK_STATUS_CHIP_OPTIONS}
            data-testid={`project-task-status-chip:${task.id}`}
            onPointerDown={stopRowInteraction}
            onClick={stopRowInteraction}
            onValueChange={(value) => {
              const nextStatus = value as TaskStatus
              onUpdateTask(task.id, {
                status: nextStatus,
                completed: isTaskStatusDone(nextStatus)
              })
            }}
          />
          <div className="flex min-w-0 flex-1 items-center gap-2 px-1 py-1 text-left">
            <WorkspaceTextFade className="min-w-0 flex-1 text-base font-semibold text-foreground">
              {task.title}
            </WorkspaceTextFade>
          </div>
          {hasStartSchedule || hasEndSchedule ? (
            <div
              className="pointer-events-none hidden min-w-max flex-none items-center gap-0.5 sm:flex"
              data-testid={`project-task-schedule:${task.id}`}
            >
              {hasStartSchedule ? (
                <>
                  <TaskScheduleChip
                    taskId={task.id}
                    field="start-date"
                    label="Start date"
                    value={task.date}
                    kind="date"
                  />
                  <TaskScheduleChip
                    taskId={task.id}
                    field="start-time"
                    label="Start time"
                    value={task.time}
                    kind="time"
                  />
                </>
              ) : null}
              {hasStartSchedule && hasEndSchedule ? (
                <span aria-hidden="true" className="px-0.5 text-muted-foreground">
                  →
                </span>
              ) : null}
              {hasEndSchedule ? (
                <>
                  <TaskScheduleChip
                    taskId={task.id}
                    field="end-date"
                    label={hasStartSchedule ? 'End date' : 'Due date'}
                    value={task.endDate}
                    kind="date"
                  />
                  <TaskScheduleChip
                    taskId={task.id}
                    field="end-time"
                    label={hasStartSchedule ? 'End time' : 'Due time'}
                    value={task.endTime}
                    kind="time"
                  />
                </>
              ) : null}
            </div>
          ) : null}
          <Button
            className="pointer-events-auto shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 motion-reduce:transition-none"
            type="button"
            variant="rowAction"
            size="icon"
            onPointerDown={stopRowInteraction}
            onClick={openContextMenu}
            aria-label={`Open actions for task: ${task.title}`}
            title="Open task actions"
            data-testid={`project-task-menu:${task.id}`}
          >
            <MoreHorizontal size={14} aria-hidden="true" />
          </Button>
        </div>
      </li>
    </TaskContextMenu>
  )
}

function TaskScheduleChip({
  taskId,
  field,
  label,
  value,
  kind
}: {
  taskId: string
  field: 'start-date' | 'start-time' | 'end-date' | 'end-time'
  label: string
  value?: string
  kind: 'date' | 'time'
}): ReactElement | null {
  if (!value) return null

  const formattedValue =
    kind === 'date' ? formatCalendarDateValue(value) : formatCalendarTimeValue(value)
  const Icon = kind === 'date' ? CalendarCheck : ClockCheck

  return (
    <StatusChip
      item={{
        label: formattedValue,
        icon: <Icon aria-hidden="true" />,
        iconColorToken: 'var(--muted-foreground)'
      }}
      surface="hover"
      className="group-hover:bg-card-hover pointer-events-none min-w-max max-w-none flex-none"
      data-testid={`project-task-schedule-chip:${taskId}:${field}`}
      title={`${label}: ${formattedValue}`}
      aria-label={`${label}: ${formattedValue}`}
    />
  )
}
