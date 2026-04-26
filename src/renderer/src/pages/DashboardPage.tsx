import { type ReactElement, useMemo } from 'react'
import { AlertTriangle, ArrowRight, CircleCheckBig, LayoutDashboard, Target } from 'lucide-react'
import type {
  CalendarTask,
  Project,
  WeeklyPlanPriority,
  WeeklyPlanWeek
} from '../../../shared/types'
import { NoteShapeIcon } from '../components/NoteShapeIcon'
import { PROJECT_STATUS_META } from '../lib/projectStatus'
import { formatWeekRange } from '../lib/weeklyPlan'

interface DashboardPageProps {
  projects: Project[]
  currentWeek: WeeklyPlanWeek | null
  currentWeekPriorities: WeeklyPlanPriority[]
  tasks: CalendarTask[]
  weeklyPlanLoading: boolean
  weeklyPlanReady: boolean
  onOpenProject: (projectId: string) => void
  onOpenProjects: () => void
  onOpenWeeklyPlan: () => void
}

const priorityStatusLabel: Record<WeeklyPlanPriority['status'], string> = {
  planned: 'Planned',
  in_progress: 'In Progress',
  done: 'Done'
}

const priorityStatusClass: Record<WeeklyPlanPriority['status'], string> = {
  planned:
    'border-[var(--tag-neutral-line)] bg-[var(--tag-neutral-bg)] text-[var(--tag-neutral-text)]',
  in_progress: 'border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--accent)]',
  done: 'border-[color:rgba(34,197,94,0.35)] bg-[color:rgba(34,197,94,0.12)] text-[color:#15803d]'
}

const cardClass = 'workspace-subtle-surface rounded-lg'
const metricCardClass = `${cardClass} p-5`
const chipClass = 'inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-medium'

export function DashboardPage({
  projects,
  currentWeek,
  currentWeekPriorities,
  tasks,
  weeklyPlanLoading,
  weeklyPlanReady,
  onOpenProject,
  onOpenProjects,
  onOpenWeeklyPlan
}: DashboardPageProps): ReactElement {
  const activeProjects = useMemo(() => {
    return projects
      .filter((project) => project.status !== 'completed')
      .sort((a, b) => {
        const rankA = getProjectRank(a.status)
        const rankB = getProjectRank(b.status)
        if (rankA !== rankB) {
          return rankA - rankB
        }
        return b.updatedAt.localeCompare(a.updatedAt)
      })
  }, [projects])

  const focusPriorities = useMemo(() => currentWeekPriorities.slice(0, 3), [currentWeekPriorities])

  const statusCounts = useMemo(
    () => ({
      blocked: activeProjects.filter((project) => project.status === 'blocked').length,
      atRisk: activeProjects.filter((project) => project.status === 'at-risk').length,
      onTrack: activeProjects.filter((project) => project.status === 'on-track').length
    }),
    [activeProjects]
  )

  return (
    <div className="h-full overflow-y-auto px-8 py-7">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <section className="pb-2">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <p className="workspace-eyebrow">Workspace Dashboard</p>
              <h1 className="mt-2 inline-flex items-center gap-3 text-4xl font-semibold tracking-[-0.03em] text-[var(--text)]">
                <LayoutDashboard size={28} className="text-[var(--accent)]" />
                <span>Dashboard</span>
              </h1>
              <p className="mt-3 max-w-2xl text-sm workspace-meta">
                Track active project health and the first priorities that should shape today.
              </p>
            </div>
            <div className={`${cardClass} flex items-center gap-3 px-4 py-3 text-sm`}>
              <Target size={16} className="text-[var(--accent)]" />
              <div>
                <p className="font-medium text-[var(--text)]">
                  {currentWeek
                    ? `Current week: ${formatWeekRange(currentWeek.startDate, currentWeek.endDate)}`
                    : 'No active weekly plan'}
                </p>
                <p className="workspace-meta">
                  {currentWeek
                    ? `${currentWeekPriorities.length} priorities scheduled this week`
                    : 'Create a week to surface today focus here'}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <MetricCard
            label="Blocked"
            value={statusCounts.blocked}
            className={PROJECT_STATUS_META.blocked.className}
          />
          <MetricCard
            label="At Risk"
            value={statusCounts.atRisk}
            className={PROJECT_STATUS_META['at-risk'].className}
          />
          <MetricCard
            label="On Track"
            value={statusCounts.onTrack}
            className={PROJECT_STATUS_META['on-track'].className}
          />
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          <section className={`${cardClass} p-6`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-[var(--text)]">Active Project Status</h2>
                <p className="mt-1 text-sm workspace-meta">
                  Open work only. Completed projects stay on the Projects page.
                </p>
              </div>
              <button
                type="button"
                onClick={onOpenProjects}
                className="workspace-subtle-control inline-flex items-center gap-1 rounded-lg border border-[var(--line)] px-3 py-1.5 text-sm font-medium"
              >
                <span>All projects</span>
                <ArrowRight size={15} />
              </button>
            </div>

            {activeProjects.length ? (
              <div className="mt-5 space-y-3">
                {activeProjects.slice(0, 5).map((project) => {
                  const statusMeta = PROJECT_STATUS_META[project.status]
                  const milestoneCount = project.milestones.length

                  return (
                    <button
                      key={project.id}
                      type="button"
                      onClick={() => onOpenProject(project.id)}
                      className="workspace-subtle-control flex w-full items-start justify-between gap-4 rounded-lg border border-[var(--line)] px-4 py-4 text-left transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <NoteShapeIcon icon={project.icon} size={18} className="shrink-0" />
                          <p className="truncate text-base font-semibold text-[var(--text)]">
                            {project.name}
                          </p>
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm workspace-meta">
                          {project.summary}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span className={`${chipClass} ${statusMeta.className}`}>
                            {statusMeta.titleLabel}
                          </span>
                          <span
                            className={`${chipClass} workspace-subtle-control border-[var(--line)] text-[var(--muted)]`}
                          >
                            {project.progress}% complete
                          </span>
                          <span
                            className={`${chipClass} workspace-subtle-control border-[var(--line)] text-[var(--muted)]`}
                          >
                            {milestoneCount} milestones
                          </span>
                        </div>
                      </div>
                      <div className="hidden shrink-0 text-xs text-[var(--muted)] sm:block">
                        {new Date(project.updatedAt).toLocaleDateString()}
                      </div>
                    </button>
                  )
                })}
              </div>
            ) : (
              <EmptyState
                icon={<CircleCheckBig size={18} className="text-[var(--accent)]" />}
                title="No active projects"
                description="Everything is marked complete. Create a new project or reopen one from Projects."
                actionLabel="Open projects"
                onAction={onOpenProjects}
              />
            )}
          </section>

          <section className={`${cardClass} p-6`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-[var(--text)]">Today Focus</h2>
                <p className="mt-1 text-sm workspace-meta">
                  Top 3 priorities from the current weekly plan.
                </p>
              </div>
              <button
                type="button"
                onClick={onOpenWeeklyPlan}
                className="workspace-subtle-control inline-flex items-center gap-1 rounded-lg border border-[var(--line)] px-3 py-1.5 text-sm font-medium"
              >
                <span>Weekly plan</span>
                <ArrowRight size={15} />
              </button>
            </div>

            {weeklyPlanLoading ? (
              <div className="mt-5 rounded-lg border border-dashed border-[var(--line)] px-4 py-6 text-sm workspace-meta">
                Loading weekly plan priorities…
              </div>
            ) : !weeklyPlanReady ? (
              <EmptyState
                icon={<AlertTriangle size={18} className="text-[var(--accent)]" />}
                title="Weekly Plan unavailable"
                description="Update or restart Beacon to enable weekly-plan-backed focus."
                actionLabel="Open Weekly Plan"
                onAction={onOpenWeeklyPlan}
              />
            ) : !currentWeek ? (
              <EmptyState
                icon={<Target size={18} className="text-[var(--accent)]" />}
                title="No current week"
                description="Create a week plan that covers today to surface focus priorities here."
                actionLabel="Open Weekly Plan"
                onAction={onOpenWeeklyPlan}
              />
            ) : focusPriorities.length ? (
              <div className="mt-5 space-y-3">
                {focusPriorities.map((priority, index) => {
                  const linkedLabel = getPriorityLinkedLabel(priority, projects, tasks)

                  return (
                    <div
                      key={priority.id}
                      className="workspace-subtle-surface rounded-lg px-4 py-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="workspace-subtle-control inline-flex h-6 w-6 items-center justify-center rounded-lg border border-[var(--line)] text-xs font-semibold text-[var(--muted)]">
                              {index + 1}
                            </span>
                            <p className="truncate text-base font-semibold text-[var(--text)]">
                              {priority.title}
                            </p>
                          </div>
                          {linkedLabel ? (
                            <p className="mt-2 text-sm workspace-meta">{linkedLabel}</p>
                          ) : null}
                        </div>
                        <span className={`${chipClass} ${priorityStatusClass[priority.status]}`}>
                          {priorityStatusLabel[priority.status]}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <EmptyState
                icon={<Target size={18} className="text-[var(--accent)]" />}
                title="No priorities for this week"
                description="Add priorities in Weekly Plan to turn the dashboard into a daily focus view."
                actionLabel="Open Weekly Plan"
                onAction={onOpenWeeklyPlan}
              />
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

function MetricCard({
  label,
  value,
  className
}: {
  label: string
  value: number
  className: string
}): ReactElement {
  return (
    <div className={metricCardClass}>
      <div className={`${chipClass} ${className}`}>{label}</div>
      <div className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-[var(--text)]">
        {value}
      </div>
      <p className="mt-2 text-sm workspace-meta">Active projects in this state.</p>
    </div>
  )
}

function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction
}: {
  icon: ReactElement
  title: string
  description: string
  actionLabel: string
  onAction: () => void
}): ReactElement {
  return (
    <div className="mt-5 rounded-lg border border-dashed border-[var(--line)] px-4 py-6">
      <div className="flex items-center gap-2 text-[var(--text)]">
        {icon}
        <p className="font-medium">{title}</p>
      </div>
      <p className="mt-2 text-sm workspace-meta">{description}</p>
      <button
        type="button"
        onClick={onAction}
        className="workspace-subtle-control mt-4 inline-flex items-center gap-1 rounded-lg border border-[var(--line)] px-3 py-1.5 text-sm font-medium"
      >
        <span>{actionLabel}</span>
        <ArrowRight size={15} />
      </button>
    </div>
  )
}

function getProjectRank(status: Project['status']): number {
  switch (status) {
    case 'blocked':
      return 0
    case 'at-risk':
      return 1
    case 'on-track':
      return 2
    case 'completed':
      return 3
  }
}

function getPriorityLinkedLabel(
  priority: WeeklyPlanPriority,
  projects: Project[],
  tasks: CalendarTask[]
): string | null {
  if (priority.linkedTaskId) {
    const task = tasks.find((item) => item.id === priority.linkedTaskId)
    if (task) {
      return `Task: ${task.title}`
    }
  }

  if (priority.linkedProjectId) {
    const project = projects.find((item) => item.id === priority.linkedProjectId)
    if (!project) {
      return null
    }

    if (priority.linkedSubtaskId) {
      for (const milestone of project.milestones) {
        const subtask = milestone.subtasks.find((item) => item.id === priority.linkedSubtaskId)
        if (subtask) {
          return `${project.name} / ${milestone.title} / ${subtask.title}`
        }
      }
    }

    if (priority.linkedMilestoneId) {
      const milestone = project.milestones.find((item) => item.id === priority.linkedMilestoneId)
      if (milestone) {
        return `${project.name} / ${milestone.title}`
      }
    }

    return `Project: ${project.name}`
  }

  return null
}
