import { stripNoteExtension } from './noteDocument'

const NOTE_MENTION_PREFIX = 'note-mention://'
const NOTE_MENTION_REGEX = /\[\[([^\]\n]+?)\]\]/g

export function noteMentionPrefix(): string {
  return NOTE_MENTION_PREFIX
}

export function noteMentionHref(target: string): string {
  return `${NOTE_MENTION_PREFIX}${encodeURIComponent(target.trim())}`
}

export function parseNoteMentionHref(href: string): string | null {
  if (!href.startsWith(NOTE_MENTION_PREFIX)) {
    return null
  }

  return decodeURIComponent(href.slice(NOTE_MENTION_PREFIX.length)).trim()
}

export function normalizeMentionTarget(input: string): string {
  return stripNoteExtension(input.trim()).replace(/^\/+/, '').replace(/\/+$/, '').toLowerCase()
}

export function mentionTokenFromRelPath(relPath: string): string {
  return `[[${stripNoteExtension(relPath)}]]`
}

export function mentionsToMarkdownLinks(markdown: string): string {
  return markdown.replace(NOTE_MENTION_REGEX, (_match, rawTarget: string) => {
    const target = rawTarget.trim()
    const href = noteMentionHref(target)
    return `[${target}](${href})`
  })
}

export function markdownLinksToMentions(markdown: string): string {
  const mentionLinkRegex = new RegExp(
    `\\[([^\\]]+?)\\]\\(${NOTE_MENTION_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\)]+)\\)`,
    'g'
  )

  return markdown.replace(mentionLinkRegex, (_match, _label: string, rawTarget: string) => {
    const target = parseNoteMentionHref(`${NOTE_MENTION_PREFIX}${rawTarget}`) ?? rawTarget.trim()
    return `[[${target}]]`
  })
}
