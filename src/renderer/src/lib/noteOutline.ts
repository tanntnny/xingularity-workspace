export interface NoteOutlineItem {
  id: string
  label: string
  level: number
}

interface OutlineBlock {
  id: string
  type: string
  props?: Record<string, unknown>
  content?: unknown
  children?: OutlineBlock[]
}

function extractStyledText(item: unknown): string {
  if (!item || typeof item !== 'object') {
    return ''
  }

  if ('text' in item && typeof item.text === 'string') {
    return item.text
  }

  return ''
}

function extractInlineText(content: unknown): string {
  if (!Array.isArray(content) || content.length === 0) {
    return ''
  }

  return content
    .map((item) => {
      if (!item || typeof item !== 'object' || !('type' in item)) {
        return ''
      }

      if (item.type === 'text') {
        return extractStyledText(item)
      }

      if (item.type === 'link') {
        if (!('content' in item) || !Array.isArray(item.content)) {
          return ''
        }

        return item.content.map((child) => extractStyledText(child)).join('')
      }

      if ('content' in item && typeof item.content === 'string') {
        return item.content
      }

      if ('content' in item && Array.isArray(item.content)) {
        return item.content
          .map((child) => {
            if (typeof child === 'string') {
              return child
            }

            if (child && typeof child === 'object' && 'text' in child) {
              return String(child.text)
            }

            return ''
          })
          .join('')
      }

      return ''
    })
    .join('')
    .trim()
}

export function extractNoteOutline<T extends OutlineBlock>(blocks: T[]): NoteOutlineItem[] {
  const outline: NoteOutlineItem[] = []

  const visit = (items: OutlineBlock[]): void => {
    items.forEach((block) => {
      if (block.type === 'heading') {
        const label = extractInlineText(block.content)
        const level = typeof block.props?.level === 'number' ? block.props.level : 1
        if (label) {
          outline.push({
            id: block.id,
            label,
            level: Math.max(1, Math.min(level, 6))
          })
        }
      }

      if (block.children && block.children.length > 0) {
        visit(block.children)
      }
    })
  }

  visit(blocks)
  return outline
}

function stripMarkdownHeadingDecorators(label: string): string {
  return label
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/[*_~`]/g, '')
    .trim()
}

export function extractNoteOutlineFromMarkdown(markdown: string): NoteOutlineItem[] {
  const outline: NoteOutlineItem[] = []
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  let inCodeFence = false

  lines.forEach((line, index) => {
    if (/^\s*```/.test(line)) {
      inCodeFence = !inCodeFence
      return
    }

    if (inCodeFence) {
      return
    }

    const match = /^(#{1,6})\s+(.*\S.*)\s*$/.exec(line)
    if (!match) {
      return
    }

    const label = stripMarkdownHeadingDecorators(match[2])
    if (!label) {
      return
    }

    outline.push({
      id: `heading-line-${index + 1}`,
      label,
      level: match[1].length
    })
  })

  return outline
}
