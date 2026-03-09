import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { DragEvent, ReactElement, useEffect, useMemo, useState } from 'react'
import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  CircleDashed,
  Copy,
  FileText,
  GripVertical,
  Link,
  MoreHorizontal,
  Pencil,
  Plus,
  Tag,
  Trash2
} from 'lucide-react'
import { NoteListItem } from '../../../shared/types'
import { generateProjectTag } from '../../../shared/noteTags'
import { InlineEditableText } from '../components/InlineEditableText'
import { ProjectListItem, ProjectMilestone, ProjectSubtask } from '../components/ProjectPreviewList'
import { NoteShapeIcon } from '../components/NoteShapeIcon'
import { DatePickerISO } from '../components/ui/date-picker'
import { TagChip } from '../components/TagChip'
import { Badge } from '../components/ui/badge'
import { ButtonGroup, ButtonGroupItem } from '../components/ui/button-group'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '../components/ui/context-menu'

function SubtaskBranchConnector({
  isFirst,
  isLast,
  connectToParent = false
}: {
  isFirst: boolean
  isLast: boolean
  connectToParent?: boolean
}): ReactElement {
  return (
    <svg
      viewBox="0 0 20 100"
      preserveAspectRatio="none"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="h-full w-[1.4rem] text-[color-mix(in_srgb,var(--line)_92%,transparent)]"
      aria-hidden="true"
    >
      {!isFirst || connectToParent ? (
        <path
          d="M3 0 L3 42"
          stroke="currentColor"
          strokeWidth="1.8"
          fill="none"
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
      <path
        d="M3 42 L3 50 Q3 58 11 58 L17 58"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M13 53 L19 58 L13 63"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        vectorEffect="non-scaling-stroke"
      />
      {!isLast ? (
        <path
          d="M3 58 L3 100"
          stroke="currentColor"
          strokeWidth="1.8"
          fill="none"
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
    </svg>
  )
}

interface ProjectDetailsPageProps {
  project: ProjectListItem
  notes: NoteListItem[]
  onRename: (nextName: string) => void
  onUpdateSummary: (nextSummary: string) => void
  onAddMilestone: (title: string, dueDate: string) => void
  onRenameMilestone: (milestoneId: string, nextTitle: string) => void
  onUpdateMilestoneDueDate: (milestoneId: string, nextDueDate: string) => void
  onRemoveMilestone: (milestoneId: string) => void
  onAddSubtask: (milestoneId: string, title: string) => void
  onToggleSubtask: (milestoneId: string, subtaskId: string) => void
  onRenameSubtask: (milestoneId: string, subtaskId: string, nextTitle: string) => void
  onUpdateSubtaskDueDate: (milestoneId: string, subtaskId: string, nextDueDate: string) => void
  onMoveMilestone: (milestoneId: string, direction: 'up' | 'down') => void
  onMoveSubtask: (milestoneId: string, subtaskId: string, direction: 'up' | 'down') => void
  onRemoveSubtask: (milestoneId: string, subtaskId: string) => void
  onDuplicateMilestone?: (milestoneId: string) => void
  onDuplicateSubtask?: (milestoneId: string, subtaskId: string) => void
  onCopyMilestoneLink?: (milestoneId: string) => void
  onCopySubtaskLink?: (milestoneId: string, subtaskId: string) => void
  onCreateProjectNote: () => void
  onOpenNote: (relPath: string) => void
  onAddTagToNote?: (relPath: string, tag: string) => void
  onRemoveTagFromNote?: (relPath: string, tag: string) => void
}

type MilestoneTableRow =
  | {
      id: string
      kind: 'milestone'
      milestone: ProjectMilestone
      progressPercent: number
      isCollapsed: boolean
    }
  | {
      id: string
      kind: 'subtask'
      milestone: ProjectMilestone
      subtask: ProjectSubtask
      isFirstSubtask: boolean
      isLastSubtask: boolean
    }
  | {
      id: string
      kind: 'subtask-create'
      milestone: ProjectMilestone
      isCreating: boolean
      draftTitle: string
    }

const neutralChipClass =
  'inline-flex min-w-0 shrink-0 items-center gap-1 rounded-full border border-[var(--tag-neutral-line)] bg-[var(--tag-neutral-bg)] px-2 py-0.5 text-xs leading-[1.2] text-[var(--tag-neutral-text)]'

const sheetWrapClass =
  'mt-3 overflow-x-auto rounded-[0.85rem] border border-[var(--line)] bg-[linear-gradient(180deg,var(--panel-2)_0%,var(--panel)_100%)]'

const sheetTableClass = 'w-full min-w-[620px] border-collapse'

const sheetHeadCellClass =
  'border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--panel-3)_68%,transparent)] px-[0.9rem] py-3 text-left text-[0.7rem] uppercase tracking-[0.06em] text-[var(--muted)]'

const sheetCellClass =
  'border-b border-[color-mix(in_srgb,var(--line)_72%,transparent)] px-[0.9rem] align-middle text-[0.87rem]'

const sheetMilestoneRowClass =
  'group bg-[color-mix(in_srgb,var(--panel)_88%,var(--accent-soft))] hover:bg-[color-mix(in_srgb,var(--accent-soft)_45%,var(--panel))]'

const sheetSubtaskRowClass =
  'group bg-[color-mix(in_srgb,var(--panel)_96%,transparent)] hover:bg-[color-mix(in_srgb,var(--accent-soft)_45%,var(--panel))]'

const sheetSubtaskCompletedRowClass =
  'group bg-[color-mix(in_srgb,var(--tag-1-bg)_62%,var(--panel))] hover:bg-[color-mix(in_srgb,var(--tag-1-bg)_72%,var(--panel))]'

const sheetSubtaskPendingRowClass =
  'group bg-[color-mix(in_srgb,var(--tag-2-bg)_58%,var(--panel))] hover:bg-[color-mix(in_srgb,var(--tag-2-bg)_68%,var(--panel))]'

const rowMenuTriggerClass =
  'milestone-sheet-row-menu-trigger inline-flex h-6 w-6 items-center justify-center rounded-[0.4rem] border border-transparent bg-transparent text-[var(--muted)] opacity-0 transition-all duration-150 ease-in group-hover:opacity-100 focus-visible:opacity-100 hover:border-[var(--accent-line)] hover:text-[var(--text)] focus-visible:border-[var(--accent-line)] focus-visible:text-[var(--text)]'

const collapseToggleClass =
  'inline-flex h-5 w-5 items-center justify-center rounded-[0.32rem] border border-transparent bg-transparent text-[var(--muted)] transition-all duration-150 ease-in hover:border-[var(--accent-line)] hover:text-[var(--text)] focus-visible:border-[var(--accent-line)] focus-visible:text-[var(--text)]'

const gripClass =
  'inline-flex h-5 w-5 items-center justify-center rounded-[0.32rem] border border-transparent bg-transparent text-[var(--muted)] transition-all duration-150 ease-in hover:border-[var(--accent-line)] hover:bg-[color-mix(in_srgb,var(--accent-soft)_58%,var(--panel))] hover:text-[var(--text)] focus-visible:border-[var(--accent-line)] focus-visible:bg-[color-mix(in_srgb,var(--accent-soft)_58%,var(--panel))] focus-visible:text-[var(--text)]'

const titleInputClass =
  'flex-1 min-w-0 rounded-[0.32rem] border-0 bg-transparent px-[0.2rem] py-[0.15rem] text-left text-[var(--text)] outline outline-1 outline-transparent focus:outline-[var(--accent-line)] focus:bg-[color-mix(in_srgb,var(--panel)_70%,var(--accent-soft))]'

const subtaskInputClass =
  'flex-1 min-w-0 rounded-[0.32rem] border-0 bg-transparent px-[0.2rem] py-[0.15rem] text-left text-[var(--text)] outline outline-1 outline-transparent focus:outline-[var(--accent-line)] focus:bg-[color-mix(in_srgb,var(--panel)_70%,var(--accent-soft))]'

const inlineActionButtonClass =
  'rounded-[0.45rem] border border-[var(--line)] bg-[var(--panel)] px-[0.45rem] py-[0.2rem] text-[0.74rem] text-[var(--muted)] hover:border-[var(--accent-line)] hover:text-[var(--text)]'

const emptyStateClass = 'px-[0.9rem] py-6 text-center text-[var(--muted)]'

const addSubtaskButtonClass =
  'rounded-[0.45rem] border border-[var(--line)] bg-[var(--panel)] px-[0.45rem] py-[0.2rem] text-[0.74rem] text-[var(--muted)] hover:border-[var(--accent-line)] hover:text-[var(--text)]'

export function ProjectDetailsPage({
  project,
  notes,
  onRename,
  onUpdateSummary,
  onAddMilestone,
  onRenameMilestone,
  onUpdateMilestoneDueDate,
  onRemoveMilestone,
  onAddSubtask,
  onToggleSubtask,
  onRenameSubtask,
  onUpdateSubtaskDueDate,
  onMoveMilestone,
  onMoveSubtask,
  onRemoveSubtask,
  onDuplicateMilestone,
  onDuplicateSubtask,
  onCopyMilestoneLink,
  onCopySubtaskLink,
  onCreateProjectNote,
  onOpenNote,
  onAddTagToNote,
  onRemoveTagFromNote
}: ProjectDetailsPageProps): ReactElement {
  const [isCreatingMilestone, setIsCreatingMilestone] = useState(false)
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('')
  const [newMilestoneDueDate, setNewMilestoneDueDate] = useState(toIsoDate(new Date()))
  const [collapsedMilestoneIds, setCollapsedMilestoneIds] = useState<Set<string>>(new Set())
  const [creatingSubtaskByMilestoneId, setCreatingSubtaskByMilestoneId] = useState<
    Record<string, boolean>
  >({})
  const [newSubtaskTitleByMilestoneId, setNewSubtaskTitleByMilestoneId] = useState<
    Record<string, string>
  >({})
  const [isNotePickerOpen, setIsNotePickerOpen] = useState(false)
  const [notePickerSearchQuery, setNotePickerSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'milestones' | 'notes'>('milestones')

  // Generate the project tag for filtering notes
  const projectTag = useMemo(() => generateProjectTag(project.name), [project.name])

  // Filter notes that have this project's tag
  const projectNotes = useMemo(() => {
    return notes.filter((note) => note.tags.includes(projectTag))
  }, [notes, projectTag])

  // Notes that can be associated with this project (don't already have the project tag)
  const availableNotesForAssociation = useMemo(() => {
    const available = notes.filter((note) => !note.tags.includes(projectTag))
    if (!notePickerSearchQuery.trim()) {
      return available.slice(0, 10) // Limit to 10 results when no search
    }
    const query = notePickerSearchQuery.toLowerCase()
    return available.filter((note) => note.name.toLowerCase().includes(query)).slice(0, 10)
  }, [notes, projectTag, notePickerSearchQuery])

  useEffect(() => {
    const validIds = new Set(project.milestones.map((milestone) => milestone.id))

    setCreatingSubtaskByMilestoneId((current) => {
      const next = Object.fromEntries(
        Object.entries(current).filter(([milestoneId]) => validIds.has(milestoneId))
      )
      return next
    })

    setNewSubtaskTitleByMilestoneId((current) => {
      const next = Object.fromEntries(
        Object.entries(current).filter(([milestoneId]) => validIds.has(milestoneId))
      )
      return next
    })
  }, [project.milestones])

  const submitMilestone = (): void => {
    const nextTitle = newMilestoneTitle.trim()
    const nextDueDate = newMilestoneDueDate.trim()
    if (!nextTitle || !nextDueDate) {
      return
    }

    onAddMilestone(nextTitle, nextDueDate)
    setNewMilestoneTitle('')
    setNewMilestoneDueDate(toIsoDate(new Date()))
    setIsCreatingMilestone(false)
  }

  const toggleMilestoneCollapsed = (milestoneId: string): void => {
    setCollapsedMilestoneIds((current) => {
      const next = new Set(current)
      if (next.has(milestoneId)) {
        next.delete(milestoneId)
      } else {
        next.add(milestoneId)
      }
      return next
    })
  }

  const moveMilestoneSteps = (
    milestoneId: string,
    direction: 'up' | 'down',
    count: number
  ): void => {
    for (let index = 0; index < count; index += 1) {
      onMoveMilestone(milestoneId, direction)
    }
  }

  const moveSubtaskSteps = (
    milestoneId: string,
    subtaskId: string,
    direction: 'up' | 'down',
    count: number
  ): void => {
    for (let index = 0; index < count; index += 1) {
      onMoveSubtask(milestoneId, subtaskId, direction)
    }
  }

  const handleMilestoneDrop = (sourceMilestoneId: string, targetMilestoneId: string): void => {
    if (sourceMilestoneId === targetMilestoneId) {
      return
    }

    const sourceIndex = project.milestones.findIndex(
      (milestone) => milestone.id === sourceMilestoneId
    )
    const targetIndex = project.milestones.findIndex(
      (milestone) => milestone.id === targetMilestoneId
    )

    if (sourceIndex < 0 || targetIndex < 0) {
      return
    }

    if (sourceIndex < targetIndex) {
      moveMilestoneSteps(sourceMilestoneId, 'down', targetIndex - sourceIndex)
      return
    }

    moveMilestoneSteps(sourceMilestoneId, 'up', sourceIndex - targetIndex)
  }

  const handleSubtaskDrop = (
    milestoneId: string,
    sourceSubtaskId: string,
    targetSubtaskId: string
  ): void => {
    if (sourceSubtaskId === targetSubtaskId) {
      return
    }

    const milestone = project.milestones.find((item) => item.id === milestoneId)
    if (!milestone) {
      return
    }

    const sourceIndex = milestone.subtasks.findIndex((subtask) => subtask.id === sourceSubtaskId)
    const targetIndex = milestone.subtasks.findIndex((subtask) => subtask.id === targetSubtaskId)

    if (sourceIndex < 0 || targetIndex < 0) {
      return
    }

    if (sourceIndex < targetIndex) {
      moveSubtaskSteps(milestoneId, sourceSubtaskId, 'down', targetIndex - sourceIndex)
      return
    }

    moveSubtaskSteps(milestoneId, sourceSubtaskId, 'up', sourceIndex - targetIndex)
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

  const milestoneRows = useMemo<MilestoneTableRow[]>(() => {
    const rows: MilestoneTableRow[] = []

    project.milestones.forEach((milestone) => {
      const isCollapsed = collapsedMilestoneIds.has(milestone.id)
      rows.push({
        id: `milestone-${milestone.id}`,
        kind: 'milestone',
        milestone,
        progressPercent: getMilestoneProgressPercent(milestone),
        isCollapsed
      })

      if (isCollapsed) {
        return
      }

      milestone.subtasks.forEach((subtask, subtaskIndex) => {
        rows.push({
          id: `subtask-${milestone.id}-${subtask.id}`,
          kind: 'subtask',
          milestone,
          subtask,
          isFirstSubtask: subtaskIndex === 0,
          isLastSubtask: subtaskIndex === milestone.subtasks.length - 1
        })
      })

      rows.push({
        id: `subtask-create-${milestone.id}`,
        kind: 'subtask-create',
        milestone,
        isCreating: creatingSubtaskByMilestoneId[milestone.id] ?? false,
        draftTitle: newSubtaskTitleByMilestoneId[milestone.id] ?? ''
      })
    })

    return rows
  }, [
    project.milestones,
    collapsedMilestoneIds,
    creatingSubtaskByMilestoneId,
    newSubtaskTitleByMilestoneId
  ])

  const columns: ColumnDef<MilestoneTableRow>[] = useMemo(
    () => [
      {
        id: 'task',
        header: 'Task',
        cell: ({ row }) => {
          const item = row.original

          if (item.kind === 'milestone') {
            return (
              <div className="grid min-h-[2.2rem] grid-cols-[1.25rem_1.25rem_minmax(0,1fr)_1.5rem] items-center gap-2">
                <button
                  type="button"
                  className={collapseToggleClass}
                  onClick={() => toggleMilestoneCollapsed(item.milestone.id)}
                  aria-label={
                    item.isCollapsed ? 'Expand milestone subtasks' : 'Collapse milestone subtasks'
                  }
                  title={
                    item.isCollapsed ? 'Expand milestone subtasks' : 'Collapse milestone subtasks'
                  }
                >
                  {item.isCollapsed ? (
                    <ChevronRight size={14} aria-hidden="true" />
                  ) : (
                    <ChevronDown size={14} aria-hidden="true" />
                  )}
                </button>
                <button
                  type="button"
                  className={`${gripClass} cursor-grab active:cursor-grabbing`}
                  draggable
                  onDragStart={(event: DragEvent<HTMLButtonElement>) => {
                    event.dataTransfer.setData('text/drag-kind', 'milestone')
                    event.dataTransfer.setData('text/milestone-id', item.milestone.id)
                    event.dataTransfer.effectAllowed = 'move'
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'ArrowUp') {
                      event.preventDefault()
                      onMoveMilestone(item.milestone.id, 'up')
                      return
                    }

                    if (event.key === 'ArrowDown') {
                      event.preventDefault()
                      onMoveMilestone(item.milestone.id, 'down')
                    }
                  }}
                  aria-label="Move milestone"
                  title="Drag to reorder milestone"
                >
                  <GripVertical size={14} aria-hidden="true" />
                </button>
                <InlineEditableText
                  value={item.milestone.title}
                  onCommit={(nextTitle) => onRenameMilestone(item.milestone.id, nextTitle)}
                  displayAs="span"
                  displayClassName="min-w-[120px] flex-1 cursor-text text-left font-semibold text-[var(--text)]"
                  inputClassName={titleInputClass}
                  title="Click to rename milestone"
                  renderDisplay={(value) => (
                    <>
                      {value}
                      <span className="text-[0.82em] font-medium text-[var(--muted)]">
                        {' '}
                        {item.progressPercent}%
                      </span>
                    </>
                  )}
                />
                <ContextMenu>
                  <ContextMenuTrigger asChild>
                    <button
                      type="button"
                      className={rowMenuTriggerClass}
                      title="Milestone actions"
                      aria-label="Milestone actions"
                    >
                      <MoreHorizontal size={14} aria-hidden="true" />
                    </button>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem
                      onClick={() => {
                        // Focus the inline text to start editing
                        const el = document.querySelector(
                          `[title="Click to rename milestone"]`
                        ) as HTMLElement
                        el?.click()
                      }}
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Rename
                    </ContextMenuItem>
                    {onDuplicateMilestone && (
                      <ContextMenuItem onClick={() => onDuplicateMilestone(item.milestone.id)}>
                        <Copy className="mr-2 h-4 w-4" />
                        Duplicate
                      </ContextMenuItem>
                    )}
                    {onCopyMilestoneLink && (
                      <ContextMenuItem onClick={() => onCopyMilestoneLink(item.milestone.id)}>
                        <Link className="mr-2 h-4 w-4" />
                        Copy link
                      </ContextMenuItem>
                    )}
                    <ContextMenuSeparator />
                    <ContextMenuItem
                      onClick={() => onRemoveMilestone(item.milestone.id)}
                      className="text-[var(--danger)] focus:text-[var(--danger)]"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              </div>
            )
          }

          if (item.kind === 'subtask') {
            return (
              <div className="grid min-h-[2.2rem] grid-cols-[1.2rem_1.25rem_1.25rem_minmax(0,1fr)_1.5rem] items-center gap-2">
                <div className="h-[2.2rem]">
                  <SubtaskBranchConnector
                    isFirst={item.isFirstSubtask}
                    isLast={item.isLastSubtask}
                    connectToParent={item.isFirstSubtask}
                  />
                </div>
                <button
                  type="button"
                  className={`${gripClass} cursor-grab active:cursor-grabbing`}
                  draggable
                  onDragStart={(event: DragEvent<HTMLButtonElement>) => {
                    event.dataTransfer.setData('text/drag-kind', 'subtask')
                    event.dataTransfer.setData('text/milestone-id', item.milestone.id)
                    event.dataTransfer.setData('text/subtask-id', item.subtask.id)
                    event.dataTransfer.effectAllowed = 'move'
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'ArrowUp') {
                      event.preventDefault()
                      onMoveSubtask(item.milestone.id, item.subtask.id, 'up')
                      return
                    }

                    if (event.key === 'ArrowDown') {
                      event.preventDefault()
                      onMoveSubtask(item.milestone.id, item.subtask.id, 'down')
                    }
                  }}
                  aria-label="Move subtask"
                  title="Drag to reorder subtask"
                >
                  <GripVertical size={13} aria-hidden="true" />
                </button>
                <input
                  type="checkbox"
                  checked={item.subtask.completed}
                  onChange={() => onToggleSubtask(item.milestone.id, item.subtask.id)}
                  className="h-4 w-4 rounded border-[var(--line-strong)]"
                />
                <input
                  type="text"
                  value={item.subtask.title}
                  onChange={(event) =>
                    onRenameSubtask(item.milestone.id, item.subtask.id, event.target.value)
                  }
                  className={subtaskInputClass}
                />
                <ContextMenu>
                  <ContextMenuTrigger asChild>
                    <button
                      type="button"
                      className={rowMenuTriggerClass}
                      title="Subtask actions"
                      aria-label="Subtask actions"
                    >
                      <MoreHorizontal size={14} aria-hidden="true" />
                    </button>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    {onDuplicateSubtask && (
                      <ContextMenuItem
                        onClick={() => onDuplicateSubtask(item.milestone.id, item.subtask.id)}
                      >
                        <Copy className="mr-2 h-4 w-4" />
                        Duplicate
                      </ContextMenuItem>
                    )}
                    {onCopySubtaskLink && (
                      <ContextMenuItem
                        onClick={() => onCopySubtaskLink(item.milestone.id, item.subtask.id)}
                      >
                        <Link className="mr-2 h-4 w-4" />
                        Copy link
                      </ContextMenuItem>
                    )}
                    <ContextMenuSeparator />
                    <ContextMenuItem
                      onClick={() => onRemoveSubtask(item.milestone.id, item.subtask.id)}
                      className="text-[var(--danger)] focus:text-[var(--danger)]"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              </div>
            )
          }

          if (item.isCreating) {
            return (
              <div className="grid min-h-[2.2rem] grid-cols-[1.2rem_1.25rem_1.25rem_minmax(0,1fr)_auto_auto] items-center gap-2">
                <div className="h-[2.2rem]">
                  <SubtaskBranchConnector
                    isFirst={item.milestone.subtasks.length === 0}
                    isLast={true}
                  />
                </div>
                <span className={`${gripClass} pointer-events-none opacity-40`} />
                <span className="h-4 w-4" />
                <input
                  type="text"
                  value={item.draftTitle}
                  onChange={(event) =>
                    setNewSubtaskTitleByMilestoneId((current) => ({
                      ...current,
                      [item.milestone.id]: event.target.value
                    }))
                  }
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      submitSubtask(item.milestone.id)
                      return
                    }

                    if (event.key === 'Escape') {
                      cancelCreatingSubtask(item.milestone.id)
                    }
                  }}
                  placeholder="Subtask title"
                  autoFocus
                  className={subtaskInputClass}
                />
                <button
                  type="button"
                  className={inlineActionButtonClass}
                  onClick={() => cancelCreatingSubtask(item.milestone.id)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={inlineActionButtonClass}
                  onClick={() => submitSubtask(item.milestone.id)}
                >
                  Add
                </button>
              </div>
            )
          }

          return (
            <div className="grid min-h-[2.2rem] grid-cols-[1.2rem_1.25rem_1.25rem_minmax(0,1fr)] items-center gap-2">
              <span className="h-[2.2rem]" />
              <span className="h-5 w-5" />
              <span className="h-4 w-4" />
              <button
                type="button"
                className={addSubtaskButtonClass}
                onClick={() => startCreatingSubtask(item.milestone.id)}
              >
                + New subtask
              </button>
            </div>
          )
        }
      },
      {
        id: 'dueDate',
        header: 'Due Date',
        cell: ({ row }) => {
          const item = row.original
          if (item.kind === 'milestone') {
            return (
              <DatePickerISO
                value={item.milestone.dueDate}
                onChange={(nextDate) => onUpdateMilestoneDueDate(item.milestone.id, nextDate)}
                aria-label="Milestone due date"
                className="max-w-[170px]"
              />
            )
          }

          if (item.kind === 'subtask') {
            const dueDate = item.subtask.dueDate ?? item.milestone.dueDate
            return (
              <DatePickerISO
                value={dueDate}
                onChange={(nextDate) =>
                  onUpdateSubtaskDueDate(item.milestone.id, item.subtask.id, nextDate)
                }
                aria-label="Subtask due date"
                className="max-w-[170px]"
              />
            )
          }

          return ''
        }
      }
    ],
    [
      onRenameMilestone,
      onMoveMilestone,
      onMoveSubtask,
      onToggleSubtask,
      onRenameSubtask,
      onUpdateMilestoneDueDate,
      onUpdateSubtaskDueDate,
      onRemoveMilestone,
      onRemoveSubtask,
      onDuplicateMilestone,
      onDuplicateSubtask,
      onCopyMilestoneLink,
      onCopySubtaskLink
    ]
  )

  const table = useReactTable({
    data: milestoneRows,
    columns,
    getCoreRowModel: getCoreRowModel()
  })

  return (
    <div className="h-full overflow-auto bg-[var(--panel)]">
      <div className="flex flex-col gap-3 px-8 py-5">
        <div className="flex min-w-0 items-center gap-1">
          <NoteShapeIcon icon={project.icon} size={20} className="shrink-0" />
          <InlineEditableText
            value={project.name}
            onCommit={onRename}
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
          <span className={neutralChipClass}>
            <CircleDashed size={12} aria-hidden="true" />
            {project.status.replace('-', ' ')}
          </span>
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

      {/* Tab Navigation */}
      <div className="flex flex-col shrink-0 bg-[var(--panel)] px-8 py-2 gap-2">
        <div className="flex items-center border-y border-[var(--line)] py-2">
          <ButtonGroup
            variant="default"
            size="default"
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as 'milestones' | 'notes')}
            className="rounded-xl bg-[color-mix(in_srgb,var(--panel-2)_78%,var(--panel))]"
          >
            <ButtonGroupItem
              value="milestones"
              className="data-[active=true]:bg-[var(--accent-soft)] data-[active=true]:text-[var(--accent)] data-[active=true]:shadow-[inset_0_0_0_1px_var(--accent-line)]"
            >
              Milestones
            </ButtonGroupItem>
            <ButtonGroupItem
              value="notes"
              className="data-[active=true]:bg-[var(--accent-soft)] data-[active=true]:text-[var(--accent)] data-[active=true]:shadow-[inset_0_0_0_1px_var(--accent-line)]"
            >
              Project Notes
            </ButtonGroupItem>
          </ButtonGroup>
        </div>
      </div>

      {/* Project Notes Section */}
      {activeTab === 'notes' && (
        <section className="px-8 pb-6">
          <div className="p-4">
            <div className="flex items-center justify-end gap-2">
              {onAddTagToNote && (
                <div className="relative">
                  <button
                    type="button"
                    className="inline-flex items-center rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-sm text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--text)]"
                    onClick={() => setIsNotePickerOpen((current) => !current)}
                  >
                    <Link size={14} className="mr-1" />
                    Link Existing
                  </button>
                  {isNotePickerOpen && (
                    <div className="absolute right-0 top-full z-20 mt-1 w-72 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-2 shadow-xl">
                      <input
                        type="text"
                        placeholder="Search notes..."
                        value={notePickerSearchQuery}
                        onChange={(e) => setNotePickerSearchQuery(e.target.value)}
                        className="mb-2 w-full rounded-md border border-[var(--line)] bg-[var(--panel-2)] px-2 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
                        autoFocus
                      />
                      {availableNotesForAssociation.length === 0 ? (
                        <p className="px-2 py-3 text-center text-xs text-[var(--muted)]">
                          {notePickerSearchQuery.trim()
                            ? 'No matching notes found'
                            : 'All notes are already linked'}
                        </p>
                      ) : (
                        <div className="max-h-48 overflow-y-auto">
                          {availableNotesForAssociation.map((note) => (
                            <button
                              key={note.relPath}
                              type="button"
                              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-[var(--text)] hover:bg-[var(--accent-soft)]"
                              onClick={() => {
                                onAddTagToNote(note.relPath, projectTag)
                                setIsNotePickerOpen(false)
                                setNotePickerSearchQuery('')
                              }}
                            >
                              <FileText size={14} className="shrink-0 text-[var(--muted)]" />
                              <span className="truncate">{note.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              <button
                type="button"
                className="inline-flex items-center rounded-lg border border-dashed border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-sm text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--text)]"
                onClick={onCreateProjectNote}
              >
                <Plus size={14} className="mr-1" />
                New Note
              </button>
            </div>

            {projectNotes.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-[var(--line)] bg-[var(--panel-2)] p-6 text-center">
                <FileText size={32} className="mx-auto mb-2 text-[var(--muted)]" />
                <p className="text-sm text-[var(--muted)]">No notes linked to this project yet.</p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Create a new note or add the tag <TagChip tag={projectTag} /> to an existing note.
                </p>
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                {projectNotes.map((note) => (
                  <div
                    key={note.relPath}
                    className="group flex items-center gap-3 rounded-lg border border-[var(--line)] bg-[var(--panel-2)] px-3 py-2 hover:border-[var(--accent-line)] hover:bg-[color-mix(in_srgb,var(--accent-soft)_25%,var(--panel-2))]"
                  >
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      onClick={() => onOpenNote(note.relPath)}
                    >
                      <FileText size={16} className="shrink-0 text-[var(--muted)]" />
                      <span className="truncate text-sm font-medium text-[var(--text)]">
                        {note.name}
                      </span>
                    </button>
                    <div className="flex shrink-0 items-center gap-1">
                      {note.tags
                        .filter((tag) => tag !== projectTag)
                        .slice(0, 2)
                        .map((tag) => (
                          <Badge
                            key={tag}
                            variant="secondary"
                            className="text-[0.65rem] px-1.5 py-0"
                          >
                            #{tag}
                          </Badge>
                        ))}
                      {onRemoveTagFromNote && (
                        <button
                          type="button"
                          className="ml-1 rounded p-1 text-[var(--muted)] opacity-0 transition-opacity hover:bg-[var(--panel)] hover:text-[var(--danger)] group-hover:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation()
                            onRemoveTagFromNote(note.relPath, projectTag)
                          }}
                          title="Remove from project"
                        >
                          <Tag size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Milestones Section */}
      {activeTab === 'milestones' && (
        <section className="px-8 pb-8">
          <div className="p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-[var(--text)]">Milestones</h3>
              <button
                type="button"
                className="inline-flex items-center rounded-lg border border-dashed border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-sm text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--text)]"
                onClick={() => setIsCreatingMilestone(true)}
              >
                + New milestone
              </button>
            </div>

            {isCreatingMilestone ? (
              <div className="mt-3 rounded-xl border border-dashed border-[var(--accent)] bg-[var(--panel)] p-3">
                <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_180px]">
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
                    className="rounded-md border border-[var(--line)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                  />
                  <DatePickerISO
                    value={newMilestoneDueDate}
                    onChange={(nextDate) => setNewMilestoneDueDate(nextDate)}
                    aria-label="New milestone due date"
                  />
                </div>
                <div className="mt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    className="rounded-md border border-[var(--line)] px-2 py-1 text-xs text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--text)]"
                    onClick={() => {
                      setNewMilestoneTitle('')
                      setNewMilestoneDueDate(toIsoDate(new Date()))
                      setIsCreatingMilestone(false)
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-[var(--line)] px-2 py-1 text-xs hover:border-[var(--accent)]"
                    onClick={submitMilestone}
                  >
                    Add milestone
                  </button>
                </div>
              </div>
            ) : null}

            <div className={sheetWrapClass}>
              <table className={sheetTableClass}>
                <thead>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <th key={header.id} className={sheetHeadCellClass}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {table.getRowModel().rows.length === 0 ? (
                    <tr>
                      <td colSpan={2} className={emptyStateClass}>
                        No milestones yet for this project.
                      </td>
                    </tr>
                  ) : (
                    table.getRowModel().rows.map((row) => {
                      const item = row.original
                      const rowClass =
                        item.kind === 'milestone'
                          ? sheetMilestoneRowClass
                          : item.kind === 'subtask'
                            ? item.subtask.completed
                              ? sheetSubtaskCompletedRowClass
                              : sheetSubtaskPendingRowClass
                            : sheetSubtaskRowClass

                      return (
                        <ContextMenu key={row.id}>
                          <ContextMenuTrigger asChild>
                            <tr
                              className={rowClass}
                              onDragOver={(event) => {
                                if (item.kind === 'milestone') {
                                  if (
                                    event.dataTransfer.getData('text/drag-kind') === 'milestone'
                                  ) {
                                    event.preventDefault()
                                  }
                                  return
                                }

                                if (item.kind === 'subtask') {
                                  if (event.dataTransfer.getData('text/drag-kind') !== 'subtask') {
                                    return
                                  }
                                  const sourceMilestoneId =
                                    event.dataTransfer.getData('text/milestone-id')
                                  if (
                                    sourceMilestoneId === item.milestone.id &&
                                    event.dataTransfer.types.includes('text/subtask-id')
                                  ) {
                                    event.preventDefault()
                                  }
                                }
                              }}
                              onDrop={(event) => {
                                if (item.kind === 'milestone') {
                                  event.preventDefault()
                                  if (
                                    event.dataTransfer.getData('text/drag-kind') !== 'milestone'
                                  ) {
                                    return
                                  }
                                  const sourceMilestoneId =
                                    event.dataTransfer.getData('text/milestone-id')
                                  if (!sourceMilestoneId) {
                                    return
                                  }
                                  handleMilestoneDrop(sourceMilestoneId, item.milestone.id)
                                  return
                                }

                                if (item.kind === 'subtask') {
                                  event.preventDefault()
                                  if (event.dataTransfer.getData('text/drag-kind') !== 'subtask') {
                                    return
                                  }
                                  const sourceMilestoneId =
                                    event.dataTransfer.getData('text/milestone-id')
                                  const sourceSubtaskId =
                                    event.dataTransfer.getData('text/subtask-id')
                                  if (sourceMilestoneId !== item.milestone.id || !sourceSubtaskId) {
                                    return
                                  }
                                  handleSubtaskDrop(
                                    item.milestone.id,
                                    sourceSubtaskId,
                                    item.subtask.id
                                  )
                                }
                              }}
                            >
                              {row.getVisibleCells().map((cell) => (
                                <td
                                  key={cell.id}
                                  className={`${sheetCellClass} ${
                                    cell.column.id === 'task'
                                      ? `${item.kind === 'milestone' ? '' : 'py-0'} px-2.5`
                                      : 'px-[0.9rem]'
                                  }`}
                                >
                                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </td>
                              ))}
                            </tr>
                          </ContextMenuTrigger>
                          {item.kind === 'milestone' && (
                            <ContextMenuContent>
                              <ContextMenuItem
                                onClick={() => {
                                  // Focus the inline text to start editing
                                  const el = document.querySelector(
                                    `[title="Click to rename milestone"]`
                                  ) as HTMLElement
                                  el?.click()
                                }}
                              >
                                <Pencil className="mr-2 h-4 w-4" />
                                Rename
                              </ContextMenuItem>
                              {onDuplicateMilestone && (
                                <ContextMenuItem
                                  onClick={() => onDuplicateMilestone(item.milestone.id)}
                                >
                                  <Copy className="mr-2 h-4 w-4" />
                                  Duplicate
                                </ContextMenuItem>
                              )}
                              {onCopyMilestoneLink && (
                                <ContextMenuItem
                                  onClick={() => onCopyMilestoneLink(item.milestone.id)}
                                >
                                  <Link className="mr-2 h-4 w-4" />
                                  Copy link
                                </ContextMenuItem>
                              )}
                              <ContextMenuSeparator />
                              <ContextMenuItem
                                onClick={() => onRemoveMilestone(item.milestone.id)}
                                className="text-[var(--danger)] focus:text-[var(--danger)]"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </ContextMenuItem>
                            </ContextMenuContent>
                          )}
                          {item.kind === 'subtask' && (
                            <ContextMenuContent>
                              {onDuplicateSubtask && (
                                <ContextMenuItem
                                  onClick={() =>
                                    onDuplicateSubtask(item.milestone.id, item.subtask.id)
                                  }
                                >
                                  <Copy className="mr-2 h-4 w-4" />
                                  Duplicate
                                </ContextMenuItem>
                              )}
                              {onCopySubtaskLink && (
                                <ContextMenuItem
                                  onClick={() =>
                                    onCopySubtaskLink(item.milestone.id, item.subtask.id)
                                  }
                                >
                                  <Link className="mr-2 h-4 w-4" />
                                  Copy link
                                </ContextMenuItem>
                              )}
                              <ContextMenuSeparator />
                              <ContextMenuItem
                                onClick={() => onRemoveSubtask(item.milestone.id, item.subtask.id)}
                                className="text-[var(--danger)] focus:text-[var(--danger)]"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </ContextMenuItem>
                            </ContextMenuContent>
                          )}
                        </ContextMenu>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </div>
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
