import { useMemo, type ReactElement } from 'react'
import type { CalendarTask, FleetingNote, Project, ResourceRef } from '../../../shared/types'
import { isTaskDone } from '../../../shared/taskStatus'
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  StatusChip
} from '../components/ui'
import { WorkspaceIconButton } from '../components/ui/document-workspace'
import { EmptyState } from '../components/ui/empty-state'
import { FolderOpen, Inbox, Link, Loader2 } from '../components/ui/icons'
import { WorkspacePage, WorkspacePageHeader } from '../components/workspace'
import { RESOURCE_STATE_CHIP_ITEMS } from '../lib/statusChipMeta'

interface WorkspaceHomePageProps {
  projects: Project[]
  tasks: CalendarTask[]
  captures: FleetingNote[]
  resources: ResourceRef[]
  onOpenProject: (projectId: string) => void
  onOpenCapture: () => void
  onOpenResource: (resourceId: string) => Promise<void>
}

export function WorkspaceHomePage({
  projects,
  tasks,
  captures,
  resources,
  onOpenProject,
  onOpenCapture,
  onOpenResource
}: WorkspaceHomePageProps): ReactElement {
  const attentionResources = useMemo(
    () => resources.filter((resource) => resource.state !== 'available').slice(0, 5),
    [resources]
  )
  const activeProjects = projects.filter((project) => project.state === 'active').slice(0, 6)
  const nextTasks = tasks
    .filter((task) => !isTaskDone(task))
    .sort((left, right) => (left.date ?? '9999').localeCompare(right.date ?? '9999'))
    .slice(0, 5)

  return (
    <WorkspacePage data-testid="workspace-home-page" className="p-2">
      <WorkspacePageHeader
        eyebrow="Workspace control plane"
        heading="What needs your attention?"
        description="Start from the project, capture, or source that explains the work. Source systems remain authoritative."
        actions={
          <WorkspaceIconButton
            label="Open capture inbox"
            title="Open capture inbox"
            aria-label="Open capture inbox"
            icon={<Inbox size={17} />}
            onClick={onOpenCapture}
          />
        }
      />

      <div className="grid gap-3 xl:grid-cols-2" aria-label="Workspace attention areas">
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-3 p-3">
            <div>
              <CardTitle className="text-base">Active projects</CardTitle>
              <CardDescription>
                Open a planning space and follow its source context.
              </CardDescription>
            </div>
            <Badge variant="secondary">{activeProjects.length}</Badge>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            {activeProjects.length === 0 ? (
              <EmptyState
                icon={FolderOpen}
                title="No active projects"
                description="Create a project when work needs a durable home."
                className="min-h-24 bg-transparent py-4"
              />
            ) : (
              <div className="grid gap-1" role="list">
                {activeProjects.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    role="listitem"
                    className="flex items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-muted/60"
                    onClick={() => onOpenProject(project.id)}
                  >
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {project.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {
                        tasks.filter((task) => task.projectId === project.id && !isTaskDone(task))
                          .length
                      }{' '}
                      open
                    </span>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-start justify-between gap-3 p-3">
            <div>
              <CardTitle className="text-base">Recent captures</CardTitle>
              <CardDescription>
                Review unclassified ideas before they become commitments.
              </CardDescription>
            </div>
            <Badge variant={captures.length ? 'secondary' : 'outline'}>{captures.length}</Badge>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            {captures.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title="Capture inbox is clear"
                description="Quick captures will appear here when they need review."
                className="min-h-24 bg-transparent py-4"
              />
            ) : (
              <div className="grid gap-1" role="list">
                {captures.slice(0, 5).map((capture) => (
                  <button
                    key={capture.id}
                    type="button"
                    role="listitem"
                    className="truncate rounded-md px-2 py-2 text-left text-sm hover:bg-muted/60"
                    onClick={onOpenCapture}
                  >
                    {capture.content}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader className="flex-row items-start justify-between gap-3 p-3">
            <div>
              <CardTitle className="text-base">Needs attention</CardTitle>
              <CardDescription>
                Links that are stale, missing, offline, or waiting for permission.
              </CardDescription>
            </div>
            <Badge variant={attentionResources.length ? 'destructive' : 'outline'}>
              {attentionResources.length}
            </Badge>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            {attentionResources.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Link size={15} aria-hidden="true" />
                All linked resources are currently available.
              </p>
            ) : (
              <div className="grid gap-1 md:grid-cols-2" role="list">
                {attentionResources.map((resource) => (
                  <button
                    key={resource.id}
                    type="button"
                    role="listitem"
                    className="flex items-center gap-2 rounded-md border border-border/70 px-2 py-2 text-left hover:bg-muted/60"
                    onClick={() => void onOpenResource(resource.id)}
                  >
                    <Link size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate text-sm">{resource.title}</span>
                    <StatusChip item={RESOURCE_STATE_CHIP_ITEMS[resource.state]} />
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader className="p-3">
            <CardTitle className="text-base">Next commitments</CardTitle>
            <CardDescription>
              Tasks remain in Xingularity; linked resources explain why they matter.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            {nextTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No open tasks need attention right now.
              </p>
            ) : (
              <div className="grid gap-1 md:grid-cols-2">
                {nextTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-2 rounded-md border border-border/70 px-2 py-2"
                  >
                    <Loader2 size={14} className="text-muted-foreground" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate text-sm">{task.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {task.date ?? 'unscheduled'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </WorkspacePage>
  )
}
