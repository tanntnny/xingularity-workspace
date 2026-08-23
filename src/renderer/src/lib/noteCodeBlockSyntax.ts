import { codeBlockSchema } from '@milkdown/kit/preset/commonmark'
import { Plugin } from '@milkdown/kit/prose/state'
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view'
import { getCodeHighlightRanges } from './codeSyntaxHighlighting'

const CODE_BLOCK_NODE_NAME = codeBlockSchema.key.name

export function createNoteCodeBlockSyntaxPlugin(): Plugin {
  return new Plugin({
    props: {
      decorations(state) {
        const decorations: Decoration[] = []

        state.doc.descendants((node, pos) => {
          if (node.type.name !== CODE_BLOCK_NODE_NAME) {
            return true
          }

          const contentStart = pos + 1
          for (const range of getCodeHighlightRanges(node.textContent, node.attrs.language)) {
            decorations.push(
              Decoration.inline(contentStart + range.from, contentStart + range.to, {
                class: range.className
              })
            )
          }

          return false
        })

        return DecorationSet.create(state.doc, decorations)
      }
    }
  })
}
