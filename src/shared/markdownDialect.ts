interface MarkdownPosition {
  start?: { offset?: number }
  end?: { offset?: number }
}

interface MarkdownNode {
  type: string
  value?: string
  children?: MarkdownNode[]
  position?: MarkdownPosition
  data?: Record<string, unknown>
}

interface MarkdownFile {
  value: unknown
}

interface SetextHeadingInfo {
  markerLine: string
  marker: string
}

const SETEXT_MARKER_PATTERN = /^[ \t]*([=-]+)[ \t]*$/
const THEMATIC_BREAK_PATTERN = /^( {0,3})([-*_])(?:[ \t]*\2){2,}[ \t]*$/

function sourceForNode(node: MarkdownNode, source: string): string | null {
  const start = node.position?.start?.offset
  const end = node.position?.end?.offset
  if (start === undefined || end === undefined) return null
  return source.slice(start, end)
}

function setextHeadingInfo(node: MarkdownNode, source: string): SetextHeadingInfo | null {
  if (node.type !== 'heading') return null
  const raw = sourceForNode(node, source)
  if (!raw) return null

  const lines = raw.split(/\r?\n/)
  if (lines.length < 2) return null
  const markerLine = lines.at(-1)
  if (!markerLine) return null

  const marker = SETEXT_MARKER_PATTERN.exec(markerLine)?.[1]
  return marker ? { markerLine, marker } : null
}

function isThematicBreak(markerLine: string): boolean {
  return THEMATIC_BREAK_PATTERN.test(markerLine)
}

function isSingleUnderscoreEmphasis(node: MarkdownNode, source: string): boolean {
  if (node.type !== 'emphasis') return false
  const raw = sourceForNode(node, source)
  return Boolean(
    raw && raw.startsWith('_') && raw.endsWith('_') && !raw.startsWith('__') && !raw.endsWith('__')
  )
}

function transformChildren(node: MarkdownNode, source: string): void {
  if (!node.children) return

  const transformed: MarkdownNode[] = []
  for (const child of node.children) {
    transformChildren(child, source)

    if (isSingleUnderscoreEmphasis(child, source)) {
      child.data = { ...child.data, hName: 'u' }
    }

    const setext = setextHeadingInfo(child, source)
    if (!setext) {
      transformed.push(child)
      continue
    }

    if (isThematicBreak(setext.markerLine)) {
      transformed.push({
        type: 'paragraph',
        children: child.children ?? [],
        position: child.position
      })
      transformed.push({ type: 'thematicBreak' })
      continue
    }

    child.type = 'paragraph'
    child.children = [...(child.children ?? []), { type: 'text', value: `\n${setext.markerLine}` }]
    transformed.push(child)
  }

  node.children = transformed
}

/**
 * Applies Xingularity's rendered Markdown conventions without changing the
 * canonical source text stored in notes or copied/exported as Markdown.
 */
export function remarkXingularityMarkdown(): (tree: MarkdownNode, file: MarkdownFile) => void {
  return (tree, file) => {
    transformChildren(tree, String(file.value))
  }
}
