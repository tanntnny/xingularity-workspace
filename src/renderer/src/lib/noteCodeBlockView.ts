import type { Ctx } from '@milkdown/ctx'
import { nodeViewCtx } from '@milkdown/kit/core'
import type { Node as ProseNode } from '@milkdown/kit/prose/model'
import type { NodeView, NodeViewConstructor, EditorView } from '@milkdown/kit/prose/view'
import { codeBlockSchema } from '@milkdown/kit/preset/commonmark'

const COPY_ICON_MARKUP = [
  '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"',
  ' fill="currentColor" aria-hidden="true">',
  '<path d="M20.926 7.074a3.67 3.67 0 0 1 1.074 2.593v8.666a3.667 3.667 0 0 1 -3.667 3.667h-8.666a3.667 3.667 0 0 1 -3.667 -3.667v-8.666q 0 -.053 .005 -.102a3.66 3.66 0 0 1 3.662 -3.565h8.666c.973 0 1.905 .386 2.593 1.074"></path>',
  '<path d="M17.374 3.514a1 1 0 1 1 -1.748 .972c-.221 -.398 -.342 -.486 -.626 -.486h-10c-.548 0 -1 .452 -1 1v9.998c0 .36 .194 .692 .507 .87a1 1 0 1 1 -.99 1.738a3 3 0 0 1 -1.517 -2.606v-10c0 -1.652 1.348 -3 3 -3h10c1.094 0 1.828 .533 2.374 1.514"></path>',
  '</svg>'
].join('')

const CHECK_ICON_MARKUP = [
  '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"',
  ' fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"',
  ' stroke-linejoin="round" aria-hidden="true">',
  '<path d="m5 12 4 4 10-10"></path>',
  '</svg>'
].join('')

const COPY_FEEDBACK_DURATION_MS = 1500
const CODE_BLOCK_NODE_NAME = codeBlockSchema.key.name

async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    return
  } catch {
    const element = document.createElement('textarea')
    const previouslyFocusedElement = document.activeElement
    const selection = document.getSelection()
    const originalRange = selection?.rangeCount ? selection.getRangeAt(0) : null

    let didCopy = false

    try {
      element.value = text
      element.setAttribute('readonly', '')
      element.style.contain = 'strict'
      element.style.position = 'absolute'
      element.style.left = '-9999px'
      element.style.fontSize = '12pt'

      document.body.appendChild(element)
      element.select()
      element.selectionStart = 0
      element.selectionEnd = text.length
      didCopy = document.execCommand('copy')
    } finally {
      element.remove()

      if (selection && originalRange) {
        selection.removeAllRanges()
        selection.addRange(originalRange)
      }

      if (previouslyFocusedElement instanceof HTMLElement) {
        previouslyFocusedElement.focus()
      }
    }

    if (!didCopy) {
      throw new Error('The browser rejected the clipboard copy command')
    }
  }
}

class NoteCodeBlockView implements NodeView {
  dom: HTMLElement
  contentDOM: HTMLElement

  private readonly copyButton: HTMLButtonElement
  private readonly copyIconElement: HTMLSpanElement
  private readonly copyStatusElement: HTMLSpanElement
  private readonly preElement: HTMLPreElement
  private copyFeedbackTimeoutId: number | null = null

  constructor(
    private node: ProseNode,
    private readonly view: EditorView
  ) {
    this.dom = document.createElement('div')
    this.dom.className = 'milkdown-code-block note-fenced-code-block'

    this.copyButton = document.createElement('button')
    this.copyButton.type = 'button'
    this.copyButton.className = 'copy-button'
    this.copyButton.setAttribute('aria-label', 'Copy code block')
    this.copyButton.title = 'Copy code block'
    this.copyButton.dataset.state = 'idle'

    this.copyIconElement = document.createElement('span')
    this.copyIconElement.className = 'note-code-block-copy-icon'
    this.copyIconElement.innerHTML = COPY_ICON_MARKUP

    this.copyStatusElement = document.createElement('span')
    this.copyStatusElement.className = 'sr-only'
    this.copyStatusElement.setAttribute('role', 'status')
    this.copyStatusElement.setAttribute('aria-live', 'polite')
    this.copyStatusElement.setAttribute('aria-atomic', 'true')

    this.copyButton.append(this.copyIconElement)

    this.preElement = document.createElement('pre')
    this.preElement.className = 'note-code-block-body'

    this.contentDOM = document.createElement('code')
    this.contentDOM.className = 'note-code-block-content'
    this.contentDOM.spellcheck = false

    this.preElement.append(this.contentDOM)
    this.dom.append(this.copyButton, this.copyStatusElement, this.preElement)

    this.copyButton.addEventListener('mousedown', this.handleCopyMouseDown)
    this.copyButton.addEventListener('click', this.handleCopyClick)

    this.syncLanguage()
  }

  update(node: ProseNode): boolean {
    if (node.type !== this.node.type) {
      return false
    }

    this.node = node
    this.syncLanguage()
    return true
  }

  stopEvent(event: Event): boolean {
    return this.copyButton.contains(event.target as Node)
  }

  ignoreMutation(mutation: MutationRecord | { type: 'selection'; target: Node }): boolean {
    if (mutation.type === 'selection') {
      return false
    }

    return !this.contentDOM.contains(mutation.target)
  }

  destroy(): void {
    this.copyButton.removeEventListener('mousedown', this.handleCopyMouseDown)
    this.copyButton.removeEventListener('click', this.handleCopyClick)
    this.clearCopyFeedbackTimeout()
  }

  private readonly handleCopyMouseDown = (event: MouseEvent): void => {
    event.preventDefault()
  }

  private readonly handleCopyClick = (): void => {
    const text = this.node.textContent

    void copyToClipboard(text)
      .then(() => {
        this.setCopyFeedback('copied')
      })
      .catch((error: unknown) => {
        this.setCopyFeedback('error')
        console.error('Failed to copy note code block:', error)
      })

    this.view.focus()
  }

  private setCopyFeedback(state: 'idle' | 'copied' | 'error'): void {
    this.clearCopyFeedbackTimeout()

    const isCopied = state === 'copied'
    const label = isCopied ? 'Code copied' : state === 'error' ? 'Copy failed' : 'Copy code block'

    this.copyButton.dataset.state = state
    this.copyButton.setAttribute('aria-label', label)
    this.copyButton.title = label
    this.copyIconElement.innerHTML = isCopied ? CHECK_ICON_MARKUP : COPY_ICON_MARKUP
    this.copyStatusElement.textContent = state === 'idle' ? '' : label

    if (state !== 'idle') {
      this.copyFeedbackTimeoutId = window.setTimeout(() => {
        this.setCopyFeedback('idle')
      }, COPY_FEEDBACK_DURATION_MS)
    }
  }

  private clearCopyFeedbackTimeout(): void {
    if (this.copyFeedbackTimeoutId === null) {
      return
    }

    window.clearTimeout(this.copyFeedbackTimeoutId)
    this.copyFeedbackTimeoutId = null
  }

  private syncLanguage(): void {
    const language = typeof this.node.attrs.language === 'string' ? this.node.attrs.language : ''
    for (const element of [this.dom, this.preElement]) {
      if (language) {
        element.setAttribute('data-language', language)
      } else {
        element.removeAttribute('data-language')
      }
    }
  }
}

export function registerNoteCodeBlockView(ctx: Ctx): void {
  const constructor: NodeViewConstructor = (node, view) => new NoteCodeBlockView(node, view)

  ctx.update(nodeViewCtx, (entries) => [
    ...entries.filter(([id]) => id !== CODE_BLOCK_NODE_NAME),
    [CODE_BLOCK_NODE_NAME, constructor] as [string, NodeViewConstructor]
  ])
}
