import type { Ctx } from '@milkdown/ctx'
import { nodeViewCtx } from '@milkdown/kit/core'
import type { Node as ProseNode } from '@milkdown/kit/prose/model'
import type { NodeView, NodeViewConstructor, EditorView } from '@milkdown/kit/prose/view'
import { codeBlockSchema } from '@milkdown/kit/preset/commonmark'

const COPY_ICON_MARKUP = [
  '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"',
  ' fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"',
  ' stroke-linejoin="round" aria-hidden="true">',
  '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>',
  '<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>',
  '</svg>'
].join('')

async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    return
  } catch {
    const element = document.createElement('textarea')
    const previouslyFocusedElement = document.activeElement
    const selection = document.getSelection()
    const originalRange = selection?.rangeCount ? selection.getRangeAt(0) : null

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
    document.execCommand('copy')
    document.body.removeChild(element)

    if (selection && originalRange) {
      selection.removeAllRanges()
      selection.addRange(originalRange)
    }

    if (previouslyFocusedElement instanceof HTMLElement) {
      previouslyFocusedElement.focus()
    }
  }
}

class NoteCodeBlockView implements NodeView {
  dom: HTMLElement
  contentDOM: HTMLElement

  private readonly toolsElement: HTMLDivElement
  private readonly copyButton: HTMLButtonElement

  constructor(
    private node: ProseNode,
    private readonly view: EditorView
  ) {
    this.dom = document.createElement('div')
    this.dom.className = 'milkdown-code-block'

    this.toolsElement = document.createElement('div')
    this.toolsElement.className = 'tools'

    const toolGroup = document.createElement('div')
    toolGroup.className = 'tools-button-group'

    this.copyButton = document.createElement('button')
    this.copyButton.type = 'button'
    this.copyButton.className = 'copy-button'
    this.copyButton.setAttribute('aria-label', 'Copy code block')

    const iconWrapper = document.createElement('span')
    iconWrapper.className = 'note-code-block-copy-icon'
    iconWrapper.innerHTML = COPY_ICON_MARKUP
    this.copyButton.append(iconWrapper, document.createTextNode('Copy'))

    toolGroup.append(this.copyButton)
    this.toolsElement.append(toolGroup)

    const preElement = document.createElement('pre')
    preElement.className = 'note-code-block-body'

    this.contentDOM = document.createElement('code')
    this.contentDOM.className = 'note-code-block-content'
    this.contentDOM.spellcheck = false

    preElement.append(this.contentDOM)
    this.dom.append(this.toolsElement, preElement)

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
    return this.toolsElement.contains(event.target as Node)
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
  }

  private readonly handleCopyMouseDown = (event: MouseEvent): void => {
    event.preventDefault()
  }

  private readonly handleCopyClick = (): void => {
    void copyToClipboard(this.node.textContent).catch((error: unknown) => {
      console.error('Failed to copy note code block:', error)
    })

    this.view.focus()
  }

  private syncLanguage(): void {
    const language = typeof this.node.attrs.language === 'string' ? this.node.attrs.language : ''
    if (language) {
      this.dom.setAttribute('data-language', language)
    } else {
      this.dom.removeAttribute('data-language')
    }
  }
}

export function registerNoteCodeBlockView(ctx: Ctx): void {
  const constructor: NodeViewConstructor = (node, view) => new NoteCodeBlockView(node, view)

  ctx.update(nodeViewCtx, (entries) => [
    ...entries.filter(([id]) => id !== codeBlockSchema.id),
    [codeBlockSchema.id, constructor] as [string, NodeViewConstructor]
  ])
}
