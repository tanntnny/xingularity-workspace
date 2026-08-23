import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ProjectDescriptionEditor } from '../src/renderer/src/components/ProjectDescriptionEditor'
import {
  ProjectsWorkspacePage,
  ProjectsWorkspaceRightPanel,
  ProjectsWorkspaceSecondaryActions
} from '../src/renderer/src/pages/ProjectsWorkspacePage'
import { normalizeResourceInput, notebookResourceUri } from '../src/shared/resourceDomain'
import type {
  CalendarTask,
  NoteTreeNode,
  Project,
  ProjectMilestone,
  ResourceRef
} from '../src/shared/types'

const project: Project = {
  id: 'project-1',
  name: 'Alpha Project',
  description: '',
  summary: '',
  state: 'active',
  updatedAt: '2026-08-20T00:00:00.000Z',
  icon: { variant: 'filled', color: '#2563eb' },
  milestones: []
}

const task: CalendarTask = {
  id: 'task-1',
  title: 'Plan launch',
  projectId: project.id,
  tags: [],
  completed: false,
  status: 'pending',
  createdAt: '2026-08-20T00:00:00.000Z',
  priority: 'medium',
  reminders: []
}

const milestone: ProjectMilestone = {
  id: 'milestone-1',
  title: 'Launch',
  createdAt: '2026-08-20T00:00:00.000Z',
  updatedAt: '2026-08-20T00:00:00.000Z'
}

const notebookTree: NoteTreeNode[] = [
  {
    id: 'folder:Projects/Alpha Project',
    kind: 'folder',
    relPath: 'Projects/Alpha Project',
    name: 'Alpha Project',
    isLinked: false,
    children: []
  }
]

function renderProjectsPage(
  view: 'list' | 'home' | 'resources' = 'list',
  projectToRender: Project = project,
  resources: ResourceRef[] = [],
  googleDriveEnabled = false,
  tasksToRender: CalendarTask[] = [task],
  favoriteProjectIds: string[] = []
): string {
  return renderToStaticMarkup(
    createElement(ProjectsWorkspacePage, {
      projects: [projectToRender],
      tasks: tasksToRender,
      favoriteProjectIds,
      selectedProjectId: view === 'list' ? null : projectToRender.id,
      view,
      filterMode: 'all',
      onFilterModeChange: () => undefined,
      onUpdateProjectProperties: () => undefined,
      onOpenProject: () => undefined,
      onOpenProjectUpdates: () => undefined,
      onCreateProjectUpdate: async () => undefined,
      onUpdateProjectUpdate: async () => undefined,
      onDeleteProjectUpdate: async () => undefined,
      noteTree: notebookTree,
      resources,
      relations: [],
      onAddResource: async () => undefined,
      onSetProjectNotebook: async () => undefined,
      onUpdateResource: async () => undefined,
      onDetachResource: async () => undefined,
      onOpenResource: async () => undefined,
      onOpenNotebookResource: () => undefined,
      googleDriveEnabled,
      notes: [],
      vimModeEnabled: false,
      vimKeyMappings: [],
      onOpenNoteLink: () => undefined,
      onCreateTask: async () => task,
      onCreateMilestone: async () => milestone,
      onUpdateMilestone: () => undefined,
      onDeleteMilestone: async () => undefined,
      onReorderMilestones: async () => true,
      onUpdateProject: () => undefined,
      onUpdateTask: () => undefined,
      onDeleteTask: () => undefined,
      onOpenTask: () => undefined
    })
  )
}

function renderProjectsList(): string {
  return renderProjectsPage('list')
}

function renderProjectsRightPanel(projectToRender: Project): string {
  return renderToStaticMarkup(
    createElement(ProjectsWorkspaceRightPanel, {
      projects: [projectToRender],
      favoriteProjectIds: [],
      selectedProjectId: projectToRender.id,
      onToggleProjectFavorite: () => undefined,
      onToggleProjectArchive: () => undefined,
      onUpdateProjectProperties: () => undefined
    })
  )
}

describe('Projects workspace list UI', () => {
  it('renders All Projects as an accessible Scheduling-style table', () => {
    const markup = renderProjectsPage('list', project, [], false, [task], [project.id])

    expect(markup).not.toContain('px-16')
    expect(markup).toContain('data-testid="all-projects-page"')
    expect(markup).toContain('id="all-projects-heading"')
    expect(markup).toContain('aria-label="Projects"')
    expect(markup).toContain('border-separate border-spacing-y-1')
    expect(markup).toMatch(/<button[^>]*aria-label="Open project Alpha Project"/)
    expect(markup).toContain('>Alpha Project</span>')
    expect(markup).toMatch(/<span class="sr-only">Favorite<\/span>/)
    expect(markup).toContain('tabler-icon-star-filled')
    expect(markup).toContain('text-[var(--status-chip-project-favorite-favorite-icon)]')
  })

  it('leaves the unlabeled favorite column empty for non-favorite projects', () => {
    const markup = renderProjectsPage('list')

    expect(markup).toMatch(/<span class="sr-only">Favorite<\/span>/)
    expect(markup).not.toContain('tabler-icon-star-filled')
  })

  it('renders the latest project update status in the Health column', () => {
    const projectWithUpdates: Project = {
      ...project,
      updates: [
        {
          id: 'health-old-update',
          projectId: project.id,
          markdown: 'Older update',
          status: 'on-track',
          createdAt: '2026-08-19T00:00:00.000Z',
          updatedAt: '2026-08-19T00:00:00.000Z'
        },
        {
          id: 'health-latest-update',
          projectId: project.id,
          markdown: 'Latest update',
          status: 'at-risk',
          createdAt: '2026-08-20T00:00:00.000Z',
          updatedAt: '2026-08-20T00:00:00.000Z'
        }
      ]
    }
    const markup = renderProjectsPage('list', projectWithUpdates)

    expect(markup).toContain('>Health</th>')
    expect(markup).toContain('data-testid="all-project-health:project-1"')
    expect(markup).toContain('>At risk</span>')
    expect(markup).toContain('hover:bg-card-hover')
    expect(markup).toContain(
      '--status-chip-label-color:var(--status-chip-task-status-in-progress-icon)'
    )
  })

  it('renders a muted No update chip when a project has no updates', () => {
    const markup = renderProjectsPage('list')

    expect(markup).toContain('>Health</th>')
    expect(markup).toContain('>No update</span>')
    expect(markup).toContain('data-testid="all-project-health:project-1"')
    expect(markup).toContain('tabler-icon-circle-dashed')
    expect(markup).toContain('hover:bg-card-hover')
  })

  it('uses compact progress rings and hover-only calendar pills in the project table', () => {
    const completedTask: CalendarTask = {
      ...task,
      completed: true,
      status: 'completed'
    }
    const datedProject: Project = {
      ...project,
      endDate: '2026-08-31'
    }
    const markup = renderProjectsPage('list', datedProject, [], false, [completedTask])

    expect(markup).toContain('>Project</th>')
    expect(markup).toContain('>Progress</th>')
    expect(markup).toContain('>End date</th>')
    expect(markup).toContain('>Updated</th>')
    expect(markup).not.toContain('>State</th>')
    expect(markup).not.toContain('>Attention</th>')
    expect(markup).toContain('data-testid="all-project-progress-ring:project-1"')
    expect(markup).toContain('width="20"')
    expect(markup).toContain('height="20"')
    expect(markup).toContain('text-border')
    expect(markup).toContain('text-progress')
    expect(markup).toContain('>100%</span>')
    expect(markup).toContain('data-testid="all-project-date-chip:end-date:project-1"')
    expect(markup).toContain('data-testid="all-project-date-chip:updated:project-1"')
    expect(markup).toContain('aria-haspopup="dialog"')
    expect(markup).toContain('aria-label="End date: Aug 31"')
    expect(markup).toContain('tabler-icon-calendar-check')
    expect(markup).toContain('rounded-[var(--radius-button-pill)]')
    expect(markup).toContain('bg-transparent')
    expect(markup).toContain('hover:bg-surface-subtle-hover')

    const missingEndDateMarkup = renderProjectsList()
    expect(missingEndDateMarkup).toContain('Set end date')
    expect(missingEndDateMarkup).toContain('tabler-icon-calendar-off')
  })

  it('shows the current milestone in the project cell instead of a separate column', () => {
    const completeMilestone = {
      ...milestone,
      title: 'Completed launch'
    }
    const currentMilestone: ProjectMilestone = {
      ...milestone,
      id: 'milestone-2',
      title: 'Current launch'
    }
    const currentProject: Project = {
      ...project,
      milestones: [completeMilestone, currentMilestone]
    }
    const completedTask: CalendarTask = {
      ...task,
      id: 'completed-task',
      milestoneId: completeMilestone.id,
      completed: true,
      status: 'completed'
    }
    const currentTask: CalendarTask = {
      ...task,
      id: 'current-task',
      milestoneId: currentMilestone.id
    }
    const markup = renderProjectsPage('list', currentProject, [], false, [
      completedTask,
      currentTask
    ])

    expect(markup).not.toContain('>Current milestone</th>')
    expect(markup).toContain('>Current launch</span>')
    expect(markup).toContain('data-testid="all-project-milestone-icon:project-1"')
    expect(markup).toContain('data-milestone-complete="false"')
    expect(markup).toContain('all-project-milestone-summary flex')
    expect(markup).toContain('text-muted-foreground')
    expect(markup).toContain('tabler-icon-diamonds shrink-0 text-milestone-current')
    expect(markup).not.toContain('>1/2</span>')

    const completeMarkup = renderProjectsPage(
      'list',
      { ...project, milestones: [completeMilestone] },
      [],
      false,
      [completedTask]
    )

    expect(completeMarkup).toContain('>Complete</span>')
    expect(completeMarkup).toContain('data-milestone-complete="true"')
    expect(completeMarkup).toContain('tabler-icon-diamonds-filled shrink-0 text-milestone-complete')
  })

  it('colors project milestone rows by completion and persisted order', () => {
    const completeMilestone = { ...milestone, id: 'milestone-complete', title: 'Completed launch' }
    const currentMilestone = { ...milestone, id: 'milestone-current', title: 'Current launch' }
    const unreachedMilestone = {
      ...milestone,
      id: 'milestone-unreached',
      title: 'Later launch'
    }
    const completedTask: CalendarTask = {
      ...task,
      id: 'completed-task',
      milestoneId: completeMilestone.id,
      completed: true,
      status: 'completed'
    }
    const currentTask: CalendarTask = {
      ...task,
      id: 'current-task',
      milestoneId: currentMilestone.id
    }
    const markup = renderProjectsPage(
      'home',
      {
        ...project,
        milestones: [completeMilestone, currentMilestone, unreachedMilestone]
      },
      [],
      false,
      [completedTask, currentTask]
    )
    const findIconTag = (milestoneId: string): string =>
      markup.match(
        new RegExp(`<svg[^>]*data-testid="project-milestone-icon:${milestoneId}"[^>]*>`)
      )?.[0] ?? ''

    expect(findIconTag(completeMilestone.id)).toContain('text-milestone-complete')
    expect(findIconTag(completeMilestone.id)).toContain('data-milestone-status="complete"')
    expect(findIconTag(currentMilestone.id)).toContain('text-milestone-current')
    expect(findIconTag(currentMilestone.id)).toContain('data-milestone-status="current"')
    expect(findIconTag(unreachedMilestone.id)).toContain('text-milestone-unreached')
    expect(findIconTag(unreachedMilestone.id)).toContain('data-milestone-status="unreached"')
  })

  it('renders an accessible six-dot reorder handle for each milestone', () => {
    const markup = renderProjectsPage('home', {
      ...project,
      milestones: [milestone]
    })

    expect(markup).toContain('data-testid="project-milestone-reorder-handle:milestone-1"')
    expect(markup).toContain('aria-label="Reorder milestone: Launch"')
    expect(markup).toContain('tabindex="0"')
    expect(markup).toContain('absolute -left-6 top-1/2 z-20')
    expect(markup).toContain(
      'opacity-0 transition-opacity group-hover/milestone-header:opacity-100'
    )
    expect(markup).toContain('focus-visible:opacity-100')
    expect(markup).toContain('data-drag-preview-target="custom"')
    expect(markup).toContain('data-drag-preview-axis="y"')
    expect(markup).toContain('data-drag-preview-motion="smooth"')
    expect(markup).toContain('data-drag-preview-elevation="strong"')
    expect(markup).toContain('data-drag-preview-ignore="true"')
    expect(markup).toContain('data-drag-preview-ignore')
    expect(markup).toContain('opacity-0')
    expect(markup).toContain('data-[drag-over=true]:shadow-sm')
    expect(markup).toContain('data-[parent-drop-active=true]:bg-[var(--drop-zone-active-bg)]')
    expect(markup).not.toContain('hover:border-border')
    expect(markup).not.toContain('group-hover:border-border')
  })

  it('shows milestone progress as a hover-only ring and percentage', () => {
    const completedMilestoneTask: CalendarTask = {
      ...task,
      milestoneId: milestone.id,
      completed: true,
      status: 'completed'
    }
    const markup = renderProjectsPage('home', { ...project, milestones: [milestone] }, [], false, [
      completedMilestoneTask
    ])

    expect(markup).toContain('data-testid="project-milestone-progress:milestone-1"')
    expect(markup).toContain('data-testid="project-milestone-progress-ring:milestone-1"')
    expect(markup).toContain(
      'opacity-0 transition-opacity motion-reduce:transition-none group-hover/milestone-header:opacity-100'
    )
    expect(markup).toContain('>100%</span>')
    expect(markup).not.toContain('>1 Tasks</span>')
  })

  it('reveals milestone add-task and task actions on row hover or focus', () => {
    const markup = renderProjectsPage('home', { ...project, milestones: [milestone] })

    expect(markup).toContain('data-testid="project-milestone-add-task-icon:milestone-1"')
    expect(markup).toContain(
      'hover:bg-card-hover hover:text-foreground focus-visible:bg-card-hover focus-visible:text-foreground'
    )
    expect(markup).toContain('data-testid="project-task-menu:task-1"')
    expect(markup).toContain(
      'opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100'
    )
  })

  it('uses stronger title weights across the project list and editor', () => {
    const listMarkup = renderProjectsList()
    const projectMarkup = renderProjectsPage('home')
    const resourcesMarkup = renderProjectsPage('resources')

    expect(projectMarkup).toContain('mx-auto w-full min-w-0 max-w-5xl')
    expect(projectMarkup).not.toContain('px-16')
    expect(resourcesMarkup).not.toContain('px-16')
    expect(resourcesMarkup).not.toContain('bg-accent')
    expect(resourcesMarkup).toContain('>No resources found</h2>')
    expect(resourcesMarkup).not.toContain('data-testid="project-resource-add-row"')
    expect(listMarkup).toContain('text-left font-semibold text-foreground')
    expect(projectMarkup).toContain('text-3xl font-bold')
    expect(projectMarkup).toContain('data-testid="project-main-detail-description-label"')
    expect(projectMarkup).toContain('>Description</p>')
  })

  it('keeps Google Docs import in Google Drive resource actions', () => {
    const googleDriveResource = normalizeResourceInput({
      type: 'external',
      canonicalUri: 'https://drive.google.com/open?id=drive-file-1',
      title: 'Drive brief'
    })
    const markup = renderProjectsPage(
      'resources',
      { ...project, resourceRefs: [googleDriveResource] },
      [googleDriveResource],
      true
    )

    expect(markup).toContain(`data-testid="project-resource-row:${googleDriveResource.id}"`)
    expect(markup).not.toContain('aria-label="Attach Google Docs"')
    expect(markup).not.toContain('data-testid="project-resource-add-row"')
  })

  it('renders project view tabs as standalone text buttons', () => {
    const markup = renderToStaticMarkup(
      createElement(ProjectsWorkspaceSecondaryActions, {
        view: 'home',
        project,
        onViewChange: () => undefined
      })
    )

    expect(markup).toContain('data-testid="project-view-tabs"')
    expect(markup).toContain('data-testid="project-view-tab:home"')
    expect(markup).toContain('data-testid="project-view-tab:pulse"')
    expect(markup).toContain('data-testid="project-view-tab:resources"')
    expect(markup).toContain('aria-controls="project-view-panel"')
    expect(markup).toContain('>Overview</button>')
    expect(markup).toContain('>Activity</button>')
    expect(markup).toContain('>Resources</button>')
    expect(markup).not.toContain('Project Home')
    expect(markup).not.toContain('>Pulse</button>')
    expect(markup).not.toContain('data-testid="project-view-tab-icon:home"')
    expect(markup).not.toContain('data-testid="project-view-tab-icon:pulse"')
  })

  it('renders project descriptions as an inline Markdown editor', () => {
    const markup = renderToStaticMarkup(
      createElement(ProjectDescriptionEditor, {
        initialContent: '# Alpha brief\n\nA **Markdown** description.',
        onSave: () => undefined,
        testId: 'project-main-detail-description-editor',
        vimModeEnabled: true,
        vimKeyMappings: []
      })
    )

    expect(markup).toContain('data-testid="project-main-detail-description-editor"')
    expect(markup).toContain('aria-label="Project description"')
    expect(markup).toContain('data-testid="note-block-editor"')
    expect(markup).toContain('data-editor-density="compact"')
    expect(markup).toContain('data-vim-mode="insert"')
    expect(markup).not.toContain('data-testid="project-main-detail-description-editor-status"')
    expect(markup).not.toContain('data-testid="project-main-detail-description-editor-count"')
    expect(markup).not.toContain('border border-border')
    expect(markup).not.toContain('border-b')
  })

  it('renders the latest project update between the description and milestones', () => {
    const overviewProject: Project = {
      ...project,
      updates: [
        {
          id: 'overview-old-update',
          projectId: project.id,
          markdown: 'Older update',
          status: 'on-track',
          createdAt: '2026-08-19T00:00:00.000Z',
          updatedAt: '2026-08-19T00:00:00.000Z'
        },
        {
          id: 'overview-latest-update',
          projectId: project.id,
          markdown: 'Latest update content',
          status: 'off-track',
          createdAt: '2026-08-20T00:00:00.000Z',
          updatedAt: '2026-08-20T00:00:00.000Z'
        }
      ]
    }
    const markup = renderProjectsPage('home', overviewProject)

    expect(markup).toContain('data-testid="project-latest-update"')
    expect(markup).toContain('data-testid="project-latest-update-content:overview-latest-update"')
    expect(markup).toContain('data-testid="project-latest-update-status:overview-latest-update"')
    expect(markup).toContain('data-editor-read-only="true"')
    expect(markup.indexOf('data-testid="project-main-detail-description-row"')).toBeLessThan(
      markup.indexOf('data-testid="project-latest-update"')
    )
    expect(markup.indexOf('data-testid="project-latest-update"')).toBeLessThan(
      markup.indexOf('id="project-milestones-heading"')
    )
  })

  it('renders a centered transparent add button when no project update exists', () => {
    const markup = renderProjectsPage('home')

    expect(markup).toContain('data-testid="project-latest-update"')
    expect(markup).toContain('data-testid="project-latest-update-empty"')
    expect(markup).toContain('data-testid="project-latest-update-add"')
    expect(markup).toContain('aria-label="Add project update"')
    expect(markup).toContain('flex min-h-20 items-center justify-center')
    expect(markup).toContain('bg-transparent text-muted-foreground hover:bg-muted')
    expect(markup).toContain('text-muted-foreground hover:bg-muted hover:text-foreground')
    expect(markup).not.toContain('data-testid="project-latest-update-content:')
  })

  it('renders project tags in the properties panel', () => {
    const taggedProject = {
      ...project,
      tags: ['launch'],
      startDate: '2026-08-01',
      endDate: '2026-08-31',
      resourceRefs: [
        normalizeResourceInput({
          type: 'notebook',
          canonicalUri: notebookResourceUri('Projects/Alpha Project'),
          title: 'Alpha Project'
        })
      ]
    }
    const propertiesMarkup = renderProjectsRightPanel(taggedProject)
    const emptyDatePropertiesMarkup = renderProjectsRightPanel(project)
    const emptyResourcesMarkup = renderProjectsPage('resources')
    const detailMarkup = renderProjectsPage('home')

    expect(propertiesMarkup).toContain('data-testid="project-property-tags"')
    expect(propertiesMarkup).toContain('data-testid="project-tags-editor"')
    expect(propertiesMarkup).toContain('aria-label="Project tags selection"')
    expect(propertiesMarkup).not.toContain('data-testid="project-resources-panel"')
    expect(propertiesMarkup).not.toContain('data-testid="project-resources-page"')
    expect(propertiesMarkup).not.toContain('Project Knowledge')
    expect(emptyResourcesMarkup).toContain('data-testid="project-resources-page"')
    expect(emptyResourcesMarkup).toContain('>No resources found</h2>')
    expect(emptyResourcesMarkup).not.toContain('data-testid="project-resources-table"')
    expect(emptyResourcesMarkup).not.toContain('>Alpha Project</span>')
    expect(emptyResourcesMarkup).not.toContain('Automatic')
    expect(propertiesMarkup).not.toContain('data-testid="project-property-notebook"')
    expect(propertiesMarkup).not.toContain('data-testid="project-notebook-selector"')
    expect(propertiesMarkup).toContain('data-testid="project-favorite-button"')
    expect(propertiesMarkup).toContain('aria-label="Project favorite: Not favorite"')
    expect(propertiesMarkup).toContain('bg-surface-subtle')
    expect(propertiesMarkup).toContain('hover:bg-surface-subtle-hover')
    expect(propertiesMarkup).not.toContain('aria-pressed="false"')
    expect(propertiesMarkup).not.toContain('data-testid="project-property-time-budget"')
    expect(propertiesMarkup).toContain('data-testid="project-property-start-date-group"')
    expect(propertiesMarkup).toContain('data-testid="project-property-end-date-group"')
    expect(propertiesMarkup).toContain('data-testid="project-property-start-date-group-clear"')
    expect(propertiesMarkup).toContain('data-testid="project-property-end-date-group-clear"')
    expect(propertiesMarkup).toContain('aria-label="Clear project start date"')
    expect(propertiesMarkup).toContain('tabler-icon-x-filled')
    expect(propertiesMarkup).toContain('p-1.5')
    expect(propertiesMarkup).not.toContain('Project start time')
    expect(emptyDatePropertiesMarkup).not.toContain(
      'data-testid="project-property-start-date-group-clear"'
    )
    expect(emptyDatePropertiesMarkup).not.toContain(
      'data-testid="project-property-end-date-group-clear"'
    )
    expect(detailMarkup).not.toContain('data-testid="project-main-detail-tags-editor"')
  })

  it('uses the latest update status for the project properties Health chip', () => {
    const projectWithUpdates: Project = {
      ...project,
      updates: [
        {
          id: 'property-old-update',
          projectId: project.id,
          markdown: 'Older update',
          status: 'on-track',
          createdAt: '2026-08-19T00:00:00.000Z',
          updatedAt: '2026-08-19T00:00:00.000Z'
        },
        {
          id: 'property-latest-update',
          projectId: project.id,
          markdown: 'Latest update',
          status: 'off-track',
          createdAt: '2026-08-20T00:00:00.000Z',
          updatedAt: '2026-08-20T00:00:00.000Z'
        }
      ]
    }
    const markup = renderProjectsRightPanel(projectWithUpdates)

    expect(markup).toContain('data-testid="project-property-health-status"')
    expect(markup).toContain('>Off track</span>')
    expect(markup).toContain('bg-surface-subtle')
    expect(markup).toContain('border border-border')
    expect(markup).toContain(
      '--status-chip-label-color:var(--status-chip-task-status-canceled-icon)'
    )
  })

  it('removes the inline Add resource placeholder row', () => {
    const resourcesMarkup = renderProjectsPage('resources')
    const milestonesMarkup = renderProjectsPage('home')
    const inlineAddActionClasses =
      'w-full justify-start px-2 text-muted-foreground hover:bg-transparent hover:text-foreground'

    expect(resourcesMarkup).not.toContain('data-testid="project-resource-add-row"')
    expect(resourcesMarkup).not.toContain(inlineAddActionClasses)
    expect(milestonesMarkup).toContain('aria-label="Add new milestone"')
    expect(milestonesMarkup).toContain(inlineAddActionClasses)
  })

  it('uses the pill-surface No update chip in project properties when needed', () => {
    const markup = renderProjectsRightPanel(project)

    expect(markup).toContain('data-testid="project-property-health-status"')
    expect(markup).toContain('>No update</span>')
    expect(markup).toContain('tabler-icon-circle-dashed')
    expect(markup).toContain('bg-surface-subtle')
  })

  it('renders project activity metadata below properties without update content', () => {
    const activityProject: Project = {
      ...project,
      updates: [
        {
          id: 'activity-old',
          projectId: project.id,
          markdown: 'Older update',
          status: 'on-track',
          createdAt: '2026-08-19T00:00:00.000Z',
          updatedAt: '2026-08-19T00:00:00.000Z'
        },
        {
          id: 'activity-new',
          projectId: project.id,
          markdown: 'Newer update',
          status: 'at-risk',
          createdAt: '2026-08-20T00:00:00.000Z',
          updatedAt: '2026-08-20T00:00:00.000Z'
        }
      ]
    }
    const markup = renderProjectsRightPanel(activityProject)

    expect(markup).toContain('data-testid="project-properties-panel"')
    expect(markup).toContain('data-testid="project-activity-panel"')
    expect(markup).toContain('data-testid="project-activity-table"')
    expect(markup).toContain('aria-label="Project update history"')
    expect(markup).toContain('data-testid="project-activity-row:activity-new"')
    expect(markup).toContain('data-testid="project-activity-row:activity-old"')
    expect(markup).toContain('data-testid="project-activity-status:activity-new"')
    expect(markup).toContain('data-testid="project-activity-time:activity-new"')
    expect(markup).not.toContain('data-testid="project-activity-text:activity-new"')
    expect(markup).toContain('data-testid="project-activity-author:activity-new"')
    expect(markup.indexOf('data-testid="project-activity-status:activity-new"')).toBeLessThan(
      markup.indexOf('data-testid="project-activity-time:activity-new"')
    )
    expect(markup.indexOf('data-testid="project-activity-time:activity-new"')).toBeLessThan(
      markup.indexOf('data-testid="project-activity-author:activity-new"')
    )
    expect(markup).toContain('>By You</span>')
    expect(markup).toContain('class="p-3"')
    expect(markup.indexOf('data-testid="project-activity-panel"')).toBeGreaterThan(
      markup.indexOf('data-testid="project-properties-panel"')
    )
    expect(markup).not.toContain('>Newer update</span>')
    expect(markup).not.toContain('>Older update</span>')
    expect(markup).not.toContain('>Alpha Project</span>')
    expect(markup).not.toContain('>Plan launch</span>')
    expect(markup).not.toContain('cursor-pointer')
  })

  it('renders an empty state for projects without activity', () => {
    const markup = renderProjectsRightPanel(project)

    expect(markup).toContain('data-testid="project-activity-panel"')
    expect(markup).toContain('data-testid="project-activity-empty"')
    expect(markup).not.toContain('data-testid="project-activity-table"')
  })

  it('renders recognizable product marks for typed external resources', () => {
    const docs = normalizeResourceInput({
      type: 'external',
      canonicalUri: 'https://docs.google.com/document/d/brief/edit',
      title: 'Project brief'
    })
    const canva = normalizeResourceInput({
      type: 'external',
      canonicalUri: 'https://www.canva.com/design/brief/view',
      title: 'Project deck'
    })
    const markup = renderProjectsPage('resources', { ...project, resourceRefs: [docs, canva] }, [
      docs,
      canva
    ])

    expect(markup).toContain('data-testid="project-resources-table"')
    expect(markup).toContain('aria-label="Resources"')
    expect(markup).toContain('>Name</th>')
    expect(markup).toContain('>Source</th>')
    expect(markup).toContain('>Health</th>')
    expect(markup).toContain('>Location</th>')
    expect(markup).toContain('>Last checked</th>')
    expect(markup).toContain('>Actions</th>')
    expect(markup).toContain('border-separate border-spacing-y-1')
    expect(markup).toContain(`data-testid="project-resource-row:${docs.id}"`)
    expect(markup).toContain('aria-label="Google Docs"')
    expect(markup).toContain('aria-label="Canva"')
    expect(markup).toContain('>Project brief</span>')
    expect(markup).toContain('>Project deck</span>')
  })
})
