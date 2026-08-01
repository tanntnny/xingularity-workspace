export const TAG_COLOR_COUNT = 6
export const TAG_COLOR_VARIANTS = ['tag0', 'tag1', 'tag2', 'tag3', 'tag4', 'tag5'] as const

export type TagColorVariant = (typeof TAG_COLOR_VARIANTS)[number]

function getTagColorKey(tag: string): string {
  return tag.trim().replace(/^#/, '').toLowerCase()
}

export function getTagColorIndex(tag: string): number {
  const colorKey = getTagColorKey(tag)
  let hash = 0
  for (let index = 0; index < colorKey.length; index += 1) {
    hash = (hash * 31 + colorKey.charCodeAt(index)) >>> 0
  }
  return hash % TAG_COLOR_COUNT
}

export function getTagColorVariant(tag: string): TagColorVariant {
  return TAG_COLOR_VARIANTS[getTagColorIndex(tag)]
}
