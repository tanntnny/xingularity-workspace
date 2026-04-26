import { Fragment, type ReactElement, useEffect, useMemo, useRef, useState } from 'react'
import { format, parseISO } from 'date-fns'
import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  CircleDashed,
  FileText,
  Flag,
  Funnel,
  MoreHorizontal,
  Plus,
  Tag
} from 'lucide-react'
import { type NoteListItem } from '../../../shared/types'
import { generateProjectTag, isProjectTag } from '../../../shared/noteTags'
import { InlineEditableText } from '../components/InlineEditableText'
import { TagChip } from '../components/TagChip'
import { type ProjectListItem, type ProjectMilestone } from '../components/ProjectPreviewList'
import { NoteShapeIcon } from '../components/NoteShapeIcon'
import { Button } from '../components/ui/button'
import { Calendar } from '../components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover'
import { TabMenu, TabMenuItem } from '../components/ui/tab-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '../components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  SortableTableHead,
  TableRow
} from '../components/ui/table'
import { usePersistentState } from '../hooks/usePersistentState'
import { PROJECT_STATUS_META, getProjectHealthSummary } from '../lib/projectStatus'
import { canUseNativeMenus, getElementMenuPosition, showNativeMenu } from '../lib/nativeMenu'
import { cn } from '../lib/utils'

interface ProjectDetailsPageProps {
  project: ProjectListItem
  notes: NoteListItem[]
  focusedMilestoneId?: string | null
  focusedMilestoneToken?: number
  nameEditToken?: number
  onRename: (nextName: string) => void
  onUpdateSummary: (nextSummary: string) => void
  onAddMilestone: (title: string, dueDate?: string) => void
  onRenameMilestone: (milestoneId: string, nextTitle: string) => void
  onUpdateMilestoneDescription: (milestoneId: string, nextDescription: string) => void
  onUpdateMilestoneDueDate: (milestoneId: string, nextDueDate: string | undefined) => void
  onToggleMilestoneCollapsed: (milestoneId: string) => void
  onCycleMilestonePriority: (milestoneId: string) => void
  onRemoveMilestone: (milestoneId: string) => void
  onAddSubtask: (milestoneId: string, title: string) => void
  onToggleSubtask: (milestoneId: string, subtaskId: string) => void
  onCycleSubtaskPriority: (milestoneId: string, subtaskId: string) => void
  onRenameSubtask: (milestoneId: string, subtaskId: string, nextTitle: string) => void
  onUpdateSubtaskDescription: (
    milestoneId: string,
    subtaskId: string,
    nextDescription: string
  ) => void
  onMoveMilestone: (milestoneId: string, direction: 'up' | 'down') => void
  onReorderMilestones: (orderedMilestoneIds: string[]) => void
  onMoveSubtask: (milestoneId: string, subtaskId: string, direction: 'up' | 'down') => void
  onReorderSubtasks: (milestoneId: string, orderedSubtaskIds: string[]) => void
  onRemoveSubtask: (milestoneId: string, subtaskId: string) => void
  onDuplicateMilestone?: (milestoneId: string) => void
  onDuplicateSubtask?: (milestoneId: string, subtaskId: string) => void
  onCopyMilestoneLink?: (milestoneId: string) => void
  onCopySubtaskLink?: (milestoneId: string, subtaskId: string) => void
  onCreateProjectNote: () => void
  onOpenNote: (relPath: string) => void
}

type ProjectNoteRow = {
  relPath: string
  name: string
  tags: string[]
}

const neutralChipClass =
  'inline-flex min-w-0 shrink-0 items-center gap-1 rounded-full border border-[var(--tag-neutral-line)] bg-[var(--tag-neutral-bg)] px-2 py-0.5 text-xs leading-[1.2] text-[var(--tag-neutral-text)]'
const defaultProjectNoteSort: ProjectNoteSortState = {
  key: 'name',
  direction: 'asc'
}
const defaultProjectMilestoneSort: ProjectMilestoneSortState = {
  key: 'dueDate',
  direction: 'asc'
}

export function ProjectDetailsPage({
  project,
  notes,
  focusedMilestoneId = null,
  focusedMilestoneToken = 0,
  nameEditToken = 0,
  onRename,
  onUpdateSummary,
  onAddMilestone,
  onRenameMilestone,
  onUpdateMilestoneDueDate,
  onToggleMilestoneCollapsed,
  onCycleMilestonePriority,
  onRemoveMilestone: _onRemoveMilestone,
  onAddSubtask,
  onToggleSubtask,
  onCycleSubtaskPriority,
  onRenameSubtask,
  onRemoveSubtask,
  onDuplicateMilestone,
  onDuplicateSubtask,
  onCopyMilestoneLink,
  onCopySubtaskLink,
  onCreateProjectNote,
  onOpenNote
}: ProjectDetailsPageProps): ReactElement {
  const useNativeMenus = canUseNativeMenus()
  const [isCreatingMilestone, setIsCreatingMilestone] = useState(false)
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('')
  const [newMilestoneDueDate, setNewMilestoneDueDate] = useState<string | undefined>(
    toIsoDate(new Date())
  )
  const [creatingSubtaskByMilestoneId, setCreatingSubtaskByMilestoneId] = useState<
    Record<string, boolean>
  >({})
  const [newSubtaskTitleByMilestoneId, setNewSubtaskTitleByMilestoneId] = useState<
    Record<string, string>
  >({})
  const [activeTab, setActiveTab] = useState<'milestones' | 'notes'>('milestones')
  const [noteSort, setNoteSort] = usePersistentState<ProjectNoteSortState>(
    'beacon:project-details:note-sort',
    defaultProjectNoteSort,
    { validate: isProjectNoteSortState }
  )
  const [milestoneSort, setMilestoneSort] = usePersistentState<ProjectMilestoneSortState>(
    'beacon:project-details:milestone-sort',
    defaultProjectMilestoneSort,
    { validate: isProjectMilestoneSortState }
  )
  const [hideCompletedItems, setHideCompletedItems] = usePersistentState<boolean>(
    'beacon:project-details:hide-completed-items',
    false,
    { validate: (value): value is boolean => typeof value === 'boolean' }
  )
  const [highlightedMilestoneId, setHighlightedMilestoneId] = useState<string | null>(null)
  const milestoneRowRefs = useRef<Record<string, HTMLTableRowElement | null>>({})

  const projectTag = useMemo(() => generateProjectTag(project.id), [project.id])

  const projectNotes = useMemo(() => {
    return notes.filter((note) => note.tags.includes(projectTag))
  }, [notes, projectTag])

  useEffect(() => {
    if (!focusedMilestoneId) {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      if (hideCompletedItems) {
        setHideCompletedItems(false)
      }

      if (activeTab !== 'milestones') {
        setActiveTab('milestones')
        return
      }

      const target = milestoneRowRefs.current[focusedMilestoneId]
      if (!target) {
        return
      }
      target.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setHighlightedMilestoneId(focusedMilestoneId)
    })

    const timeout = window.setTimeout(() => {
      setHighlightedMilestoneId((current) => (current === focusedMilestoneId ? null : current))
    }, 2200)

    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(timeout)
    }
  }, [
    activeTab,
    focusedMilestoneId,
    focusedMilestoneToken,
    hideCompletedItems,
    project.id,
    setHideCompletedItems
  ])

  const submitMilestone = (): void => {
    const nextTitle = newMilestoneTitle.trim()
    const nextDueDate = newMilestoneDueDate?.trim() || undefined
    if (!nextTitle) {
      return
    }

    onAddMilestone(nextTitle, nextDueDate)
    setNewMilestoneTitle('')
    setNewMilestoneDueDate(toIsoDate(new Date()))
    setIsCreatingMilestone(false)
  }

  const startCreatingSubtask = (milestoneId: string): void => {
    setCreatingSubtaskByMilestoneId((current) => ({ ...current, [milestoneId]: true }))
    setNewSubtaskTitleByMilestoneId((current) => ({ ...current, [milestoneId]: '' }))
  }

  const cancelCreatingSubtask = (milestoneId: string): void => {
    setCreatingSubtaskByMilestoneId((current) => ({ ...current, [milestoneId]: false }))
    setNewSubtaskTitleByMilestoneId((current) => ({ ...current, [milestoneId]: '' }))
  }

  const submitSubtask = (milestoneId: string): void => {
    const nextTitle = (newSubtaskTitleByMilestoneId[milestoneId] ?? '').trim()
    if (!nextTitle) {
      return
    }

    onAddSubtask(milestoneId, nextTitle)
    cancelCreatingSubtask(milestoneId)
  }

  const projectNoteRows = useMemo<ProjectNoteRow[]>(() => {
    return [...projectNotes]
      .map((note) => ({ relPath: note.relPath, name: note.name, tags: note.tags }))
      .sort((left, right) => compareProjectNoteRows(left, right, noteSort))
  }, [noteSort, projectNotes])

  const visibleMilestones = useMemo(() => {
    return [...project.milestones]
      .sort((left, right) => compareMilestones(left, right, milestoneSort))
      .reduce<ProjectMilestone[]>((accumulator, milestone) => {
        if (hideCompletedItems && isMilestoneDone(milestone)) {
          return accumulator
        }

        const subtasks = [...milestone.subtasks].sort((left, right) =>
          compareSubtasks(left, right, milestoneSort)
        )

        accumulator.push({
          ...milestone,
          subtasks: hideCompletedItems ? subtasks.filter((subtask) => !subtask.completed) : subtasks
        })

        return accumulator
      }, [])
  }, [hideCompletedItems, milestoneSort, project.milestones])
  const healthSummary = useMemo(() => getProjectHealthSummary(project), [project])

  const openProjectNoteMenu = async (button: HTMLButtonElement, relPath: string): Promise<void> => {
    const actionId = await showNativeMenu(
      [{ id: 'open', label: 'Open note' }],
      getElementMenuPosition(button)
    )

    if (!actionId) {
      return
    }
    if (actionId === 'open') {
      onOpenNote(relPath)
    }
  }

  const toggleNoteSort = (key: ProjectNoteSortKey): void => {
    setNoteSort((current) =>
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' }
    )
  }

  const toggleMilestoneSort = (key: ProjectMilestoneSortKey): void => {
    setMilestoneSort((current) =>
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: key === 'dueDate' ? 'asc' : 'asc' }
    )
  }

  return (
    <div className="workspace-clear-surface h-full overflow-auto">
      <div className="flex flex-col gap-3 px-8 py-5">
        <div className="flex min-w-0 items-center gap-1">
          <NoteShapeIcon icon={project.icon} size={20} className="shrink-0" />
          <InlineEditableText
            value={project.name}
            onCommit={onRename}
            editToken={nameEditToken}
            displayAs="h2"
            displayClassName="m-0 min-w-0 cursor-text truncate text-4xl font-bold text-[var(--text)] hover:text-[var(--accent)]"
            inputClassName="m-0 min-w-0 flex-1 border-0 bg-transparent text-4xl font-bold text-[var(--text)] outline-none"
            title="Click to rename"
          />
        </div>

        <InlineEditableText
          value={project.summary}
          onCommit={onUpdateSummary}
          displayAs="p"
          displayClassName="cursor-text text-sm text-[var(--muted)] hover:text-[var(--accent)]"
          inputClassName="border-0 bg-transparent text-sm text-[var(--muted)] outline-none"
          title="Click to edit details"
          placeholder="Add project details here."
          allowEmpty={true}
          normalize={(next) => next.trim()}
        />

        <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className={cn(
                    neutralChipClass,
                    'cursor-help',
                    PROJECT_STATUS_META[project.status].className
                  )}
                  tabIndex={0}
                >
                  <CircleDashed size={12} aria-hidden="true" />
                  {PROJECT_STATUS_META[project.status].label}
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs space-y-1.5 text-left">
                <div className="font-semibold text-[var(--text)]">
                  Status: {PROJECT_STATUS_META[healthSummary.status].label}
                </div>
                <div>{healthSummary.reason}</div>
                <div>
                  {healthSummary.completedMilestones}/{healthSummary.totalMilestones} milestones
                  complete
                </div>
                <div>
                  In progress: {healthSummary.inProgressMilestones} · Pending:{' '}
                  {healthSummary.pendingMilestones}
                </div>
                <div>
                  Blocked: {healthSummary.blockedMilestones} · Overdue:{' '}
                  {healthSummary.overdueMilestones}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <span className={neutralChipClass}>
            <CircleDashed size={12} aria-hidden="true" />
            Progress: {project.progress}%
          </span>
          <span className={neutralChipClass}>
            <CalendarDays size={12} aria-hidden="true" />
            Last updated: {new Date(project.updatedAt).toLocaleDateString()}
          </span>
        </div>
      </div>

      <div className="workspace-clear-surface flex shrink-0 flex-col gap-2 px-8 py-2">
        <TabMenu
          variant="inline-accent"
          className="project-tab-menu"
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as 'milestones' | 'notes')}
        >
          <TabMenuItem variant="inline-accent" className="project-tab-menu-item" value="milestones">
            <span className="inline-flex items-center gap-1.5">
              <Flag size={14} aria-hidden="true" />
              Milestones
            </span>
          </TabMenuItem>
          <TabMenuItem variant="inline-accent" className="project-tab-menu-item" value="notes">
            <span className="inline-flex items-center gap-1.5">
              <FileText size={14} aria-hidden="true" />
              Project Notes
            </span>
          </TabMenuItem>
        </TabMenu>
      </div>

      {activeTab === 'notes' && (
        <section className="px-8 pb-6">
          <div className="p-4">
            <Table className="rounded-xl">
              <TableHeader>
                <TableRow>
                  <SortableTableHead
                    className="w-[45%]"
                    isActive={noteSort.key === 'name'}
                    sortDirection={noteSort.direction}
                    onToggleSort={() => toggleNoteSort('name')}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <FileText size={12} aria-hidden="true" />
                      Note
                    </span>
                  </SortableTableHead>
                  <SortableTableHead
                    className="w-[45%]"
                    isActive={noteSort.key === 'tags'}
                    sortDirection={noteSort.direction}
                    onToggleSort={() => toggleNoteSort('tags')}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Tag size={12} aria-hidden="true" />
                      Tags
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
                {projectNoteRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3}>
                      <div className="py-2 text-sm text-[var(--muted)]">
                        No notes tagged for this project yet.
                      </div>
                    </TableCell>
                  </TableRow>
                ) : null}
                {projectNoteRows.map((row) => (
                  <TableRow key={row.relPath}>
                    <TableCell className="p-0">
                      <button
                        type="button"
                        className="flex h-full w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:text-[var(--accent)]"
                        onClick={() => onOpenNote(row.relPath)}
                      >
                        <span>{row.name}</span>
                      </button>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {row.tags
                          .filter((tag) => !isProjectTag(tag))
                          .slice(0, 3)
                          .map((tag) => (
                            <TagChip key={tag} tag={tag} />
                          ))}
                      </div>
                    </TableCell>
                    <TableCell className="px-2 py-1 text-left">
                      {useNativeMenus ? (
                        <button
                          type="button"
                          className="inline-flex h-7 w-7 items-center justify-center rounded text-[var(--muted)] transition-colors hover:bg-[var(--panel-2)] hover:text-[var(--accent)]"
                          aria-label="Open note actions"
                          onClick={(event) => {
                            void openProjectNoteMenu(event.currentTarget, row.relPath)
                          }}
                        >
                          <MoreHorizontal size={14} />
                        </button>
                      ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="inline-flex h-7 w-7 items-center justify-center rounded text-[var(--muted)] transition-colors hover:bg-[var(--panel-2)] hover:text-[var(--accent)]"
                              aria-label="Open note actions"
                            >
                              <MoreHorizontal size={14} />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onClick={() => onOpenNote(row.relPath)}>
                              Open note
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="hover:bg-[var(--accent-soft)]/60">
                  <TableCell colSpan={3} className="p-0">
                    <button
                      type="button"
                      className="flex h-full w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--muted)] transition-colors hover:text-[var(--accent)]"
                      onClick={onCreateProjectNote}
                    >
                      <Plus size={14} className="shrink-0" />
                      <span>New note</span>
                    </button>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      {activeTab === 'milestones' && (
        <section className="px-8 pb-8">
          <div className="p-4">
            <Table className="rounded-xl">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[48px] px-2 text-center">
                    <button
                      type="button"
                      className={cn(
                        'inline-flex h-7 w-7 items-center justify-center rounded transition-colors hover:bg-[var(--panel)] hover:text-[var(--text)]',
                        hideCompletedItems ? 'text-[var(--accent)]' : 'text-[var(--muted)]'
                      )}
                      onClick={() => setHideCompletedItems((current) => !current)}
                      aria-label={
                        hideCompletedItems ? 'Show completed items' : 'Hide completed items'
                      }
                      title={hideCompletedItems ? 'Show completed items' : 'Hide completed items'}
                    >
                      <Funnel size={12} aria-hidden="true" />
                    </button>
                  </TableHead>
                  <SortableTableHead
                    className="w-[68%]"
                    isActive={milestoneSort.key === 'title'}
                    sortDirection={milestoneSort.direction}
                    onToggleSort={() => toggleMilestoneSort('title')}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <FileText size={12} aria-hidden="true" />
                      Task
                    </span>
                  </SortableTableHead>
                  <SortableTableHead
                    className="w-[1%] whitespace-nowrap px-3"
                    isActive={milestoneSort.key === 'dueDate'}
                    sortDirection={milestoneSort.direction}
                    onToggleSort={() => toggleMilestoneSort('dueDate')}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays size={12} aria-hidden="true" />
                      Due Date
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
                {visibleMilestones.map((milestone) => {
                  const isCreatingSubtask = creatingSubtaskByMilestoneId[milestone.id] ?? false
                  const draftTitle = newSubtaskTitleByMilestoneId[milestone.id] ?? ''
                  const milestoneProgressPercent = getMilestoneProgressPercent(milestone)

                  return (
                    <Fragment key={milestone.id}>
                      <TableRow
                        ref={(node) => {
                          milestoneRowRefs.current[milestone.id] = node
                        }}
                        className={cn(
                          'bg-[var(--accent-soft)] transition-colors',
                          highlightedMilestoneId === milestone.id
                            ? 'ring-1 ring-inset ring-[var(--accent)] bg-[color-mix(in_srgb,var(--accent-soft)_55%,var(--panel))]'
                            : undefined
                        )}
                      >
                        <TableCell className="px-3 py-2 text-center">
                          <button
                            type="button"
                            className="inline-flex h-6 w-6 items-center justify-center rounded text-[var(--muted)] transition-colors hover:text-[var(--accent)]"
                            onClick={(event) => {
                              event.stopPropagation()
                              onToggleMilestoneCollapsed(milestone.id)
                            }}
                            aria-label={
                              milestone.collapsed
                                ? 'Expand milestone subtasks'
                                : 'Collapse milestone subtasks'
                            }
                          >
                            {milestone.collapsed ? (
                              <ChevronRight size={14} />
                            ) : (
                              <ChevronDown size={14} />
                            )}
                          </button>
                        </TableCell>
                        <TableCell className="p-0">
                          <div className="flex min-w-0">
                            <InlineEditableText
                              value={milestone.title}
                              onCommit={(nextTitle) => onRenameMilestone(milestone.id, nextTitle)}
                              displayAs="span"
                              displayClassName="block h-full min-w-[120px] w-full cursor-text px-3 py-2 text-left font-semibold text-[var(--text)] transition-colors hover:text-[var(--accent)]"
                              inputClassName="h-full min-w-[120px] w-full border-0 bg-transparent px-3 py-2 font-semibold text-[var(--text)] outline-none"
                              title="Click to rename milestone"
                              renderDisplay={(value) => (
                                <>
                                  {value}
                                  <span className="ml-2 text-[0.82em] font-medium text-[var(--muted)]">
                                    {milestoneProgressPercent}% complete
                                  </span>
                                </>
                              )}
                            />
                          </div>
                        </TableCell>
                        <TableCell className="w-[1%] whitespace-nowrap px-1 py-0">
                          <MilestoneCalendarPicker
                            value={milestone.dueDate}
                            onChange={(nextDate) =>
                              onUpdateMilestoneDueDate(milestone.id, nextDate)
                            }
                            aria-label="Milestone due date"
                            className="h-8 justify-start bg-transparent px-2 text-xs hover:bg-transparent"
                          />
                        </TableCell>
                        <TableCell className="px-2 py-1">
                          <div className="flex items-center justify-start gap-1">
                            <button
                              type="button"
                              className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md transition-colors ${subtaskPriorityButtonClass(milestone.priority)}`}
                              onClick={() => onCycleMilestonePriority(milestone.id)}
                              title={`Priority: ${formatSubtaskPriority(milestone.priority)}. Click to change priority.`}
                              aria-label={`Change priority for ${milestone.title}`}
                            >
                              <Flag size={13} />
                            </button>
                            {useNativeMenus ? (
                              <button
                                type="button"
                                className="inline-flex h-7 w-7 items-center justify-center rounded text-[var(--muted)] transition-colors hover:bg-[var(--panel-2)] hover:text-[var(--accent)]"
                                aria-label="Open milestone actions"
                                onClick={async (event) => {
                                  const actionId = await showNativeMenu(
                                    [
                                      ...(onDuplicateMilestone
                                        ? [{ id: 'duplicate', label: 'Duplicate' }]
                                        : []),
                                      ...(onCopyMilestoneLink
                                        ? [{ id: 'copy-link', label: 'Copy link' }]
                                        : []),
                                      {
                                        id: 'unschedule',
                                        label: 'Make unscheduled'
                                      },
                                      { type: 'separator' as const },
                                      {
                                        id: 'delete',
                                        label: 'Delete',
                                        accelerator: 'Command+Backspace'
                                      }
                                    ],
                                    getElementMenuPosition(event.currentTarget)
                                  )

                                  if (!actionId) {
                                    return
                                  }
                                  if (actionId === 'duplicate' && onDuplicateMilestone) {
                                    onDuplicateMilestone(milestone.id)
                                  } else if (actionId === 'copy-link' && onCopyMilestoneLink) {
                                    onCopyMilestoneLink(milestone.id)
                                  } else if (actionId === 'unschedule') {
                                    onUpdateMilestoneDueDate(milestone.id, undefined)
                                  } else if (actionId === 'delete') {
                                    _onRemoveMilestone(milestone.id)
                                  }
                                }}
                              >
                                <MoreHorizontal size={14} />
                              </button>
                            ) : (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    type="button"
                                    className="inline-flex h-7 w-7 items-center justify-center rounded text-[var(--muted)] transition-colors hover:bg-[var(--panel-2)] hover:text-[var(--accent)]"
                                    aria-label="Open milestone actions"
                                  >
                                    <MoreHorizontal size={14} />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-44">
                                  {onDuplicateMilestone ? (
                                    <DropdownMenuItem
                                      onClick={() => onDuplicateMilestone(milestone.id)}
                                    >
                                      Duplicate
                                    </DropdownMenuItem>
                                  ) : null}
                                  {onCopyMilestoneLink ? (
                                    <DropdownMenuItem
                                      onClick={() => onCopyMilestoneLink(milestone.id)}
                                    >
                                      Copy link
                                    </DropdownMenuItem>
                                  ) : null}
                                  <DropdownMenuItem
                                    onClick={() =>
                                      onUpdateMilestoneDueDate(milestone.id, undefined)
                                    }
                                  >
                                    Make unscheduled
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => _onRemoveMilestone(milestone.id)}
                                  >
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                            <button
                              type="button"
                              className="inline-flex h-7 w-7 items-center justify-center rounded text-[var(--muted)] transition-colors hover:bg-[var(--panel-2)] hover:text-[var(--accent)]"
                              onClick={() => startCreatingSubtask(milestone.id)}
                              aria-label="Add subtask"
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {milestone.collapsed
                        ? null
                        : milestone.subtasks.map((subtask) => (
                            <Fragment key={`subtask-fragment-${milestone.id}-${subtask.id}`}>
                              <TableRow key={`subtask-${milestone.id}-${subtask.id}`}>
                                <TableCell className="px-3 py-2 text-center">
                                  <div className="flex items-center justify-center">
                                    <input
                                      type="checkbox"
                                      checked={subtask.completed}
                                      onChange={() => {
                                        onToggleSubtask(milestone.id, subtask.id)
                                      }}
                                      className="h-4 w-4 rounded border-[var(--line-strong)]"
                                    />
                                  </div>
                                </TableCell>
                                <TableCell className="p-0">
                                  <div className="flex min-w-0 items-center gap-2 px-3 py-2">
                                    <InlineEditableText
                                      value={subtask.title}
                                      onCommit={(nextTitle) => {
                                        onRenameSubtask(milestone.id, subtask.id, nextTitle)
                                      }}
                                      displayAs="span"
                                      displayClassName="block h-full min-w-[140px] w-full cursor-text px-1 py-0 text-sm text-[var(--text)] transition-colors hover:text-[var(--accent)]"
                                      inputClassName="h-full min-w-[140px] w-full border-0 bg-transparent px-1 py-0 text-sm text-[var(--text)] outline-none"
                                      title="Click to rename subtask"
                                    />
                                  </div>
                                </TableCell>
                                <TableCell className="w-[1%] whitespace-nowrap px-1 py-0">
                                  <span className="block h-full w-full px-1.5 py-2 text-sm text-[var(--muted)]">
                                    -
                                  </span>
                                </TableCell>
                                <TableCell className="px-2 py-1 text-left">
                                  <div className="flex items-center justify-start gap-1">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onCycleSubtaskPriority(milestone.id, subtask.id)
                                      }
                                      className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md transition-colors ${subtaskPriorityButtonClass(subtask.priority)}`}
                                      title={`Priority: ${formatSubtaskPriority(subtask.priority)}. Click to change priority.`}
                                      aria-label={`Change priority for ${subtask.title}`}
                                    >
                                      <Flag size={13} />
                                    </button>
                                    {useNativeMenus ? (
                                      <button
                                        type="button"
                                        className="inline-flex h-7 w-7 items-center justify-center rounded text-[var(--muted)] transition-colors hover:bg-[var(--panel-2)] hover:text-[var(--accent)]"
                                        aria-label="Open subtask actions"
                                        onClick={async (event) => {
                                          const actionId = await showNativeMenu(
                                            [
                                              ...(onDuplicateSubtask
                                                ? [{ id: 'duplicate', label: 'Duplicate' }]
                                                : []),
                                              ...(onCopySubtaskLink
                                                ? [{ id: 'copy-link', label: 'Copy link' }]
                                                : []),
                                              { type: 'separator' as const },
                                              {
                                                id: 'delete',
                                                label: 'Delete',
                                                accelerator: 'Command+Backspace'
                                              }
                                            ],
                                            getElementMenuPosition(event.currentTarget)
                                          )

                                          if (!actionId) {
                                            return
                                          }
                                          if (actionId === 'duplicate' && onDuplicateSubtask) {
                                            onDuplicateSubtask(milestone.id, subtask.id)
                                          } else if (
                                            actionId === 'copy-link' &&
                                            onCopySubtaskLink
                                          ) {
                                            onCopySubtaskLink(milestone.id, subtask.id)
                                          } else if (actionId === 'delete') {
                                            onRemoveSubtask(milestone.id, subtask.id)
                                          }
                                        }}
                                      >
                                        <MoreHorizontal size={14} />
                                      </button>
                                    ) : (
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <button
                                            type="button"
                                            className="inline-flex h-7 w-7 items-center justify-center rounded text-[var(--muted)] transition-colors hover:bg-[var(--panel-2)] hover:text-[var(--accent)]"
                                            aria-label="Open subtask actions"
                                          >
                                            <MoreHorizontal size={14} />
                                          </button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-44">
                                          {onDuplicateSubtask ? (
                                            <DropdownMenuItem
                                              onClick={() =>
                                                onDuplicateSubtask(milestone.id, subtask.id)
                                              }
                                            >
                                              Duplicate
                                            </DropdownMenuItem>
                                          ) : null}
                                          {onCopySubtaskLink ? (
                                            <DropdownMenuItem
                                              onClick={() =>
                                                onCopySubtaskLink(milestone.id, subtask.id)
                                              }
                                            >
                                              Copy link
                                            </DropdownMenuItem>
                                          ) : null}
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem
                                            onClick={() =>
                                              onRemoveSubtask(milestone.id, subtask.id)
                                            }
                                          >
                                            Delete
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            </Fragment>
                          ))}
                      {milestone.collapsed || !isCreatingSubtask ? null : (
                        <TableRow className="hover:bg-[var(--accent-soft)]/60">
                          <TableCell colSpan={4} className="p-0">
                            <div className="flex items-center gap-2 rounded-md border border-dashed border-[var(--accent)] px-3 py-2">
                              <input
                                type="text"
                                value={draftTitle}
                                onChange={(event) =>
                                  setNewSubtaskTitleByMilestoneId((current) => ({
                                    ...current,
                                    [milestone.id]: event.target.value
                                  }))
                                }
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter') {
                                    submitSubtask(milestone.id)
                                    return
                                  }

                                  if (event.key === 'Escape') {
                                    cancelCreatingSubtask(milestone.id)
                                  }
                                }}
                                placeholder="Subtask title"
                                autoFocus
                                className="min-w-0 flex-1 border-0 bg-transparent text-sm text-[var(--text)] outline-none"
                              />
                              <button
                                type="button"
                                className="rounded-md border border-[var(--line)] px-2 py-1 text-xs"
                                onClick={() => submitSubtask(milestone.id)}
                              >
                                Add
                              </button>
                              <button
                                type="button"
                                className="rounded-md border border-[var(--line)] px-2 py-1 text-xs"
                                onClick={() => cancelCreatingSubtask(milestone.id)}
                              >
                                Cancel
                              </button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  )
                })}
                <TableRow className="hover:bg-[var(--accent-soft)]/60">
                  <TableCell colSpan={4} className="p-0">
                    {isCreatingMilestone ? (
                      <div className="grid gap-2 rounded-md border border-dashed border-[var(--accent)] px-3 py-2 md:grid-cols-[minmax(0,1fr)_180px_auto_auto]">
                        <input
                          type="text"
                          value={newMilestoneTitle}
                          onChange={(event) => setNewMilestoneTitle(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              submitMilestone()
                              return
                            }

                            if (event.key === 'Escape') {
                              setNewMilestoneTitle('')
                              setNewMilestoneDueDate(toIsoDate(new Date()))
                              setIsCreatingMilestone(false)
                            }
                          }}
                          placeholder="Milestone title"
                          autoFocus
                          className="min-w-0 border-0 bg-transparent text-sm text-[var(--text)] outline-none"
                        />
                        <MilestoneCalendarPicker
                          value={newMilestoneDueDate}
                          onChange={(nextDate) => setNewMilestoneDueDate(nextDate)}
                          aria-label="New milestone due date"
                          className="h-8 justify-start text-xs"
                        />
                        <button
                          type="button"
                          className="rounded-md border border-[var(--line)] px-2 py-1 text-xs"
                          onClick={submitMilestone}
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          className="rounded-md border border-[var(--line)] px-2 py-1 text-xs"
                          onClick={() => {
                            setNewMilestoneTitle('')
                            setNewMilestoneDueDate(toIsoDate(new Date()))
                            setIsCreatingMilestone(false)
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="flex h-full w-full items-center px-3 py-2 text-left text-sm text-[var(--muted)] transition-colors hover:text-[var(--accent)]"
                        onClick={() => setIsCreatingMilestone(true)}
                      >
                        + New milestone
                      </button>
                    )}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </section>
      )}
    </div>
  )
}

function MilestoneCalendarPicker({
  value,
  onChange,
  className,
  'aria-label': ariaLabel
}: {
  value?: string
  onChange: (nextDate: string | undefined) => void
  className?: string
  'aria-label'?: string
}): ReactElement {
  const date = value ? parseISO(value) : undefined

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'w-full min-w-[130px] justify-start text-left font-normal',
            !date && 'text-[var(--muted-foreground)]',
            className
          )}
          aria-label={ariaLabel}
        >
          {date ? format(date, 'MMM d, yyyy') : <span>Unscheduled</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="border-b border-[var(--line)] p-1">
          <button
            type="button"
            className="flex w-full items-center justify-start rounded-sm px-3 py-2 text-sm text-[var(--muted)] transition-colors hover:bg-[var(--panel-2)] hover:text-[var(--text)]"
            onClick={() => onChange(undefined)}
          >
            Unscheduled milestone
          </button>
        </div>
        <Calendar
          mode="single"
          selected={date}
          onSelect={(selected) => {
            if (!selected) {
              return
            }
            onChange(format(selected, 'yyyy-MM-dd'))
          }}
          captionLayout="dropdown"
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function getMilestoneProgressPercent(milestone: ProjectMilestone): number {
  const total = milestone.subtasks.length
  if (total === 0) {
    return 0
  }

  const completed = milestone.subtasks.filter((subtask) => subtask.completed).length
  return Math.round((completed / total) * 100)
}

function isMilestoneDone(milestone: ProjectMilestone): boolean {
  if (milestone.status === 'completed') {
    return true
  }

  return milestone.subtasks.length > 0 && milestone.subtasks.every((subtask) => subtask.completed)
}

function formatSubtaskPriority(priority?: 'low' | 'medium' | 'high'): string {
  if (priority === 'high') {
    return 'High'
  }
  if (priority === 'medium') {
    return 'Medium'
  }
  return 'Low'
}

function subtaskPriorityButtonClass(priority?: 'low' | 'medium' | 'high'): string {
  if (priority === 'high') {
    return 'border-[color:rgba(239,68,68,0.35)] bg-[color:rgba(239,68,68,0.12)] text-[color:#b91c1c] hover:border-[color:rgba(239,68,68,0.55)]'
  }
  if (priority === 'medium') {
    return 'border-[color:rgba(245,158,11,0.35)] bg-[color:rgba(245,158,11,0.12)] text-[color:#b45309] hover:border-[color:rgba(245,158,11,0.55)]'
  }
  return 'border-[color:rgba(34,197,94,0.35)] bg-[color:rgba(34,197,94,0.12)] text-[color:#15803d] hover:border-[color:rgba(34,197,94,0.55)]'
}

type ProjectNoteSortKey = 'name' | 'tags'
type ProjectMilestoneSortKey = 'title' | 'dueDate'
type SortDirection = 'asc' | 'desc'

interface ProjectNoteSortState {
  key: ProjectNoteSortKey
  direction: SortDirection
}

interface ProjectMilestoneSortState {
  key: ProjectMilestoneSortKey
  direction: SortDirection
}

function isProjectNoteSortState(value: unknown): value is ProjectNoteSortState {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { key?: unknown }).key !== undefined &&
    ((value as { key?: unknown }).key === 'name' || (value as { key?: unknown }).key === 'tags') &&
    ((value as { direction?: unknown }).direction === 'asc' ||
      (value as { direction?: unknown }).direction === 'desc')
  )
}

function isProjectMilestoneSortState(value: unknown): value is ProjectMilestoneSortState {
  return (
    typeof value === 'object' &&
    value !== null &&
    ((value as { key?: unknown }).key === 'title' ||
      (value as { key?: unknown }).key === 'dueDate') &&
    ((value as { direction?: unknown }).direction === 'asc' ||
      (value as { direction?: unknown }).direction === 'desc')
  )
}

function compareProjectNoteRows(
  left: ProjectNoteRow,
  right: ProjectNoteRow,
  sort: ProjectNoteSortState
): number {
  const factor = sort.direction === 'asc' ? 1 : -1

  if (sort.key === 'tags') {
    const tagLabelResult = buildTagSortLabel(left.tags).localeCompare(buildTagSortLabel(right.tags))
    if (tagLabelResult !== 0) {
      return tagLabelResult * factor
    }
  } else {
    const nameResult = left.name.localeCompare(right.name)
    if (nameResult !== 0) {
      return nameResult * factor
    }
  }

  return left.name.localeCompare(right.name)
}

function compareMilestones(
  left: ProjectMilestone,
  right: ProjectMilestone,
  sort: ProjectMilestoneSortState
): number {
  return compareProjectRows(
    {
      title: left.title,
      description: left.description,
      dueDate: left.dueDate,
      createdAt: left.subtasks[0]?.createdAt ?? left.dueDate ?? ''
    },
    {
      title: right.title,
      description: right.description,
      dueDate: right.dueDate,
      createdAt: right.subtasks[0]?.createdAt ?? right.dueDate ?? ''
    },
    sort
  )
}

function compareSubtasks(
  left: { title: string; description?: string; dueDate?: string; createdAt: string },
  right: { title: string; description?: string; dueDate?: string; createdAt: string },
  sort: ProjectMilestoneSortState
): number {
  return compareProjectRows(left, right, sort)
}

function compareProjectRows(
  left: { title: string; description?: string; dueDate?: string; createdAt: string },
  right: { title: string; description?: string; dueDate?: string; createdAt: string },
  sort: ProjectMilestoneSortState
): number {
  const factor = sort.direction === 'asc' ? 1 : -1

  if (sort.key === 'title') {
    const titleResult = left.title.localeCompare(right.title)
    if (titleResult !== 0) {
      return titleResult * factor
    }
  } else {
    const dueDateResult = compareNullableText(left.dueDate, right.dueDate)
    if (dueDateResult !== 0) {
      return dueDateResult * factor
    }
  }

  const fallbackTitleResult = left.title.localeCompare(right.title)
  if (fallbackTitleResult !== 0) {
    return fallbackTitleResult
  }

  return left.createdAt.localeCompare(right.createdAt)
}

function compareNullableText(left?: string, right?: string): number {
  if (left && right) {
    return left.localeCompare(right)
  }
  if (left) {
    return -1
  }
  if (right) {
    return 1
  }
  return 0
}

function buildTagSortLabel(tags: string[]): string {
  return tags
    .filter((tag) => !isProjectTag(tag))
    .sort((left, right) => left.localeCompare(right))
    .join('|')
}
