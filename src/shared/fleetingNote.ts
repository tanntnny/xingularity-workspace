import type { FleetingNote } from './types'

const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/

function readFrontmatterValue(frontmatter: string, key: string): string | null {
  const line = frontmatter
    .split(/\r?\n/)
    .find((candidate) => candidate.trimStart().startsWith(`${key}:`))

  if (!line) {
    return null
  }

  const value = line.slice(line.indexOf(':') + 1).trim()
  return value || null
}

export function serializeFleetingNote(note: FleetingNote): string {
  const metadata = [
    '---',
    `type: ${note.type}`,
    `id: ${note.id}`,
    `createdAt: ${note.createdAt}`,
    `updatedAt: ${note.updatedAt}`,
    ...(note.source ? [`source: ${note.source}`] : []),
    ...(note.priority ? [`priority: ${note.priority}`] : []),
    ...(note.tags?.length ? [`tags: ${note.tags.join(',')}`] : []),
    ...(note.dueDate ? [`dueDate: ${note.dueDate}`] : []),
    ...(note.projectId ? [`projectId: ${note.projectId}`] : []),
    ...(note.triageState ? [`triageState: ${note.triageState}`] : []),
    '---',
    ''
  ]
  return [...metadata, note.content].join('\n')
}

export function parseFleetingNote(raw: string, relPath: string): FleetingNote {
  const match = FRONTMATTER_REGEX.exec(raw)
  if (!match) {
    throw new Error(`Invalid fleeting note metadata for ${relPath}`)
  }

  const type = readFrontmatterValue(match[1], 'type')
  const id = readFrontmatterValue(match[1], 'id')
  const createdAt = readFrontmatterValue(match[1], 'createdAt')
  const updatedAt = readFrontmatterValue(match[1], 'updatedAt')
  const source = readFrontmatterValue(match[1], 'source')
  const priority = readFrontmatterValue(match[1], 'priority')
  const tags = readFrontmatterValue(match[1], 'tags')
  const dueDate = readFrontmatterValue(match[1], 'dueDate')
  const projectId = readFrontmatterValue(match[1], 'projectId')
  const triageState = readFrontmatterValue(match[1], 'triageState')

  if (type !== 'fleeting' || !id || !createdAt || !updatedAt) {
    throw new Error(`Invalid fleeting note metadata for ${relPath}`)
  }

  return {
    type: 'fleeting',
    id,
    relPath,
    content: raw.slice(match[0].length).replace(/^\r?\n/, ''),
    createdAt,
    updatedAt,
    ...(source === 'manual' ||
    source === 'shortcut' ||
    source === 'clipboard' ||
    source === 'import'
      ? { source }
      : {}),
    ...(priority === 'low' || priority === 'medium' || priority === 'high' ? { priority } : {}),
    ...(tags
      ? {
          tags: tags
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean)
        }
      : {}),
    ...(dueDate ? { dueDate } : {}),
    ...(projectId ? { projectId } : {}),
    ...(triageState === 'inbox' ||
    triageState === 'in-progress' ||
    triageState === 'converted' ||
    triageState === 'archived'
      ? { triageState }
      : {})
  }
}
