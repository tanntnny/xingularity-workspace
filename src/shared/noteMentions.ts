import { stripNoteExtension } from './noteDocument'

const NOTE_MENTION_PREFIX = 'note-mention://'
const NOTE_MENTION_REGEX = /\[\[([^\]\n]+?)\]\]/g

type JsonRecord = Record<string, unknown>

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

export function extractMentionTargets(input: unknown): string[] {
  const targets = new Set<string>()

  const visit = (value: unknown): void => {
    if (typeof value === 'string') {
      for (const match of value.matchAll(NOTE_MENTION_REGEX)) {
        const target = match[1]?.trim()
        if (target) {
          targets.add(target)
        }
      }
      return
    }

    if (Array.isArray(value)) {
      value.forEach((item) => visit(item))
      return
    }

    if (!value || typeof value !== 'object') {
      return
    }

    const record = value as JsonRecord
    if (typeof record.href === 'string') {
      const target = parseNoteMentionHref(record.href)
      if (target) {
        targets.add(target)
      }
    }

    Object.values(record).forEach((item) => visit(item))
  }

  visit(input)
  return Array.from(targets)
}
