import { useMemo, useState, type ReactElement } from 'react'
import {
  ArrowRight,
  CalendarDays,
  Circle,
  CircleAlert,
  FileText,
  Loader2,
  ListTodo,
  NotebookPen,
  Pencil,
  Plus,
  Target,
  Trophy,
  Trash2
} from 'lucide-react'
import type {
  CreateWeeklyPlanPriorityInput,
  CreateWeeklyPlanWeekInput,
  ReorderWeeklyPlanPrioritiesInput,
  UpdateWeeklyPlanPriorityInput,
  UpdateWeeklyPlanWeekInput,
  UpsertWeeklyPlanReviewInput,
  WeeklyPlanPriority,
  WeeklyPlanState
} from '../../../shared/types'
import { InlineEditableText } from '../components/InlineEditableText'
import {
  DocumentWorkspacePanelContent,
  DocumentWorkspacePanelHeader,
  WorkspaceHeaderActions,
  WorkspaceHeaderActionDivider,
  WorkspaceHeaderActionGroup
} from '../components/ui/document-workspace'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  SortableTableHead,
  TableRow
} from '../components/ui/table'
import {
  WorkspacePanelSection,
  WorkspacePanelSectionHeader
} from '../components/ui/workspace-panel-section'
import { cn } from '../lib/utils'
import {
  findWeekForDate,
  formatWeekRange,
  getSortedWeeks,
  getWeekPriorities,
  getWeekReview
} from '../lib/weeklyPlan'

interface WeeklyPlanWorkspaceProps {
  state: WeeklyPlanState | null
  loading: boolean
  selectedWeekId: string | null
  isReady: boolean
  onUpdateWeek: (input: UpdateWeeklyPlanWeekInput) => Promise<void>
  onAddPriority: (input: CreateWeeklyPlanPriorityInput) => Promise<void>
  onUpdatePriority: (input: UpdateWeeklyPlanPriorityInput) => Promise<void>
  onDeletePriority: (priorityId: string) => Promise<void>
  onReorderPriorities: (input: ReorderWeeklyPlanPrioritiesInput) => Promise<void>
  onUpsertReview: (input: UpsertWeeklyPlanReviewInput) => Promise<void>
}

interface WeeklyPlanSidebarProps {
  state: WeeklyPlanState | null
  loading: boolean
  selectedWeekId: string | null
  currentWeekId: string | null
  nextWeekStart: string
  todayIso: string
  isReady: boolean
  onSelectWeek: (weekId: string) => void
  onCreateWeek: (input: CreateWeeklyPlanWeekInput) => Promise<void>
}

const flatSidebarButtonClass =
  'flex items-center justify-center rounded border border-[var(--line)] bg-[var(--panel-2)] p-1.5 hover:border-[var(--accent)] disabled:opacity-50'
const metaPillClass =
  'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-[var(--muted)]'
const neutralChipClass =
  'inline-flex min-w-0 shrink-0 items-center gap-1 rounded-full border border-[var(--tag-neutral-line)] bg-[var(--tag-neutral-bg)] px-2 py-0.5 text-xs leading-[1.2] text-[var(--tag-neutral-text)]'

export function WeeklyPlanWorkspace({
  state,
  loading,
  selectedWeekId,
  isReady,
  onUpdateWeek,
  onAddPriority,
  onUpdatePriority,
  onDeletePriority,
  onReorderPriorities: _onReorderPriorities,
  onUpsertReview
}: WeeklyPlanWorkspaceProps): ReactElement {
  const selectedWeek = state?.weeks.find((week) => week.id === selectedWeekId) ?? null
  const priorities = getWeekPriorities(state, selectedWeekId)
  const review = getWeekReview(state, selectedWeekId)
  const [prioritySort, setPrioritySort] = useState<WeeklyPrioritySortState>({
    key: 'status',
    direction: 'asc'
  })

  const handleFocusCommit = async (nextValue: string): Promise<void> => {
    if (!selectedWeek) {
      return
    }
    await onUpdateWeek({ id: selectedWeek.id, focus: nextValue.trim() ? nextValue : null })
  }

  const handleAddPriority = async (): Promise<void> => {
    if (!selectedWeek) {
      return
    }
    await onAddPriority({
      weekId: selectedWeek.id,
      title: `Priority ${priorities.length + 1}`
    })
  }

  const sortedPriorities = useMemo(() => {
    return [...priorities].sort((left, right) =>
      compareWeeklyPriorities(left, right, prioritySort.key, prioritySort.direction)
    )
  }, [priorities, prioritySort])

  const togglePrioritySort = (key: WeeklyPrioritySortKey): void => {
    setPrioritySort((current) =>
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: key === 'title' ? 'asc' : 'asc' }
    )
  }

  const handlePriorityCheckedChange = async (
    priority: WeeklyPlanPriority,
    checked: boolean
  ): Promise<void> => {
    await onUpdatePriority({
      id: priority.id,
      status: checked ? 'done' : 'planned'
    })
  }

  const handleReviewCommit = async (
    key: 'wins' | 'misses' | 'blockers' | 'nextWeek',
    nextValue: string
  ): Promise<void> => {
    if (!selectedWeek) {
      return
    }
    await onUpsertReview({
      weekId: selectedWeek.id,
      [key]: nextValue.trim() ? nextValue : null
    })
  }

  const progress = useMemo(() => {
    if (!priorities.length) {
      return { done: 0, total: 0 }
    }
    const done = priorities.filter((priority) => priority.status === 'done').length
    return { done, total: priorities.length }
  }, [priorities])

  if (!isReady) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-[var(--muted)]">
        <CalendarDays size={24} />
        <p className="max-w-sm text-sm">
          Weekly Plan isn't available in this build yet. Restart Beacon after updating or make sure
          you're running the latest desktop app.
        </p>
      </div>
    )
  }

  if (!selectedWeek && !loading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-[var(--muted)]">
        <CalendarDays size={24} />
        <p className="max-w-sm text-sm">Create a week from the right panel to start planning.</p>
      </div>
    )
  }

  return (
    <div className="relative flex h-full flex-col">
      {loading ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-[var(--panel)]/60">
          <Loader2 className="animate-spin" />
        </div>
      ) : null}
      <div className="flex-1 overflow-y-auto px-8 py-7">
        {selectedWeek ? (
          <div className="mx-auto flex max-w-5xl flex-col">
            <section className="pb-7">
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-start gap-4">
                  <div className="min-w-0 flex-1">
                    <h1 className="text-4xl font-semibold tracking-[-0.03em] text-[var(--text)]">
                      {formatWeekRange(selectedWeek.startDate, selectedWeek.endDate)}
                    </h1>
                    <p className="mt-2 max-w-2xl text-sm workspace-meta">
                      {progress.total
                        ? `${progress.done} of ${progress.total} priorities complete this week.`
                        : 'Add priorities to define what success looks like this week.'}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <div className="px-4">
              <div className="grid lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
                <div className="space-y-2">
                  <h2 className="mt-1 inline-flex items-center gap-2 text-2xl font-semibold text-[var(--text)]">
                    <Target size={20} className="text-[var(--accent)]" />
                    <span>Week Focus</span>
                  </h2>
                  <p className="mt-1 text-sm workspace-meta">
                    One line that keeps the week pointed in the right direction.
                  </p>
                  <InlineEditableText
                    value={selectedWeek.focus ?? ''}
                    onCommit={(nextValue) => handleFocusCommit(nextValue)}
                    displayAs="p"
                    displayClassName="cursor-text text-lg font-medium text-[var(--text)] transition-colors hover:text-[var(--accent)]"
                    inputClassName="m-0 min-w-0 w-full border-0 bg-transparent p-0 text-lg font-medium text-[var(--text)] outline-none"
                    placeholder="Name the main theme for this week."
                    title="Click to edit weekly focus"
                    allowEmpty={true}
                    normalize={(next) => next}
                    renderDisplay={(value) =>
                      value?.trim() ? (
                        value
                      ) : (
                        <span className="text-[var(--muted)]">
                          Name the main theme for this week.
                        </span>
                      )
                    }
                  />
                </div>
              </div>

              <section className="workspace-section">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="mt-1 inline-flex items-center gap-2 text-2xl font-semibold text-[var(--text)]">
                      <ListTodo size={20} className="text-[var(--accent)]" />
                      <span>Priority</span>
                    </h2>
                    <p className="mt-1 text-sm workspace-meta">Aim for 3 to 7 priorities.</p>
                  </div>
                </div>

                <Table className="mt-4 rounded-xl">
                  <TableHeader>
                    <TableRow>
                      <SortableTableHead
                        className="w-[56px] text-center"
                        isActive={prioritySort.key === 'status'}
                        sortDirection={prioritySort.direction}
                        onToggleSort={() => togglePrioritySort('status')}
                      >
                        <span className="inline-flex items-center justify-center">
                          <Circle size={12} aria-hidden="true" />
                        </span>
                      </SortableTableHead>
                      <SortableTableHead
                        isActive={prioritySort.key === 'title'}
                        sortDirection={prioritySort.direction}
                        onToggleSort={() => togglePrioritySort('title')}
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <FileText size={12} aria-hidden="true" />
                          Priority
                        </span>
                      </SortableTableHead>
                      <TableHead className="w-[120px] text-center">
                        <span className="inline-flex items-center justify-center text-xs font-semibold tracking-wide text-[var(--muted)]">
                          ACTIONS
                        </span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {priorities.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3}>
                          <div className="py-2 text-sm text-[var(--muted)]">
                            Capture the top commitments that make this week successful.
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : null}
                    {sortedPriorities.map((priority) => (
                      <TableRow key={priority.id}>
                        <TableCell className="px-3 py-2 text-center align-middle">
                          <input
                            type="checkbox"
                            checked={priority.status === 'done'}
                            onChange={(event) => {
                              void handlePriorityCheckedChange(
                                priority,
                                event.currentTarget.checked
                              )
                            }}
                            className="h-4 w-4 rounded border-[var(--line)] accent-[var(--accent)]"
                            aria-label={`Mark ${priority.title} as done`}
                          />
                        </TableCell>
                        <TableCell className="p-0 align-middle">
                          <div className="flex min-h-[44px] min-w-0 items-center">
                            <InlineEditableText
                              value={priority.title}
                              onCommit={(nextTitle) => {
                                void onUpdatePriority({
                                  id: priority.id,
                                  title: nextTitle
                                })
                              }}
                              displayAs="span"
                              displayClassName={cn(
                                'block h-full min-w-[140px] w-full cursor-text px-3 py-2 font-semibold text-[var(--text)] transition-colors hover:text-[var(--accent)]',
                                priority.status === 'done' ? 'text-[var(--muted)] line-through' : ''
                              )}
                              inputClassName={cn(
                                'h-full min-w-[140px] w-full border-0 bg-transparent px-3 py-2 font-semibold text-[var(--text)] outline-none',
                                priority.status === 'done' ? 'text-[var(--muted)] line-through' : ''
                              )}
                              title="Click to rename priority"
                            />
                          </div>
                        </TableCell>
                        <TableCell className="px-2 py-1">
                          <div className="flex items-center justify-start gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                void onDeletePriority(priority.id)
                              }}
                              className="inline-flex h-7 w-7 items-center justify-center rounded text-[var(--danger)] transition-colors hover:bg-[var(--panel-2)] hover:text-[var(--danger)]"
                              title="Remove priority"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="hover:bg-[var(--accent-soft)]/60">
                      <TableCell colSpan={3} className="p-0">
                        <button
                          type="button"
                          className="flex h-full w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--muted)] transition-colors hover:text-[var(--accent)] disabled:opacity-50"
                          onClick={() => {
                            void handleAddPriority()
                          }}
                          disabled={priorities.length >= 7}
                        >
                          <Plus size={14} className="shrink-0" />
                          <span>
                            {priorities.length >= 7
                              ? 'Priority limit reached'
                              : 'Add a new priority'}
                          </span>
                        </button>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </section>

              <section className="workspace-section">
                <div className="mb-4">
                  <h2 className="mt-1 inline-flex items-center gap-2 text-2xl font-semibold text-[var(--text)]">
                    <NotebookPen size={20} className="text-[var(--accent)]" />
                    <span>Weekly Review</span>
                  </h2>
                  <p className="mt-1 text-sm workspace-meta">
                    Reflect on wins, misses, blockers, and what should carry forward.
                  </p>
                </div>
                <div className="grid gap-6 md:grid-cols-2">
                  {(['wins', 'misses', 'blockers', 'nextWeek'] as const).map((key) => (
                    <div key={key} className="space-y-2">
                      <h2 className="mt-1 inline-flex items-center gap-2 text-2xl font-semibold text-[var(--text)]">
                        {reviewHeadingIcon(key)}
                        <span>{labelForReviewKey(key)}</span>
                      </h2>
                      <p className="mt-1 text-sm workspace-meta">{placeholderForReviewKey(key)}</p>
                      <InlineEditableText
                        value={review?.[key] ?? ''}
                        onCommit={(nextValue) => handleReviewCommit(key, nextValue)}
                        displayAs="p"
                        displayClassName="cursor-text text-base font-medium text-[var(--text)] transition-colors hover:text-[var(--accent)]"
                        inputClassName="m-0 min-w-0 w-full border-0 bg-transparent p-0 text-base font-medium text-[var(--text)] outline-none"
                        placeholder={placeholderForReviewKey(key)}
                        title={`Click to edit ${labelForReviewKey(key).toLowerCase()}`}
                        allowEmpty={true}
                        normalize={(next) => next}
                        renderDisplay={(value) =>
                          value?.trim() ? (
                            value
                          ) : (
                            <span className="text-[var(--muted)]">
                              {placeholderForReviewKey(key)}
                            </span>
                          )
                        }
                      />
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function WeeklyPlanSidebar({
  state,
  loading,
  selectedWeekId,
  currentWeekId,
  nextWeekStart,
  todayIso,
  isReady,
  onSelectWeek,
  onCreateWeek
}: WeeklyPlanSidebarProps): ReactElement {
  const weeks = getSortedWeeks(state)

  const handleQuickCreateWeek = async (): Promise<void> => {
    if (!isReady) {
      return
    }
    await onCreateWeek({ startDate: nextWeekStart })
  }

  const handleJumpToCurrent = (): void => {
    if (currentWeekId) {
      onSelectWeek(currentWeekId)
    }
  }

  return (
    <div className="relative flex h-full flex-col">
      <DocumentWorkspacePanelHeader
        actions={
          <WorkspaceHeaderActions>
            <WorkspaceHeaderActionGroup>
              <button
                type="button"
                onClick={() => {
                  void handleQuickCreateWeek()
                }}
                disabled={!isReady}
                className={flatSidebarButtonClass}
                aria-label="New week"
                title="New week"
              >
                <Plus size={16} />
              </button>
            </WorkspaceHeaderActionGroup>
            <WorkspaceHeaderActionDivider />
            <WorkspaceHeaderActionGroup>
              <button
                type="button"
                onClick={() => handleJumpToCurrent()}
                disabled={!currentWeekId || !isReady}
                className={flatSidebarButtonClass}
                aria-label="Current week"
                title="Current week"
              >
                <CalendarDays size={18} className="text-current" />
              </button>
            </WorkspaceHeaderActionGroup>
          </WorkspaceHeaderActions>
        }
      />
      <DocumentWorkspacePanelContent className="p-3">
        <div className="flex flex-col gap-2">
          <WorkspacePanelSection>
            <WorkspacePanelSectionHeader
              icon={<CalendarDays size={16} aria-hidden="true" />}
              heading="All Week"
              description={`${weeks.length} saved weeks${currentWeekId ? ' · current week available' : ''}`}
            />
            <div className="space-y-2">
              {weeks.length === 0 ? (
                <div className="p-2 text-sm text-[var(--muted)]">
                  Nothing scheduled yet. Create your first week to get rolling.
                </div>
              ) : (
                weeks.map((week) => {
                  const weekPriorities = getWeekPriorities(state, week.id)
                  const doneCount = weekPriorities.filter(
                    (priority) => priority.status === 'done'
                  ).length
                  const range = formatWeekRange(week.startDate, week.endDate)
                  const isCurrent = !!findWeekForDate([week], todayIso)
                  return (
                    <button
                      key={week.id}
                      type="button"
                      onClick={() => onSelectWeek(week.id)}
                      className={cn(
                        'flex w-full flex-col gap-1.5 rounded-xl border px-3 py-2.5 text-left transition-colors',
                        selectedWeekId === week.id
                          ? 'border-[var(--accent-line)] bg-[var(--accent-soft)]'
                          : 'border-[var(--line)] bg-[var(--panel-2)] hover:border-[var(--accent)]'
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="truncate text-lg font-bold text-[var(--text)]">{range}</div>
                        <span className={metaPillClass}>
                          {doneCount}/{weekPriorities.length}
                        </span>
                      </div>
                      <div className="line-clamp-2 text-sm text-[var(--muted)]">
                        {week.focus?.trim()
                          ? week.focus
                          : 'No weekly focus yet. Open this week to set one.'}
                      </div>
                      <div className="flex min-w-0 items-center gap-1 overflow-hidden text-xs text-[var(--muted)]">
                        {isCurrent ? (
                          <span className={cn(neutralChipClass, 'text-[var(--accent)]')}>
                            <Circle size={10} /> Current
                          </span>
                        ) : null}
                        <span className={neutralChipClass}>
                          <Pencil size={12} aria-hidden="true" />
                          {new Date(week.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </WorkspacePanelSection>
        </div>
      </DocumentWorkspacePanelContent>
      {loading ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[var(--panel)]/60">
          <Loader2 className="animate-spin" />
        </div>
      ) : null}
    </div>
  )
}

type WeeklyPrioritySortKey = 'status' | 'title'
type WeeklyPrioritySortDirection = 'asc' | 'desc'

interface WeeklyPrioritySortState {
  key: WeeklyPrioritySortKey
  direction: WeeklyPrioritySortDirection
}

function compareWeeklyPriorities(
  left: WeeklyPlanPriority,
  right: WeeklyPlanPriority,
  key: WeeklyPrioritySortKey,
  direction: WeeklyPrioritySortDirection
): number {
  const factor = direction === 'asc' ? 1 : -1

  if (key === 'status') {
    const statusResult =
      WEEKLY_PRIORITY_STATUS_ORDER[left.status] - WEEKLY_PRIORITY_STATUS_ORDER[right.status]
    if (statusResult !== 0) {
      return statusResult * factor
    }
  } else {
    const titleResult = left.title.localeCompare(right.title)
    if (titleResult !== 0) {
      return titleResult * factor
    }
  }

  return left.order - right.order
}

const WEEKLY_PRIORITY_STATUS_ORDER: Record<WeeklyPlanPriority['status'], number> = {
  planned: 0,
  in_progress: 1,
  done: 2
}

function labelForReviewKey(key: 'wins' | 'misses' | 'blockers' | 'nextWeek'): string {
  switch (key) {
    case 'wins':
      return 'Wins'
    case 'misses':
      return 'Misses'
    case 'blockers':
      return 'Blockers'
    case 'nextWeek':
      return 'Next week'
  }
}

function placeholderForReviewKey(key: 'wins' | 'misses' | 'blockers' | 'nextWeek'): string {
  switch (key) {
    case 'wins':
      return 'Capture a win worth remembering.'
    case 'misses':
      return 'Note what slipped or stayed unfinished.'
    case 'blockers':
      return 'Call out what got in the way.'
    case 'nextWeek':
      return 'Set the direction for next week.'
  }
}

function reviewHeadingIcon(key: 'wins' | 'misses' | 'blockers' | 'nextWeek'): ReactElement {
  switch (key) {
    case 'wins':
      return <Trophy size={20} className="text-[var(--accent)]" />
    case 'misses':
      return <Pencil size={20} className="text-[var(--accent)]" />
    case 'blockers':
      return <CircleAlert size={20} className="text-[var(--accent)]" />
    case 'nextWeek':
      return <ArrowRight size={20} className="text-[var(--accent)]" />
  }
}
