import { extractNoteTitleFromMarkdown } from '../shared/noteDocument'
import { splitNoteContent } from '../shared/noteContent'
import {
  CALENDAR_TASK_TYPE_OPTIONS,
  formatCalendarTaskType,
  TASK_STATUS_OPTIONS,
  type CalendarTask,
  type Project,
  type ProjectUpdate
} from '../shared/types'
import type { FolderMarkdownNote } from './noteMarkdownExport'
import { isTaskDone } from '../shared/taskStatus'

export interface ProjectMarkdownExportInput {
  project: Pick<Project, 'name' | 'description' | 'summary' | 'updatedAt'>
  notebookPath: string
  tasks: readonly CalendarTask[]
  updates: readonly ProjectUpdate[]
  notes: readonly FolderMarkdownNote[]
  externalDocuments?: readonly ProjectMarkdownExternalDocument[]
  exportedAt: string
}

export interface ProjectMarkdownExternalDocument {
  title: string
  canonicalUri: string
  markdown?: string
  modifiedAt?: string
  truncated?: boolean
}

export function buildProjectMarkdown(input: ProjectMarkdownExportInput): string {
  const description = input.project.description?.trim() || input.project.summary.trim()
  const lines = [
    `# ${input.project.name}`,
    '',
    `- Exported: ${input.exportedAt}`,
    `- Last updated: ${input.project.updatedAt}`,
    `- Linked notebook: \`${escapeInlineCode(input.notebookPath)}\``,
    '',
    '## Description',
    '',
    description || '_No description provided._',
    '',
    ...buildTaskSection(input.tasks),
    '',
    ...buildUpdateSection(input.updates),
    '',
    ...buildNoteSection(input.notes),
    '',
    ...buildExternalDocumentSection(input.externalDocuments ?? []),
    ''
  ]

  return lines.join('\n')
}

function buildTaskSection(tasks: readonly CalendarTask[]): string[] {
  const projectTasks = [...tasks]
  if (projectTasks.length === 0) {
    return ['## Tasks', '', '_No tasks found._']
  }

  const groups = new Map<string, CalendarTask[]>()
  for (const task of projectTasks) {
    const milestone = task.milestoneId?.trim() || 'No milestone'
    const group = groups.get(milestone) ?? []
    group.push(task)
    groups.set(milestone, group)
  }

  const sortedGroups = [...groups.entries()].sort(([left], [right]) => {
    if (left === 'No milestone') return 1
    if (right === 'No milestone') return -1
    return left.localeCompare(right)
  })

  const lines = ['## Tasks', '']
  sortedGroups.forEach(([milestone, milestoneTasks], groupIndex) => {
    if (groupIndex > 0) {
      lines.push('')
    }
    lines.push(`### ${milestone}`, '')

    milestoneTasks
      .sort(
        (left, right) => left.title.localeCompare(right.title) || left.id.localeCompare(right.id)
      )
      .forEach((task, taskIndex) => {
        lines.push(...formatTask(task))
        if (taskIndex < milestoneTasks.length - 1) {
          lines.push('')
        }
      })
  })

  return lines
}

function formatTask(task: CalendarTask): string[] {
  const status = task.status ?? (task.completed ? 'completed' : 'pending')
  const completed = isTaskDone({ status, completed: task.completed })
  const taskType = task.taskType
    ? formatCalendarTaskType(task.taskType)
    : (CALENDAR_TASK_TYPE_OPTIONS.find((option) => option.value === 'other')?.label ?? 'Other')
  const description = task.description?.trim() || 'None'

  return [
    `- [${completed ? 'x' : ' '}] **${formatInlineText(task.title)}**`,
    `  - Status: ${formatTaskStatus(status)}`,
    `  - Priority: ${formatLabel(task.priority)}`,
    `  - Type: ${taskType}`,
    `  - Schedule: ${formatTaskSchedule(task)}`,
    `  - Tags: ${task.tags.length > 0 ? task.tags.map(formatInlineText).join(', ') : 'none'}`,
    `  - Description: ${formatInlineText(description)}`
  ]
}

function buildUpdateSection(updates: readonly ProjectUpdate[]): string[] {
  if (updates.length === 0) {
    return ['## Updates', '', '_No updates found._']
  }

  const sortedUpdates = [...updates].sort((left, right) => {
    const dateOrder = compareDates(right.createdAt, left.createdAt)
    return dateOrder || right.id.localeCompare(left.id)
  })
  const lines = ['## Updates', '']

  sortedUpdates.forEach((update, index) => {
    lines.push(
      `### ${update.createdAt} · ${formatUpdateStatus(update.status)}`,
      '',
      update.markdown.trim() || '_No update content._'
    )
    if (index < sortedUpdates.length - 1) {
      lines.push('')
    }
  })

  return lines
}

function buildNoteSection(notes: readonly FolderMarkdownNote[]): string[] {
  if (notes.length === 0) {
    return ['## Linked Notes', '', '_No linked notes found._']
  }

  const lines = ['## Linked Notes', '']
  const sortedNotes = [...notes].sort((left, right) => left.relPath.localeCompare(right.relPath))

  sortedNotes.forEach((note, index) => {
    const title = extractNoteTitleFromMarkdown(note.markdown, note.relPath)
    const body = stripTitleHeading(splitNoteContent(note.markdown).body, title)
    lines.push(
      `### ${formatInlineText(title)}`,
      '',
      `Source: \`${escapeInlineCode(note.relPath)}\``
    )
    if (body) {
      lines.push('', body)
    }
    if (index < sortedNotes.length - 1) {
      lines.push('')
    }
  })

  return lines
}

function buildExternalDocumentSection(
  documents: readonly ProjectMarkdownExternalDocument[]
): string[] {
  if (documents.length === 0) {
    return ['## Linked Google Docs', '', '_No linked Google Docs found._']
  }

  const lines = ['## Linked Google Docs', '']
  const sortedDocuments = [...documents].sort(
    (left, right) =>
      left.title.localeCompare(right.title) || left.canonicalUri.localeCompare(right.canonicalUri)
  )

  sortedDocuments.forEach((document, index) => {
    lines.push(
      `### ${formatInlineText(document.title)}`,
      '',
      `Source: [Open in Google Docs](${escapeMarkdownLinkDestination(document.canonicalUri)})`
    )
    if (document.modifiedAt) {
      lines.push(`Modified: ${document.modifiedAt}`)
    }

    const body = document.markdown?.trim()
    if (body) {
      const normalizedBody = stripTitleHeading(body, document.title)
      if (normalizedBody) {
        lines.push('', normalizedBody)
      }
    } else {
      lines.push('', '_Content unavailable._')
    }
    if (document.truncated) {
      lines.push('', '_Content truncated by Xingularity._')
    }
    if (index < sortedDocuments.length - 1) {
      lines.push('')
    }
  })

  return lines
}

function formatTaskStatus(value: CalendarTask['status']): string {
  const label = TASK_STATUS_OPTIONS.find((option) => option.value === value)?.label
  return label ?? formatLabel(value ?? 'pending')
}

function formatUpdateStatus(value: ProjectUpdate['status']): string {
  return formatLabel(value)
}

function formatTaskSchedule(task: CalendarTask): string {
  const date = task.date
    ? task.endDate && task.endDate !== task.date
      ? `${task.date}–${task.endDate}`
      : task.date
    : task.endDate
      ? `Deadline ${task.endDate}`
      : ''
  const time = task.time
    ? task.endTime && task.endTime !== task.time
      ? `${task.time}–${task.endTime}`
      : task.time
    : task.endTime
      ? `Until ${task.endTime}`
      : ''

  return [date, time].filter(Boolean).join(' ') || 'Unscheduled'
}

function formatLabel(value: string): string {
  const normalized = value.replace(/[-_]+/g, ' ').trim()
  return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : 'Unknown'
}

function formatInlineText(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim()
}

function escapeInlineCode(value: string): string {
  return value.replaceAll('`', '\\`')
}

function escapeMarkdownLinkDestination(value: string): string {
  return value.replace(/[\\)]/g, '\\$&')
}

function stripTitleHeading(body: string, title: string): string {
  const lines = body.replace(/\r\n/g, '\n').split('\n')
  const heading = lines[0]?.match(/^#{1,6}\s+(.+)$/)?.[1]?.trim()
  if (heading !== title) {
    return body.trim()
  }
  return lines.slice(1).join('\n').trim()
}

function compareDates(left: string, right: string): number {
  const leftTime = Date.parse(left)
  const rightTime = Date.parse(right)
  if (Number.isFinite(leftTime) && Number.isFinite(rightTime)) {
    return leftTime - rightTime
  }
  return left.localeCompare(right)
}
