interface FrontmatterParts {
  frontmatter: string | null
  body: string
  lineEnding: '\n' | '\r\n'
}

const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/
// Allow tags like "project:my-project" with optional colon-separated namespace
const SIMPLE_TAG_REGEX = /^[a-z0-9_-]{1,64}(:[a-z0-9_-]{1,64})?$/
const INLINE_TAG_REGEX = /(^|[^a-z0-9_])#([a-z0-9_-]{1,64}(?::[a-z0-9_-]{1,64})?)\b/gi

export function normalizeTag(input: string): string | null {
  const normalized = input.trim().replace(/^#/, '').toLowerCase().replace(/\s+/g, '-')
  if (!SIMPLE_TAG_REGEX.test(normalized)) {
    return null
  }
  return normalized
}

/**
 * Generate a project tag in format "project:slug" from project name.
 * Example: "Client Portal Refresh" -> "project:client-portal-refresh"
 */
export function generateProjectTag(projectName: string): string {
  const slug = projectName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64)
  return `project:${slug || 'untitled'}`
}

/**
 * Check if a tag is a project tag (starts with "project:")
 */
export function isProjectTag(tag: string): boolean {
  return tag.startsWith('project:')
}

/**
 * Extract the project slug from a project tag
 */
export function getProjectSlugFromTag(tag: string): string | null {
  if (!isProjectTag(tag)) {
    return null
  }
  return tag.slice('project:'.length)
}

export function listTagsFromMarkdown(markdown: string): string[] {
  const { frontmatter } = splitFrontmatter(markdown)
  if (!frontmatter) {
    return []
  }

  const lines = frontmatter.split(/\r?\n/)
  const tags = new Set<string>()
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim()
    if (!line.startsWith('tags:')) {
      continue
    }

    const inline = line.slice(5).trim()
    if (inline.startsWith('[') && inline.endsWith(']')) {
      const values = inline
        .slice(1, -1)
        .split(',')
        .map((item) => normalizeTag(item))
        .filter((item): item is string => Boolean(item))
      for (const value of values) {
        tags.add(value)
      }
      continue
    }

    let cursor = index + 1
    while (cursor < lines.length && /^\s*-\s+/.test(lines[cursor])) {
      const listValue = lines[cursor].replace(/^\s*-\s+/, '')
      const normalized = normalizeTag(listValue)
      if (normalized) {
        tags.add(normalized)
      }
      cursor += 1
    }
  }

  return Array.from(tags)
}

export function listPreviewTagsFromMarkdown(markdown: string): string[] {
  const frontmatterTags = listTagsFromMarkdown(markdown)
  const combined = new Set(frontmatterTags)
  const { body } = splitFrontmatter(markdown)

  let match = INLINE_TAG_REGEX.exec(body)
  while (match) {
    const normalized = normalizeTag(match[2])
    if (normalized) {
      combined.add(normalized)
    }
    match = INLINE_TAG_REGEX.exec(body)
  }
  INLINE_TAG_REGEX.lastIndex = 0

  return Array.from(combined)
}

export function upsertTagsInMarkdown(markdown: string, nextTags: string[]): string {
  const normalized = Array.from(
    new Set(nextTags.map((tag) => normalizeTag(tag)).filter((tag): tag is string => Boolean(tag)))
  )

  const { frontmatter, body, lineEnding } = splitFrontmatter(markdown)
  const tagsLine = `tags: [${normalized.join(', ')}]`

  if (!frontmatter) {
    return ['---', tagsLine, '---', '', body].join(lineEnding)
  }

  const lines = frontmatter.split(/\r?\n/)
  const cleaned: string[] = []
  for (let index = 0; index < lines.length; index += 1) {
    if (/^\s*tags\s*:/.test(lines[index])) {
      index += 1
      while (index < lines.length && /^\s*-\s+/.test(lines[index])) {
        index += 1
      }
      index -= 1
      continue
    }
    cleaned.push(lines[index])
  }

  const titleIndex = cleaned.findIndex((line) => /^\s*title\s*:/.test(line))
  const insertAt = titleIndex >= 0 ? titleIndex + 1 : 0
  cleaned.splice(insertAt, 0, tagsLine)

  return ['---', ...cleaned, '---', '', body].join(lineEnding)
}

function splitFrontmatter(markdown: string): FrontmatterParts {
  const lineEnding = markdown.includes('\r\n') ? '\r\n' : '\n'
  const match = FRONTMATTER_REGEX.exec(markdown)
  if (!match) {
    return {
      frontmatter: null,
      body: markdown,
      lineEnding
    }
  }

  return {
    frontmatter: match[1],
    body: markdown.slice(match[0].length),
    lineEnding
  }
}
