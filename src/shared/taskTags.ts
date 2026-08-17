import { normalizeTag } from './noteTags'

export const TASK_TAG_MAX_COUNT = 50

export function normalizeTaskTags(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return []
  }

  const tags: string[] = []
  const seen = new Set<string>()

  for (const value of input) {
    if (typeof value !== 'string') {
      continue
    }

    const normalized = normalizeTag(value)
    if (!normalized || seen.has(normalized)) {
      continue
    }

    seen.add(normalized)
    tags.push(normalized)
    if (tags.length >= TASK_TAG_MAX_COUNT) {
      break
    }
  }

  return tags
}
