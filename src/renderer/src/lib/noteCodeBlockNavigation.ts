import { exitCode } from '@milkdown/kit/prose/commands'
import { codeBlockSchema } from '@milkdown/kit/preset/commonmark'
import { Plugin, Selection, TextSelection } from '@milkdown/kit/prose/state'
import type { EditorView } from '@milkdown/kit/prose/view'

const CODE_BLOCK_NODE_NAME = codeBlockSchema.key.name

function isAtCodeBlockBoundary(
  view: EditorView,
  direction: 'up' | 'down' | 'left' | 'right'
): boolean {
  const { selection } = view.state
  if (!(selection instanceof TextSelection) || !selection.empty) {
    return false
  }

  const parentText = selection.$from.parent.textContent
  const parentOffset = selection.$from.parentOffset
  switch (direction) {
    case 'up':
      return !parentText.slice(0, parentOffset).includes('\n')
    case 'down':
      return !parentText.slice(parentOffset).includes('\n')
    case 'left':
      return parentOffset === 0
    case 'right':
      return parentOffset >= parentText.length
  }
}

function leaveCodeBlock(view: EditorView, direction: 'up' | 'down' | 'left' | 'right'): boolean {
  const { selection } = view.state
  if (
    !(selection instanceof TextSelection) ||
    !selection.empty ||
    selection.$from.parent.type.name !== CODE_BLOCK_NODE_NAME ||
    !isAtCodeBlockBoundary(view, direction)
  ) {
    return false
  }

  const codeBlockDepth = selection.$from.depth
  const leaveBefore = direction === 'up' || direction === 'left'
  const boundary = leaveBefore
    ? selection.$from.before(codeBlockDepth)
    : selection.$from.after(codeBlockDepth)
  const nextSelection = Selection.findFrom(
    view.state.doc.resolve(boundary),
    leaveBefore ? -1 : 1,
    true
  )

  if (!nextSelection) {
    return false
  }

  view.dispatch(view.state.tr.setSelection(nextSelection).scrollIntoView())
  return true
}

export function createNoteCodeBlockNavigationPlugin(): Plugin {
  return new Plugin({
    props: {
      handleKeyDown(view, event) {
        if (
          event.key === 'Enter' &&
          (event.metaKey || event.ctrlKey) &&
          !event.altKey &&
          !event.shiftKey
        ) {
          if (!exitCode(view.state, (transaction) => view.dispatch(transaction))) {
            return false
          }

          event.preventDefault()
          return true
        }

        if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
          return false
        }

        const directionByKey: Record<string, 'up' | 'down' | 'left' | 'right'> = {
          ArrowUp: 'up',
          ArrowDown: 'down',
          ArrowLeft: 'left',
          ArrowRight: 'right'
        }
        const direction = directionByKey[event.key]
        if (!direction) {
          return false
        }

        if (!leaveCodeBlock(view, direction)) {
          return false
        }

        event.preventDefault()
        return true
      }
    }
  })
}
