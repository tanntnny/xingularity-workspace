import { type ReactElement, useEffect, useMemo, useState } from 'react'
import { CalendarDays, CircleDashed, FileText, Link, Plus, Tag, Trash2 } from 'lucide-react'
import { type NoteListItem } from '../../../shared/types'
import { generateProjectTag } from '../../../shared/noteTags'
import { InlineEditableText } from '../components/InlineEditableText'
import {
  type ProjectListItem,
  type ProjectMilestone,
  type ProjectSubtask
} from '../components/ProjectPreviewList'
import { NoteShapeIcon } from '../components/NoteShapeIcon'
import { DatePickerISO } from '../components/ui/date-picker'
import { TagChip } from '../components/TagChip'
import { Badge } from '../components/ui/badge'
import { ButtonGroup, ButtonGroupItem } from '../components/ui/button-group'
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

type MilestoneRow = {
  id: string
  kind: 'milestone' | 'subtask'
  milestone: ProjectMilestone
  subtask?: ProjectSubtask
  progressPercent: number
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
  onUpdateMilestoneDueDate,
  onRemoveMilestone,
  onAddSubtask,
  onToggleSubtask,
  onRenameSubtask,
  onUpdateSubtaskDueDate,
  onMoveMilestone: _onMoveMilestone,
  onMoveSubtask: _onMoveSubtask,
  onRemoveSubtask,
  onDuplicateMilestone: _onDuplicateMilestone,
  onDuplicateSubtask: _onDuplicateSubtask,
  onCopyMilestoneLink: _onCopyMilestoneLink,
  onCopySubtaskLink: _onCopySubtaskLink,
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

  const milestoneRows = useMemo<MilestoneRow[]>(() => {
    const rows: MilestoneRow[] = []

    project.milestones.forEach((milestone) => {
      rows.push({
        id: `milestone-${milestone.id}`,
        kind: 'milestone',
        milestone,
        progressPercent: getMilestoneProgressPercent(milestone)
      })

      milestone.subtasks.forEach((subtask) => {
        rows.push({
          id: `subtask-${milestone.id}-${subtask.id}`,
          kind: 'subtask',
          milestone,
          subtask,
          progressPercent: 0
        })
      })
    })

    return rows
  }, [project.milestones])

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
        <div className="flex items-center justify-between gap-2 border-y border-[var(--line)] py-2">
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

          <div className="flex items-center gap-2">
            {activeTab === 'milestones' && (
              <button
                type="button"
                className="inline-flex items-center rounded-lg border border-dashed border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-sm text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--text)]"
                onClick={() => setIsCreatingMilestone(true)}
              >
                + New milestone
              </button>
            )}

            {activeTab === 'notes' && (
              <>
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
                )}

                <button
                  type="button"
                  className="inline-flex items-center rounded-lg border border-dashed border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-sm text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--text)]"
                  onClick={onCreateProjectNote}
                >
                  <Plus size={14} className="mr-1" />
                  New Note
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {activeTab === 'notes' && (
        <section className="px-8 pb-6">
          <div className="p-4">
            {projectNotes.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--line)] bg-[var(--panel-2)] p-6 text-center">
                <FileText size={32} className="mx-auto mb-2 text-[var(--muted)]" />
                <p className="text-sm text-[var(--muted)]">No notes linked to this project yet.</p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Create a new note or add the tag <TagChip tag={projectTag} /> to an existing note.
                </p>
              </div>
            ) : (
              <Table className="rounded-xl">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[45%]">Note</TableHead>
                    <TableHead className="w-[40%]">Tags</TableHead>
                    <TableHead className="w-[15%]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projectNoteRows.map((row) => (
                    <TableRow key={row.relPath}>
                      <TableCell>
                        <button
                          type="button"
                          className="flex items-center gap-2 text-left hover:text-[var(--accent)]"
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
                      <TableCell>
                        {onRemoveTagFromNote ? (
                          <button
                            type="button"
                            className="inline-flex items-center rounded-md border border-[var(--line)] px-2 py-1 text-xs"
                            onClick={() => onRemoveTagFromNote(row.relPath, projectTag)}
                          >
                            <Tag size={12} className="mr-1" />
                            Unlink
                          </button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </section>
      )}

      {activeTab === 'milestones' && (
        <section className="px-8 pb-8">
          <div className="p-4">
            {isCreatingMilestone ? (
              <div className="mb-4 rounded-xl border border-dashed border-[var(--accent)] bg-[var(--panel)] p-3">
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

            <Table className="rounded-xl">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[46%]">Task</TableHead>
                  <TableHead className="w-[22%]">Due Date</TableHead>
                  <TableHead className="w-[14%]">Type</TableHead>
                  <TableHead className="w-[18%]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {milestoneRows.map((item) => {
                  if (item.kind === 'milestone') {
                    const isCreatingSubtask =
                      creatingSubtaskByMilestoneId[item.milestone.id] ?? false
                    const draftTitle = newSubtaskTitleByMilestoneId[item.milestone.id] ?? ''

                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="flex min-w-0 flex-col gap-2 py-1">
                            <InlineEditableText
                              value={item.milestone.title}
                              onCommit={(nextTitle) =>
                                onRenameMilestone(item.milestone.id, nextTitle)
                              }
                              displayAs="span"
                              displayClassName="min-w-[120px] flex-1 cursor-text text-left font-semibold text-[var(--text)]"
                              inputClassName="min-w-[120px] flex-1 rounded-md border border-[var(--line)] bg-transparent px-2 py-1 text-[var(--text)] outline-none"
                              title="Click to rename milestone"
                              renderDisplay={(value) => (
                                <>
                                  {value}
                                  <span className="ml-2 text-[0.82em] font-medium text-[var(--muted)]">
                                    {item.progressPercent}% complete
                                  </span>
                                </>
                              )}
                            />

                            {isCreatingSubtask ? (
                              <div className="flex flex-wrap items-center gap-2">
                                <input
                                  type="text"
                                  value={draftTitle}
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
                                  className="rounded-md border border-[var(--line)] bg-transparent px-2 py-1 text-sm text-[var(--text)] outline-none"
                                />
                                <button
                                  type="button"
                                  className="rounded-md border border-[var(--line)] px-2 py-1 text-xs"
                                  onClick={() => submitSubtask(item.milestone.id)}
                                >
                                  Add
                                </button>
                                <button
                                  type="button"
                                  className="rounded-md border border-[var(--line)] px-2 py-1 text-xs"
                                  onClick={() => cancelCreatingSubtask(item.milestone.id)}
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="w-fit rounded-md border border-[var(--line)] px-2 py-1 text-xs"
                                onClick={() => startCreatingSubtask(item.milestone.id)}
                              >
                                + New subtask
                              </button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <DatePickerISO
                            value={item.milestone.dueDate}
                            onChange={(nextDate) =>
                              onUpdateMilestoneDueDate(item.milestone.id, nextDate)
                            }
                            aria-label="Milestone due date"
                            className="max-w-[170px]"
                          />
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">Milestone</Badge>
                        </TableCell>
                        <TableCell>
                          <button
                            type="button"
                            className="inline-flex items-center rounded-md border border-[var(--line)] px-2 py-1 text-xs text-[var(--danger)]"
                            onClick={() => onRemoveMilestone(item.milestone.id)}
                          >
                            <Trash2 size={12} className="mr-1" />
                            Delete
                          </button>
                        </TableCell>
                      </TableRow>
                    )
                  }

                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="flex min-w-0 items-center gap-2 py-1 pl-6">
                          <input
                            type="checkbox"
                            checked={item.subtask?.completed ?? false}
                            onChange={() => {
                              if (item.subtask) {
                                onToggleSubtask(item.milestone.id, item.subtask.id)
                              }
                            }}
                            className="h-4 w-4 rounded border-[var(--line-strong)]"
                          />
                          <input
                            type="text"
                            value={item.subtask?.title ?? ''}
                            onChange={(event) => {
                              if (item.subtask) {
                                onRenameSubtask(
                                  item.milestone.id,
                                  item.subtask.id,
                                  event.target.value
                                )
                              }
                            }}
                            className="min-w-[140px] flex-1 rounded-md border border-[var(--line)] bg-transparent px-2 py-1 text-sm text-[var(--text)] outline-none"
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <DatePickerISO
                          value={item.subtask?.dueDate ?? item.milestone.dueDate}
                          onChange={(nextDate) => {
                            if (item.subtask) {
                              onUpdateSubtaskDueDate(item.milestone.id, item.subtask.id, nextDate)
                            }
                          }}
                          aria-label="Subtask due date"
                          className="max-w-[170px]"
                        />
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">Subtask</Badge>
                      </TableCell>
                      <TableCell>
                        <button
                          type="button"
                          className="inline-flex items-center rounded-md border border-[var(--line)] px-2 py-1 text-xs text-[var(--danger)]"
                          onClick={() => {
                            if (item.subtask) {
                              onRemoveSubtask(item.milestone.id, item.subtask.id)
                            }
                          }}
                        >
                          <Trash2 size={12} className="mr-1" />
                          Delete
                        </button>
                      </TableCell>
                    </TableRow>
                  )
                })}
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
