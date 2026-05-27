export type NoteSlashCommandId =
  | 'text'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'bulletList'
  | 'numberedList'
  | 'taskList'
  | 'quote'
  | 'codeBlock'
  | 'divider'
  | 'table'

export interface NoteSlashCommand {
  id: NoteSlashCommandId
  label: string
  keywords: string[]
}

export interface NoteSlashTriggerMatch {
  query: string
  triggerStartOffset: number
}

export const NOTE_SLASH_COMMANDS: NoteSlashCommand[] = [
  { id: 'text', label: 'Text', keywords: ['paragraph', 'plain', 'p'] },
  { id: 'heading1', label: 'Heading 1', keywords: ['h1', 'title', 'header'] },
  { id: 'heading2', label: 'Heading 2', keywords: ['h2', 'subtitle', 'header'] },
  { id: 'heading3', label: 'Heading 3', keywords: ['h3', 'subheading', 'header'] },
  { id: 'bulletList', label: 'Bullet List', keywords: ['bullet', 'unordered', 'ul', 'list'] },
  {
    id: 'numberedList',
    label: 'Numbered List',
    keywords: ['numbered', 'ordered', 'ol', 'list']
  },
  { id: 'taskList', label: 'Task List', keywords: ['task', 'todo', 'checklist', 'list'] },
  { id: 'quote', label: 'Quote', keywords: ['blockquote', 'cite'] },
  { id: 'codeBlock', label: 'Code Block', keywords: ['code', 'fence', 'snippet'] },
  { id: 'divider', label: 'Divider', keywords: ['hr', 'rule', 'separator'] },
  { id: 'table', label: 'Table', keywords: ['grid', 'columns', 'rows'] }
]

const SLASH_TRIGGER_PATTERN = /^(\s*)\/([a-z0-9-]*)$/i

export function findNoteSlashTrigger(textBeforeCursor: string): NoteSlashTriggerMatch | null {
  const match = textBeforeCursor.match(SLASH_TRIGGER_PATTERN)
  if (!match) {
    return null
  }

  return {
    query: (match[2] ?? '').trim().toLowerCase(),
    triggerStartOffset: (match[1] ?? '').length
  }
}

export function getNoteSlashCommands(query: string): NoteSlashCommand[] {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) {
    return NOTE_SLASH_COMMANDS
  }

  return NOTE_SLASH_COMMANDS.filter((command) => {
    if (command.label.toLowerCase().includes(normalizedQuery)) {
      return true
    }

    return command.keywords.some((keyword) => keyword.includes(normalizedQuery))
  })
}
