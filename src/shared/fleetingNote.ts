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
  return [
    '---',
    `type: ${note.type}`,
    `id: ${note.id}`,
    `createdAt: ${note.createdAt}`,
    `updatedAt: ${note.updatedAt}`,
    '---',
    '',
    note.content
  ].join('\n')
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

  if (type !== 'fleeting' || !id || !createdAt || !updatedAt) {
    throw new Error(`Invalid fleeting note metadata for ${relPath}`)
  }

  return {
    type: 'fleeting',
    id,
    relPath,
    content: raw.slice(match[0].length).replace(/^\r?\n/, ''),
    createdAt,
    updatedAt
  }
}
