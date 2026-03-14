import { Fragment, type ReactElement, useEffect, useMemo, useState } from 'react'
import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  CircleDashed,
  FileText,
  Link,
  MoreHorizontal,
  Plus,
  Tag
} from 'lucide-react'
import { type NoteListItem } from '../../../shared/types'
import { generateProjectTag } from '../../../shared/noteTags'
import { InlineEditableText } from '../components/InlineEditableText'
import { type ProjectListItem, type ProjectMilestone } from '../components/ProjectPreviewList'
import { NoteShapeIcon } from '../components/NoteShapeIcon'
import { DatePickerISO } from '../components/ui/date-picker'
import { Badge } from '../components/ui/badge'
import { ButtonGroup, ButtonGroupItem } from '../components/ui/button-group'
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
  TableRow
} from '../components/ui/table'

interface ProjectDetailsPageProps {
  project: ProjectListItem
  notes: NoteListItem[]
  onRename: (nextName: string) => void
  onUpdateSummary: (nextSummary: string) => void
  onAddMilestone: (title: string, dueDate: string) => void
  onRenameMilestone: (milestoneId: string, nextTitle: string) => void
  onUpdateMilestoneDescription: (milestoneId: string, nextDescription: string) => void
  onUpdateMilestoneDueDate: (milestoneId: string, nextDueDate: string) => void
  onToggleMilestoneCollapsed: (milestoneId: string) => void
  onRemoveMilestone: (milestoneId: string) => void
  onAddSubtask: (milestoneId: string, title: string) => void
  onToggleSubtask: (milestoneId: string, subtaskId: string) => void
  onRenameSubtask: (milestoneId: string, subtaskId: string, nextTitle: string) => void
  onUpdateSubtaskDescription: (
    milestoneId: string,
    subtaskId: string,
    nextDescription: string
  ) => void
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

type ProjectNoteRow = {
  relPath: string
  name: string
  tags: string[]
}

const neutralChipClass =
  'inline-flex min-w-0 shrink-0 items-center gap-1 rounded-full border border-[var(--tag-neutral-line)] bg-[var(--tag-neutral-bg)] px-2 py-0.5 text-xs leading-[1.2] text-[var(--tag-neutral-text)]'

export function ProjectDetailsPage({
  project,
  notes,
  onRename,
  onUpdateSummary,
  onAddMilestone,
  onRenameMilestone,
  onUpdateMilestoneDescription,
  onUpdateMilestoneDueDate,
  onToggleMilestoneCollapsed,
  onRemoveMilestone: _onRemoveMilestone,
  onAddSubtask,
  onToggleSubtask,
  onRenameSubtask,
  onUpdateSubtaskDescription,
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
  const [creatingSubtaskByMilestoneId, setCreatingSubtaskByMilestoneId] = useState<
    Record<string, boolean>
  >({})
  const [newSubtaskTitleByMilestoneId, setNewSubtaskTitleByMilestoneId] = useState<
    Record<string, string>
  >({})
  const [isNotePickerOpen, setIsNotePickerOpen] = useState(false)
  const [notePickerSearchQuery, setNotePickerSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'milestones' | 'notes'>('milestones')

  const projectTag = useMemo(() => generateProjectTag(project.name), [project.name])

  const projectNotes = useMemo(() => {
    return notes.filter((note) => note.tags.includes(projectTag))
  }, [notes, projectTag])

  const availableNotesForAssociation = useMemo(() => {
    const available = notes.filter((note) => !note.tags.includes(projectTag))
    if (!notePickerSearchQuery.trim()) {
      return available.slice(0, 10)
    }
    const query = notePickerSearchQuery.toLowerCase()
    return available.filter((note) => note.name.toLowerCase().includes(query)).slice(0, 10)
  }, [notes, projectTag, notePickerSearchQuery])

  useEffect(() => {
    const validIds = new Set(project.milestones.map((milestone) => milestone.id))

    setCreatingSubtaskByMilestoneId((current) => {
      return Object.fromEntries(
        Object.entries(current).filter(([milestoneId]) => validIds.has(milestoneId))
      )
    })

    setNewSubtaskTitleByMilestoneId((current) => {
      return Object.fromEntries(
        Object.entries(current).filter(([milestoneId]) => validIds.has(milestoneId))
      )
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
    return projectNotes.map((note) => ({ relPath: note.relPath, name: note.name, tags: note.tags }))
  }, [projectNotes])

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

      <div className="flex shrink-0 flex-col gap-2 bg-[var(--panel)] px-8 py-2">
        <div className="flex items-center gap-2 border-y border-[var(--line)] py-2">
          <ButtonGroup
            variant="default"
            size="default"
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as 'milestones' | 'notes')}
            className="rounded-xl border border-[var(--line)] bg-[color-mix(in_srgb,var(--panel-2)_78%,var(--panel))]"
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

      {activeTab === 'notes' && (
        <section className="px-8 pb-6">
          <div className="p-4">
            <Table className="rounded-xl">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[45%]">
                    <span className="inline-flex items-center gap-1.5">
                      <FileText size={12} aria-hidden="true" />
                      Note
                    </span>
                  </TableHead>
                  <TableHead className="w-[45%]">
                    <span className="inline-flex items-center gap-1.5">
                      <Tag size={12} aria-hidden="true" />
                      Tags
                    </span>
                  </TableHead>
                  <TableHead className="w-[84px] text-center">
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
                        No notes linked to this project yet. Use the rows below to create or link.
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
                        <FileText size={14} className="shrink-0 text-[var(--muted)]" />
                        <span>{row.name}</span>
                      </button>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {row.tags
                          .filter((tag) => tag !== projectTag)
                          .slice(0, 3)
                          .map((tag) => (
                            <Badge
                              key={tag}
                              variant="secondary"
                              className="px-1.5 py-0 text-[0.65rem]"
                            >
                              #{tag}
                            </Badge>
                          ))}
                      </div>
                    </TableCell>
                    <TableCell className="px-2 py-1 text-left">
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
                          {onRemoveTagFromNote ? (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => onRemoveTagFromNote(row.relPath, projectTag)}
                              >
                                <Tag size={12} className="mr-2" />
                                Unlink
                              </DropdownMenuItem>
                            </>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {onAddTagToNote ? (
                  <TableRow className="hover:bg-[var(--accent-soft)]/60">
                    <TableCell colSpan={3} className="p-0">
                      <div className="relative">
                        <button
                          type="button"
                          className="flex h-full w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--muted)] transition-colors hover:text-[var(--accent)]"
                          onClick={() => setIsNotePickerOpen((current) => !current)}
                        >
                          <Link size={14} className="shrink-0" />
                          <span>+ Link existing note</span>
                        </button>
                        {isNotePickerOpen && (
                          <div className="absolute left-0 top-full z-20 mt-1 w-72 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-2 shadow-xl">
                            <input
                              type="text"
                              placeholder="Search notes..."
                              value={notePickerSearchQuery}
                              onChange={(event) => setNotePickerSearchQuery(event.target.value)}
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
                    </TableCell>
                  </TableRow>
                ) : null}
                <TableRow className="hover:bg-[var(--accent-soft)]/60">
                  <TableCell colSpan={3} className="p-0">
                    <button
                      type="button"
                      className="flex h-full w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--muted)] transition-colors hover:text-[var(--accent)]"
                      onClick={onCreateProjectNote}
                    >
                      <Plus size={14} className="shrink-0" />
                      <span>+ New note</span>
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
                  <TableHead className="w-[48px] text-center">
                    <span className="inline-flex items-center justify-center">
                      <ChevronDown size={12} aria-hidden="true" />
                    </span>
                  </TableHead>
                  <TableHead className="w-[37%]">
                    <span className="inline-flex items-center gap-1.5">
                      <FileText size={12} aria-hidden="true" />
                      Task
                    </span>
                  </TableHead>
                  <TableHead className="w-[31%]">
                    <span className="inline-flex items-center gap-1.5">
                      <CircleDashed size={12} aria-hidden="true" />
                      Description
                    </span>
                  </TableHead>
                  <TableHead className="w-[1%] whitespace-nowrap px-1">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays size={12} aria-hidden="true" />
                      Due Date
                    </span>
                  </TableHead>
                  <TableHead className="w-[84px] text-center">
                    <span className="inline-flex items-center justify-center text-xs font-semibold tracking-wide text-[var(--muted)]">
                      ACTIONS
                    </span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {project.milestones.map((milestone) => {
                  const isCreatingSubtask = creatingSubtaskByMilestoneId[milestone.id] ?? false
                  const draftTitle = newSubtaskTitleByMilestoneId[milestone.id] ?? ''
                  const milestoneProgressPercent = getMilestoneProgressPercent(milestone)

                  return (
                    <Fragment key={milestone.id}>
                      <TableRow className="bg-[color-mix(in_srgb,var(--accent-soft)_30%,var(--panel))]">
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
                        <TableCell className="p-0">
                          <InlineEditableText
                            value={milestone.description ?? ''}
                            onCommit={(nextDescription) =>
                              onUpdateMilestoneDescription(milestone.id, nextDescription)
                            }
                            displayAs="span"
                            displayClassName="block h-full min-w-[120px] w-full cursor-text px-3 py-2 text-sm text-[var(--muted)] transition-colors hover:text-[var(--accent)]"
                            inputClassName="h-full min-w-[120px] w-full border-0 bg-transparent px-3 py-2 text-sm text-[var(--muted)] outline-none"
                            title="Click to edit milestone description"
                            placeholder="-"
                            allowEmpty={true}
                            normalize={(next) => next.trim()}
                          />
                        </TableCell>
                        <TableCell className="w-[1%] whitespace-nowrap px-1 py-0">
                          <DatePickerISO
                            value={milestone.dueDate}
                            onChange={(nextDate) =>
                              onUpdateMilestoneDueDate(milestone.id, nextDate)
                            }
                            aria-label="Milestone due date"
                            showIcon={false}
                            className="h-full w-auto min-w-0 rounded-none border-0 bg-transparent px-1.5 py-2"
                          />
                        </TableCell>
                        <TableCell className="px-2 py-1">
                          <div className="flex items-center justify-start gap-1">
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
                                <DropdownMenuItem
                                  onClick={() => onMoveMilestone(milestone.id, 'up')}
                                >
                                  Move up
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => onMoveMilestone(milestone.id, 'down')}
                                >
                                  Move down
                                </DropdownMenuItem>
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
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => _onRemoveMilestone(milestone.id)}>
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
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
                              <TableCell className="p-0">
                                <InlineEditableText
                                  value={subtask.description ?? ''}
                                  onCommit={(nextDescription) => {
                                    onUpdateSubtaskDescription(
                                      milestone.id,
                                      subtask.id,
                                      nextDescription
                                    )
                                  }}
                                  displayAs="span"
                                  displayClassName="block h-full min-w-[120px] w-full cursor-text px-3 py-2 text-sm text-[var(--muted)] transition-colors hover:text-[var(--accent)]"
                                  inputClassName="h-full min-w-[120px] w-full border-0 bg-transparent px-3 py-2 text-sm text-[var(--muted)] outline-none"
                                  title="Click to edit subtask description"
                                  placeholder="-"
                                  allowEmpty={true}
                                  normalize={(next) => next.trim()}
                                />
                              </TableCell>
                              <TableCell className="w-[1%] whitespace-nowrap px-1 py-0">
                                <span className="block h-full w-full px-1.5 py-2 text-sm text-[var(--muted)]">
                                  -
                                </span>
                              </TableCell>
                              <TableCell className="px-2 py-1 text-left">
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
                                    <DropdownMenuItem
                                      onClick={() => onMoveSubtask(milestone.id, subtask.id, 'up')}
                                    >
                                      Move up
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() =>
                                        onMoveSubtask(milestone.id, subtask.id, 'down')
                                      }
                                    >
                                      Move down
                                    </DropdownMenuItem>
                                    {onDuplicateSubtask ? (
                                      <DropdownMenuItem
                                        onClick={() => onDuplicateSubtask(milestone.id, subtask.id)}
                                      >
                                        Duplicate
                                      </DropdownMenuItem>
                                    ) : null}
                                    {onCopySubtaskLink ? (
                                      <DropdownMenuItem
                                        onClick={() => onCopySubtaskLink(milestone.id, subtask.id)}
                                      >
                                        Copy link
                                      </DropdownMenuItem>
                                    ) : null}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => onRemoveSubtask(milestone.id, subtask.id)}
                                    >
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          ))}
                      {milestone.collapsed || !isCreatingSubtask ? null : (
                        <TableRow className="hover:bg-[var(--accent-soft)]/60">
                          <TableCell colSpan={5} className="p-0">
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
                  <TableCell colSpan={5} className="p-0">
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
                        <DatePickerISO
                          value={newMilestoneDueDate}
                          onChange={(nextDate) => setNewMilestoneDueDate(nextDate)}
                          aria-label="New milestone due date"
                          showIcon={false}
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
