export interface MarkdownMergeConflictHunk {
  readonly baseStart: number
  readonly baseEnd: number
  readonly local: readonly string[]
  readonly external: readonly string[]
}

export interface MarkdownMergeSuccess {
  readonly status: 'merged'
  readonly content: string
}

export interface MarkdownMergeConflict {
  readonly status: 'conflict'
  readonly reason: 'overlapping-edits' | 'newline-conflict'
  readonly base: string
  readonly local: string
  readonly external: string
  readonly hunks: readonly MarkdownMergeConflictHunk[]
}

export type MarkdownMergeResult = MarkdownMergeSuccess | MarkdownMergeConflict

interface NormalizedMarkdown {
  readonly lines: readonly string[]
  readonly hasFinalNewline: boolean
}

interface MarkdownChange {
  readonly start: number
  readonly end: number
  readonly replacement: readonly string[]
}

type DiffOperation =
  | { readonly kind: 'equal'; readonly line: string }
  | { readonly kind: 'insert'; readonly line: string }
  | { readonly kind: 'delete'; readonly line: string }

interface LineMerge {
  readonly lines: readonly string[]
  readonly conflicts: readonly MarkdownMergeConflictHunk[]
}

/**
 * Merge Markdown against a common base using deterministic line-based hunks.
 *
 * Line endings are normalized to LF in a successful result. Concurrent edits
 * to the same base range are conflicts; this function never writes conflict
 * markers into the returned content.
 */
export function mergeMarkdownThreeWay(
  base: string,
  local: string,
  external: string
): MarkdownMergeResult {
  const normalizedBase = normalizeMarkdown(base)
  const normalizedLocal = normalizeMarkdown(local)
  const normalizedExternal = normalizeMarkdown(external)

  if (sameMarkdown(normalizedLocal, normalizedExternal)) {
    return mergedResult(normalizedLocal)
  }
  if (sameMarkdown(normalizedLocal, normalizedBase)) {
    return mergedResult(normalizedExternal)
  }
  if (sameMarkdown(normalizedExternal, normalizedBase)) {
    return mergedResult(normalizedLocal)
  }

  const lineMerge = mergeLines(
    normalizedBase.lines,
    normalizedLocal.lines,
    normalizedExternal.lines
  )
  const newlineMerge = mergeFinalNewline(
    normalizedBase.hasFinalNewline,
    normalizedLocal.hasFinalNewline,
    normalizedExternal.hasFinalNewline
  )

  if (lineMerge.conflicts.length > 0) {
    return conflictResult('overlapping-edits', base, local, external, lineMerge.conflicts)
  }
  if (newlineMerge === 'conflict') {
    return conflictResult('newline-conflict', base, local, external, [])
  }

  return {
    status: 'merged',
    content: serializeMarkdown({ lines: lineMerge.lines, hasFinalNewline: newlineMerge })
  }
}

/** Alias with the shorter name used by callers that already know the input is Markdown. */
export const mergeMarkdown = mergeMarkdownThreeWay

function normalizeMarkdown(content: string): NormalizedMarkdown {
  const normalized = content.replace(/\r\n?/g, '\n')
  const hasFinalNewline = normalized.endsWith('\n')
  const body = hasFinalNewline ? normalized.slice(0, -1) : normalized

  return {
    lines: body.length === 0 && !hasFinalNewline ? [] : body.split('\n'),
    hasFinalNewline
  }
}

function serializeMarkdown(content: NormalizedMarkdown): string {
  const body = content.lines.join('\n')
  return content.hasFinalNewline ? `${body}\n` : body
}

function sameMarkdown(left: NormalizedMarkdown, right: NormalizedMarkdown): boolean {
  return (
    left.hasFinalNewline === right.hasFinalNewline &&
    left.lines.length === right.lines.length &&
    left.lines.every((line, index) => line === right.lines[index])
  )
}

function mergedResult(content: NormalizedMarkdown): MarkdownMergeSuccess {
  return {
    status: 'merged',
    content: serializeMarkdown(content)
  }
}

function conflictResult(
  reason: MarkdownMergeConflict['reason'],
  base: string,
  local: string,
  external: string,
  hunks: readonly MarkdownMergeConflictHunk[]
): MarkdownMergeConflict {
  return {
    status: 'conflict',
    reason,
    base,
    local,
    external,
    hunks
  }
}

function mergeFinalNewline(base: boolean, local: boolean, external: boolean): boolean | 'conflict' {
  if (local === external) {
    return local
  }
  if (local === base) {
    return external
  }
  if (external === base) {
    return local
  }
  return 'conflict'
}

function mergeLines(
  base: readonly string[],
  local: readonly string[],
  external: readonly string[]
): LineMerge {
  const localChanges = diffToChanges(base, local)
  const externalChanges = diffToChanges(base, external)
  const conflicts: MarkdownMergeConflictHunk[] = []

  for (const localChange of localChanges) {
    for (const externalChange of externalChanges) {
      if (!changesOverlap(localChange, externalChange)) {
        continue
      }
      if (sameChange(localChange, externalChange)) {
        continue
      }
      conflicts.push({
        baseStart: Math.min(localChange.start, externalChange.start),
        baseEnd: Math.max(localChange.end, externalChange.end),
        local: localChange.replacement,
        external: externalChange.replacement
      })
    }
  }

  if (conflicts.length > 0) {
    return { lines: [], conflicts }
  }

  const changes = deduplicateChanges([...localChanges, ...externalChanges]).sort(compareChanges)
  const lines: string[] = []
  let baseIndex = 0

  for (const change of changes) {
    lines.push(...base.slice(baseIndex, change.start))
    lines.push(...change.replacement)
    baseIndex = change.end
  }
  lines.push(...base.slice(baseIndex))

  return { lines, conflicts: [] }
}

function changesOverlap(left: MarkdownChange, right: MarkdownChange): boolean {
  if (left.start === left.end && right.start === right.end) {
    return left.start === right.start
  }
  if (left.start === left.end) {
    return left.start >= right.start && left.start < right.end
  }
  if (right.start === right.end) {
    return right.start >= left.start && right.start < left.end
  }
  return left.start < right.end && right.start < left.end
}

function sameChange(left: MarkdownChange, right: MarkdownChange): boolean {
  return (
    left.start === right.start &&
    left.end === right.end &&
    left.replacement.length === right.replacement.length &&
    left.replacement.every((line, index) => line === right.replacement[index])
  )
}

function deduplicateChanges(changes: readonly MarkdownChange[]): MarkdownChange[] {
  const unique: MarkdownChange[] = []
  for (const change of changes) {
    if (!unique.some((candidate) => sameChange(candidate, change))) {
      unique.push(change)
    }
  }
  return unique
}

function compareChanges(left: MarkdownChange, right: MarkdownChange): number {
  return left.start - right.start || left.end - right.end
}

function diffToChanges(base: readonly string[], target: readonly string[]): MarkdownChange[] {
  const operations = diffLines(base, target)
  const changes: MarkdownChange[] = []
  let baseIndex = 0
  let current: { start: number; end: number; replacement: string[] } | undefined

  const flush = (): void => {
    if (current) {
      changes.push(current)
      current = undefined
    }
  }

  for (const operation of operations) {
    if (operation.kind === 'equal') {
      flush()
      baseIndex += 1
      continue
    }

    if (!current) {
      current = { start: baseIndex, end: baseIndex, replacement: [] }
    }

    if (operation.kind === 'delete') {
      baseIndex += 1
      current.end = baseIndex
    } else {
      current.replacement.push(operation.line)
    }
  }
  flush()
  return changes
}

function diffLines(base: readonly string[], target: readonly string[]): DiffOperation[] {
  const maxDistance = base.length + target.length
  const trace: Array<Map<number, number>> = []
  const frontier = new Map<number, number>([[1, 0]])

  for (let distance = 0; distance <= maxDistance; distance += 1) {
    trace.push(new Map(frontier))

    for (let diagonal = -distance; diagonal <= distance; diagonal += 2) {
      const down = diagonal === -distance
      const moveDown =
        down ||
        (diagonal !== distance &&
          (frontier.get(diagonal - 1) ?? Number.NEGATIVE_INFINITY) <
            (frontier.get(diagonal + 1) ?? Number.NEGATIVE_INFINITY))
      let x = moveDown ? (frontier.get(diagonal + 1) ?? 0) : (frontier.get(diagonal - 1) ?? 0) + 1
      let y = x - diagonal

      while (x < base.length && y < target.length && base[x] === target[y]) {
        x += 1
        y += 1
      }

      frontier.set(diagonal, x)
      if (x >= base.length && y >= target.length) {
        return backtrackDiff(trace, base, target, x, y)
      }
    }
  }

  throw new Error('Markdown diff did not converge')
}

function backtrackDiff(
  trace: readonly Map<number, number>[],
  base: readonly string[],
  target: readonly string[],
  endX: number,
  endY: number
): DiffOperation[] {
  const operations: DiffOperation[] = []
  let x = endX
  let y = endY

  for (let distance = trace.length - 1; distance > 0; distance -= 1) {
    const frontier = trace[distance]
    const diagonal = x - y
    const moveDown =
      diagonal === -distance ||
      (diagonal !== distance &&
        (frontier.get(diagonal - 1) ?? Number.NEGATIVE_INFINITY) <
          (frontier.get(diagonal + 1) ?? Number.NEGATIVE_INFINITY))
    const previousDiagonal = moveDown ? diagonal + 1 : diagonal - 1
    const previousX = frontier.get(previousDiagonal)

    if (previousX === undefined) {
      throw new Error('Markdown diff backtrack encountered an invalid path')
    }
    const previousY = previousX - previousDiagonal

    while (x > previousX && y > previousY) {
      operations.push({ kind: 'equal', line: base[x - 1] as string })
      x -= 1
      y -= 1
    }

    if (x === previousX) {
      operations.push({ kind: 'insert', line: target[y - 1] as string })
      y -= 1
    } else {
      operations.push({ kind: 'delete', line: base[x - 1] as string })
      x -= 1
    }
  }

  while (x > 0 && y > 0) {
    operations.push({ kind: 'equal', line: base[x - 1] as string })
    x -= 1
    y -= 1
  }
  while (x > 0) {
    operations.push({ kind: 'delete', line: base[x - 1] as string })
    x -= 1
  }
  while (y > 0) {
    operations.push({ kind: 'insert', line: target[y - 1] as string })
    y -= 1
  }

  operations.reverse()
  return operations
}
