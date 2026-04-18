import type { NoteListItem } from './types'
import { stripNoteExtension } from './noteDocument'

const NOTE_MENTION_PREFIX = 'note-mention://'
const NOTE_MENTION_REGEX = /\[\[([^\]\n]+?)\]\]/g
const NOTE_MENTION_MARKDOWN_LINK_REGEX = new RegExp(
  `\\[([^\\]]+?)\\]\\(${NOTE_MENTION_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\)]+)\\)`,
  'g'
)

type JsonRecord = Record<string, unknown>
type NoteMentionable = Pick<NoteListItem, 'relPath' | 'name'>

function cleanMentionTarget(input: string): string {
  return stripNoteExtension(input.trim()).replace(/^\/+/, '').replace(/\/+$/, '')
}

export function noteMentionPrefix(): string {
  return NOTE_MENTION_PREFIX
}

export function noteMentionHref(target: string): string {
  return `${NOTE_MENTION_PREFIX}${encodeURIComponent(cleanMentionTarget(target))}`
}

export function parseNoteMentionHref(href: string): string | null {
  if (!href.startsWith(NOTE_MENTION_PREFIX)) {
    return null
  }

  return cleanMentionTarget(decodeURIComponent(href.slice(NOTE_MENTION_PREFIX.length)))
}

export function normalizeMentionTarget(input: string): string {
  return cleanMentionTarget(input).toLowerCase()
}

export function mentionTokenFromRelPath(relPath: string): string {
  return `[[${stripNoteExtension(relPath)}]]`
}

export function mentionsToMarkdownLinks(markdown: string): string {
  return markdown.replace(NOTE_MENTION_REGEX, (_match, rawTarget: string) => {
    const target = cleanMentionTarget(rawTarget)
    const href = noteMentionHref(target)
    return `[${target}](${href})`
  })
}

export function markdownLinksToMentions(markdown: string): string {
  return markdown.replace(
    NOTE_MENTION_MARKDOWN_LINK_REGEX,
    (_match, _label: string, rawTarget: string) => {
      const target = parseNoteMentionHref(`${NOTE_MENTION_PREFIX}${rawTarget}`) ?? rawTarget.trim()
      return `[[${target}]]`
    }
  )
}

export function normalizeNoteMentionMarkdown(markdown: string): string {
  const normalizedLinks = markdown.replace(
    NOTE_MENTION_MARKDOWN_LINK_REGEX,
    (_match, label: string, rawTarget: string) => {
      const target = parseNoteMentionHref(`${NOTE_MENTION_PREFIX}${rawTarget}`) ?? rawTarget.trim()
      return `[${label}](${noteMentionHref(target)})`
    }
  )

  return mentionsToMarkdownLinks(normalizedLinks)
}

export function rewriteNoteMentionTargets(
  markdown: string,
  rewriteTarget: (target: string) => string | null
): string {
  const rewrittenLinks = markdown.replace(
    NOTE_MENTION_MARKDOWN_LINK_REGEX,
    (match, label: string, rawTarget: string) => {
      const target = parseNoteMentionHref(`${NOTE_MENTION_PREFIX}${rawTarget}`) ?? rawTarget.trim()
      const nextTarget = rewriteTarget(target)
      if (!nextTarget || nextTarget === target) {
        return match
      }

      return `[${label}](${noteMentionHref(nextTarget)})`
    }
  )

  return rewrittenLinks.replace(NOTE_MENTION_REGEX, (match, rawTarget: string) => {
    const target = cleanMentionTarget(rawTarget)
    const nextTarget = rewriteTarget(target)
    if (!nextTarget || nextTarget === target) {
      return match
    }

    return `[[${nextTarget}]]`
  })
}

export function extractMentionTargets(input: unknown): string[] {
  const targets = new Set<string>()

  const visit = (value: unknown): void => {
    if (typeof value === 'string') {
      for (const match of value.matchAll(NOTE_MENTION_MARKDOWN_LINK_REGEX)) {
        const target = parseNoteMentionHref(`${NOTE_MENTION_PREFIX}${match[2] ?? ''}`)
        if (target) {
          targets.add(target)
        }
      }

      for (const match of value.matchAll(NOTE_MENTION_REGEX)) {
        const target = match[1] ? cleanMentionTarget(match[1]) : null
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

export function extractMentionTargetsFromMarkdown(markdown: string): string[] {
  return extractMentionTargets(markdown)
}

export function createNoteMentionResolver(
  notes: NoteMentionable[]
): (target: string) => string | null {
  const exactPathLookup = new Map<string, string>()
  const noteNameGroups = new Map<string, NoteMentionable[]>()

  notes.forEach((note) => {
    exactPathLookup.set(normalizeMentionTarget(note.relPath), note.relPath)
    const nameKey = normalizeMentionTarget(note.name)
    const matches = noteNameGroups.get(nameKey)
    if (matches) {
      matches.push(note)
      return
    }

    noteNameGroups.set(nameKey, [note])
  })

  return (target: string): string | null => {
    const normalizedTarget = normalizeMentionTarget(target)
    const exactMatch = exactPathLookup.get(normalizedTarget)
    if (exactMatch) {
      return exactMatch
    }

    const byNameMatches = noteNameGroups.get(normalizedTarget) ?? []
    return byNameMatches.length === 1 ? byNameMatches[0].relPath : null
  }
}

export function resolveNoteMentionTarget(notes: NoteMentionable[], target: string): string | null {
  return createNoteMentionResolver(notes)(target)
}
