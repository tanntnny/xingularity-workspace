import { codeBlockSchema } from '@milkdown/kit/preset/commonmark'
import type { Node as ProseNode, ResolvedPos } from '@milkdown/kit/prose/model'
import { Plugin, PluginKey } from '@milkdown/kit/prose/state'
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view'
import { getCodeHighlightRanges } from './codeSyntaxHighlighting'

const CODE_BLOCK_NODE_NAME = codeBlockSchema.key.name
const noteCodeBlockSyntaxPluginKey = new PluginKey('note-code-block-syntax')

interface DecorationRange {
  from: number
  to: number
}

interface DecorationTarget {
  node: ProseNode
  range: DecorationRange
}

interface TransactionLike {
  docChanged: boolean
  mapping: {
    maps: readonly {
      forEach: (
        callback: (oldStart: number, oldEnd: number, newStart: number, newEnd: number) => void
      ) => void
      map: (position: number, assoc?: number) => number
    }[]
  }
}

function getTransactionChangedRange(transaction: TransactionLike): DecorationRange | null {
  if (!transaction.docChanged) {
    return null
  }

  let from = Number.POSITIVE_INFINITY
  let to = Number.NEGATIVE_INFINITY

  transaction.mapping.maps.forEach((map, index) => {
    if (index > 0) {
      from = map.map(from, 1)
      to = map.map(to, -1)
    }

    map.forEach((_oldStart, _oldEnd, newStart, newEnd) => {
      from = Math.min(from, newStart)
      to = Math.max(to, newEnd)
    })
  })

  return from === Number.POSITIVE_INFINITY ? null : { from, to }
}

function getDecorationTarget(position: ResolvedPos): DecorationTarget | null {
  for (let depth = position.depth; depth > 0; depth -= 1) {
    const node = position.node(depth)
    if (node.type.name === CODE_BLOCK_NODE_NAME) {
      return {
        node,
        range: {
          from: position.before(depth),
          to: position.after(depth)
        }
      }
    }
  }

  return null
}

function rangesEqual(left: DecorationRange, right: DecorationRange): boolean {
  return left.from === right.from && left.to === right.to
}

function isRangeWithin(inner: DecorationRange, outer: DecorationRange): boolean {
  return inner.from >= outer.from && inner.to <= outer.to + 1
}

function refreshDecorationTarget(
  decorationSet: DecorationSet,
  doc: ProseNode,
  target: DecorationTarget
): DecorationSet {
  const staleDecorations = decorationSet.find(target.range.from, target.range.to)
  const decorations = getCodeBlockDecorations(target.node, target.range.from)
  return decorationSet.remove(staleDecorations).add(doc, decorations)
}

function getCodeBlockDecorations(node: ProseNode, pos: number): Decoration[] {
  const contentStart = pos + 1
  return getCodeHighlightRanges(node.textContent, node.attrs.language).map((range) =>
    Decoration.inline(contentStart + range.from, contentStart + range.to, {
      class: range.className
    })
  )
}

function createCodeBlockDecorationSet(doc: ProseNode): DecorationSet {
  const decorations: Decoration[] = []

  doc.descendants((node, pos) => {
    if (node.type.name !== CODE_BLOCK_NODE_NAME) {
      return true
    }

    decorations.push(...getCodeBlockDecorations(node, pos))
    return false
  })

  return DecorationSet.create(doc, decorations)
}

export function createNoteCodeBlockSyntaxPlugin(): Plugin {
  return new Plugin({
    key: noteCodeBlockSyntaxPluginKey,
    state: {
      init: (_config, state) => ({
        decorations: createCodeBlockDecorationSet(state.doc)
      }),
      apply(transaction, previousState, oldState, newState) {
        const previousTarget = getDecorationTarget(oldState.selection.$from)
        const nextTarget = getDecorationTarget(newState.selection.$from)
        const selectionChanged = !oldState.selection.eq(newState.selection)

        if (!transaction.docChanged && !selectionChanged) {
          return previousState
        }

        let decorations = previousState.decorations
        if (transaction.docChanged) {
          decorations = decorations.map(transaction.mapping, newState.doc)
          const changedRange = getTransactionChangedRange(transaction)
          if (!changedRange) {
            return { decorations: createCodeBlockDecorationSet(newState.doc) }
          }

          if (!nextTarget) {
            if (previousTarget) {
              return { decorations: createCodeBlockDecorationSet(newState.doc) }
            }

            return { decorations }
          }

          if (!isRangeWithin(changedRange, nextTarget.range)) {
            return { decorations: createCodeBlockDecorationSet(newState.doc) }
          }

          decorations = refreshDecorationTarget(decorations, newState.doc, nextTarget)
        } else {
          const targets: DecorationTarget[] = []
          if (previousTarget) {
            targets.push(previousTarget)
          }
          if (
            nextTarget &&
            !targets.some((target) => rangesEqual(target.range, nextTarget.range))
          ) {
            targets.push(nextTarget)
          }

          for (const target of targets) {
            decorations = refreshDecorationTarget(decorations, newState.doc, target)
          }
        }

        return { decorations }
      }
    },
    props: {
      decorations(state) {
        return noteCodeBlockSyntaxPluginKey.getState(state)?.decorations ?? DecorationSet.empty
      }
    }
  })
}
