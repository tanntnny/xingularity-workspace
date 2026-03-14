import { useEffect, useMemo, useState, type ReactElement } from 'react'
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  Circle,
  Link2,
  Loader2,
  Plus,
  Trash2
} from 'lucide-react'
import type {
  CalendarTask,
  CreateWeeklyPlanPriorityInput,
  CreateWeeklyPlanWeekInput,
  DeleteWeeklyPlanWeekInput,
  Project,
  ReorderWeeklyPlanPrioritiesInput,
  UpdateWeeklyPlanPriorityInput,
  UpdateWeeklyPlanWeekInput,
  UpsertWeeklyPlanReviewInput,
  WeeklyPlanPriority,
  WeeklyPlanState
} from '../../../shared/types'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
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
  projects: Project[]
  calendarTasks: CalendarTask[]
  onUpdateWeek: (input: UpdateWeeklyPlanWeekInput) => Promise<void>
  onDeleteWeek: (input: DeleteWeeklyPlanWeekInput) => Promise<void>
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
  onDeleteWeek: (input: DeleteWeeklyPlanWeekInput) => Promise<void>
}

export function WeeklyPlanWorkspace({
  state,
  loading,
  selectedWeekId,
  isReady,
  projects,
  calendarTasks,
  onUpdateWeek,
  onDeleteWeek,
  onAddPriority,
  onUpdatePriority,
  onDeletePriority,
  onReorderPriorities,
  onUpsertReview
}: WeeklyPlanWorkspaceProps): ReactElement {
  const selectedWeek = state?.weeks.find((week) => week.id === selectedWeekId) ?? null
  const priorities = getWeekPriorities(state, selectedWeekId)
  const review = getWeekReview(state, selectedWeekId)

  const [focusDraft, setFocusDraft] = useState('')
  const [reviewDraft, setReviewDraft] = useState({ wins: '', misses: '', blockers: '', nextWeek: '' })
  const [isSavingReview, setIsSavingReview] = useState(false)

  useEffect(() => {
    setFocusDraft(selectedWeek?.focus ?? '')
  }, [selectedWeek])

  useEffect(() => {
    setReviewDraft({
      wins: review?.wins ?? '',
      misses: review?.misses ?? '',
      blockers: review?.blockers ?? '',
      nextWeek: review?.nextWeek ?? ''
    })
  }, [review])

  const linkOptions = useMemo(() => buildLinkOptions(projects, calendarTasks), [projects, calendarTasks])

  const handleFocusBlur = async (): Promise<void> => {
    if (!selectedWeek) {
      return
    }
    await onUpdateWeek({ id: selectedWeek.id, focus: focusDraft.trim() ? focusDraft : null })
  }

  const handleDateChange = async (field: 'startDate' | 'endDate', value: string): Promise<void> => {
    if (!selectedWeek || !value) {
      return
    }
    await onUpdateWeek({ id: selectedWeek.id, [field]: value })
  }

  const handleDeleteWeek = async (): Promise<void> => {
    if (!selectedWeek) {
      return
    }
    if (!window.confirm('Delete this week plan? This cannot be undone.')) {
      return
    }
    await onDeleteWeek({ id: selectedWeek.id })
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

  const handlePriorityMove = async (priorityId: string, delta: -1 | 1): Promise<void> => {
    if (!selectedWeekId) {
      return
    }
    const index = priorities.findIndex((priority) => priority.id === priorityId)
    if (index === -1) {
      return
    }
    const targetIndex = index + delta
    if (targetIndex < 0 || targetIndex >= priorities.length) {
      return
    }
    const nextOrder = [...priorities]
    const [moved] = nextOrder.splice(index, 1)
    nextOrder.splice(targetIndex, 0, moved)
    await onReorderPriorities({ weekId: selectedWeekId, priorityIds: nextOrder.map((item) => item.id) })
  }

  const handleLinkChange = async (priority: WeeklyPlanPriority, value: string): Promise<void> => {
    const payload: UpdateWeeklyPlanPriorityInput = { id: priority.id }
    if (!value) {
      payload.linkedProjectId = null
      payload.linkedMilestoneId = null
      payload.linkedSubtaskId = null
      payload.linkedTaskId = null
    } else {
      const [type, ...rest] = value.split(':')
      if (type === 'project') {
        payload.linkedProjectId = rest[0] ?? null
        payload.linkedMilestoneId = null
        payload.linkedSubtaskId = null
        payload.linkedTaskId = null
      } else if (type === 'milestone') {
        payload.linkedProjectId = rest[0] ?? null
        payload.linkedMilestoneId = rest[1] ?? null
        payload.linkedSubtaskId = null
        payload.linkedTaskId = null
      } else if (type === 'subtask') {
        payload.linkedProjectId = rest[0] ?? null
        payload.linkedMilestoneId = rest[1] ?? null
        payload.linkedSubtaskId = rest[2] ?? null
        payload.linkedTaskId = null
      } else if (type === 'task') {
        payload.linkedTaskId = rest[0] ?? null
        payload.linkedProjectId = null
        payload.linkedMilestoneId = null
        payload.linkedSubtaskId = null
      }
    }
    await onUpdatePriority(payload)
  }

  const handleSaveReview = async (): Promise<void> => {
    if (!selectedWeek) {
      return
    }
    setIsSavingReview(true)
    await onUpsertReview({
      weekId: selectedWeek.id,
      wins: reviewDraft.wins.trim() ? reviewDraft.wins : null,
      misses: reviewDraft.misses.trim() ? reviewDraft.misses : null,
      blockers: reviewDraft.blockers.trim() ? reviewDraft.blockers : null,
      nextWeek: reviewDraft.nextWeek.trim() ? reviewDraft.nextWeek : null
    })
    setIsSavingReview(false)
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
          Weekly Plan isn't available in this build yet. Restart Beacon after updating or make sure you're running the latest desktop app.
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
      <div className="flex-1 overflow-y-auto p-6">
        {selectedWeek ? (
          <div className="space-y-6">
            <section className="rounded-2xl border border-[var(--line)] bg-[var(--panel-2)] p-5 shadow-inner">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Selected Week</p>
                  <div className="mt-2 text-2xl font-semibold text-[var(--text)]">
                    {formatWeekRange(selectedWeek.startDate, selectedWeek.endDate)}
                  </div>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {progress.total ? `${progress.done}/${progress.total} priorities complete` : 'Add priorities to track progress'}
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                    Week window
                  </label>
                  <div className="flex items-center gap-3 text-sm">
                    <Input
                      type="date"
                      value={selectedWeek.startDate}
                      onChange={(event) => {
                        void handleDateChange('startDate', event.currentTarget.value)
                      }}
                      className="max-w-[180px]"
                    />
                    <span className="text-[var(--muted)]">to</span>
                    <Input
                      type="date"
                      value={selectedWeek.endDate}
                      onChange={(event) => {
                        void handleDateChange('endDate', event.currentTarget.value)
                      }}
                      className="max-w-[180px]"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="self-end text-[var(--danger)] hover:text-[var(--danger)]"
                    onClick={() => {
                      void handleDeleteWeek()
                    }}
                  >
                    <Trash2 size={16} className="mr-2" /> Delete week
                  </Button>
                </div>
              </div>
              <div className="mt-6">
                <label className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                  Weekly focus
                </label>
                <Input
                  value={focusDraft}
                  onChange={(event) => setFocusDraft(event.currentTarget.value)}
                  onBlur={() => {
                    void handleFocusBlur()
                  }}
                  placeholder="Ship mobile beta, shore up onboarding, etc."
                  className="mt-2"
                />
              </div>
            </section>

            <section className="rounded-2xl border border-[var(--line)] bg-[var(--panel-2)] p-5">
              <div className="flex flex-wrap items-center gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Weekly Priorities</p>
                  <p className="text-sm text-[var(--muted)]">Aim for 3–7 focused outcomes</p>
                </div>
                <div className="ml-auto flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      void handleAddPriority()
                    }}
                    disabled={priorities.length >= 7}
                  >
                    <Plus size={16} className="mr-1.5" /> Add priority
                  </Button>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {priorities.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[var(--line)] bg-[var(--panel)] p-6 text-center text-sm text-[var(--muted)]">
                    Capture the top commitments that make this week successful.
                  </div>
                ) : (
                  priorities.map((priority, index) => (
                    <div
                      key={priority.id}
                      className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4"
                    >
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--panel-2)] text-sm font-semibold text-[var(--muted)]">
                          {index + 1}
                        </div>
                        <Input
                          value={priority.title}
                          onChange={(event) => {
                            void onUpdatePriority({ id: priority.id, title: event.currentTarget.value })
                          }}
                          className="flex-1"
                        />
                        <select
                          value={priority.status}
                          onChange={(event) => {
                            void onUpdatePriority({
                              id: priority.id,
                              status: event.currentTarget.value as WeeklyPlanPriority['status']
                            })
                          }}
                          className="rounded-lg border border-[var(--line)] bg-[var(--panel-2)] px-3 py-1 text-sm text-[var(--text)]"
                        >
                          <option value="planned">Planned</option>
                          <option value="in_progress">In progress</option>
                          <option value="done">Done</option>
                        </select>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              void handlePriorityMove(priority.id, -1)
                            }}
                            className="inline-flex h-8 w-8 items-center justify-center rounded border border-[var(--line)] bg-[var(--panel-2)] disabled:opacity-40"
                            disabled={index === 0}
                            title="Move up"
                          >
                            <ArrowUp size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              void handlePriorityMove(priority.id, 1)
                            }}
                            className="inline-flex h-8 w-8 items-center justify-center rounded border border-[var(--line)] bg-[var(--panel-2)] disabled:opacity-40"
                            disabled={index === priorities.length - 1}
                            title="Move down"
                          >
                            <ArrowDown size={16} />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            void onDeletePriority(priority.id)
                          }}
                          className="inline-flex h-8 w-8 items-center justify-center rounded border border-[var(--line)] bg-[var(--panel)] text-[var(--danger)]"
                          title="Remove priority"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-[var(--muted)]">
                        <Link2 size={14} />
                        <select
                          value={resolvePriorityLinkValue(priority)}
                          onChange={(event) => {
                            void handleLinkChange(priority, event.currentTarget.value)
                          }}
                          className="min-w-[220px] rounded-lg border border-[var(--line)] bg-[var(--panel-2)] px-2 py-1 text-[var(--text)]"
                        >
                          <option value="">No link</option>
                          {linkOptions.projects.length ? (
                            <optgroup label="Projects">
                              {linkOptions.projects.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </optgroup>
                          ) : null}
                          {linkOptions.milestones.length ? (
                            <optgroup label="Milestones">
                              {linkOptions.milestones.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </optgroup>
                          ) : null}
                          {linkOptions.subtasks.length ? (
                            <optgroup label="Subtasks">
                              {linkOptions.subtasks.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </optgroup>
                          ) : null}
                          {linkOptions.tasks.length ? (
                            <optgroup label="Tasks">
                              {linkOptions.tasks.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </optgroup>
                          ) : null}
                        </select>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-[var(--line)] bg-[var(--panel-2)] p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Weekly Review</p>
                  <p className="text-sm text-[var(--muted)]">Reflect on wins, misses, blockers, and tee up next week.</p>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    void handleSaveReview()
                  }}
                  disabled={isSavingReview || !selectedWeek}
                >
                  {isSavingReview ? <Loader2 size={16} className="mr-2 animate-spin" /> : null}
                  Save review
                </Button>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {(['wins', 'misses', 'blockers', 'nextWeek'] as const).map((key) => (
                  <div key={key} className="flex flex-col">
                    <label className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                      {labelForReviewKey(key)}
                    </label>
                    <textarea
                      value={reviewDraft[key]}
                      onChange={(event) =>
                        setReviewDraft((draft) => ({ ...draft, [key]: event.currentTarget.value }))
                      }
                      rows={4}
                      className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3 text-sm text-[var(--text)] shadow-inner"
                      placeholder={placeholderForReviewKey(key)}
                    />
                  </div>
                ))}
              </div>
            </section>
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
  onCreateWeek,
  onDeleteWeek
}: WeeklyPlanSidebarProps): ReactElement {
  const weeks = getSortedWeeks(state)
  const selectedWeek = state?.weeks.find((week) => week.id === selectedWeekId) ?? null
  const priorities = getWeekPriorities(state, selectedWeekId)
  const review = getWeekReview(state, selectedWeekId)
  const progress = priorities.length
    ? `${priorities.filter((priority) => priority.status === 'done').length}/${priorities.length}`
    : '0/0'
  const [newWeekStart, setNewWeekStart] = useState(nextWeekStart)
  const [newWeekFocus, setNewWeekFocus] = useState('')

  useEffect(() => {
    setNewWeekStart(nextWeekStart)
  }, [nextWeekStart])

  const handleCreateWeek = async (): Promise<void> => {
    if (!newWeekStart || !isReady) {
      return
    }
    await onCreateWeek({
      startDate: newWeekStart,
      focus: newWeekFocus.trim() ? newWeekFocus : undefined
    })
    setNewWeekFocus('')
    setNewWeekStart(addIsoDays(newWeekStart, 7))
  }

  const handleJumpToCurrent = (): void => {
    if (currentWeekId) {
      onSelectWeek(currentWeekId)
    }
  }

  const handleDeleteSelected = async (): Promise<void> => {
    if (!selectedWeek) {
      return
    }
    if (!window.confirm('Delete this week plan?')) {
      return
    }
    await onDeleteWeek({ id: selectedWeek.id })
  }

  return (
    <div className="relative flex h-full flex-col">
      <div className="border-b border-[var(--line)] bg-[var(--panel)] p-4">
        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            onClick={() => handleJumpToCurrent()}
            disabled={!currentWeekId}
          >
            <CalendarDays size={16} className="mr-2" /> Current week
          </Button>
          <Button
            variant="ghost"
            className="justify-start text-[var(--danger)] hover:text-[var(--danger)]"
            disabled={!selectedWeek}
            onClick={() => {
              void handleDeleteSelected()
            }}
          >
            <Trash2 size={16} className="mr-2" /> Delete selected
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel-2)] p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Start a new week</p>
            <div className="mt-3 space-y-3 text-sm">
              <label className="flex flex-col gap-1">
                <span className="text-[var(--muted)]">Week start</span>
                <Input
                  type="date"
                  value={newWeekStart}
                  onChange={(event) => setNewWeekStart(event.currentTarget.value)}
                  disabled={!isReady}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[var(--muted)]">Focus (optional)</span>
                <Input
                  value={newWeekFocus}
                  onChange={(event) => setNewWeekFocus(event.currentTarget.value)}
                  placeholder="Key theme for the week"
                  disabled={!isReady}
                />
              </label>
              <Button
                className="w-full"
                onClick={() => {
                  void handleCreateWeek()
                }}
                disabled={!newWeekStart || !isReady}
              >
                <Plus size={16} className="mr-2" /> Create week
              </Button>
              {!isReady ? (
                <p className="text-xs text-[var(--muted)]">
                  Restart the app after updating to enable Weekly Plan storage.
                </p>
              ) : null}
            </div>
          </div>
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel-2)] p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Summary</p>
            {selectedWeek ? (
              <div className="mt-3 space-y-3 text-sm">
                <div>
                  <p className="text-[var(--muted)]">Week range</p>
                  <p className="text-base font-semibold text-[var(--text)]">
                    {formatWeekRange(selectedWeek.startDate, selectedWeek.endDate)}
                  </p>
                </div>
                <div>
                  <p className="text-[var(--muted)]">Focus</p>
                  <p className="text-[var(--text)]">
                    {selectedWeek.focus?.trim() ? selectedWeek.focus : 'Add a focus to stay aligned'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--panel)] px-2 py-1 text-xs font-semibold text-[var(--text)]">
                    {progress} done
                  </span>
                  <span className="text-xs text-[var(--muted)]">
                    Updated {new Date(selectedWeek.updatedAt).toLocaleDateString()}
                  </span>
                </div>
                {review && review.wins ? (
                  <div>
                    <p className="text-[var(--muted)]">Last win</p>
                    <p className="text-[var(--text)]">{review.wins}</p>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="mt-3 text-sm text-[var(--muted)]">Select a week to see details.</p>
            )}
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Weeks</p>
            <div className="mt-3 space-y-2">
              {weeks.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[var(--line)] bg-[var(--panel)] p-4 text-sm text-[var(--muted)]">
                  Nothing scheduled yet. Create your first week to get rolling.
                </div>
              ) : (
                weeks.map((week) => {
                  const weekPriorities = getWeekPriorities(state, week.id)
                  const doneCount = weekPriorities.filter((priority) => priority.status === 'done').length
                  const range = formatWeekRange(week.startDate, week.endDate)
                  const isCurrent = !!findWeekForDate([week], todayIso)
                  return (
                    <button
                      key={week.id}
                      type="button"
                      onClick={() => onSelectWeek(week.id)}
                      className={cn(
                        'w-full rounded-2xl border px-4 py-3 text-left transition-colors',
                        selectedWeekId === week.id
                          ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                          : 'border-[var(--line)] bg-[var(--panel)] hover:border-[var(--accent)]'
                      )}
                    >
                      <div className="flex items-center justify-between text-sm font-semibold text-[var(--text)]">
                        <span>{range}</span>
                        <span className="text-xs text-[var(--muted)]">{doneCount}/{weekPriorities.length}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-[var(--muted)]">
                        {isCurrent ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--panel-2)] px-2 py-0.5 text-[var(--accent)]">
                            <Circle size={10} /> Current
                          </span>
                        ) : null}
                        <span>Updated {new Date(week.updatedAt).toLocaleDateString()}</span>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>
      {loading ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[var(--panel)]/60">
          <Loader2 className="animate-spin" />
        </div>
      ) : null}
    </div>
  )
}

function buildLinkOptions(projects: Project[], calendarTasks: CalendarTask[]) {
  const projectsGroup = projects.map((project) => ({
    value: `project:${project.id}`,
    label: project.name
  }))
  const milestonesGroup = projects.flatMap((project) =>
    project.milestones.map((milestone) => ({
      value: `milestone:${project.id}:${milestone.id}`,
      label: `${project.name} · ${milestone.title}`
    }))
  )
  const subtasksGroup = projects.flatMap((project) =>
    project.milestones.flatMap((milestone) =>
      milestone.subtasks.map((subtask) => ({
        value: `subtask:${project.id}:${milestone.id}:${subtask.id}`,
        label: `${project.name} · ${milestone.title} › ${subtask.title}`
      }))
    )
  )
  const tasksGroup = calendarTasks.map((task) => ({
    value: `task:${task.id}`,
    label: `${task.title}${task.date ? ` · ${task.date}` : ''}`
  }))

  return {
    projects: projectsGroup,
    milestones: milestonesGroup,
    subtasks: subtasksGroup,
    tasks: tasksGroup
  }
}

function resolvePriorityLinkValue(priority: WeeklyPlanPriority): string {
  if (priority.linkedSubtaskId && priority.linkedProjectId && priority.linkedMilestoneId) {
    return `subtask:${priority.linkedProjectId}:${priority.linkedMilestoneId}:${priority.linkedSubtaskId}`
  }
  if (priority.linkedMilestoneId && priority.linkedProjectId) {
    return `milestone:${priority.linkedProjectId}:${priority.linkedMilestoneId}`
  }
  if (priority.linkedProjectId) {
    return `project:${priority.linkedProjectId}`
  }
  if (priority.linkedTaskId) {
    return `task:${priority.linkedTaskId}`
  }
  return ''
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
      return 'What went well?'
    case 'misses':
      return 'What slipped?'
    case 'blockers':
      return 'Anything in the way?'
    case 'nextWeek':
      return "What's the goal for next week?"
  }
}

function addIsoDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00`)
  if (Number.isNaN(date.getTime())) {
    return isoDate
  }
  date.setDate(date.getDate() + days)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
