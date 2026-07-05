import type { Ctx } from '@milkdown/ctx'
import { editorViewCtx } from '@milkdown/kit/core'
import type { EditorView } from '@milkdown/kit/prose/view'

const pendingEditorView = Object.freeze({}) as EditorView

export function ensureEditorViewContext(ctx: Ctx): void {
  if (!ctx.isInjected(editorViewCtx)) {
    ctx.inject(editorViewCtx, pendingEditorView)
  }
}

export function hasReadyEditorView(value: unknown): value is EditorView {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<EditorView>
  return (
    typeof candidate.dispatch === 'function' &&
    typeof candidate.focus === 'function' &&
    typeof candidate.state === 'object' &&
    candidate.state !== null
  )
}
