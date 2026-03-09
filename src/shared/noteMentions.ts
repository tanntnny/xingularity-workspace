const NOTE_MENTION_PREFIX = 'note-mention://'
const NOTE_MENTION_REGEX = /\[\[([^\[\]\n]+?)\]\]/g

export function noteMentionPrefix(): string {
  return NOTE_MENTION_PREFIX
}

export function normalizeMentionTarget(input: string): string {
  return input.trim().replace(/\.md$/i, '').replace(/^\/+/, '').replace(/\/+$/, '').toLowerCase()
}

export function mentionTokenFromRelPath(relPath: string): string {
  return `[[${relPath.replace(/\.md$/i, '')}]]`
}

export function mentionsToMarkdownLinks(markdown: string): string {
  return markdown.replace(NOTE_MENTION_REGEX, (_match, rawTarget: string) => {
    const target = rawTarget.trim()
    const href = `${NOTE_MENTION_PREFIX}${encodeURIComponent(target)}`
    return `[${target}](${href})`
  })
}
