export const TAG_COLOR_COUNT = 6

export function getTagColorIndex(tag: string): number {
  let hash = 0
  for (let index = 0; index < tag.length; index += 1) {
    hash = (hash * 31 + tag.charCodeAt(index)) >>> 0
  }
  return hash % TAG_COLOR_COUNT
}
